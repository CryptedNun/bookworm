'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { createHash } from 'crypto';

export interface Issue {
  issue_id: string;
  note_id: string;
  target_slot_id: string;
  creator_id: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'MERGED' | 'CLOSED';
  created_at: string;
  creator_username?: string;
  target_block_type?: string;
  target_block_content?: string;
  branch_count?: number;
  user_branch_id?: string | null;
}

export interface IssueWithBranches extends Issue {
  branches: Array<{
    branch_id: string;
    branch_name: string;
    attempted_by: string;
    attempted_by_username: string;
    is_merged: boolean;
    commit_count: number;
    latest_commit_message: string;
    created_at: string;
  }>;
}

/**
 * Create an issue targeting a specific block
 * Automatically creates a branch for the issue creator
 */
export async function createIssue({
  noteId,
  slotId,
  title,
  description,
}: {
  noteId: string;
  slotId: string;
  title: string;
  description?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Check if user has access to this note and resolve role
    const [noteAccess] = await sql`
      SELECT 
        n.notebook_id,
        nb.owner_id,
        n.visibility as note_visibility,
        nb.visibility as notebook_visibility,
        COALESCE(
          (SELECT cr_note.role_type FROM collaborator_roles cr_note WHERE cr_note.resource_id = n.note_id AND cr_note.user_id = ${user.user_id} LIMIT 1),
          (SELECT cr_nb.role_type FROM collaborator_roles cr_nb WHERE cr_nb.resource_id = n.notebook_id AND cr_nb.user_id = ${user.user_id} LIMIT 1),
          CASE WHEN nb.owner_id = ${user.user_id} THEN 'OWNER' ELSE NULL END
        ) as role_type
      FROM notes n
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      WHERE n.note_id = ${noteId} AND n.deleted_at IS NULL
    `;

    if (!noteAccess) {
      return { success: false, error: 'Note not found' };
    }

    const effectiveRole = noteAccess.role_type;
    // Issue creation requires MAINTAINER or OWNER (Contributors attempt on existing issues)
    if (!['OWNER', 'MAINTAINER'].includes(effectiveRole)) {
      return { 
        success: false, 
        error: 'Only Owners and Maintainers can create issues on this note. Contributors can attempt on open issues.' 
      };
    }

    // Validate title
    if (!title || title.trim().length === 0) {
      return { success: false, error: 'Issue title is required' };
    }

    // Check if slot exists and belongs to this note
    const [slot] = await sql`
      SELECT slot_id, note_id, block_type
      FROM logical_block_slots
      WHERE slot_id = ${slotId}
      AND note_id = ${noteId}
    `;

    if (!slot) {
      return { success: false, error: 'Block not found or does not belong to this note' };
    }

    // Check if there's already an active issue for this slot
    const [existingIssue] = await sql`
      SELECT issue_id, title
      FROM issues
      WHERE target_slot_id = ${slotId}
      AND status IN ('OPEN', 'IN_PROGRESS')
    `;

    if (existingIssue) {
      return { 
        success: false, 
        error: `This block is already locked by issue: "${existingIssue.title}". Only one active issue per block allowed.` 
      };
    }

    // Create issue
    const [issue] = await sql`
      INSERT INTO issues (
        note_id,
        target_slot_id,
        creator_id,
        title,
        status
      )
      VALUES (
        ${noteId},
        ${slotId},
        ${user.user_id},
        ${title.trim()},
        'OPEN'
      )
      RETURNING issue_id, created_at
    `;

    // Auto-create branch for the creator
    const branchName = `issue-${issue.issue_id.substring(0, 8)}/${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)}`;

    // Get main branch's latest commit to copy manifest
    const [mainBranch] = await sql`
      SELECT branch_id
      FROM branches
      WHERE note_id = ${noteId}
      AND is_main = TRUE
    `;

    if (!mainBranch) {
      // Rollback issue creation
      await sql`DELETE FROM issues WHERE issue_id = ${issue.issue_id}`;
      return { success: false, error: 'Note has no main branch' };
    }

    const [latestCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${mainBranch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!latestCommit) {
      // Rollback issue creation
      await sql`DELETE FROM issues WHERE issue_id = ${issue.issue_id}`;
      return { success: false, error: 'Main branch has no commits' };
    }

    // Create issue branch
    const [branch] = await sql`
      INSERT INTO branches (
        note_id,
        issue_id,
        attempted_by,
        branch_name,
        is_main
      )
      VALUES (
        ${noteId},
        ${issue.issue_id},
        ${user.user_id},
        ${branchName},
        FALSE
      )
      RETURNING branch_id, created_at
    `;

    // Create initial commit on issue branch
    const commitHash = createHash('sha256')
      .update(JSON.stringify({
        branch_id: branch.branch_id,
        parent_commit_id: latestCommit.commit_id,
        author_id: user.user_id,
        issue_id: issue.issue_id,
        timestamp: Date.now(),
      }))
      .digest('hex');

    const [commit] = await sql`
      INSERT INTO commits (
        branch_id,
        author_id,
        commit_message,
        commit_hash,
        parent_commit_id
      )
      VALUES (
        ${branch.branch_id},
        ${user.user_id},
        ${`Issue: ${title.trim()}`},
        ${commitHash},
        ${latestCommit.commit_id}
      )
      RETURNING commit_id
    `;

    // Copy manifest from main branch
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT ${commit.commit_id}, slot_id, version_id
      FROM commit_manifests
      WHERE commit_id = ${latestCommit.commit_id}
    `;

    // Record creator in issue_contributors
    await sql`
      INSERT INTO issue_contributors (issue_id, contributor_id, assigned_by)
      VALUES (${issue.issue_id}, ${user.user_id}, ${user.user_id})
      ON CONFLICT DO NOTHING
    `;

    // Update issue status to IN_PROGRESS
    await sql`
      UPDATE issues
      SET status = 'IN_PROGRESS'
      WHERE issue_id = ${issue.issue_id}
    `;

    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${noteId}`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${noteId}/edit`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${noteId}/issues`);

    return {
      success: true,
      issue: {
        issue_id: issue.issue_id,
        branch_id: branch.branch_id,
        branch_name: branchName,
        created_at: issue.created_at,
      },
    };
  } catch (error: any) {
    console.error('Error creating issue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all issues for a note
 */
export async function getIssues(noteId: string, includeResolved = false) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Check access
    const [access] = await sql`
      SELECT 1
      FROM notes n
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      WHERE n.note_id = ${noteId}
        AND (
          nb.owner_id = ${user.user_id}
          OR n.visibility = 'PUBLIC'
          OR nb.visibility = 'PUBLIC'
          OR EXISTS (
            SELECT 1 FROM collaborator_roles cr 
            WHERE (cr.resource_id = n.note_id OR cr.resource_id = n.notebook_id)
              AND cr.user_id = ${user.user_id}
          )
        )
    `;

    if (!access) {
      return { success: false, error: 'Access denied' };
    }

    // Build status filter
    const statusFilter = includeResolved 
      ? sql`1=1` 
      : sql`i.status IN ('OPEN', 'IN_PROGRESS')`;

    // Get issues with metadata
    const issues = await sql`
      SELECT 
        i.issue_id,
        i.note_id,
        i.target_slot_id,
        i.creator_id,
        i.title,
        i.status,
        i.created_at,
        u.username as creator_username,
        lbs.block_type as target_block_type,
        COALESCE(canonical_content.content_text, fallback_version.content_text) as target_block_content,
        (
          SELECT COUNT(*)
          FROM branches b
          WHERE b.issue_id = i.issue_id
        ) as branch_count,
        (
          SELECT b.branch_id
          FROM branches b
          WHERE b.issue_id = i.issue_id
            AND b.attempted_by = ${user.user_id}
            AND b.is_merged = FALSE
          LIMIT 1
        ) as user_branch_id
      FROM issues i
      JOIN users u ON u.user_id = i.creator_id
      JOIN logical_block_slots lbs ON lbs.slot_id = i.target_slot_id
      LEFT JOIN LATERAL (
        SELECT cb.content_text
        FROM branches mb
        JOIN commits mc ON mc.branch_id = mb.branch_id
        JOIN commit_manifests mcm ON mcm.commit_id = mc.commit_id
        JOIN block_version_contents mbvc ON mbvc.version_id = mcm.version_id
        JOIN content_blobs cb ON cb.sha256 = mbvc.content_blob_hash
        WHERE mb.note_id = i.note_id
          AND mb.is_main = TRUE
          AND mcm.slot_id = i.target_slot_id
        ORDER BY mc.created_at DESC
        LIMIT 1
      ) canonical_content ON TRUE
      LEFT JOIN LATERAL (
        SELECT cb.content_text
        FROM block_version_contents bvc
        JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
        WHERE bvc.slot_id = i.target_slot_id
        ORDER BY bvc.created_at ASC
        LIMIT 1
      ) fallback_version ON TRUE
      WHERE i.note_id = ${noteId}
      AND ${statusFilter}
      ORDER BY 
        CASE i.status
          WHEN 'IN_PROGRESS' THEN 1
          WHEN 'OPEN' THEN 2
          WHEN 'MERGED' THEN 3
          WHEN 'CLOSED' THEN 4
        END,
        i.created_at DESC
    `;

    return { success: true, issues: issues as Issue[] };
  } catch (error: any) {
    console.error('Error fetching issues:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get detailed issue with all branches/attempts
 */
export async function getIssueDetail(issueId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Get issue with access check
    const [issue] = await sql`
      SELECT 
        i.issue_id,
        i.note_id,
        i.target_slot_id,
        i.creator_id,
        i.title,
        i.status,
        i.created_at,
        u.username as creator_username,
        lbs.block_type as target_block_type,
        COALESCE(canonical_content.content_text, fallback_version.content_text) as target_block_content
      FROM issues i
      JOIN users u ON u.user_id = i.creator_id
      JOIN logical_block_slots lbs ON lbs.slot_id = i.target_slot_id
      LEFT JOIN LATERAL (
        SELECT cb.content_text
        FROM branches mb
        JOIN commits mc ON mc.branch_id = mb.branch_id
        JOIN commit_manifests mcm ON mcm.commit_id = mc.commit_id
        JOIN block_version_contents mbvc ON mbvc.version_id = mcm.version_id
        JOIN content_blobs cb ON cb.sha256 = mbvc.content_blob_hash
        WHERE mb.note_id = i.note_id
          AND mb.is_main = TRUE
          AND mcm.slot_id = i.target_slot_id
        ORDER BY mc.created_at DESC
        LIMIT 1
      ) canonical_content ON TRUE
      LEFT JOIN LATERAL (
        SELECT cb.content_text
        FROM block_version_contents bvc
        JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
        WHERE bvc.slot_id = i.target_slot_id
        ORDER BY bvc.created_at ASC
        LIMIT 1
      ) fallback_version ON TRUE
      WHERE i.issue_id = ${issueId}
    `;

    if (!issue) {
      return { success: false, error: 'Issue not found' };
    }

    // Check user has access to the note
    const [access] = await sql`
      SELECT 1
      FROM notes n
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      WHERE n.note_id = ${issue.note_id}
        AND (
          nb.owner_id = ${user.user_id}
          OR n.visibility = 'PUBLIC'
          OR nb.visibility = 'PUBLIC'
          OR EXISTS (
            SELECT 1 FROM collaborator_roles cr 
            WHERE (cr.resource_id = n.note_id OR cr.resource_id = n.notebook_id)
              AND cr.user_id = ${user.user_id}
          )
        )
    `;

    if (!access) {
      return { success: false, error: 'Access denied' };
    }

    // Get all branches for this issue
    const branches = await sql`
      SELECT 
        b.branch_id,
        b.branch_name,
        b.attempted_by,
        u.username as attempted_by_username,
        b.is_merged,
        b.created_at,
        (
          SELECT COUNT(*)
          FROM commits c
          WHERE c.branch_id = b.branch_id
        ) as commit_count,
        (
          SELECT c.commit_message
          FROM commits c
          WHERE c.branch_id = b.branch_id
          ORDER BY c.created_at DESC
          LIMIT 1
        ) as latest_commit_message
      FROM branches b
      JOIN users u ON u.user_id = b.attempted_by
      WHERE b.issue_id = ${issueId}
      ORDER BY b.is_merged DESC, b.created_at DESC
    `;

    return {
      success: true,
      issue: {
        ...issue,
        branches,
      } as IssueWithBranches,
    };
  } catch (error: any) {
    console.error('Error fetching issue detail:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Close an issue without merging (creator or maintainer only)
 */
export async function closeIssue(issueId: string, reason?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Get issue with permission check
    const [issue] = await sql`
      SELECT 
        i.issue_id,
        i.note_id,
        i.creator_id,
        i.status,
        cr.role_type
      FROM issues i
      JOIN collaborator_roles cr ON cr.resource_id = i.note_id
      WHERE i.issue_id = ${issueId}
      AND cr.user_id = ${user.user_id}
    `;

    if (!issue) {
      return { success: false, error: 'Issue not found or access denied' };
    }

    // Only creator, MAINTAINER, or OWNER can close
    const canClose = 
      issue.creator_id === user.user_id ||
      ['OWNER', 'MAINTAINER'].includes(issue.role_type);

    if (!canClose) {
      return { success: false, error: 'Only issue creator, maintainers, or owners can close issues' };
    }

    // Can't close already merged/closed issues
    if (issue.status === 'MERGED') {
      return { success: false, error: 'Cannot close a merged issue' };
    }

    if (issue.status === 'CLOSED') {
      return { success: false, error: 'Issue is already closed' };
    }

    // Close the issue
    await sql`
      UPDATE issues
      SET status = 'CLOSED'
      WHERE issue_id = ${issueId}
    `;

    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${issue.note_id}`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${issue.note_id}/issues`);

    return { success: true };
  } catch (error: any) {
    console.error('Error closing issue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Assign additional contributors to work on an issue
 * Creates a new branch for the contributor
 */
export async function assignContributor({
  issueId,
  userId,
}: {
  issueId: string;
  userId: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Get issue with permission check
    const [issue] = await sql`
      SELECT 
        i.issue_id,
        i.note_id,
        i.title,
        i.status,
        cr.role_type
      FROM issues i
      JOIN collaborator_roles cr ON cr.resource_id = i.note_id
      WHERE i.issue_id = ${issueId}
      AND cr.user_id = ${user.user_id}
    `;

    if (!issue) {
      return { success: false, error: 'Issue not found or access denied' };
    }

    // Only MAINTAINER or OWNER can assign contributors
    if (!['OWNER', 'MAINTAINER'].includes(issue.role_type)) {
      return { success: false, error: 'Only maintainers and owners can assign contributors' };
    }

    // Issue must be open or in progress
    if (!['OPEN', 'IN_PROGRESS'].includes(issue.status)) {
      return { success: false, error: 'Can only assign contributors to open issues' };
    }

    // Check if user to assign has access to the note
    const [contributorAccess] = await sql`
      SELECT cr.role_type
      FROM collaborator_roles cr
      WHERE cr.resource_id = ${issue.note_id}
      AND cr.user_id = ${userId}
    `;

    if (!contributorAccess) {
      return { success: false, error: 'User does not have access to this note' };
    }

    // Check if user already has a branch for this issue
    const [existingBranch] = await sql`
      SELECT branch_id
      FROM branches
      WHERE issue_id = ${issueId}
      AND attempted_by = ${userId}
    `;

    if (existingBranch) {
      return { success: false, error: 'User already has a branch for this issue' };
    }

    // Get user info
    const [contributor] = await sql`
      SELECT username
      FROM users
      WHERE user_id = ${userId}
    `;

    // Get main branch's latest commit
    const [mainBranch] = await sql`
      SELECT branch_id
      FROM branches
      WHERE note_id = ${issue.note_id}
      AND is_main = TRUE
    `;

    const [latestCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${mainBranch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // Create branch for the contributor
    const branchName = `issue-${issueId.substring(0, 8)}/${contributor.username}-attempt`;

    const [branch] = await sql`
      INSERT INTO branches (
        note_id,
        issue_id,
        attempted_by,
        branch_name,
        is_main
      )
      VALUES (
        ${issue.note_id},
        ${issueId},
        ${userId},
        ${branchName},
        FALSE
      )
      RETURNING branch_id, created_at
    `;

    // Create initial commit
    const commitHash = createHash('sha256')
      .update(JSON.stringify({
        branch_id: branch.branch_id,
        parent_commit_id: latestCommit.commit_id,
        author_id: userId,
        issue_id: issueId,
        timestamp: Date.now(),
      }))
      .digest('hex');

    const [commit] = await sql`
      INSERT INTO commits (
        branch_id,
        author_id,
        commit_message,
        commit_hash,
        parent_commit_id
      )
      VALUES (
        ${branch.branch_id},
        ${userId},
        ${`Assigned to issue: ${issue.title}`},
        ${commitHash},
        ${latestCommit.commit_id}
      )
      RETURNING commit_id
    `;

    // Copy manifest
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT ${commit.commit_id}, slot_id, version_id
      FROM commit_manifests
      WHERE commit_id = ${latestCommit.commit_id}
    `;

    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${issue.note_id}/issues`);

    return {
      success: true,
      branch: {
        branch_id: branch.branch_id,
        branch_name: branchName,
      },
    };
  } catch (error: any) {
    console.error('Error assigning contributor:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Self-assign / Contribute to an open or in-progress issue
 * Creates or retrieves the user's attempt branch and returns the branchId
 */
export async function contributeToIssue(issueId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // 1. Get issue details and check access
    const [issue] = await sql`
      SELECT 
        i.issue_id,
        i.note_id,
        i.title,
        i.status,
        i.target_slot_id,
        n.notebook_id,
        COALESCE(
          (SELECT cr_note.role_type FROM collaborator_roles cr_note WHERE cr_note.resource_id = i.note_id AND cr_note.user_id = ${user.user_id} LIMIT 1),
          (SELECT cr_nb.role_type FROM collaborator_roles cr_nb WHERE cr_nb.resource_id = n.notebook_id AND cr_nb.user_id = ${user.user_id} LIMIT 1),
          CASE WHEN nb.owner_id = ${user.user_id} THEN 'OWNER' ELSE NULL END
        ) as role_type
      FROM issues i
      JOIN notes n ON n.note_id = i.note_id
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      WHERE i.issue_id = ${issueId}
        AND (
          nb.owner_id = ${user.user_id}
          OR n.visibility = 'PUBLIC'
          OR nb.visibility = 'PUBLIC'
          OR EXISTS (
            SELECT 1 FROM collaborator_roles cr 
            WHERE (cr.resource_id = i.note_id OR cr.resource_id = n.notebook_id)
              AND cr.user_id = ${user.user_id}
          )
        )
    `;

    if (!issue) {
      return { success: false, error: 'Issue not found or access denied' };
    }

    if (!['OPEN', 'IN_PROGRESS'].includes(issue.status)) {
      return { success: false, error: 'This issue is already resolved or closed' };
    }

    // Role check: must have at least CONTRIBUTOR role
    if (!['OWNER', 'MAINTAINER', 'CONTRIBUTOR'].includes(issue.role_type)) {
      return { 
        success: false, 
        error: 'You need Contributor, Maintainer, or Owner access to work on this issue.' 
      };
    }

    // 2. Check if user already has an attempt branch for this issue
    const [existingBranch] = await sql`
      SELECT branch_id, branch_name
      FROM branches
      WHERE issue_id = ${issueId}
      AND attempted_by = ${user.user_id}
      AND is_merged = FALSE
    `;

    if (existingBranch) {
      return { 
        success: true, 
        branchId: existingBranch.branch_id,
        branchName: existingBranch.branch_name,
        alreadyExisted: true,
      };
    }

    // 3. Get main branch latest commit
    const [mainBranch] = await sql`
      SELECT branch_id
      FROM branches
      WHERE note_id = ${issue.note_id}
      AND is_main = TRUE
    `;

    if (!mainBranch) {
      return { success: false, error: 'Note has no canonical main branch' };
    }

    const [latestCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${mainBranch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!latestCommit) {
      return { success: false, error: 'Main branch has no commits' };
    }

    // 4. Create attempt branch for this user
    const branchSlug = `issue-${issue.issue_id.substring(0, 8)}/${user.username}`;
    const [branch] = await sql`
      INSERT INTO branches (
        note_id,
        issue_id,
        attempted_by,
        branch_name,
        is_main
      )
      VALUES (
        ${issue.note_id},
        ${issue.issue_id},
        ${user.user_id},
        ${branchSlug},
        FALSE
      )
      RETURNING branch_id, branch_name
    `;

    // 5. Create initial commit on attempt branch
    const commitHash = createHash('sha256')
      .update(JSON.stringify({
        branch_id: branch.branch_id,
        parent_commit_id: latestCommit.commit_id,
        author_id: user.user_id,
        issue_id: issue.issue_id,
        timestamp: Date.now(),
      }))
      .digest('hex');

    const [commit] = await sql`
      INSERT INTO commits (
        branch_id,
        author_id,
        commit_message,
        commit_hash,
        parent_commit_id
      )
      VALUES (
        ${branch.branch_id},
        ${user.user_id},
        ${`Attempt fix for Issue #${issue.issue_id.substring(0, 8)}: ${issue.title}`},
        ${commitHash},
        ${latestCommit.commit_id}
      )
      RETURNING commit_id
    `;

    // 6. Copy commit manifests from main commit
    await sql`
      INSERT INTO commit_manifests (commit_id, slot_id, version_id)
      SELECT ${commit.commit_id}, slot_id, version_id
      FROM commit_manifests
      WHERE commit_id = ${latestCommit.commit_id}
    `;

    // 7. Record contributor in issue_contributors
    await sql`
      INSERT INTO issue_contributors (issue_id, contributor_id, assigned_by)
      VALUES (${issue.issue_id}, ${user.user_id}, ${user.user_id})
      ON CONFLICT DO NOTHING
    `;

    // 8. Update issue status to IN_PROGRESS
    await sql`
      UPDATE issues
      SET status = 'IN_PROGRESS'
      WHERE issue_id = ${issue.issue_id}
    `;

    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${issue.note_id}`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${issue.note_id}/branches`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${issue.note_id}/issues`);

    return {
      success: true,
      branchId: branch.branch_id,
      branchName: branch.branch_name,
      alreadyExisted: false,
    };
  } catch (error: any) {
    console.error('Error contributing to issue:', error);
    return { success: false, error: error.message || 'Failed to contribute to issue' };
  }
}
