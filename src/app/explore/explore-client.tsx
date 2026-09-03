'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Compass,
  BookOpen,
  Folder,
  BookMarked,
  Search,
  GitFork,
  ArrowRight,
  Clock,
  User as UserIcon,
  Sparkles,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type { ExploreNotebookItem, ExploreNoteItem, ExploreEditionItem } from '@/actions/explore';
import ForkNoteModal from '@/components/notes/ForkNoteModal';

interface ExploreClientProps {
  notebooks: ExploreNotebookItem[];
  notes: ExploreNoteItem[];
  editions: ExploreEditionItem[];
  currentUser: {
    user_id: string;
    username: string;
  } | null;
  userNotebooks: Array<{ notebook_id: string; title: string }>;
}

export default function ExploreClient({
  notebooks,
  notes,
  editions,
  currentUser,
  userNotebooks,
}: ExploreClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'NOTES' | 'NOTEBOOKS' | 'EDITIONS'>('ALL');
  const [selectedForkNote, setSelectedForkNote] = useState<{ id: string; title: string } | null>(null);

  // Filter items by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.notebook_title.toLowerCase().includes(q) ||
        n.owner_username.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const filteredNotebooks = useMemo(() => {
    if (!searchQuery.trim()) return notebooks;
    const q = searchQuery.toLowerCase();
    return notebooks.filter(
      (nb) =>
        nb.title.toLowerCase().includes(q) ||
        (nb.description && nb.description.toLowerCase().includes(q)) ||
        nb.owner_username.toLowerCase().includes(q)
    );
  }, [notebooks, searchQuery]);

  const filteredEditions = useMemo(() => {
    if (!searchQuery.trim()) return editions;
    const q = searchQuery.toLowerCase();
    return editions.filter(
      (e) =>
        e.note_title.toLowerCase().includes(q) ||
        e.edition_name.toLowerCase().includes(q) ||
        e.share_code.toLowerCase().includes(q)
    );
  }, [editions, searchQuery]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 w-full bg-zinc-950/90 border-b border-zinc-800 backdrop-blur-md px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-zinc-100 font-bold text-base hover:opacity-90 transition-opacity tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <span>BookWorm</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Community Hub
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <Link
                href="/dashboard"
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-colors flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                Sign In / Join
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-zinc-800/80 bg-gradient-to-b from-zinc-900/50 via-zinc-950 to-zinc-950 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Compass className="w-3.5 h-3.5" />
            <span>Discover Public Notes & Knowledge Repositories</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
            Explore Open Community Notes
          </h1>

          <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Read canonical published editions or fork any note into your workspace with zero storage overhead through Content-Addressed Storage.
          </p>

          {/* Search Input */}
          <div className="max-w-lg mx-auto pt-2">
            <div className="relative">
              <Search className="absolute inset-y-0 left-3.5 my-auto w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search community notes, notebooks, topics..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 text-xs font-medium">
          {(['ALL', 'NOTES', 'NOTEBOOKS', 'EDITIONS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'ALL'
                ? `All (${filteredNotes.length + filteredNotebooks.length + filteredEditions.length})`
                : tab === 'NOTES'
                ? `Notes (${filteredNotes.length})`
                : tab === 'NOTEBOOKS'
                ? `Notebooks (${filteredNotebooks.length})`
                : `Editions (${filteredEditions.length})`}
            </button>
          ))}
        </div>

        {/* 1. Notes Grid */}
        {(activeTab === 'ALL' || activeTab === 'NOTES') && filteredNotes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Public Notes</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => (
                <div
                  key={note.note_id}
                  className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                      <span className="text-zinc-400 truncate max-w-[150px]">
                        📁 {note.notebook_title}
                      </span>
                      <span>{note.blocks_count} {note.blocks_count === 1 ? 'block' : 'blocks'}</span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {note.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center overflow-hidden">
                        {note.owner_avatar_url ? (
                          <img
                            src={note.owner_avatar_url}
                            alt={note.owner_username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          note.owner_username[0]?.toUpperCase()
                        )}
                      </div>
                      <span className="font-medium text-zinc-300">@{note.owner_username}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
                    {note.canonical_edition_code ? (
                      <Link
                        href={`/e/${note.canonical_edition_code}`}
                        className="text-purple-400 hover:text-purple-300 font-mono text-[11px] flex items-center gap-1"
                      >
                        <span>Release Edition</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/notebooks/${note.notebook_id}/notes/${note.note_id}`}
                        className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1"
                      >
                        <span>View Document</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}

                    {currentUser && (
                      <button
                        onClick={() => setSelectedForkNote({ id: note.note_id, title: note.title })}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-emerald-600 hover:text-zinc-950 text-zinc-300 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                        title="Zero-cost copy to your workspace"
                      >
                        <GitFork className="w-3 h-3" />
                        <span>Fork</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. Notebooks Grid */}
        {(activeTab === 'ALL' || activeTab === 'NOTEBOOKS') && filteredNotebooks.length > 0 && (
          <section className="space-y-3 pt-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <Folder className="w-3.5 h-3.5 text-purple-400" />
              <span>Public Notebooks</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotebooks.map((nb) => (
                <Link
                  key={nb.notebook_id}
                  href={`/dashboard/notebooks/${nb.notebook_id}`}
                  className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/40 transition-all space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                      <span>{nb.notes_count} {nb.notes_count === 1 ? 'Note' : 'Notes'}</span>
                      <span className="text-purple-400">Public</span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-purple-400 transition-colors line-clamp-1">
                      {nb.title}
                    </h3>

                    {nb.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {nb.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <span>by @{nb.owner_username}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      Browse <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 3. Published Editions Grid */}
        {(activeTab === 'ALL' || activeTab === 'EDITIONS') && filteredEditions.length > 0 && (
          <section className="space-y-3 pt-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <BookMarked className="w-3.5 h-3.5 text-cyan-400" />
              <span>Published Editions</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEditions.map((ed) => (
                <a
                  key={ed.edition_id}
                  href={`/e/${ed.share_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 transition-all space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                        {ed.edition_name}
                      </span>
                      <span>/e/{ed.share_code}</span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-cyan-400 transition-colors line-clamp-1">
                      {ed.note_title}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <span>by @{ed.author_username}</span>
                    <span className="text-cyan-400 flex items-center gap-1 font-medium">
                      Read Publicly <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Fork Modal if triggered */}
      {selectedForkNote && currentUser && (
        <ForkNoteModal
          noteId={selectedForkNote.id}
          noteTitle={selectedForkNote.title}
          userId={currentUser.user_id}
          userNotebooks={userNotebooks}
          isOpen={true}
          onClose={() => setSelectedForkNote(null)}
        />
      )}
    </div>
  );
}
