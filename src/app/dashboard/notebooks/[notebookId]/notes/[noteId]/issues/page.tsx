import { getCurrentUser } from '@/actions/auth';
import { getNote } from '@/actions/notes';
import { getIssues } from '@/actions/issues';
import { redirect } from 'next/navigation';
import IssuesClient from './issues-client';

interface PageProps {
  params: Promise<{
    notebookId: string;
    noteId: string;
  }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const { notebookId, noteId } = await params;
  const { status } = await searchParams;

  // Fetch note details
  const noteResult = await getNote(noteId);
  if (!noteResult.success || !noteResult.note) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  // Fetch issues (active by default, or all if status=all)
  const includeResolved = status === 'all';
  const issuesResult = await getIssues(noteId, includeResolved);
  
  if (!issuesResult.success) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  return (
    <IssuesClient
      note={noteResult.note}
      issues={issuesResult.issues || []}
      notebookId={notebookId}
      user={user}
    />
  );
}
