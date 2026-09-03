import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth-crypto';
import { randomUUID } from 'crypto';

/**
 * POST /api/auth/register
 * Standard REST registration endpoint
 * 
 * Responses:
 * - 201 Created: User created, session cookie set
 * - 400 Bad Request: Missing or malformed fields
 * - 409 Conflict: Email or username already registered
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, email, password } = body;

    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    // Validation
    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
      return NextResponse.json(
        { success: false, error: 'Username must be between 3 and 30 characters.' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return NextResponse.json(
        { success: false, error: 'Username can only contain letters, numbers, hyphens, and underscores.' },
        { status: 400 }
      );
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // Check duplicate email
    const [existingEmail] = await sql`
      SELECT 1 FROM users WHERE LOWER(email) = ${cleanEmail} LIMIT 1
    `;
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    // Check duplicate username
    const [existingUser] = await sql`
      SELECT 1 FROM users WHERE LOWER(username) = ${cleanUsername} LIMIT 1
    `;
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    // Hash with random 16-byte salt
    const { hash, salt } = hashPassword(password);
    const userId = randomUUID();
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    const [newUser] = await sql`
      INSERT INTO users (
        user_id,
        email,
        username,
        avatar_url,
        password_hash,
        salt,
        system_role,
        is_active
      ) VALUES (
        ${userId},
        ${cleanEmail},
        ${cleanUsername},
        ${avatarUrl},
        ${hash},
        ${salt},
        'USER',
        TRUE
      )
      RETURNING user_id, email, username, avatar_url, system_role
    `;

    // Auto-create starter notebook
    try {
      const resourceId = randomUUID();
      await sql`INSERT INTO resources (resource_id, resource_type) VALUES (${resourceId}, 'NOTEBOOK')`;
      await sql`
        INSERT INTO notebooks (notebook_id, owner_id, title, description, visibility)
        VALUES (${resourceId}, ${newUser.user_id}, 'My Notes', 'Default personal workspace', 'PRIVATE')
      `;
      await sql`
        INSERT INTO collaborator_roles (user_id, resource_id, role_type)
        VALUES (${newUser.user_id}, ${resourceId}, 'OWNER')
      `;
    } catch (e) {
      console.warn('Could not auto-create starter notebook:', e);
    }

    const response = NextResponse.json(
      {
        success: true,
        user: newUser,
      },
      { status: 201 }
    );

    // Set session cookie
    response.cookies.set('session_user_id', newUser.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('API /api/auth/register error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
