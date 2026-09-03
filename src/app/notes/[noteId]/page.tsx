import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

interface PageProps {
  params: Promise<{ noteId: string }>;
}

/**
 * Top-level canonical route for /notes/[noteId]
 */
export default async function TopLevelNoteRedirectPage({ params }: PageProps) {
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
