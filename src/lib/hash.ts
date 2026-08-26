/**
 * Content Hashing Utilities
 * 
 * SHA-256 hashing for content-addressed storage and deduplication
 */

import { createHash } from 'crypto';

/**
 * Calculate SHA-256 hash of text content
 * 
 * @param content - Text to hash
 * @returns Hexadecimal SHA-256 hash (64 characters)
 */
export function hashContent(content: string): string {
  return createHash('sha256')
    .update(content, 'utf8')
    .digest('hex');
}

/**
 * Calculate byte size of UTF-8 string
 * 
 * @param content - Text to measure
 * @returns Byte size
 */
export function getByteSize(content: string): number {
  return Buffer.byteLength(content, 'utf8');
}
