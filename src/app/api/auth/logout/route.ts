import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Invalidates user session cookie
 * 
 * Responses:
 * - 200 OK: Session cookie invalidated
 */
export async function POST(_request: NextRequest) {
  const response = NextResponse.json(
    { success: true, message: 'Logged out successfully' },
    { status: 200 }
  );

  response.cookies.set('session_user_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
