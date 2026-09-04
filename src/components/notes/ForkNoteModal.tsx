'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  GitFork, 
  X, 
  Loader2, 
  Database, 
  CheckCircle2, 
  ArrowRight,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Folder
} from 'lucide-react';
import { forkNote } from '@/actions/notes';

interface ForkNoteModalProps {
  noteId?: string;
  noteTitle?: string;
  userId: string;
  userNotebooks: Array<{ notebook_id: string; title: string; role_type?: string }>;
  availableNotes?: Array<{ note_id: string; title: string; notebook_title?: string }>;
  isOpen: boolean;
  onClose: () => void;
}

export default function ForkNoteModal({
  noteId = '',
  noteTitle = '',
  userId,
  userNotebooks = [],
  availableNotes,
  isOpen,
  onClose,
}: ForkNoteModalProps) {
  const router = useRouter();

  // Filter notebooks where user has write permission (OWNER or MAINTAINER)
  const writableNotebooks = userNotebooks.filter(
    (nb) => !nb.role_type || ['OWNER', 'MAINTAINER'].includes(nb.role_type)
  );

  const [activeNoteId, setActiveNoteId] = useState(noteId || availableNotes?.[0]?.note_id || '');
  const [activeNoteTitle, setActiveNoteTitle] = useState(noteTitle || availableNotes?.[0]?.title || 'Note');
  const [selectedNotebookId, setSelectedNotebookId] = useState(
    writableNotebooks[0]?.notebook_id || userNotebooks[0]?.notebook_id || ''
  );
  const [forkTitle, setForkTitle] = useState(`${activeNoteTitle} (Fork)`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ noteId: string; notebookId: string } | null>(null);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      const currentNoteId = noteId || availableNotes?.[0]?.note_id || '';
      const currentNoteTitle = noteTitle || availableNotes?.[0]?.title || 'Note';
      setActiveNoteId(currentNoteId);
      setActiveNoteTitle(currentNoteTitle);
      setForkTitle(`${currentNoteTitle} (Fork)`);

      const targetNb = writableNotebooks[0] || userNotebooks[0];
      if (targetNb) {
        setSelectedNotebookId(targetNb.notebook_id);
      }
      setError(null);
      setSuccessResult(null);
    }
  }, [isOpen, noteId, noteTitle, userNotebooks.length]);

  const handleSourceNoteChange = (newNoteId: string) => {
    setActiveNoteId(newNoteId);
    const found = availableNotes?.find(n => n.note_id === newNoteId);
    if (found) {
      setActiveNoteTitle(found.title);
      setForkTitle(`${found.title} (Fork)`);
    }
  };

  if (!isOpen) return null;

  const handleFork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNoteId) {
      setError('Please select a source note to fork');
      return;
    }
    if (!selectedNotebookId) {
      setError('Please select a destination notebook');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await forkNote({
        noteId: activeNoteId,
        targetNotebookId: selectedNotebookId,
        newTitle: forkTitle,
        userId,
      });

      if (res.success && res.noteId && res.notebookId) {
        setSuccessResult({
          noteId: res.noteId,
          notebookId: res.notebookId,
        });
        setTimeout(() => {
          onClose();
          router.push(`/dashboard/notebooks/${res.notebookId}/notes/${res.noteId}`);
        }, 1200);
      } else {
        setError(res.error || 'Failed to fork note');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectedNotebookTitle = userNotebooks.find(
    (nb) => nb.notebook_id === selectedNotebookId
  )?.title || 'Selected Notebook';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xl animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-zinc-900/80 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Apple-style Frosted Header */}
        <div className="p-6 border-b border-white/[0.08] bg-zinc-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-inner">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-100 tracking-tight">Zero-Cost Note Forking</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  CAS Engine
                </span>
              </div>
              <p className="text-xs text-zinc-400">Clone into your personal workspace without duplicating text</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {successResult ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-zinc-100">Fork Created Successfully!</h4>
              <p className="text-xs text-zinc-400">
                0 extra disk bytes allocated. Redirecting to your independent note copy...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFork} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* If choosing among available notes (e.g. triggered from topnav/dashboard) */}
            {availableNotes && availableNotes.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Select Note to Fork</label>
                <select
                  value={activeNoteId}
                  onChange={(e) => handleSourceNoteChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/[0.1] text-zinc-100 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all cursor-pointer"
                >
                  {availableNotes.map((n) => (
                    <option key={n.note_id} value={n.note_id}>
                      {n.title} {n.notebook_title ? `(${n.notebook_title})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Visual Forking Pipeline Graphic */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/[0.06] flex items-center justify-between gap-3 text-xs">
              <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.06]">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Source Note</div>
                <div className="font-semibold text-zinc-200 truncate mt-0.5">{activeNoteTitle}</div>
              </div>

              <div className="flex flex-col items-center shrink-0 text-cyan-400">
                <ArrowRight className="w-4 h-4" />
                <span className="text-[9px] font-mono text-zinc-500">SHA-256</span>
              </div>

              <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">Your Workspace</div>
                <div className="font-semibold text-cyan-200 truncate mt-0.5">{selectedNotebookTitle}</div>
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Forked Note Title</label>
              <input
                type="text"
                value={forkTitle}
                onChange={(e) => setForkTitle(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/[0.1] text-zinc-100 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder-zinc-500"
                placeholder="Name your forked copy"
              />
            </div>

            {/* Target Notebook Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Destination Notebook</label>
              {writableNotebooks.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  You need a notebook where you are an <strong>Owner</strong> or <strong>Maintainer</strong> to place your forked note. Please create a notebook first!
                </div>
              ) : (
                <select
                  value={selectedNotebookId}
                  onChange={(e) => setSelectedNotebookId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/[0.1] text-zinc-100 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all cursor-pointer"
                >
                  {writableNotebooks.map((nb) => (
                    <option key={nb.notebook_id} value={nb.notebook_id}>
                      {nb.title} {nb.role_type ? `(${nb.role_type})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Zero-Cost Guarantee Badge */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/20 to-cyan-950/20 border border-purple-500/20 text-xs text-zinc-300 flex items-start gap-2.5">
              <Database className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-100">Instantaneous & Zero Storage Cost:</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  The fork creates an independent commit pointer referencing the exact same SHA-256 blobs. You can edit blocks freely; changes will create new versions without affecting the original note.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || writableNotebooks.length === 0 || !activeNoteId}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Allocating Pointers...</span>
                  </>
                ) : (
                  <>
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Confirm Zero-Cost Fork</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
