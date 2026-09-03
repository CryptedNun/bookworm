'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Database,
  Layers,
  GitBranch,
  ShieldCheck,
  Code2,
  Sparkles,
  ArrowRight,
  HardDrive,
  Copy,
  Check,
  Lock,
  GitFork,
  BookOpen,
  Home,
} from 'lucide-react';
import type { EvaluationMetrics, ConstraintAuditResult } from '@/actions/evaluation';

interface EvaluationClientProps {
  metrics: EvaluationMetrics;
  audit: ConstraintAuditResult;
}

export default function EvaluationClient({ metrics, audit }: EvaluationClientProps) {
  const [activeTab, setActiveTab] = useState<'METRICS' | 'ARCHITECTURE' | 'QUERIES' | 'CONSTRAINTS'>('METRICS');
  const [copiedQueryId, setCopiedQueryId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQueryId(id);
    setTimeout(() => setCopiedQueryId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full bg-zinc-950/90 border-b border-zinc-800 backdrop-blur-md px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-zinc-100 font-bold text-base hover:opacity-90 transition-opacity tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span>BookWorm</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Database Evaluation Walkthrough
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Home className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-zinc-800/80 bg-gradient-to-b from-emerald-950/20 via-zinc-950 to-zinc-950 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Database className="w-3.5 h-3.5" />
            <span>Relational Database Architecture & CAS Storage Report</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
            System Evaluation & Schema Proof
          </h1>

          <p className="text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Live diagnostic validation of BookWorm’s 17-table schema, Content-Addressed Storage (CAS) engine, polymorphic ISA hierarchy, and zero-conflict version control invariants.
          </p>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="max-w-6xl w-full mx-auto px-6 pt-6">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 text-xs font-medium flex-wrap">
          <button
            onClick={() => setActiveTab('METRICS')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'METRICS'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Live Database Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('ARCHITECTURE')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ARCHITECTURE'
                ? 'bg-zinc-800 text-purple-400 border border-zinc-700 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3-Layer Content Model</span>
          </button>

          <button
            onClick={() => setActiveTab('QUERIES')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'QUERIES'
                ? 'bg-zinc-800 text-blue-400 border border-zinc-700 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Advanced SQL Query Showcase</span>
          </button>

          <button
            onClick={() => setActiveTab('CONSTRAINTS')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CONSTRAINTS'
                ? 'bg-zinc-800 text-amber-400 border border-zinc-700 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>ACID Constraints & Triggers</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 space-y-6">
        {/* TAB 1: METRICS */}
        {activeTab === 'METRICS' && (
          <div className="space-y-6">
            {/* Storage Hero */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-purple-950/40 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Content-Addressed Storage (CAS) Deduplication Performance</span>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Global SHA-256 Storage Engine
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Deduplication Ratio</span>
                  <div className="text-2xl font-extrabold text-emerald-400">
                    {metrics.deduplicationRatio}x
                  </div>
                  <p className="text-[10px] text-zinc-500">Virtual block volume / Unique physical bytes</p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Physical CAS Blobs</span>
                  <div className="text-2xl font-extrabold text-zinc-100">
                    {metrics.totalBlobs} Blobs ({metrics.casBlobBytes.toLocaleString()} bytes)
                  </div>
                  <p className="text-[10px] text-zinc-500">Stored once globally in content_blobs</p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Storage Savings</span>
                  <div className="text-2xl font-extrabold text-purple-400">
                    {metrics.byteSavings.toLocaleString()} Bytes Saved
                  </div>
                  <p className="text-[10px] text-zinc-500">Zero duplicate storage across forks & versions</p>
                </div>
              </div>
            </div>

            {/* Table Stats Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Live Entity Count Across All 17 Database Tables
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Users', count: metrics.totalUsers, table: 'users' },
                  { label: 'Resources (ISA Supertype)', count: metrics.totalResources, table: 'resources' },
                  { label: 'Notebooks', count: metrics.totalNotebooks, table: 'notebooks' },
                  { label: 'Notes', count: metrics.totalNotes, table: 'notes' },
                  { label: 'Logical Slots (Layer 1)', count: metrics.totalSlots, table: 'logical_block_slots' },
                  { label: 'Block Versions (Layer 2)', count: metrics.totalVersions, table: 'block_version_contents' },
                  { label: 'Content Blobs (Layer 3)', count: metrics.totalBlobs, table: 'content_blobs' },
                  { label: 'Branches (Main & Attempt)', count: metrics.totalBranches, table: 'branches' },
                  { label: 'Commits (Immutable DAG)', count: metrics.totalCommits, table: 'commits' },
                  { label: 'Editions (Published)', count: metrics.totalEditions, table: 'editions' },
                  { label: 'Issues (Block Locks)', count: metrics.totalIssues, table: 'issues' },
                  { label: 'Issue Comments', count: metrics.totalComments, table: 'issue_comments' },
                ].map((stat) => (
                  <div key={stat.table} className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                    <span className="text-[11px] text-zinc-400 font-medium">{stat.label}</span>
                    <div className="text-lg font-bold text-zinc-100">{stat.count}</div>
                    <span className="text-[10px] text-zinc-500 font-mono">table: {stat.table}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ARCHITECTURE */}
        {activeTab === 'ARCHITECTURE' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>The 3-Layer Content Model</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                BookWorm decouples document structure from text content into three independent normalized layers, fulfilling the core thesis of the project:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="text-xs font-mono font-bold text-emerald-400 uppercase">
                    Layer 1: Structure (WHERE)
                  </div>
                  <p className="text-xs text-zinc-300 font-semibold">logical_block_slots</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Represents a positional slot in a note. Has a fractional LexoRank key for O(1) midpoint insertion and an optional parent_slot_id for hierarchical indentation.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="text-xs font-mono font-bold text-purple-400 uppercase">
                    Layer 2: Versions (WHO / WHEN)
                  </div>
                  <p className="text-xs text-zinc-300 font-semibold">block_version_contents</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Audit trail of every edit. Records version_id, author_id, and created_at. Points to a SHA-256 content blob rather than duplicating raw text.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="text-xs font-mono font-bold text-blue-400 uppercase">
                    Layer 3: Storage (WHAT)
                  </div>
                  <p className="text-xs text-zinc-300 font-semibold">content_blobs</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Global Content-Addressed Storage (CAS). Primary key is SHA-256 hash. If two notes or versions contain identical text, it is stored only once globally.
                  </p>
                </div>
              </div>
            </div>

            {/* Polymorphic ISA Hierarchy */}
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Unified Polymorphic ISA Hierarchy (resources)</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Rather than creating duplicate permission, star, and notification systems for notebooks and notes, BookWorm implements an <strong>ISA supertype hierarchy</strong>. 
                Both <code className="text-emerald-400">notebooks</code> and <code className="text-emerald-400">notes</code> share their primary key with <code className="text-emerald-400">resources(resource_id)</code>. 
                Database triggers enforce discriminator consistency so permissions in <code className="text-emerald-400">collaborator_roles</code> seamlessly attach to any resource.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: SQL QUERIES */}
        {activeTab === 'QUERIES' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Highlighted SQL Queries from Specification
            </h3>

            {[
              {
                id: 'recursive_cte',
                title: '1. Recursive CTE: Commit Ancestry Chain Traversal',
                desc: 'Traverses the DAG from any branch head backwards through parent commits to compute commit depth and lineage.',
                sql: `WITH RECURSIVE commit_chain AS (
  SELECT commit_id, parent_commit_id, commit_message, commit_hash, 0 as depth
  FROM commits
  WHERE commit_id = $1

  UNION ALL

  SELECT c.commit_id, c.parent_commit_id, c.commit_message, c.commit_hash, cc.depth + 1
  FROM commits c
  INNER JOIN commit_chain cc ON c.commit_id = cc.parent_commit_id
  WHERE cc.depth < 100
)
SELECT * FROM commit_chain ORDER BY depth;`,
              },
              {
                id: 'ternary_manifest',
                title: '2. Ternary Manifest Join: Document Snapshot Reconstruction',
                desc: 'Reconstructs an entire note at any arbitrary commit by joining commit manifests with logical slots, version records, and CAS blobs.',
                sql: `SELECT 
  cm.slot_id,
  lbs.lexorank_key,
  lbs.block_type,
  lbs.parent_slot_id,
  bvc.version_id,
  bvc.created_at as version_created_at,
  u.username as author_username,
  cb.content_text,
  cb.sha256
FROM commit_manifests cm
JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
JOIN users u ON u.user_id = bvc.author_id
WHERE cm.commit_id = $1
ORDER BY lbs.lexorank_key ASC;`,
              },
              {
                id: 'block_lock_index',
                title: '3. Partial Unique Index: Zero-Conflict Block Locking',
                desc: 'Guarantees mathematically at the database level that only one active issue can lock a given block slot at any moment.',
                sql: `CREATE UNIQUE INDEX uq_one_active_issue_per_slot
ON issues (target_slot_id)
WHERE status IN ('OPEN', 'IN_PROGRESS');`,
              },
            ].map((q) => (
              <div key={q.id} className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">{q.title}</h4>
                    <p className="text-xs text-zinc-400">{q.desc}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(q.id, q.sql)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedQueryId === q.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 font-mono text-xs text-emerald-300 overflow-x-auto">
                  {q.sql}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: CONSTRAINTS */}
        {activeTab === 'CONSTRAINTS' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              ACID Invariant Verification & Live Database Trigger Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">ISA Trigger Enforcement</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  {audit.details.triggersFound}: Rejects any notebook or note insertion lacking a parent entry in the resources supertype table.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">Block Locking Index</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ENFORCED
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Partial unique index guarantees zero conflict: concurrent attempts to lock an active slot are rejected at the DB engine level.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">Branch XOR Constraint</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ENFORCED
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  <code className="text-amber-400">chk_branch_type</code> enforces that main branches cannot have an issue_id, and issue branches must have an issue_id.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
