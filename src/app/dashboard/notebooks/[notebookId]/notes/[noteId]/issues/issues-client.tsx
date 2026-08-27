'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertCircle,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  GitBranch,
  Lock,
  Users,
  Calendar,
  MessageSquare,
  Code,
} from 'lucide-react';
import { createIssue, closeIssue, getIssueDetail } from '@/actions/issues';
import { mergeBranch } from '@/actions/branches';
import type { Issue } from '@/actions/issues';
import type { User as AuthUser } from '@/actions/auth';
import type { Note } from '@/actions/notes';

interface IssuesClientProps {
  note: Note & {
    blocks: Array<{
      slot_id: string;
      block_type: string;
      content_text: string;
      lexorank_key: string;
    }>;
  };
  issues: Issue[];
  notebookId: string;
  user: AuthUser;
}

export default function IssuesClient({ note, issues, notebookId, user }: IssuesClientProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [issueTitle, setIssueTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'closed'>('open');

  const openIssues = issues.filter(i => ['OPEN', 'IN_PROGRESS'].includes(i.status));
  const closedIssues = issues.filter(i => ['CLOSED', 'MERGED'].includes(i.status));

  const filteredIssues = 
    filter === 'all' ? issues :
    filter === 'open' ? issues.filter(i => i.status === 'OPEN') :
    filter === 'in_progress' ? issues.filter(i => i.status === 'IN_PROGRESS') :
    issues.filter(i => i.status === 'CLOSED');

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlock || !issueTitle.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createIssue({
        noteId: note.note_id,
        slotId: selectedBlock,
        title: issueTitle.trim(),
      });

      if (result.success) {
        setSuccess(`Issue created! Branch "${result.issue?.branch_name}" is ready.`);
        setIssueTitle('');
        setSelectedBlock(null);
        setShowCreateModal(false);
        router.refresh();
        
        // Navigate to edit on the new branch
        if (result.issue?.branch_id) {
          setTimeout(() => {
            router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/edit?branch=${result.issue.branch_id}`);
          }, 1500);
        }
      } else {
        setError(result.error || 'Failed to create issue');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseIssue = async (issueId: string, title: string) => {
    if (!confirm(`Close issue "${title}"? This cannot be undone.`)) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await closeIssue(issueId);

      if (result.success) {
        setSuccess(`Issue "${title}" closed successfully.`);
        router.refresh();
      } else {
        setError(result.error || 'Failed to close issue');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeBranch = async (branchId: string, issueTitle: string) => {
    if (!confirm(`Merge this solution into main branch?`)) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await mergeBranch({
        branchId,
        mergeMessage: `Resolve issue: ${issueTitle}`,
      });

      if (result.success) {
        setSuccess(
          `Issue resolved and merged!${
            result.warning ? ` ${result.warning}` : ''
          }`
        );
        router.refresh();
      } else {
        setError(result.error || 'Failed to merge');
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

  const getBlockTypeIcon = (type: string) => {
    switch (type) {
      case 'HEADING': return '# ';
      case 'CODE': return '</>';
      case 'QUOTE': return '" ';
      default: return '¶ ';
    }
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
                <Lock className="w-5 h-5" />
                Issues
              </h1>
              <p className="text-xs text-zinc-500">{note.title}</p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Issue
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

        {/* Filters */}
        <div className="border-b border-zinc-800">
          <div className="max-w-7xl mx-auto px-6 flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                filter === 'all'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({issues.length})
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                filter === 'open'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Open ({issues.filter(i => i.status === 'OPEN').length})
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                filter === 'in_progress'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              In Progress ({issues.filter(i => i.status === 'IN_PROGRESS').length})
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                filter === 'closed'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Closed ({closedIssues.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-20">
            <Lock className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <h2 className="text-2xl font-bold mb-2">
              {filter === 'all' ? 'No Issues Yet' : `No ${filter.replace('_', ' ')} Issues`}
            </h2>
            <p className="text-zinc-500 mb-6">
              {filter === 'all'
                ? 'Create an issue to request changes to a specific block'
                : `Change the filter to see other issues`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Your First Issue
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIssues.map((issue) => (
              <IssueCard
                key={issue.issue_id}
                issue={issue}
                onClose={() => handleCloseIssue(issue.issue_id, issue.title)}
                onMerge={handleMergeBranch}
                onView={() =>
                  router.push(`/dashboard/notebooks/${notebookId}/notes/${note.note_id}/branches`)
                }
                formatDate={formatDate}
                getBlockTypeIcon={getBlockTypeIcon}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Issue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Create Issue
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Select a block to request changes. The block will be locked until the issue is resolved.
              </p>
            </div>

            <form onSubmit={handleCreateIssue} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Issue Title
                </label>
                <input
                  type="text"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="e.g., Update introduction paragraph"
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-emerald-500 focus:outline-none text-zinc-100"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Select Block to Edit
                </label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {note.blocks.map((block, idx) => {
                    const isLocked = issues.some(
                      (i) => i.target_slot_id === block.slot_id && ['OPEN', 'IN_PROGRESS'].includes(i.status)
                    );
                    
                    return (
                      <button
                        key={block.slot_id}
                        type="button"
                        onClick={() => !isLocked && setSelectedBlock(block.slot_id)}
                        disabled={isLocked}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          selectedBlock === block.slot_id
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : isLocked
                            ? 'border-zinc-800 bg-zinc-900/50 opacity-50 cursor-not-allowed'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-mono">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-zinc-500">
                                {getBlockTypeIcon(block.block_type)}
                                {block.block_type}
                              </span>
                              {isLocked && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  LOCKED
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-300 line-clamp-2">
                              {block.content_text || '(empty block)'}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="submit"
                  disabled={loading || !selectedBlock || !issueTitle.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Create Issue & Start Editing
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedBlock(null);
                    setIssueTitle('');
                  }}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Issue Card Component
function IssueCard({
  issue,
  onClose,
  onMerge,
  onView,
  formatDate,
  getBlockTypeIcon,
}: {
  issue: Issue;
  onClose: () => void;
  onMerge: (branchId: string, title: string) => void;
  onView: () => void;
  formatDate: (date: string) => string;
  getBlockTypeIcon: (type: string) => string;
}) {
  const statusColors = {
    OPEN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    MERGED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    CLOSED: 'bg-zinc-700/20 text-zinc-400 border-zinc-700/30',
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-zinc-100">{issue.title}</h3>
            <span
              className={`text-xs px-2 py-1 rounded border font-medium ${
                statusColors[issue.status]
              }`}
            >
              {issue.status.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(issue.created_at)}
            </span>
            {issue.creator_username && (
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {issue.creator_username}
              </span>
            )}
            {issue.branch_count !== undefined && (
              <span className="flex items-center gap-1">
                <GitBranch className="w-4 h-4" />
                {issue.branch_count} {issue.branch_count === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {issue.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={onView}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
              >
                View Branches
              </button>
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
              >
                Close Issue
              </button>
            </>
          )}
          {issue.status === 'OPEN' && (
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
            >
              Close Issue
            </button>
          )}
        </div>
      </div>

      {/* Target Block */}
      {issue.target_block_content && (
        <div className="mt-4 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-mono text-zinc-500">
              {getBlockTypeIcon(issue.target_block_type || 'PARAGRAPH')}
              {issue.target_block_type || 'PARAGRAPH'}
            </span>
            <span className="text-xs text-zinc-600">• Target Block</span>
          </div>
          <p className="text-sm text-zinc-300 line-clamp-3">{issue.target_block_content}</p>
        </div>
      )}
    </div>
  );
}
