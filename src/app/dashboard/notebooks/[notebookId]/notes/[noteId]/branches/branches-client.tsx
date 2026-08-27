'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  GitBranch,
  Plus,
  GitMerge,
  Trash2,
  GitCommit,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  Code,
} from 'lucide-react';
import { mergeBranch, deleteBranch, compareBranches } from '@/actions/branches';
import type { Branch, BranchWithCommits } from '@/actions/branches';
import type { User as AuthUser } from '@/actions/auth';
import type { Note } from '@/actions/notes';

interface BranchesClientProps {
  note: Note;
  branches: BranchWithCommits[];
  notebookId: string;
  user: AuthUser;
}

export default function BranchesClient({ note, branches, notebookId, user }: BranchesClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [showMergeModal, setShowMergeModal] = useState<string | null>(null);
  const [mergeMessage, setMergeMessage] = useState('');
  const [comparing, setComparing] = useState<string | null>(null);
  const [comparison, setComparison] = useState<any>(null);

  const mainBranch = branches.find(b => b.is_main);
  const activeBranches = branches.filter(b => !b.is_main && !b.is_merged);
  const mergedBranches = branches.filter(b => !b.is_main && b.is_merged);

  const handleMergeBranch = async (branchId: string, branchName: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await mergeBranch({
        branchId,
        mergeMessage: mergeMessage || undefined,
      });

      if (result.success) {
        setSuccess(
          `Branch '${branchName}' merged successfully!${
            result.warning ? ` ${result.warning}` : ''
          }`
        );
        setShowMergeModal(null);
        setMergeMessage('');
        router.refresh();
      } else {
        setError(result.error || 'Failed to merge branch');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Delete branch '${branchName}'? This cannot be undone.`)) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await deleteBranch(branchId);

      if (result.success) {
        setSuccess(`Branch '${branchName}' deleted successfully!`);
        router.refresh();
      } else {
        setError(result.error || 'Failed to delete branch');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareBranch = async (branchId: string) => {
    setComparing(branchId);
    setError(null);

    try {
      const result = await compareBranches({
        noteId: note.note_id,
        sourceBranchId: branchId,
      });

      if (result.success && result.comparison) {
        setComparison({ branchId, ...result.comparison });
      } else {
        setError(result.error || 'Failed to compare branches');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setComparing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit`}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Branches
              </h1>
              <p className="text-xs text-zinc-500">{note.title}</p>
            </div>
          </div>

          <button
            onClick={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/issues`)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Issue
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-950/50 border-b border-red-900/50 px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/50 border-b border-emerald-900/50 px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-300">
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Main Branch */}
          {mainBranch && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Main Branch
              </h2>

              <BranchCard
                branch={mainBranch}
                isMain
                onExpand={() => setExpandedBranch(expandedBranch === mainBranch.branch_id ? null : mainBranch.branch_id)}
                isExpanded={expandedBranch === mainBranch.branch_id}
                onEdit={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit`)}
              />
            </section>
          )}

          {/* Active Branches */}
          {activeBranches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Active Branches ({activeBranches.length})
              </h2>

              <div className="space-y-4">
                {activeBranches.map(branch => (
                  <BranchCard
                    key={branch.branch_id}
                    branch={branch}
                    onExpand={() => setExpandedBranch(expandedBranch === branch.branch_id ? null : branch.branch_id)}
                    isExpanded={expandedBranch === branch.branch_id}
                    onMerge={() => setShowMergeModal(branch.branch_id)}
                    onDelete={() => handleDeleteBranch(branch.branch_id, branch.branch_name)}
                    onCompare={() => handleCompareBranch(branch.branch_id)}
                    onEdit={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit?branch=${branch.branch_id}`)}
                    comparing={comparing === branch.branch_id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Merged Branches */}
          {mergedBranches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Merged Branches ({mergedBranches.length})
              </h2>

              <div className="space-y-4">
                {mergedBranches.map(branch => (
                  <BranchCard
                    key={branch.branch_id}
                    branch={branch}
                    onExpand={() => setExpandedBranch(expandedBranch === branch.branch_id ? null : branch.branch_id)}
                    isExpanded={expandedBranch === branch.branch_id}
                    isMerged
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {activeBranches.length === 0 && mergedBranches.length === 0 && (
            <div className="text-center py-20 text-zinc-500">
              <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No branches yet</p>
              <p className="text-sm mb-6">Create an issue to work on changes. Branches are created automatically.</p>
              <button
                onClick={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/issues`)}
                className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Go to Issues
              </button>
            </div>
          )}
        </div>

        {/* Comparison View */}
        {comparison && comparison.branchId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Branch Comparison
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Comparing with {comparison.target_branch_name}
                  </p>
                </div>
                <button
                  onClick={() => setComparison(null)}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-emerald-400">{comparison.stats.added}</div>
                    <div className="text-xs text-zinc-500">Added</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-400">{comparison.stats.modified}</div>
                    <div className="text-xs text-zinc-500">Modified</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-400">{comparison.stats.deleted}</div>
                    <div className="text-xs text-zinc-500">Deleted</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-zinc-400">{comparison.stats.unchanged}</div>
                    <div className="text-xs text-zinc-500">Unchanged</div>
                  </div>
                </div>

                {/* Changes */}
                <div className="space-y-3">
                  {comparison.changes
                    .filter((c: any) => c.change_type !== 'unchanged')
                    .map((change: any, idx: number) => (
                      <div
                        key={idx}
                        className={`rounded-lg border p-4 ${
                          change.change_type === 'added'
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : change.change_type === 'deleted'
                            ? 'border-red-500/30 bg-red-500/5'
                            : 'border-blue-500/30 bg-blue-500/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-xs font-mono px-2 py-1 rounded ${
                              change.change_type === 'added'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : change.change_type === 'deleted'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {change.change_type}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {change.source_type || change.target_type}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {change.target_content && change.change_type !== 'added' && (
                            <div className="text-sm text-red-400 line-through opacity-75">
                              - {change.target_content.substring(0, 150)}
                              {change.target_content.length > 150 ? '...' : ''}
                            </div>
                          )}
                          {change.source_content && (
                            <div className="text-sm text-emerald-400">
                              {change.change_type === 'added' ? '+ ' : ''}
                              {change.source_content.substring(0, 150)}
                              {change.source_content.length > 150 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {comparison.changes.filter((c: any) => c.change_type !== 'unchanged').length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No changes detected</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-md w-full">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <GitMerge className="w-5 h-5" />
                Merge Branch
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Merge changes back into main branch
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Merge Message (Optional)
                </label>
                <textarea
                  value={mergeMessage}
                  onChange={(e) => setMergeMessage(e.target.value)}
                  placeholder="Describe what this merge accomplishes..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-emerald-500 focus:outline-none text-zinc-100 resize-none"
                />
              </div>

              <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-4">
                <p className="text-sm text-yellow-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  This will merge all changes into the main branch. If conflicts exist, branch changes will be preferred.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const branch = branches.find(b => b.branch_id === showMergeModal);
                    if (branch) handleMergeBranch(branch.branch_id, branch.branch_name);
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <GitMerge className="w-4 h-4" />
                      Merge
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowMergeModal(null);
                    setMergeMessage('');
                  }}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Branch Card Component
function BranchCard({
  branch,
  isMain = false,
  isMerged = false,
  onExpand,
  isExpanded,
  onMerge,
  onDelete,
  onCompare,
  onEdit,
  comparing = false,
}: {
  branch: BranchWithCommits;
  isMain?: boolean;
  isMerged?: boolean;
  onExpand: () => void;
  isExpanded: boolean;
  onMerge?: () => void;
  onDelete?: () => void;
  onCompare?: () => void;
  onEdit?: () => void;
  comparing?: boolean;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        isMain
          ? 'border-emerald-500/50 bg-emerald-500/5'
          : isMerged
          ? 'border-zinc-700 bg-zinc-900/50'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
      }`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                {branch.branch_name}
              </h3>
              {isMain && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  MAIN
                </span>
              )}
              {isMerged && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-700/50 text-zinc-400 border border-zinc-700">
                  MERGED
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-zinc-500">
              {branch.latest_commit_author && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {branch.latest_commit_author}
                </span>
              )}
              {branch.latest_commit_date && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(branch.latest_commit_date)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <GitCommit className="w-4 h-4" />
                {branch.commit_count || 0} {branch.commit_count === 1 ? 'commit' : 'commits'}
              </span>
            </div>

            {branch.latest_commit_message && (
              <p className="text-sm text-zinc-400 mt-2">{branch.latest_commit_message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Edit on this branch"
              >
                <Code className="w-4 h-4" />
              </button>
            )}
            {onCompare && (
              <button
                onClick={onCompare}
                disabled={comparing}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
                title="Compare with main"
              >
                {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
            {onMerge && (
              <button
                onClick={onMerge}
                className="p-2 rounded-lg hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                title="Merge into main"
              >
                <GitMerge className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-zinc-800 text-red-400 hover:text-red-300 transition-colors"
                title="Delete branch"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onExpand}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title={isExpanded ? 'Hide commits' : 'Show commits'}
            >
              <GitCommit className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Commit History */}
        {isExpanded && branch.commits && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
            <h4 className="text-sm font-medium text-zinc-400 mb-3">Commit History</h4>
            {branch.commits.map((commit) => (
              <div key={commit.commit_id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                <GitCommit className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-mono">{commit.commit_message}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span>{commit.author_username}</span>
                    <span>•</span>
                    <span>{formatDate(commit.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
