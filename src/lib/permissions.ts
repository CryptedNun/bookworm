/**
 * Permission Utilities
 * 
 * Centralized permission checking for resources (notebooks, notes)
 * Following the Role-Based Access Control (RBAC) model
 */

import { sql } from './db';

/**
 * Role hierarchy:
 * OWNER > MAINTAINER > CONTRIBUTOR
 */
export type Role = 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';

/**
 * Capabilities for MAINTAINER role (configured per user)
 */
export interface Capabilities {
  can_create_issue: boolean;
  can_delete_branch: boolean;
  can_merge_branch: boolean;
  can_add_contributor: boolean;
}

/**
 * Permission matrix for different actions
 */
export const PERMISSIONS = {
  // Notebook permissions
  CREATE_NOTE: ['OWNER', 'MAINTAINER'],
  DELETE_NOTE: ['OWNER'],
  REORDER_NOTES: ['OWNER', 'MAINTAINER'],
  UPDATE_NOTEBOOK: ['OWNER', 'MAINTAINER'],
  DELETE_NOTEBOOK: ['OWNER'],
  
  // Note permissions
  EDIT_NOTE_MAIN: ['OWNER', 'MAINTAINER'],
  VIEW_NOTE: ['OWNER', 'MAINTAINER', 'CONTRIBUTOR'],
  CREATE_ISSUE: ['OWNER', 'MAINTAINER', 'CONTRIBUTOR'],
  
  // Branch/Merge permissions
  MERGE_BRANCH: ['OWNER', 'MAINTAINER'],
  DELETE_BRANCH: ['OWNER', 'MAINTAINER'],
  
  // Collaboration permissions
  ADD_COLLABORATOR: ['OWNER', 'MAINTAINER'],
  REMOVE_COLLABORATOR: ['OWNER'],
  ASSIGN_TO_ISSUE: ['OWNER', 'MAINTAINER'],
} as const;

/**
 * Get user's role for a resource
 */
export async function getUserRole(
  resourceId: string,
  userId: string
): Promise<{ role: Role; capabilities?: Capabilities } | null> {
  try {
    const [result] = await sql`
      SELECT 
        role_type,
        capabilities
      FROM collaborator_roles
      WHERE resource_id = ${resourceId}
        AND user_id = ${userId}
    `;

    if (!result) {
      return null;
    }

    return {
      role: result.role_type as Role,
      capabilities: result.capabilities as Capabilities | undefined,
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Check if user has specific permission for an action
 */
export async function hasPermission(
  resourceId: string,
  userId: string,
  action: keyof typeof PERMISSIONS
): Promise<boolean> {
  const userRole = await getUserRole(resourceId, userId);
  
  if (!userRole) {
    return false;
  }

  const allowedRoles = PERMISSIONS[action];
  return (allowedRoles as readonly string[]).includes(userRole.role);
}

/**
 * Check if user has capability (for MAINTAINER role)
 */
export async function hasCapability(
  resourceId: string,
  userId: string,
  capability: keyof Capabilities
): Promise<boolean> {
  const userRole = await getUserRole(resourceId, userId);
  
  if (!userRole) {
    return false;
  }

  // OWNER always has all capabilities
  if (userRole.role === 'OWNER') {
    return true;
  }

  // MAINTAINER capabilities are configured
  if (userRole.role === 'MAINTAINER' && userRole.capabilities) {
    return userRole.capabilities[capability] === true;
  }

  // CONTRIBUTOR has no special capabilities
  return false;
}

/**
 * Verify user has permission or throw error
 */
export async function requirePermission(
  resourceId: string,
  userId: string,
  action: keyof typeof PERMISSIONS,
  customError?: string
): Promise<void> {
  const allowed = await hasPermission(resourceId, userId, action);
  
  if (!allowed) {
    throw new Error(
      customError || `Insufficient permissions for action: ${action}`
    );
  }
}

/**
 * Get all collaborators for a resource
 */
export async function getCollaborators(resourceId: string) {
  try {
    const collaborators = await sql`
      SELECT 
        cr.role_id,
        cr.user_id,
        cr.role_type,
        cr.capabilities,
        cr.granted_by,
        cr.created_at,
        u.username,
        u.email,
        u.avatar_url
      FROM collaborator_roles cr
      INNER JOIN users u ON u.user_id = cr.user_id
      WHERE cr.resource_id = ${resourceId}
      ORDER BY 
        CASE cr.role_type
          WHEN 'OWNER' THEN 1
          WHEN 'MAINTAINER' THEN 2
          WHEN 'CONTRIBUTOR' THEN 3
        END,
        cr.created_at ASC
    `;

    return collaborators;
  } catch (error) {
    console.error('Error getting collaborators:', error);
    return [];
  }
}

/**
 * Check if user can edit on a specific branch
 * 
 * Rules:
 * - OWNER/MAINTAINER: Can edit main branch directly
 * - CONTRIBUTOR: Can only edit through issues (on issue branches)
 */
export async function canEditOnBranch(
  noteId: string,
  branchId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get user role
    const userRole = await getUserRole(noteId, userId);
    if (!userRole) {
      return { allowed: false, reason: 'No access to this note' };
    }

    // Get branch details
    const [branch] = await sql`
      SELECT 
        branch_id,
        is_main,
        issue_id
      FROM branches
      WHERE branch_id = ${branchId}
        AND note_id = ${noteId}
    `;

    if (!branch) {
      return { allowed: false, reason: 'Branch not found' };
    }

    // OWNER and MAINTAINER can edit main branch
    if (branch.is_main && ['OWNER', 'MAINTAINER'].includes(userRole.role)) {
      return { allowed: true };
    }

    // No one can edit main branch as CONTRIBUTOR
    if (branch.is_main && userRole.role === 'CONTRIBUTOR') {
      return { 
        allowed: false, 
        reason: 'Contributors must create issues to propose changes' 
      };
    }

    // For issue branches, check if user is assigned to the issue
    if (branch.issue_id) {
      const [assignment] = await sql`
        SELECT 1
        FROM issue_contributors
        WHERE issue_id = ${branch.issue_id}
          AND contributor_id = ${userId}
      `;

      if (assignment) {
        return { allowed: true };
      }

      return { 
        allowed: false, 
        reason: 'You are not assigned to this issue' 
      };
    }

    return { allowed: false, reason: 'Invalid branch configuration' };
  } catch (error) {
    console.error('Error checking branch edit permission:', error);
    return { allowed: false, reason: 'Permission check failed' };
  }
}

/**
 * Permission check result type
 */
export interface PermissionCheckResult {
  allowed: boolean;
  role?: Role;
  reason?: string;
}

/**
 * Comprehensive permission check with detailed result
 */
export async function checkPermission(
  resourceId: string,
  userId: string,
  action: keyof typeof PERMISSIONS
): Promise<PermissionCheckResult> {
  const userRole = await getUserRole(resourceId, userId);
  
  if (!userRole) {
    return { 
      allowed: false, 
      reason: 'No access to this resource' 
    };
  }

  const allowedRoles = PERMISSIONS[action];
  const allowed = (allowedRoles as readonly string[]).includes(userRole.role);

  return {
    allowed,
    role: userRole.role,
    reason: allowed 
      ? undefined 
      : `Role ${userRole.role} cannot perform ${action}. Required: ${allowedRoles.join(' or ')}`,
  };
}
