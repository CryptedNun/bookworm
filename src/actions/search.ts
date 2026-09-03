/**
 * Global Full-Text Search Server Actions
 * 
 * Provides unified, permission-aware searching across notebooks, notes,
 * content text blobs, issues, and published editions.
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';

export interface SearchResultItem {
  id: string;
  type: 'NOTEBOOK' | 'NOTE' | 'BLOCK' | 'ISSUE' | 'EDITION';
  title: string;
  subtitle: string;
  snippet?: string;
  url: string;
}

export interface GlobalSearchResponse {
  success: boolean;
  results?: {
    notebooks: SearchResultItem[];
    notes: SearchResultItem[];
    blocks: SearchResultItem[];
    issues: SearchResultItem[];
    editions: SearchResultItem[];
    totalCount: number;
  };
  error?: string;
}

export async function globalSearch(query: string): Promise<GlobalSearchResponse> {
  try {
    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length < 2) {
      return {
        success: true,
        results: {
          notebooks: [],
          notes: [],
          blocks: [],
          issues: [],
          editions: [],
          totalCount: 0,
        },
      };
    }

    const user = await getCurrentUser();
    const userId = user?.user_id || '00000000-0000-0000-0000-000000000000';
    const searchPattern = `%${trimmed}%`;

    // 1. Search Notebooks (Owned, Collaborated, or Public)
    const notebooksRaw = await sql`
      SELECT DISTINCT 
        nb.notebook_id,
        nb.title,
        nb.description,
        nb.visibility,
        u.username as owner_username
      FROM notebooks nb
      JOIN users u ON u.user_id = nb.owner_id
      LEFT JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id AND cr.user_id = ${userId}
      WHERE nb.deleted_at IS NULL
        AND (nb.visibility = 'PUBLIC' OR nb.owner_id = ${userId} OR cr.user_id IS NOT NULL)
        AND (nb.title ILIKE ${searchPattern} OR COALESCE(nb.description, '') ILIKE ${searchPattern})
      ORDER BY nb.title ASC
      LIMIT 8
    ` as {
      notebook_id: string;
      title: string;
      description: string | null;
      visibility: string;
      owner_username: string;
    }[];

    const notebooks: SearchResultItem[] = notebooksRaw.map((nb) => ({
      id: nb.notebook_id,
      type: 'NOTEBOOK',
      title: nb.title,
      subtitle: `Notebook • by @${nb.owner_username} • ${nb.visibility.toLowerCase()}`,
      snippet: nb.description || undefined,
      url: `/dashboard/notebooks/${nb.notebook_id}`,
    }));

    // 2. Search Notes
    const notesRaw = await sql`
      SELECT DISTINCT
        n.note_id,
        n.notebook_id,
        n.title,
        n.visibility,
        nb.title as notebook_title
      FROM notes n
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      LEFT JOIN collaborator_roles cr ON cr.resource_id = n.note_id AND cr.user_id = ${userId}
      LEFT JOIN collaborator_roles cr_nb ON cr_nb.resource_id = nb.notebook_id AND cr_nb.user_id = ${userId}
      WHERE n.deleted_at IS NULL
        AND nb.deleted_at IS NULL
        AND (n.visibility = 'PUBLIC' OR nb.owner_id = ${userId} OR cr.user_id IS NOT NULL OR cr_nb.user_id IS NOT NULL)
        AND n.title ILIKE ${searchPattern}
      ORDER BY n.title ASC
      LIMIT 10
    ` as {
      note_id: string;
      notebook_id: string;
      title: string;
      visibility: string;
      notebook_title: string;
    }[];

    const notes: SearchResultItem[] = notesRaw.map((n) => ({
      id: n.note_id,
      type: 'NOTE',
      title: n.title,
      subtitle: `Note in "${n.notebook_title}" • ${n.visibility.toLowerCase()}`,
      url: `/dashboard/notebooks/${n.notebook_id}/notes/${n.note_id}`,
    }));

    // 3. Search Content Blobs in accessible notes (deep text search)
    const blocksRaw = await sql`
      SELECT DISTINCT
        cb.sha256,
        cb.content_text,
        lbs.slot_id,
        lbs.block_type,
        n.note_id,
        n.notebook_id,
        n.title as note_title
      FROM content_blobs cb
      JOIN block_version_contents bvc ON bvc.content_blob_hash = cb.sha256
      JOIN commit_manifests cm ON cm.version_id = bvc.version_id
      JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
      JOIN notes n ON n.note_id = lbs.note_id
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      LEFT JOIN collaborator_roles cr ON cr.resource_id = n.note_id AND cr.user_id = ${userId}
      LEFT JOIN collaborator_roles cr_nb ON cr_nb.resource_id = nb.notebook_id AND cr_nb.user_id = ${userId}
      WHERE n.deleted_at IS NULL
        AND nb.deleted_at IS NULL
        AND (n.visibility = 'PUBLIC' OR nb.owner_id = ${userId} OR cr.user_id IS NOT NULL OR cr_nb.user_id IS NOT NULL)
        AND cb.content_text ILIKE ${searchPattern}
      LIMIT 8
    ` as {
      sha256: string;
      content_text: string;
      slot_id: string;
      block_type: string;
      note_id: string;
      notebook_id: string;
      note_title: string;
    }[];

    const blocks: SearchResultItem[] = blocksRaw.map((b) => {
      // Extract excerpt around search term
      const lowerText = b.content_text.toLowerCase();
      const lowerQuery = trimmed.toLowerCase();
      const matchIdx = lowerText.indexOf(lowerQuery);
      const start = Math.max(0, matchIdx - 40);
      const end = Math.min(b.content_text.length, matchIdx + lowerQuery.length + 40);
      const excerpt = (start > 0 ? '...' : '') + b.content_text.substring(start, end).replace(/\n/g, ' ') + (end < b.content_text.length ? '...' : '');

      return {
        id: b.slot_id,
        type: 'BLOCK',
        title: `Text in "${b.note_title}"`,
        subtitle: `Block (${b.block_type}) • SHA: ${b.sha256.substring(0, 8)}...`,
        snippet: excerpt,
        url: `/dashboard/notebooks/${b.notebook_id}/notes/${b.note_id}#${b.slot_id}`,
      };
    });

    // 4. Search Issues
    const issuesRaw = await sql`
      SELECT 
        i.issue_id,
        i.title,
        i.status,
        i.note_id,
        n.notebook_id,
        n.title as note_title
      FROM issues i
      JOIN notes n ON n.note_id = i.note_id
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      LEFT JOIN collaborator_roles cr ON cr.resource_id = n.note_id AND cr.user_id = ${userId}
      WHERE (n.visibility = 'PUBLIC' OR nb.owner_id = ${userId} OR cr.user_id IS NOT NULL)
        AND i.title ILIKE ${searchPattern}
      ORDER BY i.created_at DESC
      LIMIT 6
    ` as {
      issue_id: string;
      title: string;
      status: string;
      note_id: string;
      notebook_id: string;
      note_title: string;
    }[];

    const issues: SearchResultItem[] = issuesRaw.map((i) => ({
      id: i.issue_id,
      type: 'ISSUE',
      title: i.title,
      subtitle: `Issue on "${i.note_title}" • [${i.status}]`,
      url: `/dashboard/notebooks/${i.notebook_id}/notes/${i.note_id}/issues`,
    }));

    // 5. Search Published Editions
    const editionsRaw = await sql`
      SELECT 
        e.edition_id,
        e.edition_name,
        e.share_code,
        n.title as note_title
      FROM editions e
      JOIN notes n ON n.note_id = e.note_id
      WHERE e.edition_name ILIKE ${searchPattern} OR e.share_code ILIKE ${searchPattern}
      LIMIT 6
    ` as {
      edition_id: string;
      edition_name: string;
      share_code: string;
      note_title: string;
    }[];

    const editions: SearchResultItem[] = editionsRaw.map((e) => ({
      id: e.edition_id,
      type: 'EDITION',
      title: `${e.note_title} (${e.edition_name})`,
      subtitle: `Published Edition • /e/${e.share_code}`,
      url: `/e/${e.share_code}`,
    }));

    const totalCount = notebooks.length + notes.length + blocks.length + issues.length + editions.length;

    return {
      success: true,
      results: {
        notebooks,
        notes,
        blocks,
        issues,
        editions,
        totalCount,
      },
    };
  } catch (error: any) {
    console.error('globalSearch error:', error);
    return { success: false, error: error.message || 'Search failed' };
  }
}
