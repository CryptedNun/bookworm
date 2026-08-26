/**
 * Note Edit Page
 * 
 * Block-level editor with real-time markdown preview
 * Implements version control, content deduplication, and LexoRank ordering
 */

import { getNote } from '@/actions/notes';
import { getCurrentUser } from '@/actions/auth';
import { redirect } from 'next/navigation';
import NoteEditor from './editor';

interface PageProps {
  params: Promise<{ notebookId: string; noteId: string }>;
}

export default async function NoteEditPage({ params }: PageProps) {
  // Authenticate
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  // Await params
  const { notebookId, noteId } = await params;

  // Fetch note with blocks
  const noteResult = await getNote(noteId);
  
  if (!noteResult.success || !noteResult.note) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  // Check permission (OWNER or MAINTAINER only)
  const hasEditPermission = await checkEditPermission(user.user_id, noteId);
  if (!hasEditPermission) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  return (
    <NoteEditor 
      note={noteResult.note as any}
      notebookId={notebookId}
      user={user}
    />
  );
}

async function checkEditPermission(userId: string, noteId: string): Promise<boolean> {
  const { sql } = await import('@/lib/db');
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE user_id = ${userId}
    AND resource_id = ${noteId}
    AND role_type IN ('OWNER', 'MAINTAINER')
  ` as { role_type: string }[];
  
  return !!permission;
}
