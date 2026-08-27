/**
 * Note Edit Page
 * 
 * Block-level editor with real-time markdown preview
 * Implements version control, content deduplication, and LexoRank ordering
 */

import { getNoteWithBlocks } from '@/actions/notes';
import { getCurrentUser } from '@/actions/auth';
import { getBranches } from '@/actions/branches';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import NoteEditor from './editor';

interface PageProps {
  params: Promise<{ notebookId: string; noteId: string }>;
  searchParams: Promise<{ branch?: string }>;
}

export default async function NoteEditPage({ params, searchParams }: PageProps) {
  // Authenticate
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  // Await params
  const { notebookId, noteId } = await params;
  const { branch: branchId } = await searchParams;

  // Fetch note with blocks
  const noteResult = await getNoteWithBlocks(noteId, branchId);
  
  if (!noteResult.success || !noteResult.note) {
    redirect(`/dashboard/notebooks/${notebookId}`);
  }

  // Check permission
  // - For main branch: OWNER or MAINTAINER only
  // - For issue branches: Must be the assigned user (attempted_by)
  const permission = await checkEditPermission(user.user_id, noteId, branchId);
  if (!permission.canEdit) {
    redirect(`/dashboard/notebooks/${notebookId}/notes/${noteId}/issues`);
  }

  // Fetch all branches for switcher
  const branchesResult = await getBranches(noteId, false);
  const branches = branchesResult.success ? branchesResult.branches || [] : [];

  // Determine current branch
  let currentBranch;
  if (branchId) {
    currentBranch = branches.find(b => b.branch_id === branchId);
  } else {
    currentBranch = branches.find(b => b.is_main);
  }

  return (
    <NoteEditor 
      note={{ ...noteResult.note, blocks: noteResult.note.blocks || [] } as any}
      notebookId={notebookId}
      user={user}
      branches={branches as any}
      currentBranch={currentBranch as any}
      userRole={permission.role}
    />
  );
}

async function checkEditPermission(
  userId: string, 
  noteId: string,
  branchId?: string
): Promise<{ canEdit: boolean; role: string }> {
  // Get user's role on the note
  const [permission] = await sql`
    SELECT role_type FROM collaborator_roles
    WHERE user_id = ${userId}
    AND resource_id = ${noteId}
  ` as { role_type: string }[];
  
  if (!permission) {
    return { canEdit: false, role: 'NONE' };
  }

  // If no branchId (editing main)
  if (!branchId) {
    // Only OWNER or MAINTAINER can edit main
    const canEditMain = ['OWNER', 'MAINTAINER'].includes(permission.role_type);
    return { canEdit: canEditMain, role: permission.role_type };
  }

  // If branchId specified, check if it's an issue branch
  const [branch] = await sql`
    SELECT issue_id, attempted_by, is_main
    FROM branches
    WHERE branch_id = ${branchId}
    AND note_id = ${noteId}
  ` as Array<{ issue_id: string | null; attempted_by: string | null; is_main: boolean }>;

  if (!branch) {
    return { canEdit: false, role: permission.role_type };
  }

  // If it's main branch
  if (branch.is_main) {
    const canEditMain = ['OWNER', 'MAINTAINER'].includes(permission.role_type);
    return { canEdit: canEditMain, role: permission.role_type };
  }

  // If it's an issue branch, must be the assigned user
  const isAssignedUser = branch.attempted_by === userId;
  return { canEdit: isAssignedUser, role: permission.role_type };
}
