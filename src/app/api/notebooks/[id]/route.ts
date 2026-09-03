import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * GET /api/notebooks/[id]
 * Fetch single notebook with object-level ownership / access control
 * 
 * Responses:
 * - 200 OK: Notebook details and notes
 * - 401 Unauthorized: Unauthenticated
 * - 403 Forbidden: Private notebook and user is not a collaborator
 * - 404 Not Found: Notebook does not exist
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

    const { id: notebookId } = await params;

    const [notebook] = await sql`
      SELECT 
        nb.notebook_id,
        nb.owner_id,
        nb.title,
        nb.description,
        nb.visibility,
        r.created_at,
        u.username as owner_username
      FROM notebooks nb
      JOIN resources r ON r.resource_id = nb.notebook_id
      JOIN users u ON u.user_id = nb.owner_id
      WHERE nb.notebook_id = ${notebookId}
    `;

    if (!notebook) {
      return NextResponse.json(
        { success: false, error: 'Notebook not found.' },
        { status: 404 }
      );
    }

    // Object-Level Access Check:
    // Is user an owner or collaborator?
    const [userRole] = await sql`
      SELECT role_type
      FROM collaborator_roles
      WHERE resource_id = ${notebookId} AND user_id = ${sessionUserId}
    `;

    const isOwner = notebook.owner_id === sessionUserId;
    const isCollaborator = !!userRole;

    if (notebook.visibility === 'PRIVATE' && !isOwner && !isCollaborator) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden. You do not have permission to view this private notebook.',
        },
        { status: 403 }
      );
    }

    // Fetch notes inside notebook
    const notes = await sql`
      SELECT 
        n.note_id,
        n.title,
        n.visibility,
        n.display_order,
        r.created_at,
        (SELECT COUNT(*)::int FROM logical_block_slots lbs WHERE lbs.note_id = n.note_id) as blocks_count,
        (SELECT COUNT(*)::int FROM issues i WHERE i.note_id = n.note_id AND i.status IN ('OPEN', 'IN_PROGRESS')) as open_issues_count
      FROM notes n
      JOIN resources r ON r.resource_id = n.note_id
      WHERE n.notebook_id = ${notebookId} AND n.deleted_at IS NULL
      ORDER BY n.display_order ASC, r.created_at ASC
    `;

    return NextResponse.json(
      {
        success: true,
        notebook: {
          ...notebook,
          user_role: userRole?.role_type || (isOwner ? 'OWNER' : null),
          notes,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API GET /api/notebooks/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notebooks/[id]
 * Delete notebook - ONLY OWNER CAN DELETE
 * 
 * Responses:
 * - 200 OK: Notebook deleted
 * - 401 Unauthorized: Unauthenticated
 * - 403 Forbidden: User is not OWNER (Maintainers/Contributors blocked)
 * - 404 Not Found: Notebook does not exist
 */
export async function DELETE(
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

    const { id: notebookId } = await params;

    const [notebook] = await sql`
      SELECT notebook_id, owner_id, title
      FROM notebooks
      WHERE notebook_id = ${notebookId}
    `;

    if (!notebook) {
      return NextResponse.json(
        { success: false, error: 'Notebook not found.' },
        { status: 404 }
      );
    }

    // Role-Level Authorization: ONLY OWNER can delete notebook
    const [role] = await sql`
      SELECT role_type
      FROM collaborator_roles
      WHERE resource_id = ${notebookId} AND user_id = ${sessionUserId}
    `;

    const isOwner = notebook.owner_id === sessionUserId || role?.role_type === 'OWNER';

    if (!isOwner) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden. Only the OWNER of this notebook can delete it. Maintainers and Contributors cannot delete notebooks.',
          required_role: 'OWNER',
          your_role: role?.role_type || 'NONE',
        },
        { status: 403 }
      );
    }

    // Delete cascading resource
    await sql`DELETE FROM resources WHERE resource_id = ${notebookId}`;

    return NextResponse.json(
      {
        success: true,
        message: `Notebook "${notebook.title}" deleted successfully.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API DELETE /api/notebooks/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
