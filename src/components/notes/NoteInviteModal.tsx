'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Check,
  X,
  Crown,
  Wrench,
  Edit,
  Copy,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
  getResourceCollaborators,
} from '@/actions/permissions';

interface NoteCollaborator {
  role_id: string;
  user_id: string;
  role_type: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string | Date;
}

interface NoteInviteModalProps {
  noteId: string;
  noteTitle: string;
  currentUserId: string;
  currentUserRole: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  isOpen: boolean;
  onClose: () => void;
}

export default function NoteInviteModal({
  noteId,
  noteTitle,
  currentUserId,
  currentUserRole,
  isOpen,
  onClose,
}: NoteInviteModalProps) {
  const [collaborators, setCollaborators] = useState<NoteCollaborator[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [addIdentifier, setAddIdentifier] = useState('');
  const [addRole, setAddRole] = useState<'MAINTAINER' | 'CONTRIBUTOR'>('CONTRIBUTOR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canInvite = ['OWNER', 'MAINTAINER'].includes(currentUserRole);
  const isOwner = currentUserRole === 'OWNER';

  // Load collaborators when opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingList(true);
    setError(null);
    setSuccess(null);

    getResourceCollaborators(noteId, currentUserId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.collaborators) {
          setCollaborators(res.collaborators as unknown as NoteCollaborator[]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load collaborators');
      })
      .finally(() => {
        if (isMounted) setLoadingList(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, noteId, currentUserId]);

  if (!isOpen) return null;

  const handleCopyId = (id: string) => {
    if (typeof window !== 'undefined' && id) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addIdentifier.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await addCollaborator({
        resourceId: noteId,
        userEmail: addIdentifier.trim(),
        role: addRole,
        grantedBy: currentUserId,
      });

      if (res.success) {
        setSuccess(res.message || 'Collaborator invited successfully');
        setAddIdentifier('');

        // Refresh list
        const updated = await getResourceCollaborators(noteId, currentUserId);
        if (updated.success && updated.collaborators) {
          setCollaborators(updated.collaborators as unknown as NoteCollaborator[]);
        }
      } else {
        setError(res.error || 'Failed to invite collaborator');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (targetUserId: string, username: string) => {
    if (!confirm(`Remove @${username} from this note?`)) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await removeCollaborator({
        resourceId: noteId,
        targetUserId,
        removedBy: currentUserId,
      });

      if (res.success) {
        setSuccess(`Removed @${username} from note`);
        setCollaborators(collaborators.filter((c) => c.user_id !== targetUserId));
      } else {
        setError(res.error || 'Failed to remove collaborator');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove collaborator');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: 'MAINTAINER' | 'CONTRIBUTOR') => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await updateCollaboratorRole({
        resourceId: noteId,
        targetUserId,
        newRole,
        updatedBy: currentUserId,
      });

      if (res.success) {
        setSuccess(res.message || 'Role updated');
        setCollaborators(
          collaborators.map((c) => (c.user_id === targetUserId ? { ...c, role_type: newRole } : c))
        );
      } else {
        setError(res.error || 'Failed to update role');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return {
          icon: <Crown className="w-3 h-3 text-yellow-400" />,
          className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
          label: 'Owner',
        };
      case 'MAINTAINER':
        return {
          icon: <Wrench className="w-3 h-3 text-blue-400" />,
          className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          label: 'Maintainer',
        };
      case 'CONTRIBUTOR':
        return {
          icon: <Edit className="w-3 h-3 text-emerald-400" />,
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          label: 'Contributor',
        };
      default:
        return {
          icon: <Shield className="w-3 h-3 text-zinc-400" />,
          className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
          label: role,
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Invite Note Collaborators</h2>
              <p className="text-xs text-zinc-400 truncate max-w-sm">{noteTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="px-6 py-3 bg-red-950/50 border-b border-red-900/50 flex items-start gap-2 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="px-6 py-3 bg-emerald-950/50 border-b border-emerald-900/50 flex items-start gap-2 text-emerald-400 text-xs">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Invite Form */}
          {canInvite ? (
            <form onSubmit={handleInvite} className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Invite New Collaborator</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Email, UUID, or Username</span>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  User Email Address or User ID (UUID)
                </label>
                <input
                  type="text"
                  value={addIdentifier}
                  onChange={(e) => setAddIdentifier(e.target.value)}
                  placeholder="e.g. user@bookworm.dev or 550e8400-e29b-41d4-a716-446655440000"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Users can copy their UUID from their Profile tab on the dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Role</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as 'MAINTAINER' | 'CONTRIBUTOR')}
                    disabled={submitting}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="CONTRIBUTOR">Contributor (Edit via Issues)</option>
                    <option value="MAINTAINER">Maintainer (Direct Edit & Merge)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={submitting || !addIdentifier.trim()}
                    className="w-full px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Inviting...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Invite to Note</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800 text-xs text-zinc-400">
              Only owners and maintainers can invite contributors to this note.
            </div>
          )}

          {/* Current Collaborators List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>Note Collaborators ({collaborators.length})</span>
              </h3>
              {loadingList && (
                <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Refreshing...</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {collaborators.length === 0 && !loadingList ? (
                <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  No additional collaborators assigned to this note.
                </div>
              ) : (
                collaborators.map((c) => {
                  const badge = getRoleBadge(c.role_type);
                  const isSelf = c.user_id === currentUserId;
                  const isCollabOwner = c.role_type === 'OWNER';

                  return (
                    <div
                      key={c.role_id || c.user_id}
                      className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              alt={c.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            c.username[0]?.toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-zinc-100 truncate">
                              @{c.username}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] text-zinc-500 font-mono">(you)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 flex-wrap">
                            <span className="truncate max-w-[140px]">{c.email}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="font-mono text-zinc-500">
                              UUID: {c.user_id.substring(0, 8)}...
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyId(c.user_id)}
                              className="text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors flex items-center gap-0.5 cursor-pointer"
                              title="Copy user UUID"
                            >
                              {copiedId === c.user_id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Role Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isOwner && !isCollabOwner && !isSelf ? (
                          <select
                            value={c.role_type}
                            onChange={(e) =>
                              handleUpdateRole(
                                c.user_id,
                                e.target.value as 'MAINTAINER' | 'CONTRIBUTOR'
                              )
                            }
                            disabled={submitting}
                            className="px-2 py-1 rounded-lg border text-[11px] font-medium bg-zinc-900 text-zinc-300 border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="CONTRIBUTOR">Contributor</option>
                            <option value="MAINTAINER">Maintainer</option>
                          </select>
                        ) : (
                          <div
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium flex items-center gap-1 ${badge.className}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </div>
                        )}

                        {isOwner && !isCollabOwner && !isSelf && (
                          <button
                            type="button"
                            onClick={() => handleRemove(c.user_id, c.username)}
                            disabled={submitting}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                            title="Remove collaborator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
