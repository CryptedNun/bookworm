'use client';

import React, { useState } from 'react';
import { 
  BookMarked, 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  Loader2, 
  Globe, 
  ShieldCheck,
  Sparkles 
} from 'lucide-react';
import { publishEdition } from '@/actions/editions';

interface PublishEditionModalProps {
  noteId: string;
  noteTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (shareCode: string) => void;
}

export default function PublishEditionModal({
  noteId,
  noteTitle,
  isOpen,
  onClose,
  onPublished,
}: PublishEditionModalProps) {
  const [editionName, setEditionName] = useState('v1.0.0');
  const [shareCode, setShareCode] = useState('');
  const [isStandard, setIsStandard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedCode, setPublishedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editionName.trim()) {
      setError('Edition name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await publishEdition({
        noteId,
        editionName: editionName.trim(),
        shareCode: shareCode.trim() || undefined,
        isStandard,
      });

      if (res.success && res.edition) {
        setPublishedCode(res.edition.share_code);
        onPublished?.(res.edition.share_code);
      } else {
        setError(res.error || 'Failed to publish edition.');
      }
    } catch (err: any) {
      console.error('Publish error:', err);
      setError(err.message || 'An unexpected error occurred while publishing.');
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = publishedCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/e/${publishedCode}`
    : '';

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Publish Note Edition</h3>
              <p className="text-xs text-zinc-400">Create a permanent public snapshot with a shareable URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {publishedCode ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-zinc-100">Edition Published Successfully!</h4>
              <p className="text-xs text-zinc-400">
                Your note snapshot has been permanently pinned and is now accessible via its public link.
              </p>
            </div>

            {/* Link Box */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-mono text-emerald-400 text-left">{shareUrl}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                  title="Copy link"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={`/e/${publishedCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handlePublish} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Edition Release Name
              </label>
              <input
                type="text"
                required
                value={editionName}
                onChange={(e) => setEditionName(e.target.value)}
                placeholder="e.g. v1.0.0, Release 1, Final Draft"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Custom Share Code (Optional)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-500 font-mono">
                  /e/
                </span>
                <input
                  type="text"
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value)}
                  placeholder="cs101-notes-v1"
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Leave blank to automatically generate a clean URL slug from the edition name.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="isStandardCheckbox"
                checked={isStandard}
                onChange={(e) => setIsStandard(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0 accent-emerald-500 cursor-pointer"
              />
              <label htmlFor="isStandardCheckbox" className="text-xs text-zinc-300 cursor-pointer select-none">
                <span className="font-semibold block text-zinc-200">Set as Standard Public Edition</span>
                <span className="text-[11px] text-zinc-400">
                  Makes this release the canonical public snapshot shown when accessing the note without an edition tag.
                </span>
              </label>
            </div>

            <div className="p-3 rounded-xl bg-purple-950/10 border border-purple-500/20 flex items-center gap-2 text-[11px] text-purple-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-purple-400" />
              <span>
                Editions pin the current SHA-256 manifest. Future edits to the note will not alter this published edition.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    Publish Snapshot
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
