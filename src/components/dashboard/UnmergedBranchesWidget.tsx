'use client';

import React from 'react';
import Link from 'next/link';
import { 
  GitBranch, 
  GitMerge, 
  GitCommit, 
  Clock, 
  User, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  FileText,
  Code
} from 'lucide-react';
import type { UnmergedBranchItem } from '@/actions/dashboard';

interface UnmergedBranchesWidgetProps {
  branches: UnmergedBranchItem[];
}

export default function UnmergedBranchesWidget({ branches }: UnmergedBranchesWidgetProps) {
  if (!branches || branches.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 text-center space-y-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-zinc-200">No Unmerged Branches</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          All contributor attempt branches are merged or none are currently open. When an issue is created, attempt branches will appear here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-zinc-900/60 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800/80 bg-amber-500/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-100">
                Branches Awaiting Review & Merge
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {branches.length} Action Required
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Contributors have submitted changes on these attempt branches. Review diffs and merge them into main.
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-zinc-800/60 p-4 space-y-3">
        {branches.map((branch) => (
          <div
            key={branch.branch_id}
            className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            {/* Branch Details */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate">
                  {branch.branch_name}
                </span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  {branch.note_title}
                </span>
                <span className="text-zinc-500 text-xs font-mono">
                  ({branch.notebook_title})
                </span>
              </div>

              {branch.issue_title && (
                <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Issue: <strong>{branch.issue_title}</strong></span>
                </p>
              )}

              <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  @{branch.author_name}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <GitCommit className="w-3 h-3 text-zinc-400" />
                  {branch.commits_count} {branch.commits_count === 1 ? 'commit' : 'commits'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  {new Date(branch.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <Link
                href={`/dashboard/notebooks/${branch.notebook_id}/notes/${branch.note_id}/tree`}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-blue-400 text-xs font-medium border border-zinc-700/60 transition-colors flex items-center gap-1.5"
                title="View in Commit Graph"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Tree</span>
              </Link>

              <Link
                href={`/dashboard/notebooks/${branch.notebook_id}/notes/${branch.note_id}/branches?reviewBranchId=${branch.branch_id}`}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-purple-400 text-xs font-medium border border-zinc-700/60 transition-colors flex items-center gap-1.5"
                title="Compare Line-by-Line Diffs"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Compare Diff</span>
              </Link>

              <Link
                href={`/dashboard/notebooks/${branch.notebook_id}/notes/${branch.note_id}/branches?reviewBranchId=${branch.branch_id}`}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                title="Review & Merge into Main"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Review & Merge</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
