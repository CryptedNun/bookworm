/**
 * Notebook Management Page
 * 
 * Manage notes in a notebook - add, reorder, delete
 */

import { getNotebook } from '@/actions/notebooks';
import { getNotesForNotebook } from '@/actions/notes';
import { getCurrentUser } from '@/actions/auth';
import { redirect } from 'next/navigation';
import NotebookManageClient from '../manage-client';

interface PageProps {
  params: Promise<{ notebookId: string }>;
}

export default async function NotebookManagePage({ params }: PageProps) {
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

  // Fetch notes for this notebook
  const notes = await getNotesForNotebook(notebookId, user.user_id);

  return (
    <NotebookManageClient 
      notebook={notebookResult.notebook} 
      notes={notes}
      userId={user.user_id}
    />
  );
}
