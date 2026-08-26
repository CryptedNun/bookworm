/**
 * Next.js Middleware for Route Protection
 * 
 * Runs before every request to check authentication status
 * and protect routes that require login.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/notes',
  '/notebooks',
];

/**
 * Routes that should redirect to dashboard if already authenticated
 */
const AUTH_ROUTES = [
  '/',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = request.cookies.get('user_id')?.value;
  const isAuthenticated = !!userId;

  // Check if route requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  );

  // Check if route is auth page (landing)
  const isAuthRoute = AUTH_ROUTES.some(route => 
    pathname === route
  );

  // Redirect to landing if trying to access protected route without auth
  if (isProtectedRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('redirect', pathname); // Save intended destination
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if already authenticated and trying to access auth pages
  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Allow request to proceed
  return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
