'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { createHash } from 'crypto';

export interface Branch {
  branch_id: string;
  note_id: string;
  issue_id: string | null;
  attempted_by: string | null;
  branch_name: string;
  is_main: boolean;
  is_merged: boolean;
  selected_by: string | null;
  selected_at: string | null;
  created_at: string;
  latest_commit_id?: string;
  latest_commit_message?: string;
  latest_commit_author?: string;
  latest_commit_date?: string;
  commit_count?: number;
}

export interface BranchWithCommits extends Branch {
  commits: Array<{
    commit_id: string;
    commit_message: string;
    author_username: string;
    created_at: string;
    parent_commit_id: string | null;
  }>;
}

/**
 * Get all branches for a note with optional commit history
 */
export async function getBranches(noteId: string, includeCommits = false) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Check if user has access to this note
    const [access] = await sql`
      SELECT cr.role_type
      FROM collaborator_roles cr
      WHERE cr.resource_id = ${noteId}
      AND cr.user_id = ${user.user_id}
    `;

    if (!access) {
      return { success: false, error: 'Access denied' };
    }

    // Get branches with latest commit info
    const branches = await sql`
      SELECT 
        b.branch_id,
        b.note_id,
        b.issue_id,
        b.attempted_by,
        b.branch_name,
        b.is_main,
        b.is_merged,
        b.selected_by,
        b.selected_at,
        first_c.created_at as created_at,
        c.commit_id as latest_commit_id,
        c.commit_message as latest_commit_message,
        u.username as latest_commit_author,
        c.created_at as latest_commit_date,
        (
          SELECT COUNT(*)
          FROM commits c2
          WHERE c2.branch_id = b.branch_id
        ) as commit_count
      FROM branches b
      LEFT JOIN LATERAL (
        SELECT created_at
        FROM commits
        WHERE branch_id = b.branch_id
        ORDER BY created_at ASC
        LIMIT 1
      ) first_c ON TRUE
      LEFT JOIN LATERAL (
        SELECT commit_id, commit_message, author_id, created_at
        FROM commits
        WHERE branch_id = b.branch_id
        ORDER BY created_at DESC
        LIMIT 1
      ) c ON TRUE
      LEFT JOIN users u ON u.user_id = c.author_id
      WHERE b.note_id = ${noteId}
      ORDER BY b.is_main DESC, first_c.created_at DESC
    `;

    if (includeCommits) {
      // Fetch commit history for each branch
      const branchesWithCommits: BranchWithCommits[] = [];
      
      for (const branch of branches) {
        const commits = await sql`
          SELECT 
            c.commit_id,
            c.commit_message,
            u.username as author_username,
            c.created_at,
            c.parent_commit_id
          FROM commits c
          JOIN users u ON u.user_id = c.author_id
          WHERE c.branch_id = ${branch.branch_id}
          ORDER BY c.created_at DESC
          LIMIT 50
        `;

        branchesWithCommits.push({
          ...(branch as Branch),
          commits: commits as any[],
        } as BranchWithCommits);
      }

      return { success: true, branches: branchesWithCommits };
    }

    return { success: true, branches: branches as Branch[] };
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    return { success: false, error: error.message };
  }
}

/**
 * NOTE: Branch creation is now done through issues.
 * - MAINTAINER/OWNER: Edit main branch directly (no branch creation needed)
 * - CONTRIBUTOR: Must create an issue, which auto-creates a branch
 * 
 * This enforces the constraint that all non-main branches must have an issue_id.
 */

/**
 * Merge a branch into main branch (3-way merge)
 */
export async function mergeBranch({
  branchId,
  mergeMessage,
}: {
  branchId: string;
  mergeMessage?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Get branch details and check permissions
    const [branch] = await sql`
      SELECT 
        b.branch_id,
        b.note_id,
        b.branch_name,
        b.is_main,
        b.is_merged,
        b.issue_id,
        cr.role_type
      FROM branches b
      JOIN notes n ON n.note_id = b.note_id
      JOIN collaborator_roles cr ON cr.resource_id = b.note_id
      WHERE b.branch_id = ${branchId}
      AND cr.user_id = ${user.user_id}
    `;

    if (!branch) {
      return { success: false, error: 'Branch not found or access denied' };
    }

    // Only MAINTAINER or OWNER can merge
    if (!['OWNER', 'MAINTAINER'].includes(branch.role_type)) {
      return { success: false, error: 'Insufficient permissions. Only maintainers and owners can merge branches.' };
    }

    // Can't merge main branch
    if (branch.is_main) {
      return { success: false, error: 'Cannot merge main branch' };
    }

    // Can't merge already merged branch
    if (branch.is_merged) {
      return { success: false, error: 'Branch is already merged' };
    }

    // Perform merge
    let result;
    try {
      // Get main branch
      const [mainBranch] = await sql`
        SELECT branch_id
        FROM branches
        WHERE note_id = ${branch.note_id}
        AND is_main = TRUE
      `;

      if (!mainBranch) {
        return { success: false, error: 'Main branch not found' };
      }

      // Get latest commits from both branches
      const [sourceCommit] = await sql`
        SELECT commit_id, created_at
        FROM commits
        WHERE branch_id = ${branchId}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const [mainCommit] = await sql`
        SELECT commit_id, created_at
        FROM commits
        WHERE branch_id = ${mainBranch.branch_id}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!sourceCommit || !mainCommit) {
        return { success: false, error: 'Could not find commits for merge' };
      }

      // Find common ancestor (simple: use parent of branch creation)
      const [ancestorCommit] = await sql`
        SELECT c.commit_id
        FROM commits c
        WHERE c.commit_id = (
          SELECT parent_commit_id
          FROM commits
          WHERE branch_id = ${branchId}
          ORDER BY created_at ASC
          LIMIT 1
        )
      `;

      // Get manifests for 3-way merge
      const baseManifest = ancestorCommit ? await sql`
        SELECT slot_id, version_id
        FROM commit_manifests
        WHERE commit_id = ${ancestorCommit.commit_id}
      ` : [];

      const mainManifest = await sql`
        SELECT slot_id, version_id
        FROM commit_manifests
        WHERE commit_id = ${mainCommit.commit_id}
      `;

      const branchManifest = await sql`
        SELECT slot_id, version_id
        FROM commit_manifests
        WHERE commit_id = ${sourceCommit.commit_id}
      `;

      // Create maps for easier lookup
      const baseMap = new Map(baseManifest.map((m: any) => [m.slot_id, m.version_id]));
      const mainMap = new Map(mainManifest.map((m: any) => [m.slot_id, m.version_id]));
      const branchMap = new Map(branchManifest.map((m: any) => [m.slot_id, m.version_id]));

      // Perform 3-way merge
      const mergedManifest: Array<{ slot_id: string; version_id: string }> = [];
      const allSlots = new Set([
        ...baseMap.keys(),
        ...mainMap.keys(),
        ...branchMap.keys(),
      ]);

      let hasConflicts = false;
      const conflicts: Array<{ slot_id: string; reason: string }> = [];

      for (const slotId of allSlots) {
        const baseVersion = baseMap.get(slotId);
        const mainVersion = mainMap.get(slotId);
        const branchVersion = branchMap.get(slotId);

        // Case 1: Slot only in branch (added in branch)
        if (!baseVersion && !mainVersion && branchVersion) {
          mergedManifest.push({ slot_id: slotId, version_id: branchVersion });
          continue;
        }

        // Case 2: Slot only in main (added in main)
        if (!baseVersion && mainVersion && !branchVersion) {
          mergedManifest.push({ slot_id: slotId, version_id: mainVersion });
          continue;
        }

        // Case 3: Slot in base and branch, but not in main (deleted in main)
        if (baseVersion && !mainVersion && branchVersion) {
          // Main deleted it, keep it deleted
          continue;
        }

        // Case 4: Slot in base and main, but not in branch (deleted in branch)
        if (baseVersion && mainVersion && !branchVersion) {
          // Branch deleted it, apply deletion
          continue;
        }

        // Case 5: Slot unchanged in main, changed in branch
        if (baseVersion === mainVersion && branchVersion !== baseVersion) {
          mergedManifest.push({ slot_id: slotId, version_id: branchVersion });
          continue;
        }

        // Case 6: Slot changed in main, unchanged in branch
        if (baseVersion !== mainVersion && branchVersion === baseVersion) {
          mergedManifest.push({ slot_id: slotId, version_id: mainVersion });
          continue;
        }

        // Case 7: Slot unchanged in both
        if (mainVersion === branchVersion) {
          mergedManifest.push({ slot_id: slotId, version_id: mainVersion! });
          continue;
        }

        // Case 8: CONFLICT - both changed the same slot differently
        hasConflicts = true;
        conflicts.push({
          slot_id: slotId,
          reason: 'Both branches modified this block',
        });
        // For now, take branch version (can be made configurable)
        mergedManifest.push({ slot_id: slotId, version_id: branchVersion! });
      }

      // Create merge commit on main branch
      const commitHash = createHash('sha256')
        .update(JSON.stringify({
          branch_id: mainBranch.branch_id,
          parent_commit_id: mainCommit.commit_id,
          merge_from: sourceCommit.commit_id,
          author_id: user.user_id,
          timestamp: Date.now(),
        }))
        .digest('hex');

      const [mergeCommit] = await sql`
        INSERT INTO commits (
          branch_id,
          author_id,
          commit_message,
          commit_hash,
          parent_commit_id
        )
        VALUES (
          ${mainBranch.branch_id},
          ${user.user_id},
          ${mergeMessage || `Merge branch '${branch.branch_name}' into main`},
          ${commitHash},
          ${mainCommit.commit_id}
        )
        RETURNING commit_id, created_at
      `;

      // Insert merged manifest
      if (mergedManifest.length > 0) {
        const values = mergedManifest.map(m => `('${mergeCommit.commit_id}', '${m.slot_id}', '${m.version_id}')`).join(',');
        await sql.unsafe(`
          INSERT INTO commit_manifests (commit_id, slot_id, version_id)
          VALUES ${values}
        `);
      }

      // Mark branch as merged
      await sql`
        UPDATE branches
        SET 
          is_merged = TRUE,
          selected_by = ${user.user_id},
          selected_at = NOW()
        WHERE branch_id = ${branchId}
      `;

      // If this was an issue branch, update the issue status
      if (branch.issue_id) {
        await sql`
          UPDATE issues
          SET status = 'MERGED'
          WHERE issue_id = ${branch.issue_id}
        `;
      }

      result = {
        merge_commit_id: mergeCommit.commit_id,
        merged_at: mergeCommit.created_at,
        conflicts: hasConflicts ? conflicts : null,
        blocks_changed: mergedManifest.length,
      };
    } catch (error: any) {
      console.error('Merge error:', error);
      throw error;
    }

    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${branch.note_id}`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${branch.note_id}/branches`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${branch.note_id}/edit`);

    return { 
      success: true, 
      merge: result,
      warning: result.conflicts && result.conflicts.length > 0 ? 'Merge completed with conflicts. Branch changes were preferred.' : null,
    };
  } catch (error: any) {
    console.error('Error merging branch:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a branch (only non-main, non-merged branches)
 */
export async function deleteBranch(branchId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Get branch details
    const [branch] = await sql`
      SELECT 
        b.branch_id,
        b.note_id,
        b.branch_name,
        b.is_main,
        b.is_merged,
        b.issue_id,
        cr.role_type
      FROM branches b
      JOIN collaborator_roles cr ON cr.resource_id = b.note_id
      WHERE b.branch_id = ${branchId}
      AND cr.user_id = ${user.user_id}
    `;

    if (!branch) {
      return { success: false, error: 'Branch not found or access denied' };
    }

    // Can't delete main branch
    if (branch.is_main) {
      return { success: false, error: 'Cannot delete main branch' };
    }

    // Can't delete merged branch (keep for history)
    if (branch.is_merged) {
      return { success: false, error: 'Cannot delete merged branch. Merged branches are kept for history.' };
    }

    // Can't delete issue branch (must close issue instead)
    if (branch.issue_id) {
      return { success: false, error: 'Cannot delete issue branch directly. Close or merge the issue instead.' };
    }

    // Only MAINTAINER, OWNER, or the branch creator can delete
    const isCreator = branch.attempted_by === user.user_id;
    const canDelete = ['OWNER', 'MAINTAINER'].includes(branch.role_type) || isCreator;

    if (!canDelete) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Delete branch (cascades to commits and manifests)
    await sql`
      DELETE FROM branches
      WHERE branch_id = ${branchId}
    `;

    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${branch.note_id}`);
    revalidatePath(`/dashboard/notebooks/[notebookId]/notes/${branch.note_id}/branches`);

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting branch:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get branch comparison (diff between branch and main)
 */
export async function compareBranches({
  noteId,
  sourceBranchId,
  targetBranchId,
}: {
  noteId: string;
  sourceBranchId: string;
  targetBranchId?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Check access
    const [access] = await sql`
      SELECT cr.role_type
      FROM collaborator_roles cr
      WHERE cr.resource_id = ${noteId}
      AND cr.user_id = ${user.user_id}
    `;

    if (!access) {
      return { success: false, error: 'Access denied' };
    }

    // Get target branch (default to main)
    let targetBranch;
    if (targetBranchId) {
      [targetBranch] = await sql`
        SELECT branch_id, branch_name
        FROM branches
        WHERE branch_id = ${targetBranchId}
        AND note_id = ${noteId}
      `;
    } else {
      [targetBranch] = await sql`
        SELECT branch_id, branch_name
        FROM branches
        WHERE note_id = ${noteId}
        AND is_main = TRUE
      `;
    }

    if (!targetBranch) {
      return { success: false, error: 'Target branch not found' };
    }

    // Get latest commits from both branches
    const [sourceCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${sourceBranchId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [targetCommit] = await sql`
      SELECT commit_id
      FROM commits
      WHERE branch_id = ${targetBranch.branch_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!sourceCommit || !targetCommit) {
      return { success: false, error: 'Could not find commits for comparison' };
    }

    // Get manifests
    const sourceManifest = await sql`
      SELECT 
        cm.slot_id,
        cm.version_id,
        bv.block_type,
        cb.content_text,
        cs.lexorank_key
      FROM commit_manifests cm
      JOIN block_versions bv ON bv.version_id = cm.version_id
      JOIN content_blobs cb ON cb.sha256 = bv.content_sha256
      JOIN content_slots cs ON cs.slot_id = cm.slot_id
      WHERE cm.commit_id = ${sourceCommit.commit_id}
      ORDER BY cs.lexorank_key
    `;

    const targetManifest = await sql`
      SELECT 
        cm.slot_id,
        cm.version_id,
        bv.block_type,
        cb.content_text,
        cs.lexorank_key
      FROM commit_manifests cm
      JOIN block_versions bv ON bv.version_id = cm.version_id
      JOIN content_blobs cb ON cb.sha256 = bv.content_sha256
      JOIN content_slots cs ON cs.slot_id = cm.slot_id
      WHERE cm.commit_id = ${targetCommit.commit_id}
      ORDER BY cs.lexorank_key
    `;

    // Build maps
    const sourceMap = new Map(sourceManifest.map((m: any) => [m.slot_id, m]));
    const targetMap = new Map(targetManifest.map((m: any) => [m.slot_id, m]));

    // Calculate diff
    const changes: Array<{
      slot_id: string;
      change_type: 'added' | 'modified' | 'deleted' | 'unchanged';
      source_content?: string;
      target_content?: string;
      source_type?: string;
      target_type?: string;
    }> = [];

    const allSlots = new Set([...sourceMap.keys(), ...targetMap.keys()]);

    for (const slotId of allSlots) {
      const source = sourceMap.get(slotId);
      const target = targetMap.get(slotId);

      if (source && !target) {
        changes.push({
          slot_id: slotId,
          change_type: 'added',
          source_content: source.content_text,
          source_type: source.block_type,
        });
      } else if (!source && target) {
        changes.push({
          slot_id: slotId,
          change_type: 'deleted',
          target_content: target.content_text,
          target_type: target.block_type,
        });
      } else if (source && target) {
        if (source.version_id !== target.version_id) {
          changes.push({
            slot_id: slotId,
            change_type: 'modified',
            source_content: source.content_text,
            target_content: target.content_text,
            source_type: source.block_type,
            target_type: target.block_type,
          });
        } else {
          changes.push({
            slot_id: slotId,
            change_type: 'unchanged',
            source_content: source.content_text,
            source_type: source.block_type,
          });
        }
      }
    }

    const stats = {
      added: changes.filter(c => c.change_type === 'added').length,
      modified: changes.filter(c => c.change_type === 'modified').length,
      deleted: changes.filter(c => c.change_type === 'deleted').length,
      unchanged: changes.filter(c => c.change_type === 'unchanged').length,
    };

    return {
      success: true,
      comparison: {
        source_branch_id: sourceBranchId,
        target_branch_id: targetBranch.branch_id,
        target_branch_name: targetBranch.branch_name,
        changes,
        stats,
      },
    };
  } catch (error: any) {
    console.error('Error comparing branches:', error);
    return { success: false, error: error.message };
  }
}
