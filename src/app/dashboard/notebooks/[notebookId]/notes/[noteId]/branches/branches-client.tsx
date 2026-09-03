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
  ChevronRight,
  CircleDot,
  ArrowRight,
  Network,
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
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}`}
              className="p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 min-w-0">
              <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <Link href={`/dashboard/notebooks/${notebookId}`} className="hover:text-zinc-300 transition-colors truncate max-w-[80px]">Notebook</Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <Link href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}`} className="hover:text-zinc-300 transition-colors truncate max-w-[80px]">{note.title}</Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="text-zinc-200 font-semibold">Branches</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/tree`}
              className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <Network className="w-3.5 h-3.5" />
              Commit Tree
            </Link>
            
            <button
              onClick={() => router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/issues`)}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
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

        {/* VCS Workflow Progress Indicator */}
        <div className="mb-8 flex items-center justify-center gap-0">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-l-xl bg-emerald-500/10 border border-emerald-500/20">
            <CircleDot className="w-4 h-4 text-emerald-400" />
            <div className="text-xs">
              <div className="font-semibold text-emerald-400">1. Create Issue</div>
              <div className="text-emerald-400/60">Target a block</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 -mx-0.5 z-10" />
          <div className="flex items-center gap-2 px-4 py-2.5 bg-sky-500/10 border-y border-sky-500/20">
            <Code className="w-4 h-4 text-sky-400" />
            <div className="text-xs">
              <div className="font-semibold text-sky-400">2. Edit on Branch</div>
              <div className="text-sky-400/60">Auto-created branch</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 -mx-0.5 z-10" />
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-r-xl bg-purple-500/10 border border-purple-500/20">
            <GitMerge className="w-4 h-4 text-purple-400" />
            <div className="text-xs">
              <div className="font-semibold text-purple-400">3. Review & Merge</div>
              <div className="text-purple-400/60">Zero conflicts</div>
            </div>
          </div>
        </div>

        <div className="space-y-8 stagger-fade">
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

          <div className="flex items-center gap-1.5 flex-wrap">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors text-[11px] font-medium flex items-center gap-1.5 border border-zinc-700/50"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            {onCompare && (
              <button
                onClick={onCompare}
                disabled={comparing}
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-50 text-[11px] font-medium flex items-center gap-1.5 border border-sky-500/20"
              >
                {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                <span>Compare</span>
              </button>
            )}
            {onMerge && (
              <button
                onClick={onMerge}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors text-[11px] font-medium flex items-center gap-1.5 border border-emerald-500/20"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Merge</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-[11px] font-medium flex items-center gap-1.5 border border-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={onExpand}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors text-[11px] font-medium flex items-center gap-1.5 border border-zinc-700/50"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>{isExpanded ? 'Hide' : 'Commits'}</span>
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
