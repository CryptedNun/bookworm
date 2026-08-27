/**
 * Database Connection Layer
 * 
 * Uses Neon serverless driver for PostgreSQL connections.
 * No ORM - all queries are raw SQL to demonstrate database knowledge.
 * 
 * Optimized for serverless with connection pooling and retries.
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Validate environment variable exists
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required. ' +
    'Please check your .env.local file.'
  );
}

// Initialize Neon SQL client with optimizations
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

/**
 * Retry helper for transient database errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 100
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on user errors (constraint violations, etc.)
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as any).code;
        if (code && code.startsWith('23')) {
          // Constraint violation - don't retry
          throw error;
        }
      }
      
      // If not the last attempt, wait and retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}
