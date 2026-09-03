'use server';

import { sql } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getUserRole, getCollaborators } from '@/lib/permissions';
import { notifyAccessRequest, notifyAccessGranted, notifyAccessRejected, notifyCollaboratorAdded, notifyCollaboratorRemoved, notifyRoleUpdated } from './notifications';

/**
 * Server Actions for Permission Management
 * 
 * Handles:
 * - Access requests (users requesting access to notebooks/notes)
 * - Access request reviews (owners/maintainers approving/rejecting)
 * - Adding collaborators directly (by owners/maintainers)
 * - Removing collaborators
 * - Updating roles
 */

export interface AccessRequest {
  request_id: string;
  user_id: string;
  resource_id: string;
  requested_role: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message?: string;
  initiated_by: string;
  reviewed_by?: string;
  created_at: Date;
  reviewed_at?: Date;
  
  // Joined fields
  username?: string;
  email?: string;
  avatar_url?: string;
  resource_title?: string;
  resource_type?: 'NOTEBOOK' | 'NOTE';
}

/**
 * Request access to a notebook or note
 */
export async function requestAccess(input: {
  resourceId: string;
  requestedRole: 'CONTRIBUTOR' | 'MAINTAINER';
  message?: string;
  userId: string;
}) {
  try {
    const { resourceId, requestedRole, message, userId } = input;

    // Validation
    if (!resourceId || !userId) {
      return { success: false, error: 'Missing required fields' };
    }

    // Check if user already has access
    const existingRole = await getUserRole(resourceId, userId);
    if (existingRole) {
      return { success: false, error: 'You already have access to this resource' };
    }

    // Check if there's already a pending request
    const [existingRequest] = await sql`
      SELECT request_id
      FROM access_requests
      WHERE user_id = ${userId}
        AND resource_id = ${resourceId}
        AND status = 'PENDING'
    `;

    if (existingRequest) {
      return { success: false, error: 'You already have a pending request for this resource' };
    }

    // Verify resource exists and get owner
    const [resource] = await sql`
      SELECT 
        r.resource_id,
        r.resource_type,
        CASE 
          WHEN r.resource_type = 'NOTEBOOK' THEN nb.owner_id
          WHEN r.resource_type = 'NOTE' THEN (
            SELECT nb2.owner_id 
            FROM notes n2 
            INNER JOIN notebooks nb2 ON nb2.notebook_id = n2.notebook_id
            WHERE n2.note_id = r.resource_id
          )
        END as owner_id
      FROM resources r
      LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
      WHERE r.resource_id = ${resourceId}
    `;

    if (!resource) {
      return { success: false, error: 'Resource not found' };
    }

    // Create access request
    const [request] = await sql`
      INSERT INTO access_requests (
        user_id,
        resource_id,
        requested_role,
        status,
        message,
        initiated_by
      )
      VALUES (
        ${userId},
        ${resourceId},
        ${requestedRole},
        'PENDING',
        ${message || null},
        ${userId}
      )
      RETURNING request_id, created_at
    `;

    // Get user info for notification
    const [user] = await sql`
      SELECT username FROM users WHERE user_id = ${userId}
    `;

    // Get resource title
    const [resourceInfo] = await sql`
      SELECT 
        CASE 
          WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
          WHEN r.resource_type = 'NOTE' THEN n.title
        END as title
      FROM resources r
      LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
      LEFT JOIN notes n ON n.note_id = r.resource_id
      WHERE r.resource_id = ${resourceId}
    `;

    // Notify owners/maintainers
    await notifyAccessRequest({
      resourceId,
      requesterId: userId,
      requesterUsername: user?.username || 'Someone',
      resourceTitle: resourceInfo?.title || 'Unknown',
      resourceType: resource.resource_type,
      requestedRole,
    });

    revalidatePath('/dashboard');

    return {
      success: true,
      requestId: request.request_id,
      message: 'Access request submitted successfully',
    };
  } catch (error) {
    console.error('Error requesting access:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request access',
    };
  }
}

/**
 * Review an access request (approve or reject)
 */
export async function reviewAccessRequest(input: {
  requestId: string;
  approve: boolean;
  reviewerId: string;
  message?: string;
}) {
  try {
    const { requestId, approve, reviewerId, message } = input;

    // Get the request details
    const [request] = await sql`
      SELECT 
        ar.request_id,
        ar.user_id,
        ar.resource_id,
        ar.requested_role,
        ar.status,
        r.resource_type
      FROM access_requests ar
      INNER JOIN resources r ON r.resource_id = ar.resource_id
      WHERE ar.request_id = ${requestId}
    `;

    if (!request) {
      return { success: false, error: 'Access request not found' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, error: 'This request has already been reviewed' };
    }

    // Verify reviewer has permission (must be OWNER or MAINTAINER)
    const reviewerRole = await getUserRole(request.resource_id, reviewerId);
    if (!reviewerRole || !['OWNER', 'MAINTAINER'].includes(reviewerRole.role)) {
      return { success: false, error: 'Insufficient permissions to review access requests' };
    }

    if (approve) {
      // Grant access by creating collaborator role
      await sql`
        INSERT INTO collaborator_roles (
          user_id,
          resource_id,
          role_type,
          granted_by,
          capabilities
        )
        VALUES (
          ${request.user_id},
          ${request.resource_id},
          ${request.requested_role},
          ${reviewerId},
          ${request.requested_role === 'MAINTAINER' 
            ? '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": false}'
            : '{"can_create_issue": true, "can_delete_branch": false, "can_merge_branch": false, "can_add_contributor": false}'
          }::jsonb
        )
      `;

      // Update request status
      await sql`
        UPDATE access_requests
        SET 
          status = 'APPROVED',
          reviewed_by = ${reviewerId},
          reviewed_at = NOW()
        WHERE request_id = ${requestId}
      `;

      // Get resource title for notification
      const [resourceInfo] = await sql`
        SELECT 
          CASE 
            WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
            WHEN r.resource_type = 'NOTE' THEN n.title
          END as title
        FROM resources r
        LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
        LEFT JOIN notes n ON n.note_id = r.resource_id
        WHERE r.resource_id = ${request.resource_id}
      `;

      // Notify requester of approval
      await notifyAccessGranted({
        userId: request.user_id,
        resourceId: request.resource_id,
        resourceTitle: resourceInfo?.title || 'Unknown',
        resourceType: request.resource_type,
        grantedRole: request.requested_role,
        grantedBy: reviewerId,
      });

      revalidatePath('/dashboard');

      return {
        success: true,
        message: 'Access granted successfully',
      };
    } else {
      // Reject the request
      await sql`
        UPDATE access_requests
        SET 
          status = 'REJECTED',
          reviewed_by = ${reviewerId},
          reviewed_at = NOW()
        WHERE request_id = ${requestId}
      `;

      // Get resource title for notification
      const [resourceInfo] = await sql`
        SELECT 
          CASE 
            WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
            WHEN r.resource_type = 'NOTE' THEN n.title
          END as title
        FROM resources r
        LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
        LEFT JOIN notes n ON n.note_id = r.resource_id
        WHERE r.resource_id = ${request.resource_id}
      `;

      // Notify requester of rejection
      await notifyAccessRejected({
        userId: request.user_id,
        resourceTitle: resourceInfo?.title || 'Unknown',
        resourceType: request.resource_type,
        rejectedBy: reviewerId,
      });

      revalidatePath('/dashboard');

      return {
        success: true,
        message: 'Access request rejected',
      };
    }
  } catch (error) {
    console.error('Error reviewing access request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to review access request',
    };
  }
}

/**
 * Get pending access requests for resources owned/maintained by user
 */
export async function getPendingAccessRequests(userId: string) {
  try {
    const requests = await sql`
      SELECT 
        ar.request_id,
        ar.user_id,
        ar.resource_id,
        ar.requested_role,
        ar.status,
        ar.message,
        ar.created_at,
        u.username,
        u.email,
        u.avatar_url,
        r.resource_type,
        CASE 
          WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
          WHEN r.resource_type = 'NOTE' THEN n.title
        END as resource_title
      FROM access_requests ar
      INNER JOIN users u ON u.user_id = ar.user_id
      INNER JOIN resources r ON r.resource_id = ar.resource_id
      LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
      LEFT JOIN notes n ON n.note_id = r.resource_id
      WHERE ar.status = 'PENDING'
        AND EXISTS (
          SELECT 1 FROM collaborator_roles cr
          WHERE cr.resource_id = ar.resource_id
            AND cr.user_id = ${userId}
            AND cr.role_type IN ('OWNER', 'MAINTAINER')
        )
      ORDER BY ar.created_at DESC
    `;

    return { success: true, requests };
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    return { success: false, error: 'Failed to fetch requests', requests: [] };
  }
}

/**
 * Get access requests made by user
 */
export async function getMyAccessRequests(userId: string) {
  try {
    const requests = await sql`
      SELECT 
        ar.request_id,
        ar.resource_id,
        ar.requested_role,
        ar.status,
        ar.message,
        ar.created_at,
        ar.reviewed_at,
        reviewer.username as reviewed_by_username,
        r.resource_type,
        CASE 
          WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
          WHEN r.resource_type = 'NOTE' THEN n.title
        END as resource_title
      FROM access_requests ar
      INNER JOIN resources r ON r.resource_id = ar.resource_id
      LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
      LEFT JOIN notes n ON n.note_id = r.resource_id
      LEFT JOIN users reviewer ON reviewer.user_id = ar.reviewed_by
      WHERE ar.user_id = ${userId}
      ORDER BY 
        CASE ar.status
          WHEN 'PENDING' THEN 1
          WHEN 'APPROVED' THEN 2
          WHEN 'REJECTED' THEN 3
        END,
        ar.created_at DESC
    `;

    return { success: true, requests };
  } catch (error) {
    console.error('Error fetching my requests:', error);
    return { success: false, error: 'Failed to fetch requests', requests: [] };
  }
}

/**
 * Add / Invite collaborator directly (by owner/maintainer)
 * Supports userEmail as an email address, UUID, or username
 */
export async function addCollaborator(input: {
  resourceId: string;
  userEmail: string;
  role: 'MAINTAINER' | 'CONTRIBUTOR';
  grantedBy: string;
}) {
  try {
    const { resourceId, userEmail, role, grantedBy } = input;

    // Verify grantor has permission
    const grantorRole = await getUserRole(resourceId, grantedBy);
    if (!grantorRole || !['OWNER', 'MAINTAINER'].includes(grantorRole.role)) {
      return { success: false, error: 'Insufficient permissions to invite collaborators' };
    }

    const trimmedIdentifier = (userEmail || '').trim();
    if (!trimmedIdentifier) {
      return { success: false, error: 'Please enter a valid user email or UUID' };
    }

    // Check if identifier is a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedIdentifier);
    let targetUser: { user_id: string; username: string; email: string } | undefined;

    if (isUuid) {
      const [userByUuid] = await sql`
        SELECT user_id, username, email
        FROM users
        WHERE user_id = ${trimmedIdentifier}
      `;
      targetUser = userByUuid as any;
    } else {
      const [userByEmailOrUsername] = await sql`
        SELECT user_id, username, email
        FROM users
        WHERE LOWER(email) = LOWER(${trimmedIdentifier})
           OR LOWER(username) = LOWER(${trimmedIdentifier})
      `;
      targetUser = userByEmailOrUsername as any;
    }

    if (!targetUser) {
      return { 
        success: false, 
        error: `User not found with identifier "${trimmedIdentifier}". Please check the email address or UUID.` 
      };
    }

    // Prevent adding self
    if (targetUser.user_id === grantedBy) {
      return { success: false, error: 'You already own or maintain this resource' };
    }

    // Check if user already has access
    const existingRole = await getUserRole(resourceId, targetUser.user_id);
    if (existingRole) {
      return { 
        success: false, 
        error: `User @${targetUser.username} already has access as ${existingRole.role}` 
      };
    }

    // Grant access
    await sql`
      INSERT INTO collaborator_roles (
        user_id,
        resource_id,
        role_type,
        granted_by,
        capabilities
      )
      VALUES (
        ${targetUser.user_id},
        ${resourceId},
        ${role},
        ${grantedBy},
        ${role === 'MAINTAINER' 
          ? '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": false}'
          : '{"can_create_issue": true, "can_delete_branch": false, "can_merge_branch": false, "can_add_contributor": false}'
        }::jsonb
      )
    `;

    // Get resource info for notification
    const [resourceInfo] = await sql`
      SELECT 
        r.resource_type,
        CASE 
          WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
          WHEN r.resource_type = 'NOTE' THEN n.title
        END as title
      FROM resources r
      LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
      LEFT JOIN notes n ON n.note_id = r.resource_id
      WHERE r.resource_id = ${resourceId}
    `;

    // Notify new collaborator
    await notifyCollaboratorAdded({
      userId: targetUser.user_id,
      resourceId,
      resourceTitle: resourceInfo?.title || 'Unknown',
      resourceType: resourceInfo?.resource_type || 'NOTEBOOK',
      role,
      addedBy: grantedBy,
    });

    revalidatePath('/dashboard');

    return {
      success: true,
      message: `${targetUser.username} added as ${role}`,
    };
  } catch (error) {
    console.error('Error adding collaborator:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add collaborator',
    };
  }
}

/**
 * Alias for inviting/adding a collaborator
 */
export const inviteCollaborator = addCollaborator;

/**
 * Remove collaborator (by owner)
 */
export async function removeCollaborator(input: {
  resourceId: string;
  targetUserId: string;
  removedBy: string;
}) {
  try {
    const { resourceId, targetUserId, removedBy } = input;

    // Verify remover is owner
    const removerRole = await getUserRole(resourceId, removedBy);
    if (!removerRole || removerRole.role !== 'OWNER') {
      return { success: false, error: 'Only owners can remove collaborators' };
    }

    // Cannot remove yourself
    if (targetUserId === removedBy) {
      return { success: false, error: 'Cannot remove yourself' };
    }

    // Get target user's role
    const targetRole = await getUserRole(resourceId, targetUserId);
    if (!targetRole) {
      return { success: false, error: 'User does not have access to this resource' };
    }

    // Cannot remove another owner
    if (targetRole.role === 'OWNER') {
      return { success: false, error: 'Cannot remove other owners' };
    }

    // Remove collaborator role
    await sql`
      DELETE FROM collaborator_roles
      WHERE resource_id = ${resourceId}
        AND user_id = ${targetUserId}
    `;

    // Get resource info for notification
    const [resourceInfo] = await sql`
      SELECT 
        r.resource_type,
        CASE 
          WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
          WHEN r.resource_type = 'NOTE' THEN n.title
        END as title
      FROM resources r
      LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
      LEFT JOIN notes n ON n.note_id = r.resource_id
      WHERE r.resource_id = ${resourceId}
    `;

    // Notify removed user
    await notifyCollaboratorRemoved({
      userId: targetUserId,
      resourceTitle: resourceInfo?.title || 'Unknown',
      resourceType: resourceInfo?.resource_type || 'NOTEBOOK',
      removedBy,
    });

    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Collaborator removed successfully',
    };
  } catch (error) {
    console.error('Error removing collaborator:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove collaborator',
    };
  }
}

/**
 * Update collaborator role (by owner)
 */
export async function updateCollaboratorRole(input: {
  resourceId: string;
  targetUserId: string;
  newRole: 'MAINTAINER' | 'CONTRIBUTOR';
  updatedBy: string;
}) {
  try {
    const { resourceId, targetUserId, newRole, updatedBy } = input;

    // Verify updater is owner
    const updaterRole = await getUserRole(resourceId, updatedBy);
    if (!updaterRole || updaterRole.role !== 'OWNER') {
      return { success: false, error: 'Only owners can update roles' };
    }

    // Cannot update yourself
    if (targetUserId === updatedBy) {
      return { success: false, error: 'Cannot update your own role' };
    }

    // Get target user's role
    const targetRole = await getUserRole(resourceId, targetUserId);
    if (!targetRole) {
      return { success: false, error: 'User does not have access to this resource' };
    }

    // Cannot change owner role
    if (targetRole.role === 'OWNER') {
      return { success: false, error: 'Cannot change owner role' };
    }

    // Update role
    await sql`
      UPDATE collaborator_roles
      SET 
        role_type = ${newRole},
        capabilities = ${newRole === 'MAINTAINER' 
          ? '{"can_create_issue": true, "can_delete_branch": true, "can_merge_branch": true, "can_add_contributor": false}'
          : '{"can_create_issue": true, "can_delete_branch": false, "can_merge_branch": false, "can_add_contributor": false}'
        }::jsonb
      WHERE resource_id = ${resourceId}
        AND user_id = ${targetUserId}
    `;

    // Get resource info for notification
    const [resourceInfo] = await sql`
      SELECT 
        r.resource_type,
        CASE 
          WHEN r.resource_type = 'NOTEBOOK' THEN nb.title
          WHEN r.resource_type = 'NOTE' THEN n.title
        END as title
      FROM resources r
      LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
      LEFT JOIN notes n ON n.note_id = r.resource_id
      WHERE r.resource_id = ${resourceId}
    `;

    // Notify user of role change
    await notifyRoleUpdated({
      userId: targetUserId,
      resourceId,
      resourceTitle: resourceInfo?.title || 'Unknown',
      resourceType: resourceInfo?.resource_type || 'NOTEBOOK',
      oldRole: targetRole.role,
      newRole,
      updatedBy,
    });

    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Role updated successfully',
    };
  } catch (error) {
    console.error('Error updating role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update role',
    };
  }
}

/**
 * Get all collaborators for a resource with their details
 */
export async function getResourceCollaborators(resourceId: string, userId: string) {
  try {
    // Verify user has access to view collaborators
    const userRole = await getUserRole(resourceId, userId);
    if (!userRole) {
      return { success: false, error: 'No access to this resource', collaborators: [] };
    }

    const collaborators = await getCollaborators(resourceId);

    return {
      success: true,
      collaborators,
    };
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    return {
      success: false,
      error: 'Failed to fetch collaborators',
      collaborators: [],
    };
  }
}
