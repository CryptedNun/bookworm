'use server';

import { sql } from '@/lib/db';
import { cookies } from 'next/headers';
import { hashPassword, verifyPassword } from '@/lib/auth-crypto';
import { randomUUID } from 'crypto';

/**
 * Server Actions for Authentication
 * 
 * Professional session-based auth with salted PBKDF2 SHA-512 password verification
 */

export interface User {
  user_id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  system_role: 'ADMIN' | 'USER';
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
        system_role,
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
 * Professional Sign In with Salted PBKDF2 Password Verification
 */
export async function signIn(emailOrUsername: string, password?: string) {
  try {
    const identifier = (emailOrUsername || '').trim();
    if (!identifier) {
      return { success: false, error: 'Username or email is required.' };
    }

    if (!password) {
      return { success: false, error: 'Password is required.' };
    }

    // Helper function with retry logic for Neon cold starts
    const queryWithRetry = async (attempt = 1, maxAttempts = 3): Promise<any> => {
      try {
        return await sql`
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
          WHERE (LOWER(email) = LOWER(${identifier}) OR LOWER(username) = LOWER(${identifier}))
          LIMIT 1
        `;
      } catch (err: any) {
        const isTimeout = 
          err.message?.toLowerCase().includes('timeout') ||
          err.sourceError?.code === 23;
        
        const isConnection = 
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('ETIMEDOUT') ||
          err.message?.includes('Error connecting');
        
        if ((isTimeout || isConnection) && attempt < maxAttempts) {
          const delay = 300 * attempt;
          console.warn(`Database query attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return queryWithRetry(attempt + 1, maxAttempts);
        }
        throw err;
      }
    };

    const [user] = await queryWithRetry();

    if (!user) {
      return { 
        success: false, 
        error: 'Invalid credentials. Please check your username/email and password.' 
      };
    }

    if (!user.is_active) {
      return {
        success: false,
        error: 'Your account has been deactivated. Please contact support.'
      };
    }

    // Salted Password Verification
    if (user.password_hash && user.salt) {
      const isValid = verifyPassword(password, user.password_hash, user.salt);
      if (!isValid) {
        return { 
          success: false, 
          error: 'Invalid credentials. Please check your username/email and password.' 
        };
      }
    } else {
      // If user has no password set yet, verify against default 'password' and update hash
      if (password !== 'password') {
        return { success: false, error: 'Invalid credentials.' };
      }
      const { hash, salt } = hashPassword('password');
      await sql`
        UPDATE users 
        SET password_hash = ${hash}, salt = ${salt} 
        WHERE user_id = ${user.user_id}
      `;
    }

    // Set secure HTTP-only session cookie
    const cookieStore = await cookies();
    cookieStore.set('session_user_id', user.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log('✅ User authenticated successfully with salted hash:', user.username);

    return { 
      success: true, 
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        system_role: (user.system_role || 'USER') as 'ADMIN' | 'USER',
      } 
    };
  } catch (error) {
    console.error('❌ Error signing in:', error);
    
    let errorMessage = 'Authentication failed. Please try again.';
    if (error instanceof Error) {
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errorMessage = 'Database is starting up. Please try again in a few seconds.';
      } else if (error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Database connection error. Check your network connection.';
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
 * Professional User Registration with Salted PBKDF2 Password
 */
export async function signUp({
  username,
  email,
  password,
  avatarUrl,
}: {
  username: string;
  email: string;
  password: string;
  avatarUrl?: string;
}) {
  try {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Validation
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' };
    }
    if (cleanUsername.length > 30) {
      return { success: false, error: 'Username must be at most 30 characters long.' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return { success: false, error: 'Username can only contain letters, numbers, hyphens, and underscores.' };
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    // 2. Uniqueness checks
    const [existingEmail] = await sql`
      SELECT 1 FROM users WHERE LOWER(email) = ${cleanEmail} LIMIT 1
    `;
    if (existingEmail) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const [existingUsername] = await sql`
      SELECT 1 FROM users WHERE LOWER(username) = ${cleanUsername} LIMIT 1
    `;
    if (existingUsername) {
      return { success: false, error: 'Username is already taken. Please choose another.' };
    }

    // 3. Generate salt & hash password with PBKDF2 SHA-512
    const { hash, salt } = hashPassword(password);
    const userId = randomUUID();
    const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    // 4. Insert user
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
        ${finalAvatar},
        ${hash},
        ${salt},
        'USER',
        TRUE
      )
      RETURNING user_id, email, username, avatar_url, system_role
    `;

    // 5. Initialize a default notebook workspace for the new user
    try {
      const { createNotebook } = await import('@/actions/notebooks');
      await createNotebook({
        title: 'My Notes',
        description: 'Personal notebook workspace for modular notes & research',
        visibility: 'PRIVATE',
        userId: newUser.user_id,
      });
    } catch (nbErr) {
      console.warn('Could not auto-create starter notebook:', nbErr);
    }

    // 6. Establish authenticated session
    const cookieStore = await cookies();
    cookieStore.set('session_user_id', newUser.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log('✅ New user registered with salted hash:', newUser.username);

    return {
      success: true,
      user: newUser,
    };
  } catch (error) {
    console.error('❌ Error in signUp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed. Please try again.',
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
export async function getCurrentUserWithStats(): Promise<UserWithStats | null> {
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
export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM notebooks nb 
         WHERE nb.deleted_at IS NULL AND (
           nb.owner_id = ${userId}
           OR EXISTS (
             SELECT 1 FROM collaborator_roles cr 
             WHERE cr.resource_id = nb.notebook_id AND cr.user_id = ${userId} AND cr.role_type = 'OWNER'
           )
         )) as notebooks_count,
        
        (SELECT COUNT(*) FROM notes n
         JOIN notebooks nb ON nb.notebook_id = n.notebook_id
         WHERE n.deleted_at IS NULL AND (
           nb.owner_id = ${userId}
           OR EXISTS (
             SELECT 1 FROM collaborator_roles cr 
             WHERE cr.resource_id = n.note_id AND cr.user_id = ${userId} AND cr.role_type = 'OWNER'
           )
         )) as notes_count,
        
        (SELECT COUNT(*) FROM notes n
         JOIN notebooks nb ON nb.notebook_id = n.notebook_id
         WHERE n.deleted_at IS NULL AND EXISTS (
           SELECT 1 FROM collaborator_roles cr 
           WHERE (cr.resource_id = n.note_id OR cr.resource_id = nb.notebook_id)
             AND cr.user_id = ${userId} AND cr.role_type IN ('MAINTAINER', 'CONTRIBUTOR')
         )) as contributed_count,
        
        (SELECT COUNT(*) FROM issues i
         WHERE i.creator_id = ${userId} OR EXISTS (
           SELECT 1 FROM issue_contributors ic 
           WHERE ic.issue_id = i.issue_id AND ic.contributor_id = ${userId}
         )) as issues_count,
        
        (SELECT COUNT(*) FROM commits c
         WHERE c.author_id = ${userId}) as commits_count
    `;

    if (stats) {
      return {
        notebooks_count: Number(stats.notebooks_count || 0),
        notes_count: Number(stats.notes_count || 0),
        contributed_count: Number(stats.contributed_count || 0),
        issues_count: Number(stats.issues_count || 0),
        commits_count: Number(stats.commits_count || 0),
      };
    }

    return {
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
