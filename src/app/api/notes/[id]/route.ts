import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * GET /api/notes/[id]
 * Object-level access control for individual notes
 * 
 * Responses:
 * - 200 OK: Note with blocks
 * - 401 Unauthorized: Unauthenticated
 * - 403 Forbidden: Private note and requesting user has no role
 * - 404 Not Found: Note does not exist
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUserId = request.cookies.get('session_user_id')?.value;
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const { id: noteId } = await params;

    const [note] = await sql`
      SELECT 
        n.note_id,
        n.notebook_id,
        n.title,
        n.visibility,
        n.forked_from_note_id,
        nb.title as notebook_title,
        nb.visibility as notebook_visibility,
        nb.owner_id as notebook_owner_id
      FROM notes n
      JOIN notebooks nb ON nb.notebook_id = n.notebook_id
      WHERE n.note_id = ${noteId} AND n.deleted_at IS NULL
    `;

    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found.' },
        { status: 404 }
      );
    }

    // Object-Level Access Check:
    // Check note role or notebook role
    const [noteRole] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${noteId} AND user_id = ${sessionUserId}
    `;

    const [notebookRole] = await sql`
      SELECT role_type FROM collaborator_roles
      WHERE resource_id = ${note.notebook_id} AND user_id = ${sessionUserId}
    `;

    const effectiveRole = noteRole?.role_type || notebookRole?.role_type;
    const isOwner = note.notebook_owner_id === sessionUserId;
    const isPrivate = note.visibility === 'PRIVATE' || note.notebook_visibility === 'PRIVATE';

    if (isPrivate && !isOwner && !effectiveRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden. This note is private and you are not an authorized collaborator.',
        },
        { status: 403 }
      );
    }

    // Fetch note blocks from main branch
    const [mainBranch] = await sql`
      SELECT branch_id FROM branches WHERE note_id = ${noteId} AND is_main = TRUE
    `;

    let blocks: any[] = [];
    if (mainBranch) {
      const [latestCommit] = await sql`
        SELECT commit_id FROM commits WHERE branch_id = ${mainBranch.branch_id} ORDER BY created_at DESC LIMIT 1
      `;
      if (latestCommit) {
        blocks = await sql`
          SELECT 
            lbs.slot_id,
            lbs.block_type,
            lbs.lexorank_key,
            bvc.version_id,
            cb.content_text,
            cb.sha256
          FROM commit_manifests cm
          JOIN logical_block_slots lbs ON lbs.slot_id = cm.slot_id
          JOIN block_version_contents bvc ON bvc.version_id = cm.version_id
          JOIN content_blobs cb ON cb.sha256 = bvc.content_blob_hash
          WHERE cm.commit_id = ${latestCommit.commit_id}
          ORDER BY lbs.lexorank_key ASC
        `;
      }
    }

    return NextResponse.json(
      {
        success: true,
        note: {
          ...note,
          role: effectiveRole || (isOwner ? 'OWNER' : 'VIEWER'),
          blocks,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API GET /api/notes/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
