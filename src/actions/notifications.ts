'use server';

import { sql } from '@/lib/db';
import { revalidatePath } from 'next/cache';

/**
 * Server Actions for Notifications
 * 
 * Handles:
 * - Creating notifications for various events
 * - Fetching user notifications
 * - Marking notifications as read
 * - Deleting notifications
 */

export interface Notification {
  notification_id: string;
  user_id: string;
  notification_type: 'ACCESS_REQUEST' | 'ACCESS_GRANTED' | 'ACCESS_REJECTED' | 'COLLABORATOR_ADDED' | 'COLLABORATOR_REMOVED' | 'ROLE_UPDATED' | 'ISSUE_ASSIGNED' | 'BRANCH_MERGED' | 'COMMENT_ADDED';
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: Date;
  related_resource_id?: string;
  related_user_id?: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(input: {
  userId: string;
  type: Notification['notification_type'];
  title: string;
  message: string;
  link?: string;
  relatedResourceId?: string;
  relatedUserId?: string;
}) {
  try {
    const { userId, type, title, message, link, relatedResourceId, relatedUserId } = input;

    const [notification] = await sql`
      INSERT INTO notifications (
        user_id,
        notification_type,
        title,
        message,
        link,
        related_resource_id,
        related_user_id,
        is_read
      )
      VALUES (
        ${userId},
        ${type},
        ${title},
        ${message},
        ${link || null},
        ${relatedResourceId || null},
        ${relatedUserId || null},
        FALSE
      )
      RETURNING notification_id, created_at
    `;

    return {
      success: true,
      notificationId: notification.notification_id,
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    return {
      success: false,
      error: 'Failed to create notification',
    };
  }
}

/**
 * Notify when someone requests access to a resource
 */
export async function notifyAccessRequest(input: {
  resourceId: string;
  requesterId: string;
  requesterUsername: string;
  resourceTitle: string;
  resourceType: 'NOTEBOOK' | 'NOTE';
  requestedRole: string;
}) {
  try {
    const { resourceId, requesterId, requesterUsername, resourceTitle, resourceType, requestedRole } = input;

    // Get all owners and maintainers who should be notified
    const recipients = await sql`
      SELECT DISTINCT cr.user_id
      FROM collaborator_roles cr
      WHERE cr.resource_id = ${resourceId}
        AND cr.role_type IN ('OWNER', 'MAINTAINER')
        AND cr.user_id != ${requesterId}
    `;

    // Create notification for each recipient
    for (const recipient of recipients) {
      await createNotification({
        userId: recipient.user_id,
        type: 'ACCESS_REQUEST',
        title: 'New Access Request',
        message: `${requesterUsername} requested ${requestedRole} access to ${resourceType.toLowerCase()} "${resourceTitle}"`,
        link: `/dashboard/settings/access-requests`,
        relatedResourceId: resourceId,
        relatedUserId: requesterId,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error notifying access request:', error);
    return { success: false };
  }
}

/**
 * Notify when access request is approved
 */
export async function notifyAccessGranted(input: {
  userId: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: 'NOTEBOOK' | 'NOTE';
  grantedRole: string;
  grantedBy: string;
}) {
  try {
    const { userId, resourceId, resourceTitle, resourceType, grantedRole, grantedBy } = input;

    // Get grantor username
    const [grantor] = await sql`
      SELECT username FROM users WHERE user_id = ${grantedBy}
    `;

    await createNotification({
      userId,
      type: 'ACCESS_GRANTED',
      title: 'Access Granted',
      message: `Your request for ${grantedRole} access to ${resourceType.toLowerCase()} "${resourceTitle}" was approved${grantor ? ` by ${grantor.username}` : ''}`,
      link: resourceType === 'NOTEBOOK' 
        ? `/dashboard/notebooks/${resourceId}`
        : `/dashboard/notebooks/${resourceId}/notes`,
      relatedResourceId: resourceId,
      relatedUserId: grantedBy,
    });

    return { success: true };
  } catch (error) {
    console.error('Error notifying access granted:', error);
    return { success: false };
  }
}

/**
 * Notify when access request is rejected
 */
export async function notifyAccessRejected(input: {
  userId: string;
  resourceTitle: string;
  resourceType: 'NOTEBOOK' | 'NOTE';
  rejectedBy: string;
}) {
  try {
    const { userId, resourceTitle, resourceType, rejectedBy } = input;

    // Get rejector username
    const [rejector] = await sql`
      SELECT username FROM users WHERE user_id = ${rejectedBy}
    `;

    await createNotification({
      userId,
      type: 'ACCESS_REJECTED',
      title: 'Access Request Declined',
      message: `Your request for access to ${resourceType.toLowerCase()} "${resourceTitle}" was declined${rejector ? ` by ${rejector.username}` : ''}`,
      relatedUserId: rejectedBy,
    });

    return { success: true };
  } catch (error) {
    console.error('Error notifying access rejected:', error);
    return { success: false };
  }
}

/**
 * Notify when user is added as collaborator
 */
export async function notifyCollaboratorAdded(input: {
  userId: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: 'NOTEBOOK' | 'NOTE';
  role: string;
  addedBy: string;
}) {
  try {
    const { userId, resourceId, resourceTitle, resourceType, role, addedBy } = input;

    // Get adder username
    const [adder] = await sql`
      SELECT username FROM users WHERE user_id = ${addedBy}
    `;

    await createNotification({
      userId,
      type: 'COLLABORATOR_ADDED',
      title: 'Added as Collaborator',
      message: `${adder?.username || 'Someone'} added you as ${role} to ${resourceType.toLowerCase()} "${resourceTitle}"`,
      link: resourceType === 'NOTEBOOK' 
        ? `/dashboard/notebooks/${resourceId}`
        : `/dashboard/notebooks/${resourceId}/notes`,
      relatedResourceId: resourceId,
      relatedUserId: addedBy,
    });

    return { success: true };
  } catch (error) {
    console.error('Error notifying collaborator added:', error);
    return { success: false };
  }
}

/**
 * Notify when user is removed as collaborator
 */
export async function notifyCollaboratorRemoved(input: {
  userId: string;
  resourceTitle: string;
  resourceType: 'NOTEBOOK' | 'NOTE';
  removedBy: string;
}) {
  try {
    const { userId, resourceTitle, resourceType, removedBy } = input;

    // Get remover username
    const [remover] = await sql`
      SELECT username FROM users WHERE user_id = ${removedBy}
    `;

    await createNotification({
      userId,
      type: 'COLLABORATOR_REMOVED',
      title: 'Removed as Collaborator',
      message: `${remover?.username || 'Someone'} removed you from ${resourceType.toLowerCase()} "${resourceTitle}"`,
      relatedUserId: removedBy,
    });

    return { success: true };
  } catch (error) {
    console.error('Error notifying collaborator removed:', error);
    return { success: false };
  }
}

/**
 * Notify when user's role is updated
 */
export async function notifyRoleUpdated(input: {
  userId: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: 'NOTEBOOK' | 'NOTE';
  oldRole: string;
  newRole: string;
  updatedBy: string;
}) {
  try {
    const { userId, resourceId, resourceTitle, resourceType, oldRole, newRole, updatedBy } = input;

    // Get updater username
    const [updater] = await sql`
      SELECT username FROM users WHERE user_id = ${updatedBy}
    `;

    await createNotification({
      userId,
      type: 'ROLE_UPDATED',
      title: 'Role Updated',
      message: `${updater?.username || 'Someone'} changed your role from ${oldRole} to ${newRole} in ${resourceType.toLowerCase()} "${resourceTitle}"`,
      link: resourceType === 'NOTEBOOK' 
        ? `/dashboard/notebooks/${resourceId}`
        : `/dashboard/notebooks/${resourceId}/notes`,
      relatedResourceId: resourceId,
      relatedUserId: updatedBy,
    });

    return { success: true };
  } catch (error) {
    console.error('Error notifying role updated:', error);
    return { success: false };
  }
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(userId: string) {
  try {
    const notifications = await sql`
      SELECT 
        notification_id,
        user_id,
        notification_type,
        title,
        message,
        link,
        is_read,
        created_at,
        related_resource_id,
        related_user_id
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return {
      success: true,
      notifications,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      success: false,
      error: 'Failed to fetch notifications',
      notifications: [],
    };
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string) {
  try {
    const [result] = await sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ${userId}
        AND is_read = FALSE
    `;

    return {
      success: true,
      count: parseInt(result.count),
    };
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return {
      success: false,
      count: 0,
    };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  try {
    await sql`
      UPDATE notifications
      SET is_read = TRUE
      WHERE notification_id = ${notificationId}
        AND user_id = ${userId}
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error: 'Failed to mark notification as read',
    };
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId: string) {
  try {
    await sql`
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = ${userId}
        AND is_read = FALSE
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return {
      success: false,
      error: 'Failed to mark notifications as read',
    };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  try {
    await sql`
      DELETE FROM notifications
      WHERE notification_id = ${notificationId}
        AND user_id = ${userId}
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return {
      success: false,
      error: 'Failed to delete notification',
    };
  }
}

/**
 * Delete all read notifications
 */
export async function deleteReadNotifications(userId: string) {
  try {
    await sql`
      DELETE FROM notifications
      WHERE user_id = ${userId}
        AND is_read = TRUE
    `;

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    return {
      success: false,
      error: 'Failed to delete notifications',
    };
  }
}
