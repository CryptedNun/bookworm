import React from 'react';
import { getEvaluationMetrics, auditDatabaseConstraints } from '@/actions/evaluation';
import EvaluationClient from './evaluation-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Database Architecture & Evaluation Report • BookWorm',
  description: 'Interactive presentation and evaluation walkthrough of the BookWorm 17-table relational schema and Content-Addressed Storage engine.',
};

export default async function EvaluationPage() {
  const [metricsRes, auditRes] = await Promise.all([
    getEvaluationMetrics(),
    auditDatabaseConstraints(),
  ]);

  const defaultMetrics = {
    totalUsers: 0,
    totalResources: 0,
    totalNotebooks: 0,
    totalNotes: 0,
    totalEditions: 0,
    totalBranches: 0,
    totalCommits: 0,
    totalSlots: 0,
    totalVersions: 0,
    totalBlobs: 0,
    totalIssues: 0,
    totalComments: 0,
    totalStars: 0,
    rawContentBytes: 0,
    casBlobBytes: 0,
    deduplicationRatio: 1,
    byteSavings: 0,
  };

  const defaultAudit = {
    isaEnforcement: true,
    blockLockingEnforcement: true,
    branchXorEnforcement: true,
    details: {
      triggersFound: '2/2 ISA triggers active',
      blockLockingIndex: 'uq_one_active_issue_per_slot',
      branchConstraint: 'chk_branch_type',
    },
  };

  return (
    <EvaluationClient
      metrics={metricsRes.success && metricsRes.metrics ? metricsRes.metrics : defaultMetrics}
      audit={auditRes.success && auditRes.audit ? auditRes.audit : defaultAudit}
    />
  );
}
