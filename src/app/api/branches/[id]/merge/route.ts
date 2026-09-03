import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID, createHash } from 'crypto';

/**
 * POST /api/branches/[id]/merge
 * Merges an attempt branch into main.
 * 
 * Strict Role Separation:
 * - OWNER: Allowed (200 OK)
 * - MAINTAINER: Allowed (200 OK)
 * - CONTRIBUTOR: BLOCKED (403 Forbidden)
 * - UNAUTHENTICATED: BLOCKED (401 Unauthorized)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUserId = request.cookies.get('session_user_id')?.value;
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const { id: branchId } = await params;

    // 1. Fetch branch details
    const [branch] = await sql`
      SELECT 
        b.branch_id,
        b.branch_name,
        b.note_id,
        b.is_main,
        b.is_merged,
        b.issue_id,
        n.notebook_id,
        n.title as note_title
      FROM branches b
      JOIN notes n ON n.note_id = b.note_id
      WHERE b.branch_id = ${branchId}
    `;

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found.' },
        { status: 404 }
      );
    }

    if (branch.is_main) {
      return NextResponse.json(
        { success: false, error: 'Cannot merge canonical main branch into itself.' },
        { status: 400 }
      );
    }

    if (branch.is_merged) {
      return NextResponse.json(
        { success: false, error: 'This branch has already been merged.' },
        { status: 400 }
      );
    }

    // 2. Resolve user's role on the note or parent notebook
    const [noteRole] = await sql`
      SELECT role_type 
      FROM collaborator_roles 
      WHERE resource_id = ${branch.note_id} AND user_id = ${sessionUserId}
    `;

    const [notebookRole] = await sql`
      SELECT role_type 
      FROM collaborator_roles 
      WHERE resource_id = ${branch.notebook_id} AND user_id = ${sessionUserId}
    `;

    const [notebookOwner] = await sql`
      SELECT owner_id 
      FROM notebooks 
      WHERE notebook_id = ${branch.notebook_id}
    `;

    const isOwner = notebookOwner?.owner_id === sessionUserId;
    const effectiveRole = isOwner ? 'OWNER' : (noteRole?.role_type || notebookRole?.role_type || 'NONE');

    // 3. Authorization Check: Only OWNER or MAINTAINER can merge
    if (effectiveRole !== 'OWNER' && effectiveRole !== 'MAINTAINER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden. Branch merge capability requires MAINTAINER or OWNER role. Contributors can only draft attempt branches.',
          required_roles: ['OWNER', 'MAINTAINER'],
          your_role: effectiveRole,
        },
        { status: 403 }
      );
    }

    // 4. Find latest commit on attempt branch
    const [attemptCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${branchId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // 5. Find main branch
    const [mainBranch] = await sql`
      SELECT branch_id
      FROM branches
      WHERE note_id = ${branch.note_id} AND is_main = TRUE
    `;

    const [mainCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${mainBranch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // 6. Create merge commit on main and mark branch as merged
    const mergeCommitId = randomUUID();

    const commitHash = createHash('sha256')
      .update(JSON.stringify({
        branch_id: mainBranch.branch_id,
        parent_commit_id: mainCommit?.commit_id || null,
        merge_parent_commit_id: attemptCommit?.commit_id || null,
        author_id: sessionUserId,
        timestamp: Date.now(),
      }))
      .digest('hex');

    await sql`
      INSERT INTO commits (
        commit_id,
        branch_id,
        parent_commit_id,
        merge_parent_commit_id,
        author_id,
        commit_message,
        commit_hash
      ) VALUES (
        ${mergeCommitId},
        ${mainBranch.branch_id},
        ${mainCommit?.commit_id || null},
        ${attemptCommit?.commit_id || null},
        ${sessionUserId},
        ${'Merge branch ' + branch.branch_name + ' into main'},
        ${commitHash}
      )
    `;

    // Clone manifest to merge commit
    if (attemptCommit) {
      await sql`
        INSERT INTO commit_manifests (commit_id, slot_id, version_id)
        SELECT ${mergeCommitId}, slot_id, version_id
        FROM commit_manifests
        WHERE commit_id = ${attemptCommit.commit_id}
        ON CONFLICT DO NOTHING
      `;
    }

    // Update branch to merged state
    await sql`
      UPDATE branches
      SET 
        is_merged = TRUE,
        selected_by = ${sessionUserId},
        selected_at = now()
      WHERE branch_id = ${branchId}
    `;

    // Transition associated issue to MERGED (releasing block lock)
    if (branch.issue_id) {
      await sql`
        UPDATE issues
        SET status = 'MERGED'
        WHERE issue_id = ${branch.issue_id}
      `;
    }

    return NextResponse.json(
      {
        success: true,
        message: `Branch "${branch.branch_name}" successfully merged into main by ${effectiveRole}.`,
        merge_commit_id: mergeCommitId,
        merged_by: sessionUserId,
        role_verified: effectiveRole,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API POST /api/branches/[id]/merge error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
