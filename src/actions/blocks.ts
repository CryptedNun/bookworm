/**
 * Block Server Actions
 * 
 * Operations for creating, updating, and deleting blocks
 * with content deduplication and version control
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { hashContent, getByteSize } from '@/lib/hash';
import { calculateLexoRankMidpoint } from '@/lib/lexorank';
import { revalidatePath } from 'next/cache';

/**
 * Update an existing block's content
 * 
 * Creates: new blob (if needed) → new version → new commit → new manifest
 */
export async function updateBlock(data: {
  noteId: string;
  slotId: string;
  content: string;
  commitMessage?: string;
  branchId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // 1. Resolve target branch and issue scope
    let branchRecord: {
      branch_id: string;
      is_main: boolean;
      attempted_by: string | null;
      issue_id: string | null;
      target_slot_id: string | null;
    } | undefined;

    if (data.branchId) {
      const [b] = await sql`
        SELECT b.branch_id, b.is_main, b.attempted_by, b.issue_id, i.target_slot_id
        FROM branches b
        LEFT JOIN issues i ON i.issue_id = b.issue_id
        WHERE b.branch_id = ${data.branchId} AND b.note_id = ${data.noteId}
        LIMIT 1
      ` as any[];
      branchRecord = b;
    } else {
      const [b] = await sql`
        SELECT b.branch_id, b.is_main, b.attempted_by, b.issue_id, NULL as target_slot_id
        FROM branches b
        WHERE b.note_id = ${data.noteId} AND b.is_main = TRUE
        LIMIT 1
      ` as any[];
      branchRecord = b;
    }

    if (!branchRecord) {
      return { success: false, error: 'Target branch not found' };
    }

    // 2. Enforce Permissions & Scoping
    const [role] = await sql`
      SELECT role_type, capabilities
      FROM collaborator_roles
      WHERE resource_id = ${data.noteId} AND user_id = ${user.user_id}
      LIMIT 1
    ` as any[];

    if (branchRecord.is_main) {
      if (!role || !['OWNER', 'MAINTAINER'].includes(role.role_type)) {
        return { 
          success: false, 
          error: 'Only owners and maintainers can edit the main branch directly. Create an issue to propose edits.' 
        };
      }
    } else {
      const isAttemptAuthor = branchRecord.attempted_by === user.user_id;
      const isMaintainer = role && ['OWNER', 'MAINTAINER'].includes(role.role_type);
      if (!isAttemptAuthor && !isMaintainer) {
        return { success: false, error: 'You are not authorized to edit this branch' };
      }

      // CRITICAL: Block-level scoping constraint!
      if (branchRecord.target_slot_id && branchRecord.target_slot_id !== data.slotId) {
        return {
          success: false,
          error: 'This attempt branch is strictly scoped to the targeted block. You cannot edit other blocks on this branch.',
        };
      }
    }

    // Hash content for deduplication
    const contentHash = hashContent(data.content);
    const byteSize = getByteSize(data.content);

    // Insert content blob (ON CONFLICT DO NOTHING = deduplication)
    await sql`
      INSERT INTO content_blobs (sha256, content_text, byte_size)
      VALUES (${contentHash}, ${data.content}, ${byteSize})
      ON CONFLICT (sha256) DO NOTHING
    `;

    // Create new version
    const [version] = await sql`
      INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
      VALUES (${data.slotId}, ${user.user_id}, ${contentHash})
      RETURNING version_id
    ` as { version_id: string }[];

    // 3. Get latest commit to copy manifest from (from current branch, or fallback to main)
    let [latestCommit] = await sql`
      SELECT commit_id FROM commits
      WHERE branch_id = ${branchRecord.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { commit_id: string }[];

    if (!latestCommit) {
      const [mainCommit] = await sql`
        SELECT c.commit_id 
        FROM commits c
        JOIN branches b ON b.branch_id = c.branch_id
        WHERE b.note_id = ${data.noteId} AND b.is_main = TRUE
        ORDER BY c.created_at DESC
        LIMIT 1
      ` as { commit_id: string }[];
      latestCommit = mainCommit;
    }

    // Create new commit on the target branch
    const commitHash = hashContent(JSON.stringify({
      branch_id: branchRecord.branch_id,
      author_id: user.user_id,
      timestamp: Date.now(),
      slot_id: data.slotId,
      version_id: version.version_id,
    }));

    const [newCommit] = await sql`
      INSERT INTO commits (
        branch_id,
        parent_commit_id,
        author_id,
        commit_message,
        commit_hash
      )
      VALUES (
        ${branchRecord.branch_id},
        ${latestCommit ? latestCommit.commit_id : null},
        ${user.user_id},
        ${data.commitMessage || (branchRecord.is_main ? 'Update block content' : 'Propose block revision')},
        ${commitHash}
      )
      RETURNING commit_id
    ` as { commit_id: string }[];

    // Copy previous manifest (all other slots), and explicitly insert this slot's new version
    if (latestCommit?.commit_id) {
      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        SELECT 
          ${newCommit.commit_id},
          cm.slot_id,
          cm.version_id
        FROM commit_manifests cm
        WHERE cm.commit_id = ${latestCommit.commit_id}
          AND cm.slot_id != ${data.slotId}
        ON CONFLICT (commit_id, slot_id) DO NOTHING
      `;
    }

    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      VALUES (${newCommit.commit_id}, ${data.slotId}, ${version.version_id})
      ON CONFLICT (commit_id, slot_id) DO UPDATE SET version_id = EXCLUDED.version_id
    `;

    revalidatePath(`/dashboard/notebooks/${data.noteId}`);

    return { success: true };
  } catch (error: any) {
    console.error('Update block error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update block',
    };
  }
}

/**
 * Insert a new block at a specific position
 * 
 * Creates: slot (with LexoRank) → blob → version → commit → manifest
 */
export async function insertBlock(data: {
  noteId: string;
  prevSlotId: string | null;
  nextSlotId: string | null;
  parentSlotId?: string | null;
  blockType: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE';
  content: string;
}): Promise<{ 
  success: boolean; 
  slotId?: string; 
  versionId?: string;
  lexorankKey?: string;
  blockType?: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE';
  contentText?: string;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get lexorank keys for prev/next
    let prevLexorank: string | null = null;
    let nextLexorank: string | null = null;

    if (data.prevSlotId) {
      const [prev] = await sql`
        SELECT lexorank_key FROM logical_block_slots WHERE slot_id = ${data.prevSlotId}
      ` as { lexorank_key: string }[];
      prevLexorank = prev?.lexorank_key || null;
    }

    if (data.nextSlotId) {
      const [next] = await sql`
        SELECT lexorank_key FROM logical_block_slots WHERE slot_id = ${data.nextSlotId}
      ` as { lexorank_key: string }[];
      nextLexorank = next?.lexorank_key || null;
    }

    // Calculate new lexorank
    const newLexorank = calculateLexoRankMidpoint(prevLexorank, nextLexorank);

    // Create slot with optional parent_slot_id for hierarchical nesting
    const [slot] = await sql`
      INSERT INTO logical_block_slots (note_id, parent_slot_id, lexorank_key, block_type)
      VALUES (${data.noteId}, ${data.parentSlotId || null}, ${newLexorank}, ${data.blockType}::text)
      RETURNING slot_id
    ` as { slot_id: string }[];

    // Hash and insert content
    const contentHash = hashContent(data.content);
    const byteSize = getByteSize(data.content);

    await sql`
      INSERT INTO content_blobs (sha256, content_text, byte_size)
      VALUES (${contentHash}, ${data.content}, ${byteSize})
      ON CONFLICT (sha256) DO NOTHING
    `;

    // Create version
    const [version] = await sql`
      INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
      VALUES (${slot.slot_id}, ${user.user_id}, ${contentHash})
      RETURNING version_id
    ` as { version_id: string }[];

    // Get main branch
    const [branch] = await sql`
      SELECT branch_id FROM branches
      WHERE note_id = ${data.noteId}
      AND is_main = TRUE
      LIMIT 1
    ` as { branch_id: string }[];

    // Get latest commit
    const [latestCommit] = await sql`
      SELECT commit_id FROM commits
      WHERE branch_id = ${branch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { commit_id: string }[];

    // Create new commit
    const commitHash = hashContent(JSON.stringify({
      branch_id: branch.branch_id,
      author_id: user.user_id,
      timestamp: Date.now(),
      action: 'insert',
      slot_id: slot.slot_id,
    }));

    const [newCommit] = await sql`
      INSERT INTO commits (
        branch_id,
        parent_commit_id,
        author_id,
        commit_message,
        commit_hash
      )
      VALUES (
        ${branch.branch_id},
        ${latestCommit.commit_id},
        ${user.user_id},
        ${'Insert new ' + data.blockType + ' block'},
        ${commitHash}
      )
      RETURNING commit_id
    ` as { commit_id: string }[];

    // Copy previous manifest + add new slot
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT ${newCommit.commit_id}, slot_id, version_id
      FROM commit_manifests
      WHERE commit_id = ${latestCommit.commit_id}
    `;

    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      VALUES (${newCommit.commit_id}, ${slot.slot_id}, ${version.version_id})
    `;

    revalidatePath(`/dashboard/notebooks/${data.noteId}`);

    return { 
      success: true, 
      slotId: slot.slot_id,
      versionId: version.version_id,
      lexorankKey: newLexorank,
      blockType: data.blockType,
      contentText: data.content,
    };
  } catch (error: any) {
    console.error('Insert block error:', error);
    return {
      success: false,
      error: error.message || 'Failed to insert block',
    };
  }
}

/**
 * Split a block at selection point
 * 
 * Handles three cases:
 * 1. Selection from beginning: Creates new block with selected text, updates original with remainder
 * 2. Selection from middle: Keeps prefix in original, creates new block with selected text, creates third block with suffix
 * 3. Selection from end: Updates original with prefix, creates new block with selected text
 * 
 * LexoRank positioning ensures correct ordering
 */
export async function splitBlock(data: {
  noteId: string;
  originalSlotId: string;
  originalContent: string;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  newBlockType?: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE';
}): Promise<{ success: boolean; error?: string; newSlotIds?: string[] }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Validate selection
    if (data.selectionStart < 0 || data.selectionEnd > data.originalContent.length || data.selectionStart >= data.selectionEnd) {
      return { success: false, error: 'Invalid selection' };
    }

    // Extract parts
    const beforeSelection = data.originalContent.substring(0, data.selectionStart);
    const selectedText = data.originalContent.substring(data.selectionStart, data.selectionEnd);
    const afterSelection = data.originalContent.substring(data.selectionEnd);

    // Get original block info
    const [originalBlock] = await sql`
      SELECT lexorank_key, block_type FROM logical_block_slots
      WHERE slot_id = ${data.originalSlotId}
    ` as { lexorank_key: string; block_type: string }[];

    if (!originalBlock) {
      return { success: false, error: 'Original block not found' };
    }

    // Get the next block's lexorank
    const [nextBlock] = await sql`
      SELECT slot_id, lexorank_key FROM logical_block_slots
      WHERE note_id = ${data.noteId}
      AND lexorank_key > ${originalBlock.lexorank_key}
      ORDER BY lexorank_key ASC
      LIMIT 1
    ` as { slot_id: string; lexorank_key: string }[];

    const nextLexorank = nextBlock?.lexorank_key || null;
    const newBlockType = data.newBlockType || originalBlock.block_type as any;

    // Get main branch
    const [branch] = await sql`
      SELECT branch_id FROM branches
      WHERE note_id = ${data.noteId}
      AND is_main = TRUE
      LIMIT 1
    ` as { branch_id: string }[];

    // Get latest commit
    const [latestCommit] = await sql`
      SELECT commit_id FROM commits
      WHERE branch_id = ${branch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { commit_id: string }[];

    const newSlotIds: string[] = [];

    // Determine split strategy
    const isFromBeginning = data.selectionStart === 0;
    const isToEnd = data.selectionEnd === data.originalContent.length;
    const isMiddle = !isFromBeginning && !isToEnd;

    if (isFromBeginning && isToEnd) {
      // Edge case: entire block selected - just convert block type if different
      if (newBlockType !== originalBlock.block_type) {
        // Update block type
        await sql`
          UPDATE logical_block_slots
          SET block_type = ${newBlockType}::text
          WHERE slot_id = ${data.originalSlotId}
        `;
      }
      // No split needed
      return { success: true, newSlotIds: [] };
    }

    // Calculate LexoRanks for new blocks
    let firstNewLexorank: string;
    let secondNewLexorank: string | null = null;

    if (isFromBeginning) {
      // Case 1: Selection from beginning
      // Original block gets: afterSelection
      // New block (between original and next) gets: selectedText
      
      firstNewLexorank = calculateLexoRankMidpoint(originalBlock.lexorank_key, nextLexorank);

      // Update original block with remainder
      const remainderHash = hashContent(afterSelection);
      const remainderSize = getByteSize(afterSelection);

      await sql`
        INSERT INTO content_blobs (sha256, content_text, byte_size)
        VALUES (${remainderHash}, ${afterSelection}, ${remainderSize})
        ON CONFLICT (sha256) DO NOTHING
      `;

      const [remainderVersion] = await sql`
        INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
        VALUES (${data.originalSlotId}, ${user.user_id}, ${remainderHash})
        RETURNING version_id
      ` as { version_id: string }[];

      // Create new block with selected text
      const [newSlot] = await sql`
        INSERT INTO logical_block_slots (note_id, parent_slot_id, lexorank_key, block_type)
        VALUES (${data.noteId}, NULL, ${firstNewLexorank}, ${newBlockType}::text)
        RETURNING slot_id
      ` as { slot_id: string }[];

      newSlotIds.push(newSlot.slot_id);

      const selectedHash = hashContent(selectedText);
      const selectedSize = getByteSize(selectedText);

      await sql`
        INSERT INTO content_blobs (sha256, content_text, byte_size)
        VALUES (${selectedHash}, ${selectedText}, ${selectedSize})
        ON CONFLICT (sha256) DO NOTHING
      `;

      const [selectedVersion] = await sql`
        INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
        VALUES (${newSlot.slot_id}, ${user.user_id}, ${selectedHash})
        RETURNING version_id
      ` as { version_id: string }[];

      // Create commit
      const commitHash = hashContent(JSON.stringify({
        branch_id: branch.branch_id,
        author_id: user.user_id,
        timestamp: Date.now(),
        action: 'split_from_beginning',
      }));

      const [newCommit] = await sql`
        INSERT INTO commits (
          branch_id,
          parent_commit_id,
          author_id,
          commit_message,
          commit_hash
        )
        VALUES (
          ${branch.branch_id},
          ${latestCommit.commit_id},
          ${user.user_id},
          'Split block from beginning',
          ${commitHash}
        )
        RETURNING commit_id
      ` as { commit_id: string }[];

      // Update manifest
      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        SELECT 
          ${newCommit.commit_id},
          cm.slot_id,
          CASE 
            WHEN cm.slot_id = ${data.originalSlotId} THEN ${remainderVersion.version_id}
            ELSE cm.version_id
          END
        FROM commit_manifests cm
        WHERE cm.commit_id = ${latestCommit.commit_id}
      `;

      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        VALUES (${newCommit.commit_id}, ${newSlot.slot_id}, ${selectedVersion.version_id})
      `;

    } else if (isToEnd) {
      // Case 2: Selection to end
      // Original block gets: beforeSelection
      // New block (between original and next) gets: selectedText

      firstNewLexorank = calculateLexoRankMidpoint(originalBlock.lexorank_key, nextLexorank);

      // Update original block with prefix
      const prefixHash = hashContent(beforeSelection);
      const prefixSize = getByteSize(beforeSelection);

      await sql`
        INSERT INTO content_blobs (sha256, content_text, byte_size)
        VALUES (${prefixHash}, ${beforeSelection}, ${prefixSize})
        ON CONFLICT (sha256) DO NOTHING
      `;

      const [prefixVersion] = await sql`
        INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
        VALUES (${data.originalSlotId}, ${user.user_id}, ${prefixHash})
        RETURNING version_id
      ` as { version_id: string }[];

      // Create new block with selected text
      const [newSlot] = await sql`
        INSERT INTO logical_block_slots (note_id, parent_slot_id, lexorank_key, block_type)
        VALUES (${data.noteId}, NULL, ${firstNewLexorank}, ${newBlockType}::text)
        RETURNING slot_id
      ` as { slot_id: string }[];

      newSlotIds.push(newSlot.slot_id);

      const selectedHash = hashContent(selectedText);
      const selectedSize = getByteSize(selectedText);

      await sql`
        INSERT INTO content_blobs (sha256, content_text, byte_size)
        VALUES (${selectedHash}, ${selectedText}, ${selectedSize})
        ON CONFLICT (sha256) DO NOTHING
      `;

      const [selectedVersion] = await sql`
        INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
        VALUES (${newSlot.slot_id}, ${user.user_id}, ${selectedHash})
        RETURNING version_id
      ` as { version_id: string }[];

      // Create commit
      const commitHash = hashContent(JSON.stringify({
        branch_id: branch.branch_id,
        author_id: user.user_id,
        timestamp: Date.now(),
        action: 'split_to_end',
      }));

      const [newCommit] = await sql`
        INSERT INTO commits (
          branch_id,
          parent_commit_id,
          author_id,
          commit_message,
          commit_hash
        )
        VALUES (
          ${branch.branch_id},
          ${latestCommit.commit_id},
          ${user.user_id},
          'Split block to end',
          ${commitHash}
        )
        RETURNING commit_id
      ` as { commit_id: string }[];

      // Update manifest
      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        SELECT 
          ${newCommit.commit_id},
          cm.slot_id,
          CASE 
            WHEN cm.slot_id = ${data.originalSlotId} THEN ${prefixVersion.version_id}
            ELSE cm.version_id
          END
        FROM commit_manifests cm
        WHERE cm.commit_id = ${latestCommit.commit_id}
      `;

      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        VALUES (${newCommit.commit_id}, ${newSlot.slot_id}, ${selectedVersion.version_id})
      `;

    } else {
      // Case 3: Selection from middle
      // Original block gets: beforeSelection
      // First new block (between original and next) gets: selectedText
      // Second new block (between first new and next) gets: afterSelection

      firstNewLexorank = calculateLexoRankMidpoint(originalBlock.lexorank_key, nextLexorank);
      secondNewLexorank = calculateLexoRankMidpoint(firstNewLexorank, nextLexorank);

      // Update original block with prefix
      const prefixHash = hashContent(beforeSelection);
      const prefixSize = getByteSize(beforeSelection);

      await sql`
        INSERT INTO content_blobs (sha256, content_text, byte_size)
        VALUES (${prefixHash}, ${beforeSelection}, ${prefixSize})
        ON CONFLICT (sha256) DO NOTHING
      `;

      const [prefixVersion] = await sql`
        INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
        VALUES (${data.originalSlotId}, ${user.user_id}, ${prefixHash})
        RETURNING version_id
      ` as { version_id: string }[];

      // Create first new block with selected text
      const [firstNewSlot] = await sql`
        INSERT INTO logical_block_slots (note_id, parent_slot_id, lexorank_key, block_type)
        VALUES (${data.noteId}, NULL, ${firstNewLexorank}, ${newBlockType}::text)
        RETURNING slot_id
      ` as { slot_id: string }[];

      newSlotIds.push(firstNewSlot.slot_id);

      const selectedHash = hashContent(selectedText);
      const selectedSize = getByteSize(selectedText);

      await sql`
        INSERT INTO content_blobs (sha256, content_text, byte_size)
        VALUES (${selectedHash}, ${selectedText}, ${selectedSize})
        ON CONFLICT (sha256) DO NOTHING
      `;

      const [selectedVersion] = await sql`
        INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
        VALUES (${firstNewSlot.slot_id}, ${user.user_id}, ${selectedHash})
        RETURNING version_id
      ` as { version_id: string }[];

      // Create second new block with suffix
      const [secondNewSlot] = await sql`
        INSERT INTO logical_block_slots (note_id, parent_slot_id, lexorank_key, block_type)
        VALUES (${data.noteId}, NULL, ${secondNewLexorank}, ${originalBlock.block_type}::text)
        RETURNING slot_id
      ` as { slot_id: string }[];

      newSlotIds.push(secondNewSlot.slot_id);

      const suffixHash = hashContent(afterSelection);
      const suffixSize = getByteSize(afterSelection);

      await sql`
        INSERT INTO content_blobs (sha256, content_text, byte_size)
        VALUES (${suffixHash}, ${afterSelection}, ${suffixSize})
        ON CONFLICT (sha256) DO NOTHING
      `;

      const [suffixVersion] = await sql`
        INSERT INTO block_version_contents (slot_id, author_id, content_blob_hash)
        VALUES (${secondNewSlot.slot_id}, ${user.user_id}, ${suffixHash})
        RETURNING version_id
      ` as { version_id: string }[];

      // Create commit
      const commitHash = hashContent(JSON.stringify({
        branch_id: branch.branch_id,
        author_id: user.user_id,
        timestamp: Date.now(),
        action: 'split_from_middle',
      }));

      const [newCommit] = await sql`
        INSERT INTO commits (
          branch_id,
          parent_commit_id,
          author_id,
          commit_message,
          commit_hash
        )
        VALUES (
          ${branch.branch_id},
          ${latestCommit.commit_id},
          ${user.user_id},
          'Split block from middle',
          ${commitHash}
        )
        RETURNING commit_id
      ` as { commit_id: string }[];

      // Update manifest
      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        SELECT 
          ${newCommit.commit_id},
          cm.slot_id,
          CASE 
            WHEN cm.slot_id = ${data.originalSlotId} THEN ${prefixVersion.version_id}
            ELSE cm.version_id
          END
        FROM commit_manifests cm
        WHERE cm.commit_id = ${latestCommit.commit_id}
      `;

      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        VALUES 
          (${newCommit.commit_id}, ${firstNewSlot.slot_id}, ${selectedVersion.version_id}),
          (${newCommit.commit_id}, ${secondNewSlot.slot_id}, ${suffixVersion.version_id})
      `;
    }

    revalidatePath(`/dashboard/notebooks/${data.noteId}`);

    return { success: true, newSlotIds };
  } catch (error: any) {
    console.error('Split block error:', error);
    return {
      success: false,
      error: error.message || 'Failed to split block',
    };
  }
}

/**
 * Reorder blocks by updating LexoRank keys
 * 
 * When blocks are dragged, we need to:
 * 1. Calculate new LexoRank for the moved block
 * 2. Update the slot's lexorank_key
 * 3. Create a new commit documenting the reorder
 */
export async function reorderBlock(data: {
  noteId: string;
  slotId: string;
  newPrevSlotId: string | null;
  newNextSlotId: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get lexorank keys for new neighbors
    let prevLexorank: string | null = null;
    let nextLexorank: string | null = null;

    if (data.newPrevSlotId) {
      const [prev] = await sql`
        SELECT lexorank_key FROM logical_block_slots WHERE slot_id = ${data.newPrevSlotId}
      ` as { lexorank_key: string }[];
      prevLexorank = prev?.lexorank_key || null;
    }

    if (data.newNextSlotId) {
      const [next] = await sql`
        SELECT lexorank_key FROM logical_block_slots WHERE slot_id = ${data.newNextSlotId}
      ` as { lexorank_key: string }[];
      nextLexorank = next?.lexorank_key || null;
    }

    // Calculate new lexorank position
    const newLexorank = calculateLexoRankMidpoint(prevLexorank, nextLexorank);

    // Update the slot's lexorank
    await sql`
      UPDATE logical_block_slots
      SET lexorank_key = ${newLexorank}
      WHERE slot_id = ${data.slotId}
      AND note_id = ${data.noteId}
    `;

    // Get main branch
    const [branch] = await sql`
      SELECT branch_id FROM branches
      WHERE note_id = ${data.noteId}
      AND is_main = TRUE
      LIMIT 1
    ` as { branch_id: string }[];

    if (!branch) {
      return { success: false, error: 'Note has no main branch' };
    }

    // Get latest commit
    const [latestCommit] = await sql`
      SELECT commit_id FROM commits
      WHERE branch_id = ${branch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { commit_id: string }[];

    // Create new commit
    const commitHash = hashContent(JSON.stringify({
      branch_id: branch.branch_id,
      author_id: user.user_id,
      timestamp: Date.now(),
      action: 'reorder',
      slot_id: data.slotId,
      new_lexorank: newLexorank,
    }));

    const [newCommit] = await sql`
      INSERT INTO commits (
        branch_id,
        parent_commit_id,
        author_id,
        commit_message,
        commit_hash
      )
      VALUES (
        ${branch.branch_id},
        ${latestCommit.commit_id},
        ${user.user_id},
        'Reorder blocks',
        ${commitHash}
      )
      RETURNING commit_id
    ` as { commit_id: string }[];

    // Copy entire previous manifest (structure changed, not content)
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT ${newCommit.commit_id}, slot_id, version_id
      FROM commit_manifests
      WHERE commit_id = ${latestCommit.commit_id}
    `;

    revalidatePath(`/dashboard/notebooks/${data.noteId}`);

    return { success: true };
  } catch (error: any) {
    console.error('Reorder block error:', error);
    return {
      success: false,
      error: error.message || 'Failed to reorder block',
    };
  }
}

/**
 * Delete a block (removes from manifest, doesn't delete slot)
 */
export async function deleteBlock(data: {
  noteId: string;
  slotId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get main branch
    const [branch] = await sql`
      SELECT branch_id FROM branches
      WHERE note_id = ${data.noteId}
      AND is_main = TRUE
      LIMIT 1
    ` as { branch_id: string }[];

    // Get latest commit
    const [latestCommit] = await sql`
      SELECT commit_id FROM commits
      WHERE branch_id = ${branch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { commit_id: string }[];

    // Create new commit
    const commitHash = hashContent(JSON.stringify({
      branch_id: branch.branch_id,
      author_id: user.user_id,
      timestamp: Date.now(),
      action: 'delete',
      slot_id: data.slotId,
    }));

    const [newCommit] = await sql`
      INSERT INTO commits (
        branch_id,
        parent_commit_id,
        author_id,
        commit_message,
        commit_hash
      )
      VALUES (
        ${branch.branch_id},
        ${latestCommit.commit_id},
        ${user.user_id},
        'Delete block',
        ${commitHash}
      )
      RETURNING commit_id
    ` as { commit_id: string }[];

    // Copy previous manifest EXCLUDING deleted slot
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT ${newCommit.commit_id}, slot_id, version_id
      FROM commit_manifests
      WHERE commit_id = ${latestCommit.commit_id}
      AND slot_id != ${data.slotId}
    `;

    revalidatePath(`/dashboard/notebooks/${data.noteId}`);

    return { success: true };
  } catch (error: any) {
    console.error('Delete block error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete block',
    };
  }
}

/**
 * Update block parent hierarchy (Indent / Outdent)
 */
export async function setBlockParent(data: {
  noteId: string;
  slotId: string;
  parentSlotId: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Avoid self-parenting
    if (data.parentSlotId && data.parentSlotId === data.slotId) {
      return { success: false, error: 'A block cannot be its own parent' };
    }

    await sql`
      UPDATE logical_block_slots
      SET parent_slot_id = ${data.parentSlotId}
      WHERE slot_id = ${data.slotId} AND note_id = ${data.noteId}
    `;

    revalidatePath(`/dashboard/notebooks/${data.noteId}`);
    return { success: true };
  } catch (error: any) {
    console.error('setBlockParent error:', error);
    return { success: false, error: error.message || 'Failed to update parent hierarchy' };
  }
}

export interface BlockVersionHistoryItem {
  version_id: string;
  slot_id: string;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  content_text: string;
  sha256: string;
  byte_size: number;
  created_at: string;
}

/**
 * Fetch chronological version history of a block ("Blame" / Revision Timeline)
 */
export async function getBlockHistory(
  slotId: string
): Promise<{ success: boolean; history?: BlockVersionHistoryItem[]; error?: string }> {
  try {
    const history = await sql`
      SELECT 
        bvc.version_id,
        bvc.slot_id,
        bvc.author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url,
        cb.content_text,
        cb.sha256,
        cb.byte_size,
        bvc.created_at
      FROM block_version_contents bvc
      JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
      JOIN users u ON u.user_id = bvc.author_id
      WHERE bvc.slot_id = ${slotId}
      ORDER BY bvc.created_at DESC
    ` as BlockVersionHistoryItem[];

    return { success: true, history };
  } catch (error: any) {
    console.error('getBlockHistory error:', error);
    return { success: false, error: error.message || 'Failed to fetch block history' };
  }
}

/**
 * Restore an earlier historical version of a block
 */
export async function restoreBlockVersion(data: {
  noteId: string;
  slotId: string;
  versionId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Verify version belongs to this slot
    const [version] = await sql`
      SELECT version_id, content_blob_hash 
      FROM block_version_contents
      WHERE version_id = ${data.versionId} AND slot_id = ${data.slotId}
    ` as { version_id: string; content_blob_hash: string }[];

    if (!version) {
      return { success: false, error: 'Target version not found for this block' };
    }

    // Get main branch
    const [branch] = await sql`
      SELECT branch_id FROM branches
      WHERE note_id = ${data.noteId} AND is_main = TRUE
      LIMIT 1
    ` as { branch_id: string }[];

    if (!branch) {
      return { success: false, error: 'Note has no main branch' };
    }

    // Get latest commit
    const [latestCommit] = await sql`
      SELECT commit_id FROM commits
      WHERE branch_id = ${branch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { commit_id: string }[];

    // Create restore commit
    const commitHash = hashContent(JSON.stringify({
      branch_id: branch.branch_id,
      author_id: user.user_id,
      timestamp: Date.now(),
      action: 'restore_version',
      slot_id: data.slotId,
      version_id: data.versionId,
    }));

    const [newCommit] = await sql`
      INSERT INTO commits (
        branch_id,
        parent_commit_id,
        author_id,
        commit_message,
        commit_hash
      )
      VALUES (
        ${branch.branch_id},
        ${latestCommit.commit_id},
        ${user.user_id},
        ${'Revert block to version ' + data.versionId.substring(0, 8)},
        ${commitHash}
      )
      RETURNING commit_id
    ` as { commit_id: string }[];

    // Copy manifest with restored version pointer
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT 
        ${newCommit.commit_id},
        cm.slot_id,
        CASE 
          WHEN cm.slot_id = ${data.slotId} THEN ${data.versionId}::uuid
          ELSE cm.version_id
        END
      FROM commit_manifests cm
      WHERE cm.commit_id = ${latestCommit.commit_id}
    `;

    revalidatePath(`/dashboard/notebooks/${data.noteId}`);
    return { success: true };
  } catch (error: any) {
    console.error('restoreBlockVersion error:', error);
    return { success: false, error: error.message || 'Failed to restore block version' };
  }
}

/**
 * Rebalance LexoRank keys for a note (FAQ Q7 in bookworm.md)
 * Redistributes keys cleanly spaced across generation 1: 1|100000, 1|200000, etc.
 */
export async function rebalanceNoteBlocks(
  noteId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions to rebalance note' };
    }

    // Fetch all slots ordered by current lexorank
    const slots = await sql`
      SELECT slot_id, lexorank_key
      FROM logical_block_slots
      WHERE note_id = ${noteId}
      ORDER BY lexorank_key ASC
    ` as { slot_id: string; lexorank_key: string }[];

    if (slots.length === 0) {
      return { success: true, count: 0 };
    }

    // Calculate evenly spaced keys
    const STEP = 100000;
    for (let i = 0; i < slots.length; i++) {
      const newKey = `1|${((i + 1) * STEP).toString().padStart(6, '0')}`;
      await sql`
        UPDATE logical_block_slots
        SET lexorank_key = ${newKey}
        WHERE slot_id = ${slots[i].slot_id}
      `;
    }

    revalidatePath(`/dashboard/notebooks/${noteId}`);
    return { success: true, count: slots.length };
  } catch (error: any) {
    console.error('rebalanceNoteBlocks error:', error);
    return { success: false, error: error.message || 'Failed to rebalance blocks' };
  }
}
