/**
 * LexoRank Utilities
 * 
 * Implements fractional indexing for O(1) block insertion between any two blocks
 * Format: "generation|value" e.g. "1|150000"
 */

/**
 * Calculate midpoint between two lexorank keys
 * 
 * @param prev - Previous lexorank key (or null if inserting at start)
 * @param next - Next lexorank key (or null if inserting at end)
 * @returns New lexorank key that sorts between prev and next
 */
export function calculateLexoRankMidpoint(
  prev: string | null,
  next: string | null
): string {
  const GENERATION = '1';
  const MIN_VALUE = 0;
  const MAX_VALUE = 999999;
  const PAD_LENGTH = 6;

  // If no previous, insert before next
  if (!prev && next) {
    const nextValue = parseInt(next.split('|')[1]);
    const newValue = Math.floor(nextValue / 2);
    return `${GENERATION}|${newValue.toString().padStart(PAD_LENGTH, '0')}`;
  }

  // If no next, insert after previous
  if (prev && !next) {
    const prevValue = parseInt(prev.split('|')[1]);
    const newValue = Math.min(prevValue + 100000, MAX_VALUE);
    return `${GENERATION}|${newValue.toString().padStart(PAD_LENGTH, '0')}`;
  }

  // If neither, insert in middle
  if (!prev && !next) {
    return `${GENERATION}|${500000}`;
  }

  // Both exist, calculate midpoint
  const prevValue = parseInt(prev!.split('|')[1]);
  const nextValue = parseInt(next!.split('|')[1]);
  
  const newValue = Math.floor((prevValue + nextValue) / 2);

  // Check for collision (can't fit between)
  if (newValue === prevValue || newValue === nextValue) {
    // Rebalancing needed - for now, just increment generation
    // In production, you'd rebalance all keys in this range
    console.warn('LexoRank collision detected, incrementing generation');
    return `${parseInt(GENERATION) + 1}|${newValue.toString().padStart(PAD_LENGTH, '0')}`;
  }

  return `${GENERATION}|${newValue.toString().padStart(PAD_LENGTH, '0')}`;
}

/**
 * Get the initial lexorank for the first block
 */
export function getInitialLexoRank(): string {
  return '1|100000';
}

/**
 * Validate a lexorank string
 */
export function isValidLexoRank(lexorank: string): boolean {
  const pattern = /^\d+\|\d{6}$/;
  return pattern.test(lexorank);
}
