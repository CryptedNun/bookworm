'use server';

import { sql } from '@/lib/db';
import { cookies } from 'next/headers';

/**
 * Server Actions for Authentication
 * 
 * Simple session-based auth using cookies
 */

export interface User {
  user_id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  created_at: Date;
  is_active: boolean;
}

export interface UserStats {
  notebooks_count: number;
  notes_count: number;
  contributed_count: number;
  issues_count: number;
  commits_count: number;
}

export interface UserWithStats extends User {
  stats: UserStats;
}

/**
 * Get the currently logged-in user from session cookie
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('session_user_id')?.value;

    if (!sessionUserId) {
      return null;
    }

    const [user] = await sql`
      SELECT 
        user_id,
        email,
        username,
        avatar_url,
        created_at,
        is_active
      FROM users
      WHERE user_id = ${sessionUserId}
        AND is_active = TRUE
    `;

    return (user as User | undefined) || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Sign in (simplified for demo - just checks email exists)
 * In production, this would verify password with bcrypt/argon2
 */
export async function signIn(emailOrUsername: string, _password?: string) {
  try {
    // Helper function with retry logic for cold starts
    const queryWithRetry = async (attempt = 1, maxAttempts = 3): Promise<any> => {
      try {
        return await sql`
          SELECT user_id, email, username
          FROM users
          WHERE (email = ${emailOrUsername} OR username = ${emailOrUsername})
            AND is_active = TRUE
          LIMIT 1
        `;
      } catch (err: any) {
        // Check if error is retryable (timeout/connection errors)
        const isTimeout = 
          err.message?.toLowerCase().includes('timeout') ||
          err.sourceError?.code === 23; // TIMEOUT_ERR code
        
        const isConnection = 
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('ETIMEDOUT') ||
          err.message?.includes('Error connecting');
        
        // Retry if connection/timeout error and haven't exceeded max attempts
        if ((isTimeout || isConnection) && attempt < maxAttempts) {
          const delay = 300 * attempt; // 300ms, 600ms, 900ms
          console.warn(`Database query attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return queryWithRetry(attempt + 1, maxAttempts);
        }
        
        // Not retryable or max attempts reached
        throw err;
      }
    };

    // Execute query with retry
    const [user] = await queryWithRetry();

    if (!user) {
      return { 
        success: false, 
        error: 'User not found. Try: alice@bookworm.dev, bob@bookworm.dev, or charlie@bookworm.dev' 
      };
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('session_user_id', user.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log('✅ User signed in successfully:', user.username);

    return { success: true, user };
  } catch (error) {
    console.error('❌ Error signing in:', error);
    
    // Better error messages
    let errorMessage = 'Database connection failed. Please try again.';
    if (error instanceof Error) {
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errorMessage = 'Database is cold-starting (first query after idle). Please try again - it should be fast now!';
      } else if (error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot connect to database. Check your DATABASE_URL in .env.local';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sign out
 */
export async function signOut() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session_user_id');
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign out',
    };
  }
}

/**
 * Get user with stats combined
 */
export async function getCurrentUserWithStats() {
  const user = await getCurrentUser();
  if (!user) return null;

  const stats = await getUserStats(user.user_id);

  return {
    ...user,
    stats,
  };
}

/**
 * Get user stats for dashboard
 */
export async function getUserStats(userId: string) {
  try {
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM notebooks nb 
         INNER JOIN collaborator_roles cr ON cr.resource_id = nb.notebook_id
         WHERE cr.user_id = ${userId} AND cr.role_type = 'OWNER') as notebooks_count,
        
        (SELECT COUNT(*) FROM notes n
         INNER JOIN collaborator_roles cr ON cr.resource_id = n.note_id
         WHERE cr.user_id = ${userId} AND cr.role_type = 'OWNER') as notes_count,
        
        (SELECT COUNT(*) FROM notes n
         INNER JOIN collaborator_roles cr ON cr.resource_id = n.note_id
         WHERE cr.user_id = ${userId} AND cr.role_type IN ('MAINTAINER', 'CONTRIBUTOR')) as contributed_count,
        
        (SELECT COUNT(*) FROM issues i
         WHERE i.creator_id = ${userId} OR EXISTS (
           SELECT 1 FROM issue_contributors ic 
           WHERE ic.issue_id = i.issue_id AND ic.contributor_id = ${userId}
         )) as issues_count,
        
        (SELECT COUNT(*) FROM commits c
         WHERE c.author_id = ${userId}) as commits_count
    `;

    return stats || {
      notebooks_count: 0,
      notes_count: 0,
      contributed_count: 0,
      issues_count: 0,
      commits_count: 0,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      notebooks_count: 0,
      notes_count: 0,
      contributed_count: 0,
      issues_count: 0,
      commits_count: 0,
    };
  }
}
