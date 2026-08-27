'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  ArrowLeft, 
  FileText, 
  GitBranch,
  List,
  X,
  Edit,
} from 'lucide-react';
import RobustMarkdown from '@/components/markdown/RobustMarkdown';
import type { Notebook } from '@/actions/notebooks';
import type { Note } from '@/actions/notes';
import type { User } from '@/actions/auth';

interface NotebookReaderProps {
  notebook: Notebook;
  notes: Array<Note & { content: string }>;
  user: User;
}

export default function NotebookReader({ notebook, notes, user }: NotebookReaderProps) {
  const [showTOC, setShowTOC] = useState(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Extract headings for table of contents
  const tableOfContents = notes.map((note, index) => ({
    id: note.note_id,
    title: note.title,
    chapter: index + 1,
  }));

  const scrollToChapter = (noteId: string) => {
    setActiveNoteId(noteId);
    const element = document.getElementById(`note-${noteId}`);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-100">{notebook.title}</h1>
                <p className="text-xs text-zinc-400">
                  {notes.length} {notes.length === 1 ? 'chapter' : 'chapters'} • {notebook.visibility}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTOC(!showTOC)}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors flex items-center gap-2"
            >
              {showTOC ? <X className="w-4 h-4" /> : <List className="w-4 h-4" />}
              Table of Contents
            </button>

            <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Branch
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex">
        {/* Table of Contents Sidebar */}
        {showTOC && (
          <aside className="w-64 sticky top-[73px] h-[calc(100vh-73px)] border-r border-zinc-800 bg-zinc-950 overflow-y-auto p-6">
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">
                Chapters
              </h2>
              {tableOfContents.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => scrollToChapter(chapter.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeNoteId === chapter.id
                      ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-zinc-500 font-mono">
                        Chapter {chapter.chapter}
                      </div>
                      <div className="truncate">{chapter.title}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 px-8 py-12">
          {notes.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800/50 mb-4">
                <BookOpen className="w-8 h-8 text-zinc-600" />
              </div>
              <h2 className="text-xl font-bold text-zinc-400 mb-2">Empty Notebook</h2>
              <p className="text-sm text-zinc-500 mb-6">
                This notebook doesn't have any notes yet.
              </p>
              <button className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors">
                Create First Note
              </button>
            </div>
          ) : (
            <article className="max-w-4xl mx-auto">
              {/* Book Title Page */}
              <div className="mb-16 pb-16 border-b border-zinc-800">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 mb-6">
                    <BookOpen className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h1 className="text-5xl font-bold text-zinc-100">{notebook.title}</h1>
                  {notebook.description && (
                    <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                      {notebook.description}
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-6 text-sm text-zinc-500 pt-4">
                    <span>{notes.length} Chapters</span>
                    <span>•</span>
                    <span>by @{notebook.owner_username}</span>
                    <span>•</span>
                    <span>{notebook.visibility}</span>
                  </div>
                </div>
              </div>

              {/* Render Notes with Edit Buttons */}
              {notes.map((note, index) => {
                const chapterNumber = index + 1;
                return (
                  <div key={note.note_id} id={`note-${note.note_id}`} className="mb-16">
                    {/* Note Header */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
                      <div>
                        <div className="text-sm text-zinc-500 mb-2">Chapter {chapterNumber}</div>
                        <h1 className="text-4xl font-bold text-zinc-100">{note.title}</h1>
                      </div>
                      <Link
                        href={`/dashboard/notebooks/${notebook.notebook_id}/notes/${note.note_id}/edit`}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Note
                      </Link>
                    </div>

                    {/* Note Content */}
                    <RobustMarkdown content={note.content || '_This note is empty._'} />
                  </div>
                );
              })}

              {/* End of Book */}
              <div className="mt-20 pt-12 border-t border-zinc-800 text-center text-sm text-zinc-500">
                <p>— End of Notebook —</p>
                <p className="mt-2">Created by @{notebook.owner_username}</p>
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
