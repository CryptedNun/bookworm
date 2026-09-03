'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Loader2,
  Clock,
  RotateCcw,
  Check,
  User as UserIcon,
  ShieldCheck,
  Hash,
  Database,
} from 'lucide-react';
import {
  getBlockHistory,
  restoreBlockVersion,
  type BlockVersionHistoryItem,
} from '@/actions/blocks';

interface BlockHistoryModalProps {
  isOpen: boolean;
  noteId: string;
  slotId: string;
  currentVersionId?: string;
  canEdit?: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

export default function BlockHistoryModal({
  isOpen,
  noteId,
  slotId,
  currentVersionId,
  canEdit = false,
  onClose,
  onRestored,
}: BlockHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BlockVersionHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [restoredSuccess, setRestoredSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && slotId) {
      loadHistory();
    } else {
      setHistory([]);
      setError(null);
      setRestoredSuccess(null);
    }
  }, [isOpen, slotId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBlockHistory(slotId);
      if (res.success && res.history) {
        setHistory(res.history);
      } else {
        setError(res.error || 'Failed to load block history');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoringVersionId(versionId);
    setError(null);
    try {
      const res = await restoreBlockVersion({
        noteId,
        slotId,
        versionId,
      });

      if (res.success) {
        setRestoredSuccess(`Reverted to version ${versionId.substring(0, 8)}!`);
        setTimeout(() => {
          onRestored?.();
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to restore version');
      }
    } catch (err: any) {
      setError(err.message || 'Error restoring version');
    } finally {
      setRestoringVersionId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Block Version History</h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Slot: {slotId.substring(0, 8)}... • Content-Addressed Audit Trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
              {error}
            </div>
          )}

          {restoredSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{restoredSuccess}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Fetching revisions from content blobs...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              No version history found for this block.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((ver, idx) => {
                const isCurrent = idx === 0 || (currentVersionId && ver.version_id === currentVersionId);
                const isRestoring = restoringVersionId === ver.version_id;
                const formattedDate = new Date(ver.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={ver.version_id}
                    className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                      isCurrent
                        ? 'bg-zinc-950/70 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'bg-zinc-950/40 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    {/* Meta Bar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center overflow-hidden">
                          {ver.author_avatar_url ? (
                            <img
                              src={ver.author_avatar_url}
                              alt={ver.author_username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            ver.author_username[0]?.toUpperCase()
                          )}
                        </div>
                        <span className="font-semibold text-zinc-200">
                          @{ver.author_username}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Current Version
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-zinc-500 text-[11px] font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formattedDate}
                        </span>
                        <span className="flex items-center gap-1" title={`SHA-256: ${ver.sha256}`}>
                          <Database className="w-3 h-3 text-purple-400" />
                          {ver.sha256.substring(0, 8)}...
                        </span>
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-300 whitespace-pre-wrap">
                      {ver.content_text || '(empty block)'}
                    </div>

                    {/* Actions */}
                    {!isCurrent && canEdit && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleRestore(ver.version_id)}
                          disabled={isRestoring || !!restoredSuccess}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-emerald-600 hover:text-zinc-950 text-zinc-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isRestoring ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Reverting...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Revert to this version</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500">
          <span className="font-mono text-[11px]">
            {history.length} {history.length === 1 ? 'revision' : 'revisions'} recorded in CAS
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
