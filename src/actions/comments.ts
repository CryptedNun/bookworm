/**
 * Issue Comments Server Actions
 * 
 * Enables collaborative discussion and code review threads on issues.
 * Triggers COMMENT_ADDED notifications to issue creators and assignees.
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { createNotification } from './notifications';
import { revalidatePath } from 'next/cache';

export interface IssueComment {
  comment_id: string;
  issue_id: string;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  author_system_role: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

/**
 * Add a new comment to an issue
 */
export async function addIssueComment(input: {
  issueId: string;
  content: string;
}): Promise<{ success: boolean; comment?: IssueComment; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    if (!input.content || !input.content.trim()) {
      return { success: false, error: 'Comment content cannot be empty' };
    }

    // 1. Fetch issue details to verify existence and resource context
    const [issue] = await sql`
      SELECT 
        i.issue_id,
        i.note_id,
        i.creator_id,
        i.title,
        n.notebook_id,
        n.title as note_title,
        n.visibility as note_visibility
      FROM issues i
      JOIN notes n ON n.note_id = i.note_id
      WHERE i.issue_id = ${input.issueId}
    ` as {
      issue_id: string;
      note_id: string;
      creator_id: string;
      title: string;
      notebook_id: string;
      note_title: string;
      note_visibility: string;
    }[];

    if (!issue) {
      return { success: false, error: 'Issue not found' };
    }

    // 2. Insert comment
    const [newComment] = await sql`
      INSERT INTO issue_comments (issue_id, author_id, content)
      VALUES (${input.issueId}, ${user.user_id}, ${input.content.trim()})
      RETURNING comment_id, issue_id, author_id, content, created_at, updated_at
    ` as {
      comment_id: string;
      issue_id: string;
      author_id: string;
      content: string;
      created_at: string;
      updated_at: string | null;
    }[];

    // 3. Notify issue participants (creator and assignees)
    // Find all contributors assigned to this issue
    const assignees = await sql`
      SELECT contributor_id FROM issue_contributors
      WHERE issue_id = ${input.issueId}
    ` as { contributor_id: string }[];

    const recipientIds = new Set<string>();
    if (issue.creator_id !== user.user_id) {
      recipientIds.add(issue.creator_id);
    }
    for (const a of assignees) {
      if (a.contributor_id !== user.user_id) {
        recipientIds.add(a.contributor_id);
      }
    }

    // Send notifications in background
    const issueLink = `/dashboard/notebooks/${issue.notebook_id}/notes/${issue.note_id}/issues?openIssueId=${issue.issue_id}`;
    for (const recipientId of recipientIds) {
      try {
        await createNotification({
          userId: recipientId,
          type: 'COMMENT_ADDED',
          title: `New comment on issue: ${issue.title}`,
          message: `${user.username} commented: "${input.content.trim().substring(0, 100)}${input.content.length > 100 ? '...' : ''}"`,
          link: issueLink,
          relatedResourceId: issue.note_id,
          relatedUserId: user.user_id,
        });
      } catch (notifErr) {
        console.warn('Could not dispatch comment notification:', notifErr);
      }
    }

    revalidatePath(`/dashboard/notebooks/${issue.notebook_id}/notes/${issue.note_id}/issues`);

    return {
      success: true,
      comment: {
        comment_id: newComment.comment_id,
        issue_id: newComment.issue_id,
        author_id: newComment.author_id,
        author_username: user.username,
        author_avatar_url: user.avatar_url || null,
        author_system_role: user.system_role || 'USER',
        content: newComment.content,
        created_at: newComment.created_at,
        updated_at: newComment.updated_at,
      },
    };
  } catch (error: any) {
    console.error('addIssueComment error:', error);
    return { success: false, error: error.message || 'Failed to add comment' };
  }
}

/**
 * Fetch chronological comments for an issue
 */
export async function getIssueComments(
  issueId: string
): Promise<{ success: boolean; comments?: IssueComment[]; error?: string }> {
  try {
    const comments = await sql`
      SELECT 
        ic.comment_id,
        ic.issue_id,
        ic.author_id,
        u.username as author_username,
        u.avatar_url as author_avatar_url,
        u.system_role as author_system_role,
        ic.content,
        ic.created_at,
        ic.updated_at
      FROM issue_comments ic
      JOIN users u ON u.user_id = ic.author_id
      WHERE ic.issue_id = ${issueId}
      ORDER BY ic.created_at ASC
    ` as {
      comment_id: string;
      issue_id: string;
      author_id: string;
      author_username: string;
      author_avatar_url: string | null;
      author_system_role: string;
      content: string;
      created_at: string;
      updated_at: string | null;
    }[];

    return { success: true, comments };
  } catch (error: any) {
    console.error('getIssueComments error:', error);
    return { success: false, error: error.message || 'Failed to load comments' };
  }
}

/**
 * Delete a comment (by author or resource owner)
 */
export async function deleteIssueComment(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Fetch comment and owner info
    const [comment] = await sql`
      SELECT 
        ic.comment_id,
        ic.author_id,
        i.note_id,
        n.notebook_id
      FROM issue_comments ic
      JOIN issues i ON i.issue_id = ic.issue_id
      JOIN notes n ON n.note_id = i.note_id
      WHERE ic.comment_id = ${commentId}
    ` as {
      comment_id: string;
      author_id: string;
      note_id: string;
      notebook_id: string;
    }[];

    if (!comment) {
      return { success: false, error: 'Comment not found' };
    }

    // Check if user is author or notebook owner
    const isAuthor = comment.author_id === user.user_id;
    let isOwner = false;

    if (!isAuthor) {
      const [role] = await sql`
        SELECT role_type FROM collaborator_roles
        WHERE user_id = ${user.user_id}
          AND resource_id = ${comment.notebook_id}
          AND role_type = 'OWNER'
      ` as { role_type: string }[];
      isOwner = !!role;
    }

    if (!isAuthor && !isOwner) {
      return { success: false, error: 'Permission denied to delete this comment' };
    }

    await sql`
      DELETE FROM issue_comments
      WHERE comment_id = ${commentId}
    `;

    revalidatePath(`/dashboard/notebooks/${comment.notebook_id}/notes/${comment.note_id}/issues`);

    return { success: true };
  } catch (error: any) {
    console.error('deleteIssueComment error:', error);
    return { success: false, error: error.message || 'Failed to delete comment' };
  }
}
