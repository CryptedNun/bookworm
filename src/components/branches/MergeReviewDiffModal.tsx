'use client';

import React, { useState } from 'react';
import {
  GitMerge,
  GitBranch,
  X,
  CheckCircle,
  AlertCircle,
  Columns,
  FileText,
  Code2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Loader2,
  Eye,
  FileDiff,
  Hash,
} from 'lucide-react';
import RobustMarkdown from '@/components/markdown/RobustMarkdown';

export interface DiffChange {
  slot_id: string;
  change_type: 'added' | 'modified' | 'deleted' | 'unchanged';
  source_content?: string;
  target_content?: string;
  source_type?: string;
  target_type?: string;
}

export interface BranchComparisonData {
  branchId: string;
  branchName?: string;
  target_branch_name: string;
  stats: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
  changes: DiffChange[];
}

interface MergeReviewDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  noteTitle: string;
  comparison: BranchComparisonData | null;
  isLoadingComparison?: boolean;
  canMerge?: boolean;
  onConfirmMerge: (branchId: string, branchName: string, mergeMessage?: string) => Promise<void>;
  isMerging?: boolean;
}

type ViewMode = 'split-markdown' | 'split-diff' | 'unified-diff';

export default function MergeReviewDiffModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  noteTitle,
  comparison,
  isLoadingComparison = false,
  canMerge = true,
  onConfirmMerge,
  isMerging = false,
}: MergeReviewDiffModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split-markdown');
  const [selectedSlotId, setSelectedSlotId] = useState<string | 'all'>('all');
  const [mergeMessage, setMergeMessage] = useState(`Merge branch '${branchName}' into main`);

  if (!isOpen) return null;

  const nonUnchangedChanges = comparison?.changes.filter((c) => c.change_type !== 'unchanged') || [];
  const activeChanges =
    selectedSlotId === 'all'
      ? nonUnchangedChanges
      : nonUnchangedChanges.filter((c) => c.slot_id === selectedSlotId);

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmMerge(branchId, branchName, mergeMessage);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/70 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <GitMerge className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Review & Merge Branch</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {branchName}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  main
                </span>
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Note: <span className="text-zinc-200 font-medium">{noteTitle}</span> • Verify block changes before merging into canonical main.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('split-markdown')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'split-markdown'
                    ? 'bg-emerald-600 text-zinc-950 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Rendered Markdown Side-by-Side"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split Markdown</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('split-diff')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'split-diff'
                    ? 'bg-emerald-600 text-zinc-950 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Code & Raw Text Side-by-Side"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Split Code Diff</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('unified-diff')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'unified-diff'
                    ? 'bg-emerald-600 text-zinc-950 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Unified Git Diff View"
              >
                <FileDiff className="w-3.5 h-3.5" />
                <span>Unified Diff</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Changes Summary Pill Bar */}
        {comparison && (
          <div className="px-6 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Total Changes:</span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                +{comparison.stats.added} Added
              </span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                ~{comparison.stats.modified} Modified
              </span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                -{comparison.stats.deleted} Deleted
              </span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[11px] text-zinc-400 bg-zinc-800/60 border border-zinc-700/60">
                ={comparison.stats.unchanged} Unchanged
              </span>
            </div>

            {/* Block Jump Filter */}
            {nonUnchangedChanges.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 text-[11px]">Filter Block:</span>
                <select
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="all">All Changed Blocks ({nonUnchangedChanges.length})</option>
                  {nonUnchangedChanges.map((c, i) => (
                    <option key={c.slot_id} value={c.slot_id}>
                      Block {i + 1}: {c.source_type || c.target_type} ({c.change_type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Diff Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingComparison ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm">Computing block diff from commit manifests...</p>
            </div>
          ) : !comparison || nonUnchangedChanges.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 space-y-3">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-400/60" />
              <h3 className="text-base font-bold text-zinc-200">No Block Content Differences</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                The attempt branch commit manifest is identical to current canonical <code className="text-zinc-400">main</code>. Merging will perform a fast-forward zero-op.
              </p>
            </div>
          ) : (
            activeChanges.map((change, idx) => (
              <BlockDiffItem
                key={change.slot_id || idx}
                change={change}
                index={idx + 1}
                viewMode={viewMode}
              />
            ))
          )}
        </div>

        {/* Modal Footer / Merge Action Bar */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/80 shrink-0">
          <form onSubmit={handleMergeSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Merge Commit Message</span>
                  <span className="text-[10px] text-zinc-500 font-normal font-mono">(Recorded in DAG)</span>
                </label>
                <input
                  type="text"
                  value={mergeMessage}
                  onChange={(e) => setMergeMessage(e.target.value)}
                  placeholder="Describe this merge..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isMerging}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                {canMerge ? (
                  <button
                    type="submit"
                    disabled={isMerging}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isMerging ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Merging DAG Manifest...</span>
                      </>
                    ) : (
                      <>
                        <GitMerge className="w-4 h-4" />
                        <span>Confirm & Merge into Main</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-400 text-xs font-medium">
                    Maintainer / Owner Role Required to Merge
                  </div>
                )}
              </div>
            </div>

            {/* Invariant Guarantee Note */}
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>
                <strong>Zero-Conflict Invariant:</strong> Merging binds the winning version hash into the commit manifest and transitions the issue out of lock mode.
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Individual Block Diff Renderer
// -------------------------------------------------------------
function BlockDiffItem({
  change,
  index,
  viewMode,
}: {
  change: DiffChange;
  index: number;
  viewMode: ViewMode;
}) {
  const blockType = change.source_type || change.target_type || 'BLOCK';
  const isAdded = change.change_type === 'added';
  const isDeleted = change.change_type === 'deleted';
  const isModified = change.change_type === 'modified';

  const typeColor = isAdded
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : isDeleted
    ? 'border-red-500/30 bg-red-500/10 text-red-300'
    : 'border-blue-500/30 bg-blue-500/10 text-blue-300';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-lg">
      {/* Block Header */}
      <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-zinc-500">#{index}</span>
          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase border ${typeColor}`}>
            {change.change_type}
          </span>
          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700">
            {blockType}
          </span>
          <span className="text-zinc-500 font-mono text-[11px] hidden sm:inline">
            Slot: {change.slot_id.substring(0, 8)}...
          </span>
        </div>

        <div className="text-[11px] text-zinc-400 font-mono">
          {isAdded && <span className="text-emerald-400">+ Newly Introduced Block</span>}
          {isDeleted && <span className="text-red-400">- Target Block Removed</span>}
          {isModified && <span className="text-blue-400">~ Content Updated</span>}
        </div>
      </div>

      {/* Render based on view mode */}
      {viewMode === 'split-markdown' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          {/* Left: Target (Main / Base) */}
          <div className="p-4 bg-zinc-950/50 flex flex-col space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 text-[11px] text-zinc-400 font-mono font-semibold">
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Current Main (Base)
              </span>
              <span>{isAdded ? '(None)' : `${change.target_content?.length || 0} chars`}</span>
            </div>

            <div className="flex-1 min-h-[120px] max-h-[400px] overflow-y-auto pr-2">
              {isAdded ? (
                <div className="flex items-center justify-center h-full text-xs text-zinc-600 italic py-8">
                  Block does not exist in main
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
                  <RobustMarkdown content={change.target_content || ''} />
                </div>
              )}
            </div>
          </div>

          {/* Right: Source (Attempt Branch / Incoming) */}
          <div className="p-4 bg-zinc-950/20 flex flex-col space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 text-[11px] text-zinc-400 font-mono font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Proposed Incoming (Branch)
              </span>
              <span>{isDeleted ? '(Deleted)' : `${change.source_content?.length || 0} chars`}</span>
            </div>

            <div className="flex-1 min-h-[120px] max-h-[400px] overflow-y-auto pr-2">
              {isDeleted ? (
                <div className="flex items-center justify-center h-full text-xs text-red-400/80 italic py-8">
                  Block marked for deletion in this branch
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
                  <RobustMarkdown content={change.source_content || ''} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'split-diff' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          {/* Left: Target Code */}
          <div className="p-3 bg-zinc-950/70 font-mono text-xs overflow-x-auto max-h-[400px]">
            <div className="text-[11px] text-red-400 font-bold mb-2 pb-1 border-b border-zinc-800 flex items-center justify-between">
              <span>Main (Base Text)</span>
              <span className="text-zinc-500 font-normal">{change.target_type || 'RAW'}</span>
            </div>
            {isAdded ? (
              <p className="text-zinc-600 italic py-4">No content</p>
            ) : (
              <pre className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {(change.target_content || '').split('\n').map((line, lIdx) => (
                  <div key={lIdx} className="flex gap-3 hover:bg-red-500/10 py-0.5 rounded px-1">
                    <span className="text-zinc-600 select-none w-8 text-right shrink-0">{lIdx + 1}</span>
                    <span className={isModified ? 'text-red-300' : 'text-zinc-400'}>{line || ' '}</span>
                  </div>
                ))}
              </pre>
            )}
          </div>

          {/* Right: Source Code */}
          <div className="p-3 bg-zinc-950/40 font-mono text-xs overflow-x-auto max-h-[400px]">
            <div className="text-[11px] text-emerald-400 font-bold mb-2 pb-1 border-b border-zinc-800 flex items-center justify-between">
              <span>Proposed (Incoming Text)</span>
              <span className="text-zinc-500 font-normal">{change.source_type || 'RAW'}</span>
            </div>
            {isDeleted ? (
              <p className="text-red-400/70 italic py-4">Content deleted</p>
            ) : (
              <pre className="text-zinc-100 whitespace-pre-wrap leading-relaxed">
                {(change.source_content || '').split('\n').map((line, lIdx) => (
                  <div key={lIdx} className="flex gap-3 hover:bg-emerald-500/10 py-0.5 rounded px-1">
                    <span className="text-zinc-600 select-none w-8 text-right shrink-0">{lIdx + 1}</span>
                    <span className={isModified ? 'text-emerald-300' : 'text-zinc-200'}>{line || ' '}</span>
                  </div>
                ))}
              </pre>
            )}
          </div>
        </div>
      )}

      {viewMode === 'unified-diff' && (
        <div className="p-4 bg-zinc-950 font-mono text-xs overflow-x-auto max-h-[400px]">
          {isAdded && (
            <div className="space-y-1">
              {(change.source_content || '').split('\n').map((line, lIdx) => (
                <div key={lIdx} className="flex gap-2 bg-emerald-500/10 text-emerald-300 py-0.5 px-2 rounded">
                  <span className="text-emerald-500 font-bold">+</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}

          {isDeleted && (
            <div className="space-y-1">
              {(change.target_content || '').split('\n').map((line, lIdx) => (
                <div key={lIdx} className="flex gap-2 bg-red-500/10 text-red-300 py-0.5 px-2 rounded">
                  <span className="text-red-500 font-bold">-</span>
                  <span className="line-through">{line}</span>
                </div>
              ))}
            </div>
          )}

          {isModified && (
            <div className="space-y-1">
              {(change.target_content || '').split('\n').map((line, lIdx) => (
                <div key={`del-${lIdx}`} className="flex gap-2 bg-red-500/15 text-red-300/90 py-0.5 px-2 rounded">
                  <span className="text-red-400 font-bold">-</span>
                  <span>{line}</span>
                </div>
              ))}
              {(change.source_content || '').split('\n').map((line, lIdx) => (
                <div key={`add-${lIdx}`} className="flex gap-2 bg-emerald-500/15 text-emerald-300 py-0.5 px-2 rounded">
                  <span className="text-emerald-400 font-bold">+</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
