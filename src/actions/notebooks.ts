'use server';

import { sql } from '@/lib/db';
import { revalidatePath } from 'next/cache';

/**
 * Server Actions for Notebooks Management
 */

export interface Notebook {
  notebook_id: string;
  title: string;
  description: string | null;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED' | 'SHARED';
  created_at: Date;
  role_type: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  notes_count: number;
  owner_username?: string;
  owner_email?: string;
}

interface CreateNotebookInput {
  title: string;
  description?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  userId: string;
}

interface CreateNotebookResult {
  success: boolean;
  notebookId?: string;
  error?: string;
}

/**
 * Create a new notebook
 * 
 * Creates:
 * 1. Resource entry (ISA hierarchy)
 * 2. Notebook record
 * 3. Owner collaborator role
 */
export async function createNotebook(input: CreateNotebookInput): Promise<CreateNotebookResult> {
  try {
    // Validate inputs
    if (!input.title?.trim()) {
      return { success: false, error: 'Title is required' };
    }
    if (!input.userId) {
      return { success: false, error: 'User authentication required' };
    }

    const visibility = input.visibility || 'PUBLIC';

    // Step 1: Create resource
    const [resource] = await sql`
      INSERT INTO resources (resource_type)
      VALUES ('NOTEBOOK')
      RETURNING resource_id
    `;
    const notebookId = resource.resource_id;

    // Step 2: Create notebook
    await sql`
      INSERT INTO notebooks (
        notebook_id,
        owner_id,
        title,
        description,
        visibility
      )
      VALUES (
        ${notebookId},
        ${input.userId},
        ${input.title},
        ${input.description || ''},
        ${visibility}
      )
    `;

    // Step 3: Create owner collaborator role
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
        ${notebookId},
        'OWNER',
        ${input.userId},
        '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": true}'::jsonb
      )
    `;

    // Revalidate affected pages
    revalidatePath('/dashboard');

    return {
      success: true,
      notebookId: notebookId,
    };
  } catch (error) {
    console.error('Error creating notebook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create notebook',
    };
  }
}

/**
 * Get all notebooks for a user
 */
export async function getNotebooks(userId: string) {
  try {
    const notebooks = await sql`
      SELECT 
        nb.notebook_id,
        nb.title,
        nb.description,
        nb.visibility,
        cr.role_type,
        r.created_at,
        (SELECT COUNT(*) FROM notes n WHERE n.notebook_id = nb.notebook_id AND n.deleted_at IS NULL) as notes_count
      FROM notebooks nb
      INNER JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id
      INNER JOIN resources r ON r.resource_id = nb.notebook_id
      WHERE cr.user_id = ${userId}
        AND nb.deleted_at IS NULL
      ORDER BY r.created_at DESC
    `;

    return notebooks;
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    return [];
  }
}

/**
 * Get user notebooks (wrapper for compatibility with dashboard page)
 */
export async function getUserNotebooks() {
  try {
    // Get current user from cookie
    const { cookies: getCookies } = await import('next/headers');
    const cookieStore = await getCookies();
    const userId = cookieStore.get('session_user_id')?.value;

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const notebooks = await getNotebooks(userId);
    return { success: true, notebooks };
  } catch (error) {
    console.error('Error in getUserNotebooks:', error);
    return { success: false, error: 'Failed to fetch notebooks' };
  }
}

/**
 * Get a single notebook with details
 */
export async function getNotebook(notebookId: string, userId?: string) {
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

    const [notebook] = await sql`
      SELECT 
        nb.notebook_id,
        nb.title,
        nb.description,
        nb.visibility,
        r.created_at,
        cr.role_type,
        u.username as owner_username,
        u.email as owner_email
      FROM notebooks nb
      INNER JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id
      INNER JOIN users u ON u.user_id = nb.owner_id
      INNER JOIN resources r ON r.resource_id = nb.notebook_id
      WHERE nb.notebook_id = ${notebookId}
        AND cr.user_id = ${userId}
        AND nb.deleted_at IS NULL
    `;

    if (!notebook) {
      return { success: false, error: 'Notebook not found or no access' };
    }

    return { success: true, notebook };
  } catch (error) {
    console.error('Error fetching notebook:', error);
    return { success: false, error: 'Failed to fetch notebook' };
  }
}

/**
 * Update notebook details
 */
export async function updateNotebook(
  notebookId: string,
  updates: { title?: string; description?: string; visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED' },
  userId: string
) {
  try {
    // Verify permission
    const [permission] = await sql`
      SELECT role_type
      FROM collaborator_roles
      WHERE resource_id = ${notebookId}
        AND user_id = ${userId}
        AND role_type IN ('OWNER', 'MAINTAINER')
    `;

    if (!permission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      updateFields.push(`title = $${values.length + 1}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${values.length + 1}`);
      values.push(updates.description);
    }
    if (updates.visibility !== undefined) {
      updateFields.push(`visibility = $${values.length + 1}`);
      values.push(updates.visibility);
    }

    if (updateFields.length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    await sql`
      UPDATE notebooks
      SET ${sql.unsafe(updateFields.join(', '))},
          updated_at = NOW()
      WHERE notebook_id = ${notebookId}
    `;

    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/notebooks/${notebookId}`);

    return { success: true };
  } catch (error) {
    console.error('Error updating notebook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update notebook',
    };
  }
}

/**
 * Delete notebook (only if empty or owner wants to force delete)
 */
export async function deleteNotebook(notebookId: string, userId: string, force: boolean = false) {
  try {
    // Verify owner permission
    const [permission] = await sql`
      SELECT role_type
      FROM collaborator_roles
      WHERE resource_id = ${notebookId}
        AND user_id = ${userId}
        AND role_type = 'OWNER'
    `;

    if (!permission) {
      return { success: false, error: 'Only owners can delete notebooks' };
    }

    // Check if notebook has notes
    const [noteCount] = await sql`
      SELECT COUNT(*) as count
      FROM notes
      WHERE notebook_id = ${notebookId}
    `;

    if (!force && noteCount.count > 0) {
      return {
        success: false,
        error: `Notebook contains ${noteCount.count} notes. Delete them first or use force delete.`,
      };
    }

    // Delete notebook (CASCADE will handle related records)
    await sql`
      DELETE FROM resources
      WHERE resource_id = ${notebookId}
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error deleting notebook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete notebook',
    };
  }
}
