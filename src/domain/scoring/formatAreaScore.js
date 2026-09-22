/**
 * Canonical display-rounding rule for Croww Area Score.
 *
 * Implements a single authoritative rounding rule across all client and admin surfaces:
 * - Stored score in Firestore / scoring engine is an unrounded floating point number (e.g. 70.8).
 * - All consumer UI surfaces:
 *     1. Polygon centroid score bubble (LocalityScoreBubble)
 *     2. Compact Area Result Card (CompactAreaResultCard)
 *     3. Locality Detail Sheet (LocalityDetailSheet)
 *     4. Map Pins / PropertyMap
 *   must use formatAreaScore(score) so that 70.8 consistently renders as 71 everywhere.
 *
 * Rule:
 * Math.round(Number(score)) for valid numbers, or null if undefined/null/NaN.
 */
export function formatAreaScore(score) {
    if (score == null) return null;
    const num = Number(score);
    if (isNaN(num)) return null;
    return Math.round(num);
}
