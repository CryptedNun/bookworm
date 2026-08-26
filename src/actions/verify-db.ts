/**
 * Database Verification Action
 * 
 * Helper to verify database connection and seed data
 */

'use server';

import { sql } from '@/lib/db';

interface DbUser {
  user_id: string;
  email: string;
  username: string;
  is_active: boolean;
}

interface CountResult {
  count: string;
}

export async function verifyDatabase() {
  try {
    // Check if users table exists and has data
    const users = await sql`
      SELECT 
        user_id,
        email,
        username,
        is_active
      FROM users
      ORDER BY created_at
    ` as DbUser[];

    // Check notebooks count
    const [notebooksCount] = await sql`
      SELECT COUNT(*) as count FROM notebooks WHERE deleted_at IS NULL
    ` as CountResult[];

    // Check notes count
    const [notesCount] = await sql`
      SELECT COUNT(*) as count FROM notes WHERE deleted_at IS NULL
    ` as CountResult[];

    return {
      success: true,
      users: users.map((u) => ({
        email: u.email,
        username: u.username,
        is_active: u.is_active,
      })),
      notebooks_count: parseInt(notebooksCount.count),
      notes_count: parseInt(notesCount.count),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
