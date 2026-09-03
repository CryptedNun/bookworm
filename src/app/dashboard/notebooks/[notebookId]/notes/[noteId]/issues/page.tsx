import { getCurrentUser } from '@/actions/auth';
import { getNote, getNoteWithBlocks } from '@/actions/notes';
import type { Note } from '@/actions/notes';
import { getIssues } from '@/actions/issues';
import type { Issue } from '@/actions/issues';
import { redirect } from 'next/navigation';
import IssuesClient from './issues-client';

interface PageProps {
  params: Promise<{
    notebookId: string;
    noteId: string;
  }>;
  searchParams: Promise<{ status?: string; slotId?: string; action?: string }>;
}

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/?session=expired');
  }

  const { notebookId, noteId } = await params;
  const { status, slotId, action } = await searchParams;

  // Fetch note with blocks (needed for the issue creation UI which shows blocks)
  const noteResult = await getNoteWithBlocks(noteId);
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
      note={noteResult.note as Note & { blocks: Array<{ slot_id: string; block_type: string; content_text: string; lexorank_key: string }> }}
      issues={(issuesResult.issues || []) as Issue[]}
      notebookId={notebookId}
      user={user}
      initialSlotId={slotId}
      initialOpen={action === 'new' || !!slotId}
    />
  );
}
