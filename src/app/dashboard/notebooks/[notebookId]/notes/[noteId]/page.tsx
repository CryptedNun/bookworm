/**
 * Single Note Viewer Page
 * 
 * Renders an individual note's blocks in order with quick links to
 * edit, tree graph, issues, and branches.
 */

import { getNoteWithBlocks } from '@/actions/notes';
import { getNotebook, getUserNotebooks } from '@/actions/notebooks';
import { getCurrentUser } from '@/actions/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Edit, 
  GitBranch, 
  AlertCircle, 
  GitFork, 
  FileText,
  Clock,
  Lock,
  Sparkles,
} from 'lucide-react';
import ForkNoteButton from '@/components/notes/ForkNoteButton';
import PublishEditionButton from '@/components/notes/PublishEditionButton';
import { getNoteEditions } from '@/actions/editions';
import RobustMarkdown from '@/components/markdown/RobustMarkdown';
import { BookMarked } from 'lucide-react';

interface PageProps {
  params: Promise<{
    notebookId: string;
    noteId: string;
  }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const { notebookId, noteId } = await params;

  // Fetch notebook metadata
  const notebookResult = await getNotebook(notebookId);
  if (!notebookResult.success || !notebookResult.notebook) {
    redirect('/dashboard');
  }

  // Fetch note with all its block versions
  const noteResult = await getNoteWithBlocks(noteId);
  if (!noteResult.success || !noteResult.note) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  // Fetch user notebooks for forking
  const userNotebooksResult = await getUserNotebooks();
  const userNotebooks = userNotebooksResult.success && userNotebooksResult.notebooks ? userNotebooksResult.notebooks : [];

  // Fetch published editions for this note
  const editionsResult = await getNoteEditions(noteId);
  const editions = editionsResult.success && editionsResult.editions ? editionsResult.editions : [];

  const note = noteResult.note;
  const blocks = note.blocks || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/dashboard/notebooks/${notebookId}/manage`}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Back to notebook notes"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-2 text-sm text-zinc-400 truncate">
              <Link 
                href={`/dashboard/notebooks/${notebookId}`}
                className="hover:text-zinc-200 transition-colors truncate"
              >
                {notebookResult.notebook.title}
              </Link>
              <span>/</span>
              <span className="text-zinc-100 font-semibold truncate">{note.title}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <PublishEditionButton
              noteId={note.note_id}
              noteTitle={note.title}
              editions={editions}
            />

            <ForkNoteButton
              noteId={note.note_id}
              noteTitle={note.title}
              userId={user.user_id}
              userNotebooks={userNotebooks}
            />

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/tree`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-blue-400 text-xs font-medium border border-zinc-700/60 transition-colors"
              title="View Commit Tree"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Tree</span>
            </Link>

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/branches`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-purple-400 text-xs font-medium border border-zinc-700/60 transition-colors"
              title="View Branches"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Branches</span>
            </Link>

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/issues`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 text-xs font-medium border border-zinc-700/60 transition-colors"
              title="View Issues"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Issues</span>
            </Link>

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/edit`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors shadow-sm"
              title="Edit Blocks in Editor"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Note</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Note Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        <article className="space-y-6">
          {/* Note Header */}
          <div className="pb-6 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5 text-xs text-zinc-500 font-mono mb-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {note.visibility}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(note.created_at).toLocaleDateString(undefined, { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
              <span>•</span>
              <span>{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}</span>
              {editions[0] && (
                <>
                  <span>•</span>
                  <a
                    href={`/e/${editions[0].share_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20"
                    title="View canonical published edition"
                  >
                    <BookMarked className="w-3 h-3" />
                    <span>Release: {editions[0].edition_name} ↗</span>
                  </a>
                </>
              )}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mb-4">
              {note.title}
            </h1>

            {/* In-context Version Control Explainer Callout */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-200">Collaborative Block Level Versioning: </span>
                <span>
                  Hover over any individual block below to <strong>propose an edit via a block issue</strong>, or click <strong>Fork</strong> above to copy this note into your own notebook at zero storage cost!
                </span>
              </div>
            </div>
          </div>

          {/* Blocks */}
          {blocks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
              <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 mb-4">This note does not have any content blocks yet.</p>
              <Link
                href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors"
              >
                <Edit className="w-4 h-4" />
                Open Block Editor
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {blocks.map((block: any, index: number) => (
                <div 
                  key={block.slot_id}
                  className="group relative rounded-xl border border-transparent hover:border-zinc-800 hover:bg-zinc-900/20 transition-all p-3 -mx-3"
                >
                  {/* Floating Action: Propose Edit / Lock Block */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
                    <Link
                      href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/issues?slotId=${block.slot_id}&action=new`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-amber-300 text-[11px] font-medium border border-amber-500/30 shadow-md transition-all backdrop-blur-sm"
                      title="Lock this block and propose an edit via an issue"
                    >
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Propose Edit</span>
                    </Link>
                  </div>

                  <div className="prose prose-invert prose-emerald max-w-none">
                    <RobustMarkdown content={block.content_text || ''} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
