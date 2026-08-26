/**
 * Note CRUD Server Actions
 * 
 * Handles note creation with full version control initialization:
 * - ISA hierarchy (resource → note)
 * - Main branch creation
 * - Initial commit with empty content
 * - Commit manifest
 * - OWNER role assignment
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { createHash } from 'crypto';

/**
 * Note type matching database schema
 */
export interface Note {
  note_id: string;
  notebook_id: string;
  title: string;
  forked_from_note_id: string | null;
  default_edition_id: string | null;
  display_order: number;
  deleted_at: string | null;
  visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  created_at: string;
  // Joined fields
  notebook_title?: string;
  owner_username?: string;
  commits_count?: number;
  branches_count?: number;
}

/**
 * Helper: Create SHA-256 hash for content deduplication
 */
function hashContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Helper: Calculate byte size
 */
function getByteSize(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/**
 * Create a new note with full version control initialization
 * 
 * This is the most complex operation in the system, requiring:
 * 1. Resource (ISA supertype)
 * 2. Note (ISA subtype)
 * 3. Main branch
 * 4. Initial commit
 * 5. OWNER role in collaborator_roles
 * 
 * All in a single atomic transaction.
 * 
 * @param data - Note creation data
 * @returns Created note or error
 */
export async function createNote(data: {
  notebookId: string;
  title: string;
  visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
}): Promise<{ success: boolean; note?: Note; error?: string }> {
  try {
    // 1. Authenticate
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // 2. Validate input
    if (!data.title?.trim()) {
      return { success: false, error: 'Note title is required' };
    }

    if (data.title.length > 200) {
      return { success: false, error: 'Title must be 200 characters or less' };
    }

    // 3. Check permission on notebook
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${data.notebookId}
      AND user_id = ${user.user_id}
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'You do not have access to this notebook' };
    }

    // 4. Get next display order
    const [orderResult] = await sql`
      SELECT COALESCE(MAX(display_order), -1) + 1 as next_order
      FROM notes
      WHERE notebook_id = ${data.notebookId}
      AND deleted_at IS NULL
    ` as { next_order: number }[];

    // 5. Execute complex note creation
    const visibility = data.visibility || 'PRIVATE';

    // Step 1: Create resource (ISA supertype)
    const [resource] = await sql`
      INSERT INTO resources (resource_type)
      VALUES ('NOTE')
      RETURNING resource_id, created_at
    ` as { resource_id: string; created_at: string }[];

    const noteId = resource.resource_id;

    // Step 2: Create note (ISA subtype)
    const [note] = await sql`
      INSERT INTO notes (
        note_id, 
        notebook_id, 
        title, 
        display_order, 
        visibility
      )
      VALUES (
        ${noteId},
        ${data.notebookId},
        ${data.title.trim()},
        ${orderResult.next_order},
        ${visibility}
      )
      RETURNING *
    ` as Note[];

    // Step 3: Create main branch
    const [branch] = await sql`
      INSERT INTO branches (
        note_id,
        branch_name,
        is_main,
        issue_id,
        created_by
      )
      VALUES (
        ${noteId},
        'main',
        TRUE,
        NULL,
        ${user.user_id}
      )
      RETURNING branch_id
    ` as { branch_id: string }[];

    // Step 4: Create initial commit with empty content
    const initialMessage = 'Initial commit: Note created';
    
    await sql`
      INSERT INTO commits (
        branch_id,
        parent_commit_id,
        commit_message,
        author_id
      )
      VALUES (
        ${branch.branch_id},
        NULL,
        ${initialMessage},
        ${user.user_id}
      )
    `;

    // Step 5: Grant OWNER role to creator
    await sql`
      INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by)
      VALUES (
        ${user.user_id},
        ${noteId},
        'OWNER',
        ${user.user_id}
      )
    `;

    const result = {
      ...note,
      created_at: resource.created_at,
      commits_count: 1,
      branches_count: 1,
    };

    // 6. Revalidate
    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/notebooks/${data.notebookId}`);

    return { success: true, note: result };
  } catch (error: any) {
    console.error('Create note error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create note',
    };
  }
}

/**
 * Get all notes in a notebook with their latest content
 * 
 * Fetches notes with stitched content from the latest commit on main branch
 * Following the 3-layer architecture: slots → versions → blobs
 */
/**
 * Get a single note with all its blocks from the latest commit on main branch
 * 
 * Returns full block data including: slot_id, lexorank, block_type, content, version metadata
 */
export async function getNote(noteId: string): Promise<{
  success: boolean;
  note?: Note & {
    blocks: Array<{
      slot_id: string;
      lexorank_key: string;
      block_type: string;
      content_text: string;
      version_id: string;
      author_username: string;
      created_at: string;
    }>;
    latest_commit_id: string;
    branch_id: string;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get note metadata
    const [noteData] = await sql`
      SELECT 
        n.note_id,
        n.notebook_id,
        n.title,
        n.forked_from_note_id,
        n.default_edition_id,
        n.display_order,
        n.deleted_at,
        n.visibility,
        r.created_at,
        nb.title as notebook_title,
        u.username as owner_username
      FROM notes n
      INNER JOIN resources r ON r.resource_id = n.note_id
      INNER JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      INNER JOIN users u ON u.user_id = nb.owner_id
      WHERE n.note_id = ${noteId}
        AND n.deleted_at IS NULL
    ` as Note[];

    if (!noteData) {
      return { success: false, error: 'Note not found' };
    }

    // Check permission
    const [permission] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${noteId}
      AND user_id = ${user.user_id}
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Access denied to this note' };
    }

    // Get main branch
    const [mainBranch] = await sql`
      SELECT branch_id
      FROM branches
      WHERE note_id = ${noteId}
      AND is_main = TRUE
      LIMIT 1
    ` as { branch_id: string }[];

    if (!mainBranch) {
      return { success: false, error: 'Note has no main branch' };
    }

    // Get latest commit on main branch
    const [latestCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${mainBranch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { commit_id: string }[];

    if (!latestCommit) {
      // Note exists but has no commits yet (shouldn't happen with proper creation)
      return {
        success: true,
        note: {
          ...noteData,
          blocks: [],
          latest_commit_id: '',
          branch_id: mainBranch.branch_id,
        },
      };
    }

    // Get all blocks for this commit
    const blocks = await sql`
      SELECT 
        lbs.slot_id,
        lbs.lexorank_key,
        lbs.block_type,
        cb.content_text,
        bvc.version_id,
        bvc.created_at,
        u.username as author_username
      FROM commit_manifests cm
      INNER JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
      INNER JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
      INNER JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
      INNER JOIN users u ON u.user_id = bvc.author_id
      WHERE cm.commit_id = ${latestCommit.commit_id}
      ORDER BY lbs.lexorank_key ASC
    ` as Array<{
      slot_id: string;
      lexorank_key: string;
      block_type: string;
      content_text: string;
      version_id: string;
      author_username: string;
      created_at: string;
    }>;

    return {
      success: true,
      note: {
        ...noteData,
        blocks,
        latest_commit_id: latestCommit.commit_id,
        branch_id: mainBranch.branch_id,
      },
    };
  } catch (error: any) {
    console.error('Get note error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch note',
    };
  }
}

export async function getNotebookNotesWithContent(notebookId: string): Promise<{
  success: boolean;
  notes?: Array<Note & { content: string }>;
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
      WHERE resource_id = ${notebookId}
      AND user_id = ${user.user_id}
    ` as { role_type: string }[];

    if (!permission) {
      return { success: false, error: 'Access denied to this notebook' };
    }

    // Get all notes in the notebook
    const notesData = await sql`
      SELECT 
        n.note_id,
        n.notebook_id,
        n.title,
        n.forked_from_note_id,
        n.default_edition_id,
        n.display_order,
        n.deleted_at,
        n.visibility,
        r.created_at,
        nb.title as notebook_title,
        u.username as owner_username
      FROM notes n
      INNER JOIN resources r ON r.resource_id = n.note_id
      INNER JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      INNER JOIN users u ON u.user_id = nb.owner_id
      WHERE n.notebook_id = ${notebookId}
        AND n.deleted_at IS NULL
      ORDER BY n.display_order ASC, r.created_at DESC
    ` as Note[];

    // For each note, get content from latest commit on main branch
    const notesWithContent = await Promise.all(
      notesData.map(async (note) => {
        // Get main branch for this note
        const [mainBranch] = await sql`
          SELECT branch_id
          FROM branches
          WHERE note_id = ${note.note_id}
          AND is_main = TRUE
          LIMIT 1
        ` as { branch_id: string }[];

        if (!mainBranch) {
          return { ...note, content: '' };
        }

        // Get latest commit on main branch
        const [latestCommit] = await sql`
          SELECT commit_id
          FROM commits
          WHERE branch_id = ${mainBranch.branch_id}
          ORDER BY created_at DESC
          LIMIT 1
        ` as { commit_id: string }[];

        if (!latestCommit) {
          return { ...note, content: '' };
        }

        // Get all content for this commit by joining through the 3 layers
        const contentBlocks = await sql`
          SELECT 
            lbs.lexorank_key,
            cb.content_text
          FROM commit_manifests cm
          INNER JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
          INNER JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
          INNER JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
          WHERE cm.commit_id = ${latestCommit.commit_id}
          ORDER BY lbs.lexorank_key ASC
        ` as Array<{ lexorank_key: string; content_text: string }>;

        // Stitch content together
        const content = contentBlocks
          .map((block) => block.content_text)
          .join('\n\n');

        return { ...note, content };
      })
    );

    return { success: true, notes: notesWithContent };
  } catch (error: any) {
    console.error('Get notebook notes with content error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch notes',
    };
  }
}


/**
 * Update note metadata
 * 
 * User must have OWNER or MAINTAINER role
 */
export async function updateNote(
  noteId: string,
  data: {
    title?: string;
    visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  }
): Promise<{ success: boolean; note?: Note; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permission
    const [role] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${noteId}
      AND user_id = ${user.user_id}
    ` as { role_type: string }[];

    if (!role || !['OWNER', 'MAINTAINER'].includes(role.role_type)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Build update
    const updates: string[] = [];
    if (data.title?.trim()) {
      await sql`UPDATE notes SET title = ${data.title.trim()} WHERE note_id = ${noteId}`;
    }
    if (data.visibility) {
      await sql`UPDATE notes SET visibility = ${data.visibility} WHERE note_id = ${noteId}`;
    }

    // Fetch updated note
    const result = await getNote(noteId);

    revalidatePath('/dashboard');

    return result;
  } catch (error: any) {
    console.error('Update note error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update note',
    };
  }
}

/**
 * Soft delete a note
 * 
 * Only OWNER can delete
 */
export async function deleteNote(noteId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if user is OWNER
    const [role] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${noteId}
      AND user_id = ${user.user_id}
    ` as { role_type: string }[];

    if (!role || role.role_type !== 'OWNER') {
      return { success: false, error: 'Only note owner can delete' };
    }

    // Soft delete
    await sql`
      UPDATE notes
      SET deleted_at = NOW()
      WHERE note_id = ${noteId}
      AND deleted_at IS NULL
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Delete note error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete note',
    };
  }
}
