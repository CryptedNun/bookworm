import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * GET /api/auth/me
 * Returns authenticated user profile and roles
 * 
 * Responses:
 * - 200 OK: User details, system role, and collaborator roles
 * - 401 Unauthorized: When no active session cookie is present
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUserId = request.cookies.get('session_user_id')?.value;
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. No active session.' },
        { status: 401 }
      );
    }

    const [user] = await sql`
      SELECT user_id, email, username, avatar_url, system_role, created_at, is_active
      FROM users
      WHERE user_id = ${sessionUserId} AND is_active = TRUE
    `;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Session expired or user not found.' },
        { status: 401 }
      );
    }

    const roles = await sql`
      SELECT cr.resource_id, cr.role_type, r.resource_type, nb.title as notebook_title
      FROM collaborator_roles cr
      JOIN resources r ON r.resource_id = cr.resource_id
      LEFT JOIN notebooks nb ON nb.notebook_id = cr.resource_id
      WHERE cr.user_id = ${user.user_id}
      ORDER BY cr.role_type ASC
    `;

    return NextResponse.json(
      {
        success: true,
        user: {
          ...user,
          roles: roles.map(r => ({
            resource_id: r.resource_id,
            resource_type: r.resource_type,
            role_type: r.role_type,
            title: r.notebook_title || undefined,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API /api/auth/me error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
