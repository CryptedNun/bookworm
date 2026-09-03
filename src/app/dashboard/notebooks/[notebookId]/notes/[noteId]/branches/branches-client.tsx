'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Columns,
} from 'lucide-react';
import { mergeBranch, deleteBranch, compareBranches } from '@/actions/branches';
import type { Branch, BranchWithCommits } from '@/actions/branches';
import type { User as AuthUser } from '@/actions/auth';
import type { Note } from '@/actions/notes';
import MergeReviewDiffModal from '@/components/branches/MergeReviewDiffModal';

interface BranchesClientProps {
  note: Note;
  branches: BranchWithCommits[];
  notebookId: string;
  user: AuthUser;
}

export default function BranchesClient({ note, branches, notebookId, user }: BranchesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoReviewBranchId = searchParams.get('reviewBranchId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  // Modern Review & Diff Modal State
  const [reviewBranch, setReviewBranch] = useState<BranchWithCommits | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [comparison, setComparison] = useState<any>(null);

  const mainBranch = branches.find(b => b.is_main);
  const activeBranches = branches.filter(b => !b.is_main && !b.is_merged);
  const mergedBranches = branches.filter(b => !b.is_main && b.is_merged);

  const canMerge = note.role_type === 'OWNER' || note.role_type === 'MAINTAINER';

  const openReviewModal = async (branch: BranchWithCommits) => {
    setReviewBranch(branch);
    setIsReviewModalOpen(true);
    setIsLoadingComparison(true);
    setError(null);

    try {
      const result = await compareBranches({
        noteId: note.note_id,
        sourceBranchId: branch.branch_id,
      });

      if (result.success && result.comparison) {
        setComparison({
          branchId: branch.branch_id,
          branchName: branch.branch_name,
          ...result.comparison,
        });
      } else {
        setError(result.error || 'Failed to compare branches');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while computing branch diff');
    } finally {
      setIsLoadingComparison(false);
    }
  };

  // Auto-open review modal if navigated with ?reviewBranchId=...
  useEffect(() => {
    if (autoReviewBranchId && branches.length > 0) {
      const target = branches.find((b) => b.branch_id === autoReviewBranchId);
      if (target) {
        openReviewModal(target);
      }
    }
  }, [autoReviewBranchId, branches]);

  const handleMergeBranch = async (branchId: string, branchName: string, customMessage?: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await mergeBranch({
        branchId,
        mergeMessage: customMessage || undefined,
      });

      if (result.success) {
        setSuccess(
          `Branch '${branchName}' merged successfully!${
            result.warning ? ` ${result.warning}` : ''
          }`
        );
        setIsReviewModalOpen(false);
        setReviewBranch(null);
        setComparison(null);
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

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/tree`}
              className="px-4 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              Tree View
            </Link>
            
            <button
              onClick={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/issues`)}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Issue
            </button>
          </div>
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
        {/* Version Control Guide Banner */}
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-zinc-900 to-zinc-900 border border-blue-500/20 text-xs text-zinc-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              <GitMerge className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-zinc-100 flex items-center gap-2">
                <span>Understanding Branches & Merges in BookWorm</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">Zero Conflicts</span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Every note has one canonical <strong>Main</strong> branch. When contributors open an issue to propose block edits, BookWorm creates an <strong>Attempt Branch</strong>. Maintainers review changes with <strong>Compare</strong> and click <strong>Merge</strong> to designate the winning attempt. Merging automatically creates a merge commit on main, carries forward the block's new version, closes the issue, and unlocks the slot!
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Main Branch */}
          {mainBranch && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                Main Branch (Canonical)
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
                <GitBranch className="w-4 h-4 text-amber-400" />
                Unmerged Attempt Branches ({activeBranches.length})
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-normal">
                  Awaiting Review
                </span>
              </h2>

              <div className="space-y-4">
                {activeBranches.map(branch => (
                  <BranchCard
                    key={branch.branch_id}
                    branch={branch}
                    onExpand={() => setExpandedBranch(expandedBranch === branch.branch_id ? null : branch.branch_id)}
                    isExpanded={expandedBranch === branch.branch_id}
                    onMerge={canMerge ? () => openReviewModal(branch) : undefined}
                    onDelete={(canMerge || branch.attempted_by === user.user_id) ? () => handleDeleteBranch(branch.branch_id, branch.branch_name) : undefined}
                    onCompare={() => openReviewModal(branch)}
                    onEdit={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit?branch=${branch.branch_id}`)}
                    comparing={isLoadingComparison && reviewBranch?.branch_id === branch.branch_id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Merged Branches */}
          {mergedBranches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Merged Branches ({mergedBranches.length})
              </h2>

              <div className="space-y-4">
                {mergedBranches.map(branch => (
                  <BranchCard
                    key={branch.branch_id}
                    branch={branch}
                    onExpand={() => setExpandedBranch(expandedBranch === branch.branch_id ? null : branch.branch_id)}
                    isExpanded={expandedBranch === branch.branch_id}
                    onCompare={() => openReviewModal(branch)}
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
      </div>

      {/* Modern Side-by-Side Merge Review & Diff Modal */}
      {reviewBranch && (
        <MergeReviewDiffModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setReviewBranch(null);
            setComparison(null);
          }}
          branchId={reviewBranch.branch_id}
          branchName={reviewBranch.branch_name}
          noteTitle={note.title}
          comparison={comparison}
          isLoadingComparison={isLoadingComparison}
          canMerge={canMerge && !reviewBranch.is_merged}
          onConfirmMerge={(bId, bName, msg) => handleMergeBranch(bId, bName, msg)}
          isMerging={loading}
        />
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
