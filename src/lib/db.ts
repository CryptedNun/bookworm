/**
 * Database Connection Layer
 * 
 * Uses Neon serverless driver for PostgreSQL connections.
 * No ORM - all queries are raw SQL to demonstrate database knowledge.
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Validate environment variable exists
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required. ' +
    'Please check your .env.local file.'
  );
}

// Initialize Neon SQL client
// Uses HTTP-based protocol optimized for serverless environments
export const sql: NeonQueryFunction<false, false> = neon(process.env.DATABASE_URL);

/**
 * Database error codes reference
 * Useful for handling specific constraint violations
 */
export const DB_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
} as const;

/**
 * Helper to check if error is a specific DB constraint violation
 */
export function isDatabaseError(error: any, code: string): boolean {
  return error?.code === code;
}
