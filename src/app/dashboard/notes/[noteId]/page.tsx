import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

interface PageProps {
  params: Promise<{ noteId: string }>;
}

/**
 * Direct canonical route for /dashboard/notes/[noteId]
 * Automatically resolves the note's parent notebook and redirects cleanly.
 */
export default async function DirectNoteRedirectPage({ params }: PageProps) {
  const { noteId } = await params;

  if (!noteId) {
    redirect('/dashboard');
  }

  const [note] = await sql`
    SELECT note_id, notebook_id
    FROM notes
    WHERE note_id = ${noteId}
    LIMIT 1
  `;

  if (note) {
    redirect(`/dashboard/notebooks/${note.notebook_id}/notes/${note.note_id}`);
  }

  redirect('/dashboard');
}
