/**
 * Starred Resources & Bookmarks Server Actions
 * 
 * Allows users to star / bookmark favorite notes and notebooks
 * for quick access from the dashboard.
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

export interface StarredResourceItem {
  resource_id: string;
  resource_type: 'NOTEBOOK' | 'NOTE';
  title: string;
  notebook_id?: string;
  notebook_title?: string;
  starred_at: string;
}

/**
 * Toggle star/unstar on a resource
 */
export async function toggleStarResource(
  resourceId: string
): Promise<{ success: boolean; isStarred?: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if already starred
    const [existing] = await sql`
      SELECT 1 FROM user_starred_resources
      WHERE user_id = ${user.user_id} AND resource_id = ${resourceId}
    ` as { '?column?': number }[];

    if (existing) {
      // Unstar
      await sql`
        DELETE FROM user_starred_resources
        WHERE user_id = ${user.user_id} AND resource_id = ${resourceId}
      `;
      revalidatePath('/dashboard');
      return { success: true, isStarred: false };
    } else {
      // Star
      await sql`
        INSERT INTO user_starred_resources (user_id, resource_id)
        VALUES (${user.user_id}, ${resourceId})
        ON CONFLICT DO NOTHING
      `;
      revalidatePath('/dashboard');
      return { success: true, isStarred: true };
    }
  } catch (error: any) {
    console.error('toggleStarResource error:', error);
    return { success: false, error: error.message || 'Failed to toggle star' };
  }
}

/**
 * Check if a resource is starred by user
 */
export async function isResourceStarred(
  resourceId: string,
  userId?: string
): Promise<boolean> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const user = await getCurrentUser();
      targetUserId = user?.user_id;
    }

    if (!targetUserId) return false;

    const [row] = await sql`
      SELECT 1 FROM user_starred_resources
      WHERE user_id = ${targetUserId} AND resource_id = ${resourceId}
      LIMIT 1
    ` as { '?column?': number }[];

    return !!row;
  } catch (error) {
    console.error('isResourceStarred error:', error);
    return false;
  }
}

/**
 * Get all starred resources for the current user
 */
export async function getUserStarredResources(
  userId?: string
): Promise<{ success: boolean; items?: StarredResourceItem[]; error?: string }> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const user = await getCurrentUser();
      targetUserId = user?.user_id;
    }

    if (!targetUserId) {
      return { success: true, items: [] };
    }

    // Fetch starred notebooks and notes via resources ISA supertype
    const raw = await sql`
      SELECT 
        usr.resource_id,
        r.resource_type,
        usr.created_at as starred_at,
        COALESCE(nb.title, n.title) as title,
        n.notebook_id,
        nb_parent.title as notebook_title
      FROM user_starred_resources usr
      JOIN resources r ON r.resource_id = usr.resource_id
      LEFT JOIN notebooks nb ON nb.notebook_id = usr.resource_id AND nb.deleted_at IS NULL
      LEFT JOIN notes n ON n.note_id = usr.resource_id AND n.deleted_at IS NULL
      LEFT JOIN notebooks nb_parent ON nb_parent.notebook_id = n.notebook_id
      WHERE usr.user_id = ${targetUserId}
      ORDER BY usr.created_at DESC
    ` as {
      resource_id: string;
      resource_type: string;
      starred_at: string;
      title: string;
      notebook_id: string | null;
      notebook_title: string | null;
    }[];

    const items: StarredResourceItem[] = raw.map((r) => ({
      resource_id: r.resource_id,
      resource_type: r.resource_type as any,
      title: r.title,
      notebook_id: r.notebook_id || undefined,
      notebook_title: r.notebook_title || undefined,
      starred_at: r.starred_at,
    }));

    return { success: true, items };
  } catch (error: any) {
    console.error('getUserStarredResources error:', error);
    return { success: false, error: error.message || 'Failed to fetch starred items' };
  }
}
