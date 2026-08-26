/**
 * Authentication Server Actions
 * 
 * Handles user sign in, sign out, and session management.
 * Uses HTTP-only cookies for secure session storage.
 */

'use server';

import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * User type returned from authentication queries
 */
export interface User {
  user_id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Extended user with stats for dashboard
 */
export interface UserWithStats extends User {
  notebooks_count: number;
  notes_count: number;
  contributed_notes_count: number;
  commits_count: number;
}

/**
 * Sign in a user with email/username and password
 * 
 * Note: For university project, we're using simplified auth.
 * In production, use bcrypt/argon2 for password hashing.
 */
export async function signIn(
  emailOrUsername: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Query: Find user by email OR username
    // This demonstrates JOIN-free query optimization
    const [user] = await sql`
      SELECT 
        user_id,
        email,
        username,
        avatar_url,
        is_active,
        created_at
      FROM users
      WHERE (email = ${emailOrUsername} OR username = ${emailOrUsername})
        AND is_active = TRUE
    `;

    if (!user) {
      return { 
        success: false, 
        error: 'Invalid credentials. User not found or inactive.' 
      };
    }

    // TODO: In production, verify password hash here
    // For now, accept any password for demo/testing
    // if (!await bcrypt.compare(password, user.password_hash)) {
    //   return { success: false, error: 'Invalid credentials' };
    // }

    // Create session: Store user_id in HTTP-only cookie
    // This prevents XSS attacks from accessing the session
    const cookieStore = await cookies();
    cookieStore.set('user_id', user.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Also store username for quick access (non-sensitive)
    cookieStore.set('username', user.username, {
      httpOnly: false, // Accessible to client for UI display
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return { success: true };
  } catch (error) {
    console.error('Sign in error:', error);
    return { 
      success: false, 
      error: 'An error occurred during sign in. Please try again.' 
    };
  }
}

/**
 * Sign out the current user
 * Clears session cookies and redirects to landing page
 */
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('user_id');
  cookieStore.delete('username');
  redirect('/');
}

/**
 * Get the currently authenticated user
 * Returns null if not authenticated
 * 
 * This is used by other Server Actions to verify authentication
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  
  if (!userId) {
    return null;
  }

  try {
    const [user] = await sql`
      SELECT 
        user_id,
        email,
        username,
        avatar_url,
        is_active,
        created_at
      FROM users
      WHERE user_id = ${userId}
        AND is_active = TRUE
    ` as User[];

    return user || null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Get current user with aggregated stats for dashboard
 * 
 * Demonstrates complex SQL query with multiple JOINs and aggregates
 */
export async function getCurrentUserWithStats(): Promise<UserWithStats | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  
  if (!userId) {
    return null;
  }

  try {
    // Complex query demonstrating:
    // - Multiple LEFT JOINs
    // - COUNT DISTINCT for aggregation
    // - GROUP BY with multiple columns
    // - Filtering (WHERE, AND)
    const [user] = await sql`
      SELECT 
        u.user_id,
        u.email,
        u.username,
        u.avatar_url,
        u.is_active,
        u.created_at,
        COUNT(DISTINCT nb.notebook_id) as notebooks_count,
        COUNT(DISTINCT CASE 
          WHEN n.notebook_id IN (
            SELECT notebook_id FROM notebooks WHERE owner_id = u.user_id
          ) THEN n.note_id 
        END) as notes_count,
        COUNT(DISTINCT CASE 
          WHEN cr.resource_id = n.note_id 
          AND cr.role_type IN ('MAINTAINER', 'CONTRIBUTOR')
          AND nb.owner_id != u.user_id
          THEN n.note_id 
        END) as contributed_notes_count,
        COUNT(DISTINCT c.commit_id) as commits_count
      FROM users u
      LEFT JOIN notebooks nb 
        ON nb.owner_id = u.user_id 
        AND nb.deleted_at IS NULL
      LEFT JOIN notes n 
        ON n.notebook_id = nb.notebook_id 
        AND n.deleted_at IS NULL
      LEFT JOIN collaborator_roles cr 
        ON cr.user_id = u.user_id
      LEFT JOIN branches b 
        ON b.note_id = n.note_id
      LEFT JOIN commits c 
        ON c.branch_id = b.branch_id 
        AND c.author_id = u.user_id
      WHERE u.user_id = ${userId}
        AND u.is_active = TRUE
      GROUP BY 
        u.user_id, 
        u.email, 
        u.username, 
        u.avatar_url, 
        u.is_active, 
        u.created_at
    ` as UserWithStats[];

    return user || null;
  } catch (error) {
    console.error('Get user with stats error:', error);
    return null;
  }
}

/**
 * Check if user is authenticated (lightweight check)
 * Use this in middleware or for simple authentication checks
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  return !!userId;
}

/**
 * Require authentication - throws error if not authenticated
 * Use this at the start of Server Actions that need auth
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}
