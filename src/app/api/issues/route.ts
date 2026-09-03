import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/issues
 * Create a block-level issue targeting a specific slot.
 * Automatically acquires slot lock and spawns an attempt branch.
 * 
 * Responses:
 * - 201 Created: Issue created and branch spawned
 * - 400 Bad Request: Missing required parameters
 * - 401 Unauthorized: Unauthenticated
 * - 409 Conflict: Target slot is already locked by an open issue
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUserId = request.cookies.get('session_user_id')?.value;
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { noteId, slotId, title, description } = body;

    if (!noteId || !slotId || !title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'noteId, slotId, and title are required.' },
        { status: 400 }
      );
    }

    // 1. Check if the block slot is already locked by an active issue
    const [existingActiveIssue] = await sql`
      SELECT issue_id, title, status, creator_id
      FROM issues
      WHERE target_slot_id = ${slotId}
        AND status IN ('OPEN', 'IN_PROGRESS')
      LIMIT 1
    `;

    if (existingActiveIssue) {
      return NextResponse.json(
        {
          success: false,
          error: `Conflict. Slot is already locked by active Issue #${existingActiveIssue.issue_id.substring(0, 8)}: "${existingActiveIssue.title}". Wait for it to be merged or closed.`,
          active_issue_id: existingActiveIssue.issue_id,
        },
        { status: 409 }
      );
    }

    // 2. Fetch user username for branch naming
    const [user] = await sql`
      SELECT username FROM users WHERE user_id = ${sessionUserId}
    `;

    const username = user?.username || 'user';
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 25);

    const issueId = randomUUID();
    const branchId = randomUUID();
    const branchName = `issue-${slug}/${username}`;

    // 3. Create Issue
    await sql`
      INSERT INTO issues (
        issue_id,
        note_id,
        target_slot_id,
        creator_id,
        title,
        description,
        status
      ) VALUES (
        ${issueId},
        ${noteId},
        ${slotId},
        ${sessionUserId},
        ${title.trim()},
        ${description?.trim() || null},
        'OPEN'
      )
    `;

    // 4. Find parent commit from main branch
    const [mainBranch] = await sql`
      SELECT branch_id FROM branches WHERE note_id = ${noteId} AND is_main = TRUE
    `;

    const [latestMainCommit] = await sql`
      SELECT commit_id FROM commits WHERE branch_id = ${mainBranch.branch_id} ORDER BY created_at DESC LIMIT 1
    `;

    // 5. Spawn isolated attempt branch for the contributor
    await sql`
      INSERT INTO branches (
        branch_id,
        note_id,
        branch_name,
        is_main,
        issue_id
      ) VALUES (
        ${branchId},
        ${noteId},
        ${branchName},
        FALSE,
        ${issueId}
      )
    `;

    // 6. Spawn initial attempt commit
    const initialCommitId = randomUUID();
    await sql`
      INSERT INTO commits (
        commit_id,
        branch_id,
        parent_commit_id,
        author_id,
        commit_message
      ) VALUES (
        ${initialCommitId},
        ${branchId},
        ${latestMainCommit?.commit_id || null},
        ${sessionUserId},
        ${'Start work on issue: ' + title.trim()}
      )
    `;

    // Clone parent manifest
    if (latestMainCommit) {
      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        SELECT ${initialCommitId}, slot_id, version_id
        FROM commit_manifests
        WHERE commit_id = ${latestMainCommit.commit_id}
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json(
      {
        success: true,
        issue: {
          issue_id: issueId,
          note_id: noteId,
          target_slot_id: slotId,
          title: title.trim(),
          status: 'OPEN',
          branch_id: branchId,
          branch_name: branchName,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('API POST /api/issues error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
