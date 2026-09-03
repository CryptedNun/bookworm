import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * GET /api/notebooks
 * List accessible notebooks for authenticated user
 * 
 * Responses:
 * - 200 OK: Array of notebooks with role_type
 * - 401 Unauthorized: When no active session
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUserId = request.cookies.get('session_user_id')?.value;
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const notebooks = await sql`
      SELECT 
        nb.notebook_id,
        nb.title,
        nb.description,
        nb.visibility,
        r.created_at,
        cr.role_type,
        (SELECT COUNT(*)::int FROM notes n WHERE n.notebook_id = nb.notebook_id AND n.deleted_at IS NULL) as notes_count
      FROM notebooks nb
      JOIN resources r ON r.resource_id = nb.notebook_id
      JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id AND cr.user_id = ${sessionUserId}
      ORDER BY r.created_at DESC
    `;

    return NextResponse.json(
      { success: true, count: notebooks.length, notebooks },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API /api/notebooks error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notebooks
 * Create a new notebook
 * 
 * Responses:
 * - 201 Created: Notebook created with resource and owner role
 * - 400 Bad Request: Missing title
 * - 401 Unauthorized: Unauthenticated
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUserId = request.cookies.get('session_user_id')?.value;
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { title, description, visibility = 'PRIVATE' } = body;

    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
      return NextResponse.json(
        { success: false, error: 'Title is required.' },
        { status: 400 }
      );
    }

    const notebookId = randomUUID();

    // Raw SQL transaction: Resource -> Notebook -> Collaborator Role
    await sql`
      INSERT INTO resources (resource_id, resource_type)
      VALUES (${notebookId}, 'NOTEBOOK')
    `;

    await sql`
      INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility)
      VALUES (${notebookId}, ${sessionUserId}, ${cleanTitle}, ${description || null}, ${visibility})
    `;

    await sql`
      INSERT INTO collaborator_roles (user_id, resource_id, role_type, granted_by)
      VALUES (${sessionUserId}, ${notebookId}, 'OWNER', ${sessionUserId})
    `;

    return NextResponse.json(
      {
        success: true,
        notebook: {
          notebook_id: notebookId,
          title: cleanTitle,
          description: description || null,
          visibility,
          role_type: 'OWNER',
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('API POST /api/notebooks error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
