import { Suspense } from 'react';
import { getCurrentUser } from '@/actions/auth';
import { getNote } from '@/actions/notes';
import type { Note } from '@/actions/notes';
import { getBranches } from '@/actions/branches';
import type { BranchWithCommits } from '@/actions/branches';
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
    redirect('/?session=expired');
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
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Loading branches...</div>}>
      <BranchesClient
        note={noteResult.note as Note}
        branches={(branchesResult.branches || []) as BranchWithCommits[]}
        notebookId={notebookId}
        user={user}
      />
    </Suspense>
  );
}
