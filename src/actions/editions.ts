'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from '@/actions/auth';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export interface EditionItem {
  edition_id: string;
  note_id: string;
  edition_name: string;
  share_code: string;
  pinned_commit_id: string;
  is_standard: boolean;
  created_by: string;
  created_at: Date | string;
  author_username?: string;
  author_name?: string;
  commit_hash?: string;
  commit_message?: string;
  blocks_count?: number;
}

export interface PublicEditionData {
  edition_id: string;
  edition_name: string;
  share_code: string;
  note_id: string;
  note_title: string;
  pinned_commit_id: string;
  created_at: Date | string;
  publisher: {
    username: string;
    avatar_url: string | null;
  };
  blocks: Array<{
    slot_id: string;
    block_type: string;
    lexorank_key: string;
    content_text: string;
    sha256: string;
  }>;
}

/**
 * Helper to generate a clean URL slug from edition name
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Publish a new immutable snapshot edition of a note
 */
export async function publishEdition({
  noteId,
  editionName,
  shareCode,
  isStandard = false,
}: {
  noteId: string;
  editionName: string;
  shareCode?: string;
  isStandard?: boolean;
}): Promise<{ success: boolean; edition?: EditionItem; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    const cleanName = (editionName || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Edition name is required (e.g., "v1.0.0" or "Final Draft").' };
    }

    // 1. Verify Note & Permissions
    const [note] = await sql`
      SELECT n.note_id, n.notebook_id, n.title
      FROM notes n
      WHERE n.note_id = ${noteId} AND n.deleted_at IS NULL
    `;

    if (!note) {
      return { success: false, error: 'Note not found.' };
    }

    // Check permission (OWNER or MAINTAINER on note or parent notebook)
    const [noteRole] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${noteId} AND user_id = ${user.user_id}
    `;

    const [notebookRole] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${note.notebook_id} AND user_id = ${user.user_id}
    `;

    const effectiveRole = noteRole?.role_type || notebookRole?.role_type;
    if (effectiveRole !== 'OWNER' && effectiveRole !== 'MAINTAINER') {
      return {
        success: false,
        error: 'Forbidden. Publishing an edition requires OWNER or MAINTAINER permissions.',
      };
    }

    // 2. Fetch latest commit from main branch
    const [mainBranch] = await sql`
      SELECT branch_id FROM branches
      WHERE note_id = ${noteId} AND is_main = TRUE
      LIMIT 1
    `;

    if (!mainBranch) {
      return { success: false, error: 'Main branch not found for note.' };
    }

    const [latestCommit] = await sql`
      SELECT commit_id, commit_hash, commit_message
      FROM commits
      WHERE branch_id = ${mainBranch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!latestCommit) {
      return { success: false, error: 'Cannot publish edition without an initial commit.' };
    }

    // 3. Generate unique share code
    let finalShareCode = (shareCode || '').trim().toLowerCase();
    if (!finalShareCode) {
      const baseSlug = slugify(cleanName) || 'edition';
      const randSuffix = Math.random().toString(36).substring(2, 7);
      finalShareCode = `${baseSlug}-${randSuffix}`;
    } else {
      finalShareCode = slugify(finalShareCode);
    }

    // Ensure share_code is unique
    const [existingCode] = await sql`
      SELECT edition_id FROM editions WHERE share_code = ${finalShareCode} LIMIT 1
    `;
    if (existingCode) {
      finalShareCode = `${finalShareCode}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const editionId = randomUUID();

    // 4. If this edition is standard, unmark previous standard editions for this note
    if (isStandard) {
      await sql`
        UPDATE editions
        SET is_standard = FALSE
        WHERE note_id = ${noteId}
      `;
    }

    // 5. Insert Edition
    const [newEdition] = await sql`
      INSERT INTO editions (
        edition_id,
        note_id,
        edition_name,
        share_code,
        pinned_commit_id,
        is_standard,
        created_by,
        created_at
      ) VALUES (
        ${editionId},
        ${noteId},
        ${cleanName},
        ${finalShareCode},
        ${latestCommit.commit_id},
        ${isStandard},
        ${user.user_id},
        now()
      )
      RETURNING *
    `;

    // 6. Update default_edition_id if isStandard
    if (isStandard) {
      await sql`
        UPDATE notes
        SET default_edition_id = ${editionId}
        WHERE note_id = ${noteId}
      `;
    }

    revalidatePath(`/dashboard/notebooks/${note.notebook_id}/notes/${noteId}`);
    revalidatePath(`/e/${finalShareCode}`);

    return {
      success: true,
      edition: {
        ...newEdition,
        commit_hash: latestCommit.commit_hash,
        commit_message: latestCommit.commit_message,
        author_username: user.username,
      } as any as EditionItem,
    };
  } catch (error: any) {
    console.error('Error publishing edition:', error);
    return { success: false, error: error.message || 'Failed to publish edition' };
  }
}

/**
 * Fetch all published editions for a note
 */
export async function getNoteEditions(noteId: string): Promise<{
  success: boolean;
  editions?: EditionItem[];
  error?: string;
}> {
  try {
    const editions = await sql`
      SELECT 
        e.edition_id,
        e.note_id,
        e.edition_name,
        e.share_code,
        e.pinned_commit_id,
        e.is_standard,
        e.created_by,
        e.created_at,
        u.username as author_username,
        c.commit_hash,
        c.commit_message,
        (
          SELECT COUNT(*)::int 
          FROM commit_manifests cm 
          WHERE cm.commit_id = e.pinned_commit_id
        ) as blocks_count
      FROM editions e
      JOIN users u ON u.user_id = e.created_by
      JOIN commits c ON c.commit_id = e.pinned_commit_id
      WHERE e.note_id = ${noteId}
      ORDER BY e.created_at DESC
    `;

    return {
      success: true,
      editions: editions as any,
    };
  } catch (error: any) {
    console.error('Error fetching editions:', error);
    return { success: false, error: 'Failed to fetch editions' };
  }
}

/**
 * Public Reader: Fetch an edition by its public share code
 * No authentication required!
 */
export async function getPublicEdition(shareCode: string): Promise<{
  success: boolean;
  edition?: PublicEditionData;
  error?: string;
}> {
  try {
    const cleanCode = (shareCode || '').trim().toLowerCase();

    // 1. Fetch Edition and Note details
    const [edition] = await sql`
      SELECT 
        e.edition_id,
        e.edition_name,
        e.share_code,
        e.pinned_commit_id,
        e.created_at,
        n.note_id,
        n.title as note_title,
        u.username as publisher_username,
        u.avatar_url as publisher_avatar
      FROM editions e
      JOIN notes n ON n.note_id = e.note_id
      JOIN users u ON u.user_id = e.created_by
      WHERE LOWER(e.share_code) = ${cleanCode}
      LIMIT 1
    `;

    if (!edition) {
      return { success: false, error: 'Edition not found. It may have been unpublished or removed.' };
    }

    // 2. Fetch pinned blocks from CAS (Content-Addressed Storage)
    const blocks = await sql`
      SELECT 
        lbs.slot_id,
        lbs.block_type,
        lbs.lexorank_key,
        cb.content_text,
        cb.sha256
      FROM commit_manifests cm
      JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
      JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
      JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
      WHERE cm.commit_id = ${edition.pinned_commit_id}
      ORDER BY lbs.lexorank_key ASC
    `;

    return {
      success: true,
      edition: {
        edition_id: edition.edition_id,
        edition_name: edition.edition_name,
        share_code: edition.share_code,
        note_id: edition.note_id,
        note_title: edition.note_title,
        pinned_commit_id: edition.pinned_commit_id,
        created_at: edition.created_at,
        publisher: {
          username: edition.publisher_username,
          avatar_url: edition.publisher_avatar,
        },
        blocks: blocks as any,
      },
    };
  } catch (error: any) {
    console.error('Error fetching public edition:', error);
    return { success: false, error: 'Failed to load public edition' };
  }
}

/**
 * Delete an edition snapshot (OWNER / MAINTAINER only)
 */
export async function deleteEdition(editionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const [edition] = await sql`
      SELECT e.edition_id, e.note_id, n.notebook_id
      FROM editions e
      JOIN notes n ON n.note_id = e.note_id
      WHERE e.edition_id = ${editionId}
    `;

    if (!edition) {
      return { success: false, error: 'Edition not found' };
    }

    // Check permissions
    const [role] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id IN (${edition.note_id}, ${edition.notebook_id})
        AND user_id = ${user.user_id}
        AND role_type IN ('OWNER', 'MAINTAINER')
      LIMIT 1
    `;

    if (!role) {
      return { success: false, error: 'Forbidden. Owner or Maintainer role required to delete editions.' };
    }

    await sql`DELETE FROM editions WHERE edition_id = ${editionId}`;

    revalidatePath(`/dashboard/notebooks/${edition.notebook_id}/notes/${edition.note_id}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting edition:', error);
    return { success: false, error: error.message || 'Failed to delete edition' };
  }
}
