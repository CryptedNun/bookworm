/**
 * Public Explore & Community Discovery Server Actions
 * 
 * Powers the public /explore showcase of community-created notes,
 * notebooks, and published editions.
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';

export interface ExploreNotebookItem {
  notebook_id: string;
  title: string;
  description: string | null;
  owner_id: string;
  owner_username: string;
  owner_avatar_url: string | null;
  notes_count: number;
  created_at: string;
}

export interface ExploreNoteItem {
  note_id: string;
  notebook_id: string;
  notebook_title: string;
  title: string;
  owner_username: string;
  owner_avatar_url: string | null;
  blocks_count: number;
  editions_count: number;
  canonical_edition_code?: string;
  created_at: string;
  first_block_preview?: string;
}

export interface ExploreEditionItem {
  edition_id: string;
  note_id: string;
  note_title: string;
  edition_name: string;
  share_code: string;
  author_username: string;
  created_at: string;
}

export interface ExploreDataResponse {
  success: boolean;
  notebooks: ExploreNotebookItem[];
  notes: ExploreNoteItem[];
  editions: ExploreEditionItem[];
  error?: string;
}

export async function getPublicExploreData(): Promise<ExploreDataResponse> {
  try {
    // 1. Fetch public notebooks
    const notebooksRaw = await sql`
      SELECT 
        nb.notebook_id,
        nb.title,
        nb.description,
        nb.owner_id,
        u.username as owner_username,
        u.avatar_url as owner_avatar_url,
        COUNT(DISTINCT n.note_id)::int as notes_count,
        r.created_at
      FROM notebooks nb
      JOIN users u ON u.user_id = nb.owner_id
      JOIN resources r ON r.resource_id = nb.notebook_id
      LEFT JOIN notes n ON n.notebook_id = nb.notebook_id AND n.deleted_at IS NULL
      WHERE nb.visibility = 'PUBLIC' AND nb.deleted_at IS NULL
      GROUP BY nb.notebook_id, nb.title, nb.description, nb.owner_id, u.username, u.avatar_url, r.created_at
      ORDER BY r.created_at DESC
      LIMIT 12
    ` as any[];

    // 2. Fetch public notes with block count and preview
    const notesRaw = await sql`
      SELECT 
        n.note_id,
        n.notebook_id,
        nb.title as notebook_title,
        n.title,
        u.username as owner_username,
        u.avatar_url as owner_avatar_url,
        COUNT(DISTINCT lbs.slot_id)::int as blocks_count,
        COUNT(DISTINCT e.edition_id)::int as editions_count,
        MIN(e_def.share_code) as canonical_edition_code,
        r.created_at
      FROM notes n
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      JOIN resources r ON r.resource_id = n.note_id
      JOIN users u ON u.user_id = nb.owner_id
      LEFT JOIN logical_block_slots lbs ON lbs.note_id = n.note_id
      LEFT JOIN editions e ON e.note_id = n.note_id
      LEFT JOIN editions e_def ON e_def.edition_id = n.default_edition_id
      WHERE n.visibility = 'PUBLIC' AND n.deleted_at IS NULL AND nb.deleted_at IS NULL
      GROUP BY n.note_id, n.notebook_id, nb.title, n.title, u.username, u.avatar_url, r.created_at
      ORDER BY r.created_at DESC
      LIMIT 20
    ` as any[];

    // 3. Fetch public published editions
    const editionsRaw = await sql`
      SELECT 
        e.edition_id,
        e.note_id,
        n.title as note_title,
        e.edition_name,
        e.share_code,
        u.username as author_username,
        e.created_at
      FROM editions e
      JOIN notes n ON n.note_id = e.note_id
      JOIN users u ON u.user_id = e.created_by
      WHERE n.deleted_at IS NULL
      ORDER BY e.created_at DESC
      LIMIT 12
    ` as any[];

    return {
      success: true,
      notebooks: notebooksRaw.map((nb) => ({
        notebook_id: nb.notebook_id,
        title: nb.title,
        description: nb.description,
        owner_id: nb.owner_id,
        owner_username: nb.owner_username,
        owner_avatar_url: nb.owner_avatar_url,
        notes_count: nb.notes_count || 0,
        created_at: nb.created_at || new Date().toISOString(),
      })),
      notes: notesRaw.map((n) => ({
        note_id: n.note_id,
        notebook_id: n.notebook_id,
        notebook_title: n.notebook_title,
        title: n.title,
        owner_username: n.owner_username,
        owner_avatar_url: n.owner_avatar_url,
        blocks_count: n.blocks_count || 0,
        editions_count: n.editions_count || 0,
        canonical_edition_code: n.canonical_edition_code || undefined,
        created_at: n.created_at || new Date().toISOString(),
      })),
      editions: editionsRaw.map((e) => ({
        edition_id: e.edition_id,
        note_id: e.note_id,
        note_title: e.note_title,
        edition_name: e.edition_name,
        share_code: e.share_code,
        author_username: e.author_username,
        created_at: e.created_at || new Date().toISOString(),
      })),
    };
  } catch (error: any) {
    console.error('getPublicExploreData error:', error);
    return {
      success: false,
      notebooks: [],
      notes: [],
      editions: [],
      error: error.message || 'Failed to fetch explore data',
    };
  }
}
