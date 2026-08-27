import { getCurrentUser } from '@/actions/auth';
import { getNote } from '@/actions/notes';
import { getBranches, BranchWithCommits } from '@/actions/branches';
import { redirect } from 'next/navigation';
import BranchesClient from './branches-client';

interface PageProps {
  params: Promise<{
    notebookId: string;
    noteId: string;
  }>;
}

export default async function BranchesPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  const { notebookId, noteId } = await params;

  // Fetch note details
  const noteResult = await getNote(noteId);
  if (!noteResult.success || !noteResult.note) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  // Fetch branches with commit history
  const branchesResult = await getBranches(noteId, true);
  if (!branchesResult.success) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  return (
    <BranchesClient
      note={noteResult.note}
      branches={(branchesResult.branches || []) as BranchWithCommits[]}
      notebookId={notebookId}
      user={user}
    />
  );
}
