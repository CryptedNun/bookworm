'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';

export interface UnmergedBranchItem {
  branch_id: string;
  branch_name: string;
  created_at: string;
  note_id: string;
  note_title: string;
  notebook_id: string;
  notebook_title: string;
  author_name: string;
  issue_id?: string;
  issue_title?: string;
  commits_count: number;
}

export interface DashboardNoteItem {
  note_id: string;
  notebook_id: string;
  title: string;
  visibility: string;
  created_at: string;
  display_order: number;
  blocks_count: number;
  active_branches_count: number;
  open_issues_count: number;
}

export interface ActivityItem {
  activity_type: 'COMMIT' | 'EDITION' | 'ISSUE';
  id: string;
  title: string;
  actor: string;
  context: string;
  created_at: string;
}

export interface StorageAnalytics {
  uniqueBlobs: number;
  storedBytes: number;
  totalVersions: number;
  totalCommits: number;
  totalEditions: number;
  mergedBranches: number;
  totalIssues: number;
}

export async function getDashboardOverview() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // 1. Fetch unmerged attempt branches awaiting review across notebooks the user can see
    const unmergedBranches = await sql`
      SELECT DISTINCT ON (b.branch_id)
        b.branch_id,
        b.branch_name,
        b.created_at,
        b.note_id,
        n.title as note_title,
        n.notebook_id,
        nb.title as notebook_title,
        COALESCE(u.username, 'Contributor') as author_name,
        iss.issue_id,
        iss.title as issue_title,
        (SELECT COUNT(*)::int FROM commits c WHERE c.branch_id = b.branch_id) as commits_count
      FROM branches b
      JOIN notes n ON n.note_id = b.note_id
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      LEFT JOIN issues iss ON iss.issue_id = b.issue_id
      LEFT JOIN commits c_first ON c_first.branch_id = b.branch_id
      LEFT JOIN users u ON u.user_id = c_first.author_id
      WHERE b.is_main = FALSE 
        AND b.is_merged = FALSE
        AND (
          nb.owner_id = ${user.user_id}
          OR EXISTS (
            SELECT 1 FROM collaborator_roles cr 
            WHERE (cr.resource_id = nb.notebook_id OR cr.resource_id = n.note_id) 
              AND cr.user_id = ${user.user_id}
              AND cr.role_type IN ('OWNER', 'MAINTAINER')
          )
        )
      ORDER BY b.branch_id, b.created_at DESC
      LIMIT 10
    `;

    // 2. Fetch all notes in user's notebooks with stats
    const notes = await sql`
      SELECT 
        n.note_id,
        n.notebook_id,
        n.title,
        n.visibility,
        r.created_at,
        n.display_order,
        COALESCE(
          (SELECT cr_note.role_type FROM collaborator_roles cr_note WHERE cr_note.resource_id = n.note_id AND cr_note.user_id = ${user.user_id} LIMIT 1),
          (SELECT cr_nb.role_type FROM collaborator_roles cr_nb WHERE cr_nb.resource_id = n.notebook_id AND cr_nb.user_id = ${user.user_id} LIMIT 1),
          CASE WHEN nb.owner_id = ${user.user_id} THEN 'OWNER' ELSE 'VIEWER' END
        ) as role_type,
        (SELECT COUNT(*)::int FROM logical_block_slots lbs WHERE lbs.note_id = n.note_id) as blocks_count,
        (SELECT COUNT(*)::int FROM branches b WHERE b.note_id = n.note_id AND b.is_main = FALSE AND b.is_merged = FALSE) as active_branches_count,
        (SELECT COUNT(*)::int FROM issues i WHERE i.note_id = n.note_id AND i.status IN ('OPEN', 'IN_PROGRESS')) as open_issues_count
      FROM notes n
      JOIN resources r ON r.resource_id = n.note_id
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      WHERE n.deleted_at IS NULL
        AND (
          nb.owner_id = ${user.user_id}
          OR nb.visibility = 'PUBLIC'
          OR EXISTS (
            SELECT 1 FROM collaborator_roles cr 
            WHERE (cr.resource_id = nb.notebook_id OR cr.resource_id = n.note_id) AND cr.user_id = ${user.user_id}
          )
        )
      ORDER BY n.display_order ASC, r.created_at ASC
    `;

    // 3. Fetch user's collaborator roles on notebooks
    const roles = await sql`
      SELECT 
        cr.resource_id as notebook_id,
        cr.role_type
      FROM collaborator_roles cr
      WHERE cr.user_id = ${user.user_id}
    `;

    // 4. Content-Addressed Storage (CAS) & System Analytics
    const [casStats] = await sql`
      SELECT 
        COUNT(DISTINCT cb.sha256)::int as unique_blobs,
        COALESCE(SUM(cb.byte_size), 0)::bigint as stored_bytes,
        COUNT(bvc.version_id)::int as total_versions
      FROM content_blobs cb
      LEFT JOIN block_version_contents bvc ON bvc.content_blob_hash = cb.sha256
    `;

    const [counts] = await sql`
      SELECT 
        (SELECT COUNT(*)::int FROM commits) as total_commits,
        (SELECT COUNT(*)::int FROM editions) as total_editions,
        (SELECT COUNT(*)::int FROM branches WHERE is_merged = TRUE) as merged_branches,
        (SELECT COUNT(*)::int FROM issues) as total_issues
    `;

    const analytics: StorageAnalytics = {
      uniqueBlobs: Number(casStats?.unique_blobs || 0),
      storedBytes: Number(casStats?.stored_bytes || 0),
      totalVersions: Number(casStats?.total_versions || 0),
      totalCommits: Number(counts?.total_commits || 0),
      totalEditions: Number(counts?.total_editions || 0),
      mergedBranches: Number(counts?.merged_branches || 0),
      totalIssues: Number(counts?.total_issues || 0),
    };

    // 5. Unified Recent Activity Feed
    const activities = await sql`
      SELECT 
        'COMMIT' as activity_type,
        c.commit_id::text as id,
        c.commit_message as title,
        u.username as actor,
        b.branch_name as context,
        c.created_at::text as created_at
      FROM commits c
      JOIN users u ON u.user_id = c.author_id
      JOIN branches b ON b.branch_id = c.branch_id
      UNION ALL
      SELECT
        'EDITION' as activity_type,
        e.edition_id::text as id,
        'Published ' || e.edition_name || ' (/e/' || e.share_code || ')' as title,
        u.username as actor,
        n.title as context,
        e.created_at::text as created_at
      FROM editions e
      JOIN users u ON u.user_id = e.created_by
      JOIN notes n ON n.note_id = e.note_id
      UNION ALL
      SELECT
        'ISSUE' as activity_type,
        i.issue_id::text as id,
        'Opened Issue: ' || i.title as title,
        u.username as actor,
        i.status as context,
        COALESCE(i.created_at, now())::text as created_at
      FROM issues i
      JOIN users u ON u.user_id = i.creator_id
      ORDER BY created_at DESC
      LIMIT 8
    `;

    return {
      success: true,
      unmergedBranches: unmergedBranches as UnmergedBranchItem[],
      notes: notes as DashboardNoteItem[],
      roles: roles as Array<{ notebook_id: string; role_type: string }>,
      analytics,
      activities: activities as ActivityItem[],
    };
  } catch (error: any) {
    console.error('Error in getDashboardOverview:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch dashboard overview',
      unmergedBranches: [],
      notes: [],
      roles: [],
      analytics: {
        uniqueBlobs: 0,
        storedBytes: 0,
        totalVersions: 0,
        totalCommits: 0,
        totalEditions: 0,
        mergedBranches: 0,
        totalIssues: 0,
      },
      activities: [],
    };
  }
}
