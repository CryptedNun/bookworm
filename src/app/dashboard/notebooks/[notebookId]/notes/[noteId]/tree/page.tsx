/**
 * Note Tree Visualization Page
 * 
 * Shows complete branching history as a visual tree
 * Similar to `git log --graph --all`
 */

import { getCurrentUser } from '@/actions/auth';
import { getNote } from '@/actions/notes';
import type { Note } from '@/actions/notes';
import { getBranches } from '@/actions/branches';
import type { BranchWithCommits } from '@/actions/branches';
import { redirect } from 'next/navigation';
import TreeClient from './tree-client';

interface PageProps {
  params: Promise<{
    notebookId: string;
    noteId: string;
  }>;
}

export default async function TreePage({ params }: PageProps) {
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
    <TreeClient
      note={noteResult.note as Note}
      branches={(branchesResult.branches || []) as BranchWithCommits[]}
      notebookId={notebookId}
      user={user}
    />
  );
}
