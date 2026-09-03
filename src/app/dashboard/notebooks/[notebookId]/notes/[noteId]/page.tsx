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
} from 'lucide-react';
import ForkNoteButton from '@/components/notes/ForkNoteButton';
import PublishEditionButton from '@/components/notes/PublishEditionButton';
import { getNoteEditions } from '@/actions/editions';
import RobustMarkdown from '@/components/markdown/RobustMarkdown';
import { BookMarked } from 'lucide-react';
import StarButton from '@/components/notes/StarButton';
import NoteBlocksViewer from '@/components/notes/NoteBlocksViewer';
import { isResourceStarred } from '@/actions/stars';
import InviteNoteButton from '@/components/notes/InviteNoteButton';

interface PageProps {
  params: Promise<{
    notebookId: string;
    noteId: string;
  }>;
}

export default async function NoteDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/?session=expired');
  }

  const { notebookId, noteId } = await params;

  // Fetch note with all its block versions
  const noteResult = await getNoteWithBlocks(noteId);
  if (!noteResult.success || !noteResult.note) {
    redirect('/dashboard');
  }

  // Fetch notebook metadata (or use note's joined notebook_title)
  const notebookResult = await getNotebook(notebookId);
  const notebookTitle = notebookResult.success && notebookResult.notebook?.title 
    ? notebookResult.notebook.title 
    : (noteResult.note.notebook_title || 'Notebook');

  // Fetch user notebooks for forking
  const userNotebooksResult = await getUserNotebooks();
  const userNotebooks = userNotebooksResult.success && userNotebooksResult.notebooks ? userNotebooksResult.notebooks : [];

  // Fetch published editions for this note
  const editionsResult = await getNoteEditions(noteId);
  const editions = editionsResult.success && editionsResult.editions ? editionsResult.editions : [];

  // Check if note is starred by user
  const isStarred = await isResourceStarred(noteId, user.user_id);

  const note = noteResult.note;
  const blocks = note.blocks || [];
  const canEdit = ['OWNER', 'MAINTAINER'].includes(note.role_type);

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
                {notebookTitle}
              </Link>
              <span>/</span>
              <span className="text-zinc-100 font-semibold truncate">{note.title}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <StarButton resourceId={note.note_id} initialStarred={isStarred} />

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

            <InviteNoteButton
              noteId={note.note_id}
              noteTitle={note.title}
              currentUserId={user.user_id}
              currentUserRole={note.role_type as any}
            />

            {/* VCS Actions Group */}
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-zinc-900/60 border border-zinc-700/40">
              <Link
                href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/tree`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 text-[11px] font-medium transition-colors"
                title="View Commit Tree"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Tree</span>
              </Link>

              <Link
                href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/branches`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-purple-400 text-[11px] font-medium transition-colors"
                title="View Branches"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Branches</span>
              </Link>

              <Link
                href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/issues`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 text-[11px] font-medium transition-colors"
                title="View Issues"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Issues</span>
              </Link>
            </div>

            <Link
              href={`/dashboard/notebooks/${notebookId}/notes/${noteId}/edit`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
              title="Edit Blocks in Editor"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Note</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Note Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 animate-page-in">
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

          </div>

          {/* Blocks Viewer with History & Hierarchy */}
          <NoteBlocksViewer
            noteId={note.note_id}
            notebookId={notebookId}
            blocks={blocks}
            canEdit={canEdit}
          />
        </article>
      </main>
    </div>
  );
}
