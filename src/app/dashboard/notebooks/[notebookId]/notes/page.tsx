import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

interface PageProps {
  params: Promise<{ notebookId: string }>;
}

/**
 * Smart resolver page for /dashboard/notebooks/[notebookId]/notes
 * 
 * Handles cases where:
 * 1. An older notification link used the note_id in place of notebookId:
 *    /dashboard/notebooks/[noteId]/notes -> redirects to /dashboard/notebooks/[notebookId]/notes/[noteId]
 * 2. A user navigates to /dashboard/notebooks/[notebookId]/notes -> redirects to /dashboard/notebooks/[notebookId]
 */
export default async function NotebookNotesRedirectPage({ params }: PageProps) {
  const { notebookId: rawId } = await params;

  if (!rawId) {
    redirect('/dashboard');
  }

  // 1. Check if rawId is a note_id
  const [note] = await sql`
    SELECT note_id, notebook_id
    FROM notes
    WHERE note_id = ${rawId}
    LIMIT 1
  `;

  if (note) {
    redirect(`/dashboard/notebooks/${note.notebook_id}/notes/${note.note_id}`);
  }

  // 2. Check if rawId is a notebook_id
  const [notebook] = await sql`
    SELECT notebook_id
    FROM notebooks
    WHERE notebook_id = ${rawId}
    LIMIT 1
  `;

  if (notebook) {
    redirect(`/dashboard/notebooks/${notebook.notebook_id}`);
  }

  // 3. Fallback to dashboard
  redirect('/dashboard');
}
