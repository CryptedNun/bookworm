import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword } from '@/lib/auth-crypto';

/**
 * POST /api/auth/login
 * Standard REST authentication endpoint
 * 
 * Responses:
 * - 200 OK: Credentials valid, session cookie set
 * - 400 Bad Request: Missing identifier or password
 * - 401 Unauthorized: Invalid username/email or password
 * - 403 Forbidden: Account deactivated
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawIdentifier = body.identifier || body.email || body.username || '';
    const password = body.password || '';

    const cleanIdentifier = String(rawIdentifier).trim();
    if (!cleanIdentifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Both username/email and password are required.' },
        { status: 400 }
      );
    }

    const [user] = await sql`
      SELECT 
        user_id, 
        email, 
        username, 
        avatar_url, 
        system_role, 
        password_hash, 
        salt, 
        is_active
      FROM users
      WHERE (LOWER(email) = LOWER(${cleanIdentifier}) OR LOWER(username) = LOWER(${cleanIdentifier}))
      LIMIT 1
    `;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username/email or password.' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Contact administrator.' },
        { status: 403 }
      );
    }

    // Verify salted password with PBKDF2 SHA-512
    const isValid = user.password_hash && user.salt
      ? verifyPassword(password, user.password_hash, user.salt)
      : false;

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username/email or password.' },
        { status: 401 }
      );
    }

    // Fetch user's collaborator roles across notebooks to return resolved permissions
    const roles = await sql`
      SELECT cr.resource_id, cr.role_type, r.resource_type
      FROM collaborator_roles cr
      JOIN resources r ON r.resource_id = cr.resource_id
      WHERE cr.user_id = ${user.user_id}
    `;

    const response = NextResponse.json(
      {
        success: true,
        user: {
          user_id: user.user_id,
          email: user.email,
          username: user.username,
          avatar_url: user.avatar_url,
          system_role: user.system_role,
          roles: roles.map(r => ({
            resource_id: r.resource_id,
            resource_type: r.resource_type,
            role: r.role_type,
          })),
        },
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie
    response.cookies.set('session_user_id', user.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('API /api/auth/login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
