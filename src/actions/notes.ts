'use server';

import { sql } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { createHash } from 'crypto';

/**
 * Server Actions for Notes Management
 * 
 * Note creation requires creating the entire chain:
 * resource → note → branch (main) → commit → slot → version → blob → manifest
 */

export interface Note {
  note_id: string;
  title: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED' | 'SHARED';
  display_order: number;
  created_at: Date;
  notebook_id: string;
  default_edition?: string | null;
  default_edition_id?: string | null;
  role_type: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  notebook_title?: string;
}

interface CreateNoteInput {
  title: string;
  notebookId: string;
  description?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  userId: string; // From auth
}

interface CreateNoteResult {
  success: boolean;
  noteId?: string;
  error?: string;
}

/**
 * Create a new note with initial commit and main branch
 * 
 * This is a complex transaction that creates:
 * 1. Resource entry (ISA hierarchy)
 * 2. Note record
 * 3. Main branch
 * 4. Initial logical block slot (title heading)
 * 5. Content blob (SHA-256 addressed)
 * 6. Block version
 * 7. Initial commit
 * 8. Commit manifest
 * 9. Owner collaborator role
 * 10. Default edition
 */
export async function createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
  try {
    // Validate inputs
    if (!input.title?.trim()) {
      return { success: false, error: 'Title is required' };
    }
    if (!input.notebookId) {
      return { success: false, error: 'Notebook is required' };
    }
    if (!input.userId) {
      return { success: false, error: 'User authentication required' };
    }

    // Verify notebook exists and user has permission
    const [notebook] = await sql`
      SELECT nb.notebook_id, cr.role_type
      FROM notebooks nb
      INNER JOIN collaborator_roles cr 
        ON cr.resource_id = nb.notebook_id
      WHERE nb.notebook_id = ${input.notebookId}
        AND cr.user_id = ${input.userId}
        AND cr.role_type IN ('OWNER', 'MAINTAINER')
    `;

    if (!notebook) {
      return { success: false, error: 'Notebook not found or insufficient permissions' };
    }

    const visibility = input.visibility || 'PUBLIC';
    const initialContent = `# ${input.title}\n\n${input.description || 'Start writing here...'}`;

    // Calculate content hash for deduplication
    const contentHash = createHash('sha256')
      .update(initialContent, 'utf8')
      .digest('hex');

    const byteSize = Buffer.byteLength(initialContent, 'utf8');

    // Get highest display_order to append note
    const [maxOrder] = await sql`
      SELECT COALESCE(MAX(display_order), 0) as max_order
      FROM notes
      WHERE notebook_id = ${input.notebookId}
    `;
    const displayOrder = (maxOrder?.max_order || 0) + 1;

    // Step 1: Create resource
    const [resource] = await sql`
      INSERT INTO resources (resource_type)
      VALUES ('NOTE')
      RETURNING resource_id
    `;
    const noteId = resource.resource_id;

    // Step 2: Create note
    await sql`
      INSERT INTO notes (
        note_id,
        notebook_id,
        title,
        visibility,
        display_order
      )
      VALUES (
        ${noteId},
        ${input.notebookId},
        ${input.title},
        ${visibility},
        ${displayOrder}
      )
    `;

    // Step 3: Create main branch
    const [branch] = await sql`
      INSERT INTO branches (
        note_id,
        branch_name,
        is_main,
        is_merged
      )
      VALUES (
        ${noteId},
        'main',
        TRUE,
        FALSE
      )
      RETURNING branch_id
    `;
    const branchId = branch.branch_id;

    // Step 4: Create initial logical block slot
    const [slot] = await sql`
      INSERT INTO logical_block_slots (
        note_id,
        parent_slot_id,
        lexorank_key,
        block_type
      )
      VALUES (
        ${noteId},
        NULL,
        '1|100000',
        'PARAGRAPH'
      )
      RETURNING slot_id
    `;
    const slotId = slot.slot_id;

    // Step 5: Create content blob (with deduplication)
    await sql`
      INSERT INTO content_blobs (
        sha256,
        content_text,
        byte_size
      )
      VALUES (
        ${contentHash},
        ${initialContent},
        ${byteSize}
      )
      ON CONFLICT (sha256) DO NOTHING
    `;

    // Step 6: Create block version
    const [version] = await sql`
      INSERT INTO block_version_contents (
        slot_id,
        author_id,
        content_blob_hash
      )
      VALUES (
        ${slotId},
        ${input.userId},
        ${contentHash}
      )
      RETURNING version_id
    `;
    const versionId = version.version_id;

    // Step 7: Create initial commit
    const commitMessage = 'Initial commit';
    const commitHash = createHash('sha256')
      .update(`${noteId}:${branchId}:${commitMessage}:${Date.now()}`, 'utf8')
      .digest('hex');

    const [commit] = await sql`
      INSERT INTO commits (
        branch_id,
        parent_commit_id,
        author_id,
        commit_message,
        commit_hash
      )
      VALUES (
        ${branchId},
        NULL,
        ${input.userId},
        ${commitMessage},
        ${commitHash}
      )
      RETURNING commit_id
    `;
    const commitId = commit.commit_id;

    // Step 8: Create commit manifest
    await sql`
      INSERT INTO commit_manifests (
        commit_id,
        slot_id,
        version_id
      )
      VALUES (
        ${commitId},
        ${slotId},
        ${versionId}
      )
    `;

    // Step 9: Create owner collaborator role
    await sql`
      INSERT INTO collaborator_roles (
        user_id,
        resource_id,
        role_type,
        granted_by,
        capabilities
      )
        VALUES (
          ${input.userId},
          ${noteId},
          'OWNER',
          ${input.userId},
          '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb
        )
      `;

    // Step 10: Create default edition
    const [edition] = await sql`
      INSERT INTO editions (
        note_id,
        edition_name,
        share_code,
        pinned_commit_id,
        is_standard,
        created_by
      )
      VALUES (
        ${noteId},
        'Draft',
        ${noteId.substring(0, 8)},
        ${commitId},
        TRUE,
        ${input.userId}
      )
      RETURNING edition_id
    `;

    // Step 11: Update note with default edition
    await sql`
      UPDATE notes
      SET default_edition_id = ${edition.edition_id}
      WHERE note_id = ${noteId}
    `;

    // Revalidate affected pages
    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/notebooks/${input.notebookId}`);

    return {
      success: true,
      noteId: noteId,
    };
  } catch (error) {
    console.error('Error creating note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create note',
    };
  }
}

/**
 * Get notes for a notebook
 */
export async function getNotesForNotebook(notebookId: string, userId: string) {
  try {
    const notes = await sql`
      SELECT 
        n.note_id,
        n.title,
        n.visibility,
        n.display_order,
        r.created_at,
        e.edition_name as default_edition,
        cr.role_type,
        (SELECT COUNT(*) FROM logical_block_slots lbs WHERE lbs.note_id = n.note_id) as blocks_count,
        (SELECT COUNT(*) FROM branches b WHERE b.note_id = n.note_id AND b.is_main = FALSE) as branches_count,
        (SELECT COUNT(*) FROM issues i WHERE i.note_id = n.note_id AND i.status IN ('OPEN', 'IN_PROGRESS')) as open_issues_count
      FROM notes n
      INNER JOIN collaborator_roles cr ON cr.resource_id = n.note_id
      INNER JOIN resources r ON r.resource_id = n.note_id
      LEFT JOIN editions e ON e.edition_id = n.default_edition_id
      WHERE n.notebook_id = ${notebookId}
        AND cr.user_id = ${userId}
        AND n.deleted_at IS NULL
      ORDER BY n.display_order ASC, r.created_at DESC
    `;

    return notes;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
}

/**
 * Update note display order (for drag-and-drop reordering)
 */
export async function updateNoteOrder(noteId: string, newOrder: number, userId: string) {
  try {
    // Verify permission
    const [permission] = await sql`
      SELECT role_type
      FROM collaborator_roles
      WHERE resource_id = ${noteId}
        AND user_id = ${userId}
        AND role_type IN ('OWNER', 'MAINTAINER')
    `;

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Update order
    await sql`
      UPDATE notes
      SET display_order = ${newOrder}
      WHERE note_id = ${noteId}
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error updating note order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order',
    };
  }
}

/**
 * Delete note (soft delete by setting visibility)
 */
export async function deleteNote(noteId: string, userId: string) {
  try {
    // Verify owner permission
    const [permission] = await sql`
      SELECT role_type
      FROM collaborator_roles
      WHERE resource_id = ${noteId}
        AND user_id = ${userId}
        AND role_type = 'OWNER'
    `;

    if (!permission) {
      return { success: false, error: 'Only owners can delete notes' };
    }

    // Soft delete - could also use a deleted_at timestamp
    await sql`
      UPDATE notes
      SET visibility = 'PRIVATE'
      WHERE note_id = ${noteId}
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete note',
    };
  }
}

/**
 * Get a single note with details
 */
export async function getNote(noteId: string, userId?: string) {
  try {
    // If userId not provided, get from cookie
    if (!userId) {
      const { cookies: getCookies } = await import('next/headers');
      const cookieStore = await getCookies();
      userId = cookieStore.get('session_user_id')?.value;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }
    }

    const [note] = await sql`
      SELECT 
        n.note_id,
        n.title,
        n.visibility,
        n.display_order,
        r.created_at,
        n.notebook_id,
        e.edition_name as default_edition,
        e.edition_id as default_edition_id,
        cr.role_type,
        nb.title as notebook_title
      FROM notes n
      INNER JOIN collaborator_roles cr ON cr.resource_id = n.note_id
      INNER JOIN resources r ON r.resource_id = n.note_id
      INNER JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      LEFT JOIN editions e ON e.edition_id = n.default_edition_id
      WHERE n.note_id = ${noteId}
        AND cr.user_id = ${userId}
        AND n.deleted_at IS NULL
    `;

    if (!note) {
      return { success: false, error: 'Note not found or no access' };
    }

    return { success: true, note };
  } catch (error) {
    console.error('Error fetching note:', error);
    return { success: false, error: 'Failed to fetch note' };
  }
}

/**
 * Get note with blocks from a specific branch (for editing)
 */
export async function getNoteWithBlocks(noteId: string, branchId?: string) {
  try {
    // Get current user from cookie
    const { cookies: getCookies } = await import('next/headers');
    const cookieStore = await getCookies();
    const userId = cookieStore.get('session_user_id')?.value;
    
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get note metadata
    const noteResult = await getNote(noteId, userId);
    if (!noteResult.success || !noteResult.note) {
      return noteResult;
    }

    // Determine which branch/commit to load blocks from
    let commitId: string | null = null;
    
    if (branchId) {
      // Get latest commit from specified branch
      const [latestCommit] = await sql`
        SELECT commit_id
        FROM commits
        WHERE branch_id = ${branchId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      commitId = latestCommit?.commit_id;
    } else {
      // Get latest commit from main branch
      const [mainBranch] = await sql`
        SELECT branch_id
        FROM branches
        WHERE note_id = ${noteId} AND is_main = TRUE
      `;
      
      if (mainBranch) {
        const [latestCommit] = await sql`
          SELECT commit_id
          FROM commits
          WHERE branch_id = ${mainBranch.branch_id}
          ORDER BY created_at DESC
          LIMIT 1
        `;
        commitId = latestCommit?.commit_id;
      }
    }

    // If no commit found, return empty blocks
    if (!commitId) {
      return { 
        success: true, 
        note: { ...noteResult.note, blocks: [] } 
      };
    }

    // Get blocks from commit manifest
    const blocks = await sql`
      SELECT 
        lbs.slot_id,
        lbs.block_type,
        lbs.lexorank_key,
        lbs.parent_slot_id,
        bvc.version_id,
        cb.content_text,
        cb.sha256
      FROM commit_manifests cm
      INNER JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
      INNER JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
      INNER JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
      WHERE cm.commit_id = ${commitId}
      ORDER BY lbs.lexorank_key ASC
    `;

    return { 
      success: true, 
      note: { ...noteResult.note, blocks } 
    };
  } catch (error) {
    console.error('Error fetching note with blocks:', error);
    return { success: false, error: 'Failed to fetch note' };
  }
}

/**
 * Get notebook notes with their content (for reading view)
 */
export async function getNotebookNotesWithContent(notebookId: string, userId?: string) {
  try {
    // If userId not provided, get from cookie
    if (!userId) {
      const { cookies: getCookies } = await import('next/headers');
      const cookieStore = await getCookies();
      userId = cookieStore.get('session_user_id')?.value;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }
    }

    // First get the notes
    const notes = await sql`
      SELECT 
        n.note_id,
        n.title,
        n.visibility,
        n.display_order,
        r.created_at,
        e.edition_name as default_edition,
        e.pinned_commit_id,
        cr.role_type
      FROM notes n
      INNER JOIN collaborator_roles cr ON cr.resource_id = n.note_id
      INNER JOIN resources r ON r.resource_id = n.note_id
      LEFT JOIN editions e ON e.edition_id = n.default_edition_id
      WHERE n.notebook_id = ${notebookId}
        AND cr.user_id = ${userId}
        AND n.deleted_at IS NULL
      ORDER BY n.display_order ASC, r.created_at DESC
    `;

    // For each note, get its content from the main branch latest commit
    const notesWithContent = await Promise.all(
      notes.map(async (note) => {
        // Get main branch for this note
        const [mainBranch] = await sql`
          SELECT branch_id
          FROM branches
          WHERE note_id = ${note.note_id} AND is_main = TRUE
        `;

        if (!mainBranch) {
          return { ...note, blocks: [], content: '' };
        }

        // Get latest commit from main branch
        const [latestCommit] = await sql`
          SELECT commit_id
          FROM commits
          WHERE branch_id = ${mainBranch.branch_id}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (!latestCommit) {
          return { ...note, blocks: [], content: '' };
        }

        // Get all blocks in this commit
        const blocks = await sql`
          SELECT 
            lbs.slot_id,
            lbs.block_type,
            lbs.lexorank_key,
            lbs.parent_slot_id,
            bvc.version_id,
            cb.content_text,
            cb.sha256
          FROM commit_manifests cm
          INNER JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
          INNER JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
          INNER JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
          WHERE cm.commit_id = ${latestCommit.commit_id}
          ORDER BY lbs.lexorank_key ASC
        `;

        // Convert blocks to markdown content for reading view
        const content = blocks.map((block: any) => {
          const text = block.content_text || '';
          
          // Format based on block type
          switch (block.block_type) {
            case 'HEADING':
              return `## ${text}`;
            case 'CODE':
              return `\`\`\`\n${text}\n\`\`\``;
            case 'QUOTE':
              return `> ${text}`;
            case 'PARAGRAPH':
            default:
              return text;
          }
        }).join('\n\n');

        return { ...note, blocks, content };
      })
    );

    return { success: true, notes: notesWithContent };
  } catch (error) {
    console.error('Error fetching notebook notes with content:', error);
    return { success: false, error: 'Failed to fetch notes' };
  }
}
