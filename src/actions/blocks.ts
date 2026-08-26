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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission (only OWNER/MAINTAINER can edit)
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.noteId}
      AND user_id = ${user.user_id}
      AND role_type IN ('OWNER', 'MAINTAINER')
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Insufficient permissions to edit this note' };
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

    // Get latest commit to copy its manifest
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
        ${branch.branch_id},
        ${latestCommit.commit_id},
        ${user.user_id},
        ${data.commitMessage || 'Update block content'},
        ${commitHash}
      )
      RETURNING commit_id
    ` as { commit_id: string }[];

    // Copy previous manifest, updating this slot's version
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT 
        ${newCommit.commit_id},
        cm.slot_id,
        CASE 
          WHEN cm.slot_id = ${data.slotId} THEN ${version.version_id}
          ELSE cm.version_id
        END
      FROM commit_manifests cm
      WHERE cm.commit_id = ${latestCommit.commit_id}
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
  blockType: 'PARAGRAPH' | 'HEADING' | 'CODE' | 'QUOTE';
  content: string;
}): Promise<{ success: boolean; slotId?: string; error?: string }> {
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

    // Create slot
    const [slot] = await sql`
      INSERT INTO logical_block_slots (note_id, parent_slot_id, lexorank_key, block_type)
      VALUES (${data.noteId}, NULL, ${newLexorank}, ${data.blockType})
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
        'Insert new ${data.blockType} block',
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

    return { success: true, slotId: slot.slot_id };
  } catch (error: any) {
    console.error('Insert block error:', error);
    return {
      success: false,
      error: error.message || 'Failed to insert block',
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
