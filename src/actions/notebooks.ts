/**
 * Notebook CRUD Server Actions
 * 
 * Handles notebook creation, retrieval, update, and deletion.
 * Implements ISA hierarchy (resource → notebook) with proper transactions.
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';

/**
 * Notebook type matching database schema
 */
export interface Notebook {
  notebook_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  deleted_at: string | null;
  visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  created_at: string;
  // Joined fields
  owner_username?: string;
  owner_email?: string;
  notes_count?: number;
}

/**
 * Create a new notebook
 * 
 * Transaction steps:
 * 1. Insert into resources (ISA supertype)
 * 2. Insert into notebooks (ISA subtype)
 * 3. Grant OWNER role to creator in collaborator_roles
 * 
 * @param data - Notebook creation data
 * @returns Created notebook or error
 */
export async function createNotebook(data: {
  title: string;
  description?: string;
  visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
}): Promise<{ success: boolean; notebook?: Notebook; error?: string }> {
  console.log('createNotebook called with:', { title: data.title, visibility: data.visibility });
  
  try {
    // 1. Authenticate
    const user = await getCurrentUser();
    if (!user) {
      console.error('createNotebook: No authenticated user');
      return { success: false, error: 'Authentication required' };
    }

    console.log('createNotebook: User authenticated:', user.username);

    // 2. Validate input
    if (!data.title?.trim()) {
      return { success: false, error: 'Notebook title is required' };
    }

    if (data.title.length > 200) {
      return { success: false, error: 'Title must be 200 characters or less' };
    }

    // 3. Execute transaction (ISA hierarchy + permissions)
    const visibility = data.visibility || 'PRIVATE';
    const description = data.description?.trim() || null;

    console.log('createNotebook: Creating resource...');

    // Create resource first
    const [resource] = await sql`
      INSERT INTO resources (resource_type)
      VALUES ('NOTEBOOK')
      RETURNING resource_id, created_at
    ` as { resource_id: string; created_at: string }[];

    console.log('createNotebook: Resource created:', resource.resource_id);

    // Create notebook
    const [notebook] = await sql`
      INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility)
      VALUES (
        ${resource.resource_id},
        ${user.user_id},
        ${data.title.trim()},
        ${description},
        ${visibility}
      )
      RETURNING *
    ` as Notebook[];

    console.log('createNotebook: Notebook created:', notebook.notebook_id);

    // Grant OWNER role to creator
    await sql`
      INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by)
      VALUES (
        ${user.user_id},
        ${resource.resource_id},
        'OWNER',
        ${user.user_id}
      )
    `;

    console.log('createNotebook: OWNER role granted');

    const result = {
      ...notebook,
      created_at: resource.created_at,
      owner_username: user.username,
      owner_email: user.email,
      notes_count: 0,
    };

    // 4. Revalidate dashboard
    revalidatePath('/dashboard');

    console.log('createNotebook: Success!', result);
    return { success: true, notebook: result };
  } catch (error: any) {
    console.error('Create notebook error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
    });
    return {
      success: false,
      error: `Database error: ${error.message}`,
    };
  }
}

/**
 * Get all notebooks for the current user
 * 
 * Returns notebooks where user has any role (OWNER, MAINTAINER, CONTRIBUTOR)
 */
export async function getUserNotebooks(): Promise<{
  success: boolean;
  notebooks?: Notebook[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const notebooks = await sql`
      SELECT 
        nb.notebook_id,
        nb.owner_id,
        nb.title,
        nb.description,
        nb.deleted_at,
        nb.visibility,
        r.created_at,
        u.username as owner_username,
        u.email as owner_email,
        COUNT(DISTINCT n.note_id) as notes_count,
        cr.role_type as user_role
      FROM notebooks nb
      INNER JOIN resources r ON r.resource_id = nb.notebook_id
      INNER JOIN users u ON u.user_id = nb.owner_id
      INNER JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id
      LEFT JOIN notes n ON n.notebook_id = nb.notebook_id AND n.deleted_at IS NULL
      WHERE cr.user_id = ${user.user_id}
        AND nb.deleted_at IS NULL
      GROUP BY 
        nb.notebook_id, 
        nb.owner_id, 
        nb.title, 
        nb.description, 
        nb.deleted_at, 
        nb.visibility,
        r.created_at,
        u.username,
        u.email,
        cr.role_type
      ORDER BY r.created_at DESC
    ` as Notebook[];

    return { success: true, notebooks };
  } catch (error: any) {
    console.error('Get user notebooks error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch notebooks',
    };
  }
}

/**
 * Get a single notebook by ID
 * 
 * Includes permission check - user must have access
 */
export async function getNotebook(notebookId: string): Promise<{
  success: boolean;
  notebook?: Notebook;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const [notebook] = await sql`
      SELECT 
        nb.notebook_id,
        nb.owner_id,
        nb.title,
        nb.description,
        nb.deleted_at,
        nb.visibility,
        r.created_at,
        u.username as owner_username,
        u.email as owner_email,
        COUNT(DISTINCT n.note_id) as notes_count
      FROM notebooks nb
      INNER JOIN resources r ON r.resource_id = nb.notebook_id
      INNER JOIN users u ON u.user_id = nb.owner_id
      LEFT JOIN notes n ON n.notebook_id = nb.notebook_id AND n.deleted_at IS NULL
      WHERE nb.notebook_id = ${notebookId}
        AND nb.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM collaborator_roles
          WHERE resource_id = nb.notebook_id
          AND user_id = ${user.user_id}
        )
      GROUP BY 
        nb.notebook_id, 
        nb.owner_id, 
        nb.title, 
        nb.description, 
        nb.deleted_at, 
        nb.visibility,
        r.created_at,
        u.username,
        u.email
    ` as Notebook[];

    if (!notebook) {
      return { success: false, error: 'Notebook not found or access denied' };
    }

    return { success: true, notebook };
  } catch (error: any) {
    console.error('Get notebook error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch notebook',
    };
  }
}

/**
 * Update notebook metadata
 * 
 * Only OWNER can update title/description/visibility
 */
export async function updateNotebook(
  notebookId: string,
  data: {
    title?: string;
    description?: string;
    visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  }
): Promise<{ success: boolean; notebook?: Notebook; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if user is OWNER
    const [role] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${notebookId}
      AND user_id = ${user.user_id}
    ` as { role_type: string }[];

    if (!role || role.role_type !== 'OWNER') {
      return { success: false, error: 'Only notebook owner can update metadata' };
    }

    // Build update query
    if (data.title?.trim()) {
      await sql`
        UPDATE notebooks
        SET title = ${data.title.trim()}
        WHERE notebook_id = ${notebookId}
      `;
    }
    
    if (data.description !== undefined) {
      await sql`
        UPDATE notebooks
        SET description = ${data.description?.trim() || null}
        WHERE notebook_id = ${notebookId}
      `;
    }
    
    if (data.visibility) {
      await sql`
        UPDATE notebooks
        SET visibility = ${data.visibility}
        WHERE notebook_id = ${notebookId}
      `;
    }

    // Fetch updated notebook
    const result = await getNotebook(notebookId);

    revalidatePath('/dashboard');

    return result;
  } catch (error: any) {
    console.error('Update notebook error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update notebook',
    };
  }
}

/**
 * Soft delete a notebook
 * 
 * Sets deleted_at instead of hard DELETE
 * Only OWNER can delete
 */
export async function deleteNotebook(notebookId: string): Promise<{
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
      WHERE resource_id = ${notebookId}
      AND user_id = ${user.user_id}
    ` as { role_type: string }[];

    if (!role || role.role_type !== 'OWNER') {
      return { success: false, error: 'Only notebook owner can delete' };
    }

    // Soft delete
    await sql`
      UPDATE notebooks
      SET deleted_at = NOW()
      WHERE notebook_id = ${notebookId}
      AND deleted_at IS NULL
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Delete notebook error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete notebook',
    };
  }
}
