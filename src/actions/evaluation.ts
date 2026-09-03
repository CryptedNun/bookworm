/**
 * Database Evaluation & Architecture Showcase Server Actions
 * 
 * Provides live diagnostic metrics, ACID constraint verifications,
 * CAS storage deduplication stats, and advanced SQL query demonstrations
 * for database course evaluation.
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';

export interface EvaluationMetrics {
  totalUsers: number;
  totalResources: number;
  totalNotebooks: number;
  totalNotes: number;
  totalEditions: number;
  totalBranches: number;
  totalCommits: number;
  totalSlots: number;
  totalVersions: number;
  totalBlobs: number;
  totalIssues: number;
  totalComments: number;
  totalStars: number;
  rawContentBytes: number;
  casBlobBytes: number;
  deduplicationRatio: number;
  byteSavings: number;
}

export interface ConstraintAuditResult {
  isaEnforcement: boolean;
  blockLockingEnforcement: boolean;
  branchXorEnforcement: boolean;
  details: Record<string, string>;
}

/**
 * Fetch live system-wide database statistics & CAS deduplication metrics
 */
export async function getEvaluationMetrics(): Promise<{
  success: boolean;
  metrics?: EvaluationMetrics;
  error?: string;
}> {
  try {
    const [counts] = await sql`
      SELECT 
        (SELECT COUNT(*)::int FROM users) as total_users,
        (SELECT COUNT(*)::int FROM resources) as total_resources,
        (SELECT COUNT(*)::int FROM notebooks WHERE deleted_at IS NULL) as total_notebooks,
        (SELECT COUNT(*)::int FROM notes WHERE deleted_at IS NULL) as total_notes,
        (SELECT COUNT(*)::int FROM editions) as total_editions,
        (SELECT COUNT(*)::int FROM branches) as total_branches,
        (SELECT COUNT(*)::int FROM commits) as total_commits,
        (SELECT COUNT(*)::int FROM logical_block_slots) as total_slots,
        (SELECT COUNT(*)::int FROM block_version_contents) as total_versions,
        (SELECT COUNT(*)::int FROM content_blobs) as total_blobs,
        (SELECT COUNT(*)::int FROM issues) as total_issues,
        (SELECT COUNT(*)::int FROM issue_comments) as total_comments,
        (SELECT COUNT(*)::int FROM user_starred_resources) as total_stars
    ` as any[];

    // Calculate CAS Storage Savings:
    // Raw content bytes = Sum of length of all block version references
    // CAS blob bytes = Sum of length of unique blobs in content_blobs
    const [storage] = await sql`
      SELECT 
        COALESCE(SUM(cb.byte_size), 0)::bigint as raw_content_bytes,
        (SELECT COALESCE(SUM(byte_size), 0)::bigint FROM content_blobs) as cas_blob_bytes
      FROM block_version_contents bvc
      JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
    ` as any[];

    const rawBytes = Number(storage.raw_content_bytes || 0);
    const casBytes = Number(storage.cas_blob_bytes || 0);
    const byteSavings = Math.max(0, rawBytes - casBytes);
    const deduplicationRatio = casBytes > 0 ? Number((rawBytes / casBytes).toFixed(2)) : 1.0;

    return {
      success: true,
      metrics: {
        totalUsers: counts.total_users || 0,
        totalResources: counts.total_resources || 0,
        totalNotebooks: counts.total_notebooks || 0,
        totalNotes: counts.total_notes || 0,
        totalEditions: counts.total_editions || 0,
        totalBranches: counts.total_branches || 0,
        totalCommits: counts.total_commits || 0,
        totalSlots: counts.total_slots || 0,
        totalVersions: counts.total_versions || 0,
        totalBlobs: counts.total_blobs || 0,
        totalIssues: counts.total_issues || 0,
        totalComments: counts.total_comments || 0,
        totalStars: counts.total_stars || 0,
        rawContentBytes: rawBytes,
        casBlobBytes: casBytes,
        deduplicationRatio,
        byteSavings,
      },
    };
  } catch (error: any) {
    console.error('getEvaluationMetrics error:', error);
    return { success: false, error: error.message || 'Failed to fetch metrics' };
  }
}

/**
 * Audit database constraints & triggers live
 */
export async function auditDatabaseConstraints(): Promise<{
  success: boolean;
  audit?: ConstraintAuditResult;
  error?: string;
}> {
  try {
    // 1. Audit ISA Triggers
    const triggers = await sql`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name IN ('trg_check_notebook_isa', 'trg_check_note_isa')
    ` as any[];

    // 2. Audit Partial Unique Index on Issues
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE indexname = 'uq_one_active_issue_per_slot'
    ` as any[];

    // 3. Audit Branch XOR Check Constraint
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conname = 'chk_branch_type'
    ` as any[];

    const isaEnforcement = triggers.length >= 2;
    const blockLockingEnforcement = indexes.length >= 1;
    const branchXorEnforcement = constraints.length >= 1;

    return {
      success: true,
      audit: {
        isaEnforcement,
        blockLockingEnforcement,
        branchXorEnforcement,
        details: {
          triggersFound: `${triggers.length}/2 ISA triggers active`,
          blockLockingIndex: indexes[0]?.indexdef || 'Index uq_one_active_issue_per_slot',
          branchConstraint: constraints[0]?.def || 'CHECK (chk_branch_type)',
        },
      },
    };
  } catch (error: any) {
    console.error('auditDatabaseConstraints error:', error);
    return { success: false, error: error.message || 'Audit failed' };
  }
}
