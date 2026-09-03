'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  GitFork, 
  Download, 
  Printer, 
  Share2, 
  Check, 
  Calendar, 
  User as UserIcon,
  GitCommit,
  ShieldCheck,
  ExternalLink,
  Layers
} from 'lucide-react';
import type { PublicEditionData } from '@/actions/editions';
import ForkNoteModal from '@/components/notes/ForkNoteModal';
import RobustMarkdown from '@/components/markdown/RobustMarkdown';

interface PublicEditionClientProps {
  edition: PublicEditionData;
  currentUser: { user_id: string; username: string } | null;
  userNotebooks: Array<{ notebook_id: string; title: string }>;
}

export default function PublicEditionClient({
  edition,
  currentUser,
  userNotebooks,
}: PublicEditionClientProps) {
  const [copied, setCopied] = useState(false);
  const [isForkModalOpen, setIsForkModalOpen] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadMarkdown = () => {
    const fullMarkdown = edition.blocks
      .map((b) => b.content_text)
      .join('\n\n');

    const blob = new Blob([`# ${edition.note_title}\n\n*Edition: ${edition.edition_name}*\n\n${fullMarkdown}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${edition.note_title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${edition.share_code}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const formattedDate = new Date(edition.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-30 w-full bg-zinc-950/90 border-b border-zinc-800 backdrop-blur-md px-4 sm:px-8 py-3 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-zinc-100 font-bold text-base hover:opacity-90 transition-opacity tracking-tight"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <span>BookWorm</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Published Edition
            </span>
          </Link>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy shareable link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Link Copied' : 'Share'}</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export note as Markdown (.md)"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Export .md</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print document or save to PDF"
            >
              <Printer className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {currentUser ? (
              <button
                onClick={() => setIsForkModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Fork Note</span>
              </button>
            ) : (
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Sign In to Fork</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2. Reader Body */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-10 print:py-0 print:px-0">
        {/* Article Metadata Banner */}
        <div className="border-b border-zinc-800 pb-8 mb-8 space-y-4">
          <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
              🏷️ {edition.edition_name}
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
              <GitCommit className="w-3.5 h-3.5 text-zinc-400" />
              commit: {edition.pinned_commit_id.substring(0, 8)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight leading-tight">
            {edition.note_title}
          </h1>

          {/* Publisher Byline */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm overflow-hidden">
                {edition.publisher.avatar_url ? (
                  <img src={edition.publisher.avatar_url} alt={edition.publisher.username} className="w-full h-full object-cover" />
                ) : (
                  edition.publisher.username[0]?.toUpperCase()
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-200">
                  @{edition.publisher.username}
                </div>
                <div className="text-[11px] text-zinc-400">Published via BookWorm CAS Engine</div>
              </div>
            </div>

            {/* CAS Integrity Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>CAS SHA-256 Verified</span>
            </div>
          </div>
        </div>

        {/* Content Blocks */}
        <article className="space-y-6 text-zinc-200 leading-relaxed font-sans text-sm sm:text-base">
          {edition.blocks.map((block) => (
            <div key={block.slot_id} className="prose prose-invert prose-emerald max-w-none">
              <RobustMarkdown content={block.content_text || ''} />
            </div>
          ))}
        </article>

        {/* Article Footer */}
        <div className="border-t border-zinc-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 print:hidden">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Structured note composed of {edition.blocks.length} content-addressed blocks</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              Copy Permalink
            </button>
            <span>•</span>
            <Link href="/" className="hover:text-zinc-200 transition-colors">
              About BookWorm
            </Link>
          </div>
        </div>
      </main>

      {/* Fork Note Modal */}
      {currentUser && (
        <ForkNoteModal
          noteId={edition.note_id}
          noteTitle={edition.note_title}
          userId={currentUser.user_id}
          userNotebooks={userNotebooks}
          isOpen={isForkModalOpen}
          onClose={() => setIsForkModalOpen(false)}
        />
      )}
    </div>
  );
}
