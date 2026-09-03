/**
 * Notebook Management Page
 * 
 * Manage notes in a notebook - add, reorder, delete
 */

import { getNotebook } from '@/actions/notebooks';
import type { Notebook } from '@/actions/notebooks';
import { getNotesForNotebook } from '@/actions/notes';
import type { Note } from '@/actions/notes';
import { getCurrentUser } from '@/actions/auth';
import { getResourceCollaborators, getPendingAccessRequests } from '@/actions/permissions';
import { redirect } from 'next/navigation';
import NotebookManageClient from '../manage-client';

interface PageProps {
  params: Promise<{ notebookId: string }>;
}

export default async function NotebookManagePage({ params }: PageProps) {
  // Authenticate
  const user = await getCurrentUser();
  if (!user) {
    redirect('/?session=expired');
  }

  // Await params (Next.js 15+ requirement)
  const { notebookId } = await params;

  // Fetch notebook metadata
  const notebookResult = await getNotebook(notebookId);
  if (!notebookResult.success || !notebookResult.notebook) {
    redirect('/dashboard');
  }

  const notebook = notebookResult.notebook as Notebook;

  // Fetch notes for this notebook
  const notes = (await getNotesForNotebook(notebookId, user.user_id)) as Note[];

  // Fetch collaborators
  const collaboratorsResult = await getResourceCollaborators(notebookId, user.user_id);
  const collaborators = collaboratorsResult.success ? collaboratorsResult.collaborators : [];

  // Fetch pending access requests (only if user is owner/maintainer)
  const userRole = collaborators.find((c: any) => c.user_id === user.user_id)?.role_type;
  const canManageAccess = ['OWNER', 'MAINTAINER'].includes(userRole || '');
  
  let accessRequests: any[] = [];
  if (canManageAccess) {
    const requestsResult = await getPendingAccessRequests(user.user_id);
    // Filter to only this notebook's requests
    accessRequests = requestsResult.success 
      ? requestsResult.requests.filter((r: any) => r.resource_id === notebookId)
      : [];
  }

  // Serialize dates for client component (Next.js requirement)
  const serializedCollaborators = collaborators.map((c: any) => ({
    role_id: c.role_id,
    user_id: c.user_id,
    role_type: c.role_type,
    username: c.username,
    email: c.email,
    avatar_url: c.avatar_url,
    created_at: c.created_at instanceof Date ? c.created_at.toISOString() : (c.created_at || new Date().toISOString()),
  }));

  const serializedAccessRequests = accessRequests.map((r: any) => ({
    ...r,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at || new Date().toISOString()),
  }));

  return (
    <NotebookManageClient 
      notebook={notebook} 
      notes={notes}
      userId={user.user_id}
      userRole={userRole}
      collaborators={serializedCollaborators}
      accessRequests={serializedAccessRequests}
    />
  );
}
