'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  Loader2, 
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import { 
  addIssueComment, 
  getIssueComments, 
  deleteIssueComment, 
  type IssueComment 
} from '@/actions/comments';

interface IssueCommentsThreadProps {
  issueId: string;
  currentUserId: string;
  isOwnerOrMaintainer?: boolean;
}

export default function IssueCommentsThread({
  issueId,
  currentUserId,
  isOwnerOrMaintainer = false,
}: IssueCommentsThreadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getIssueComments(issueId);
      if (res.success && res.comments) {
        setComments(res.comments);
      } else {
        setError(res.error || 'Failed to load comments');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, issueId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await addIssueComment({
        issueId,
        content: newCommentText.trim(),
      });

      if (res.success && res.comment) {
        setComments((prev) => [...prev, res.comment!]);
        setNewCommentText('');
      } else {
        setError(res.error || 'Failed to post comment');
      }
    } catch (err: any) {
      setError(err.message || 'Error posting comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await deleteIssueComment(commentId);
      if (res.success) {
        setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
      } else {
        setError(res.error || 'Failed to delete comment');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting comment');
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-zinc-800/80">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
      >
        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          {comments.length > 0 ? `${comments.length} Comments` : 'Discussion & Review'}
        </span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>

      {/* Expanded Thread */}
      {isOpen && (
        <div className="mt-3 space-y-3 pl-2 sm:pl-4 border-l-2 border-zinc-800 animate-in fade-in duration-150">
          {error && (
            <div className="p-2 rounded bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading discussion...</span>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-1">
              No comments yet. Start the discussion below.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {comments.map((c) => {
                const canDelete = c.author_id === currentUserId || isOwnerOrMaintainer;
                const formattedTime = new Date(c.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={c.comment_id}
                    className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70 text-xs space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-[10px] overflow-hidden">
                          {c.author_avatar_url ? (
                            <img
                              src={c.author_avatar_url}
                              alt={c.author_username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            c.author_username[0]?.toUpperCase()
                          )}
                        </div>
                        <span className="font-semibold text-zinc-200">
                          @{c.author_username}
                        </span>
                        {c.author_system_role === 'ADMIN' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                            ADMIN
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {formattedTime}
                        </span>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteComment(c.comment_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all cursor-pointer"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <p className="text-zinc-300 whitespace-pre-wrap pl-7">
                      {c.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* New Comment Input Form */}
          <form onSubmit={handleAddComment} className="pt-2 flex gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Leave a comment or review note..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              type="submit"
              disabled={submitting || !newCommentText.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Reply</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
