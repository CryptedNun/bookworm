/**
 * Notebook Viewer Page
 * 
 * Displays a notebook as a stitched book - all notes combined in order
 * with beautiful markdown rendering
 */

import { getNotebook } from '@/actions/notebooks';
import { getNotebookNotesWithContent } from '@/actions/notes';
import { getCurrentUser } from '@/actions/auth';
import { redirect } from 'next/navigation';
import NotebookReader from './reader';

interface PageProps {
  params: Promise<{ notebookId: string }>;
}

export default async function NotebookPage({ params }: PageProps) {
  // Authenticate
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  // Await params (Next.js 15+ requirement)
  const { notebookId } = await params;

  // Fetch notebook metadata
  const notebookResult = await getNotebook(notebookId);
  if (!notebookResult.success || !notebookResult.notebook) {
    redirect('/dashboard');
  }

  // Fetch notes with content
  const notesResult = await getNotebookNotesWithContent(notebookId);
  const notes = notesResult.success ? notesResult.notes || [] : [];

  return (
    <NotebookReader 
      notebook={notebookResult.notebook} 
      notes={notes}
      user={user}
    />
  );
}
