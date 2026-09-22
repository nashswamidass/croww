/**
 * calculateImportScores — computes the overall Area Score for each import row.
 *
 * Formula:
 *   overallScore = SUM(score_i × weight_i) / SUM(weight_i for available criteria)
 *
 * Rules:
 * - Missing criteria (null) are excluded from both numerator AND denominator.
 * - INVALID cells are treated as missing (excluded).
 * - Result is always in [0, 100] or null if no criteria are available.
 * - Equal-weight case: each weight = 1/N, simplifies to arithmetic mean.
 *
 * INVARIANT: 0 <= overallScore <= 100 (or null).
 */

/**
 * @param {import('./types.ts').ImportRow[]} rows
 * @param {import('./types.ts').ScoringCriterion[]} criteria
 * @param {Record<string, number>} [weights]  optional weight overrides; key = criterion id, value = raw weight
 * @returns {import('./types.ts').ImportRow[]}
 */
export function calculateImportScores(rows, criteria, weights = {}) {
    // Build effective weight map: use override or criterion default, fallback to equal 1
    const effectiveWeights = {};
    criteria.forEach((c) => {
        effectiveWeights[c.id] = weights[c.id] !== undefined ? weights[c.id] : (c.weight ?? 1);
    });

    return rows.map((row) => {
        let numerator = 0;
        let denomWeightSum = 0;
        const available = [];
        const missing = [];

        criteria.forEach((c) => {
            const score = row.criteriaScores[c.id];
            const w = effectiveWeights[c.id] ?? 1;

            if (score === null || score === undefined || score === 'INVALID') {
                missing.push(c.id);
                return;
            }
            if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
                missing.push(c.id);
                return;
            }

            numerator += score * w;
            denomWeightSum += w;
            available.push(c.id);
        });

        const rawScore = denomWeightSum > 0 ? numerator / denomWeightSum : null;
        // Clamp to [0,100] and round to one decimal
        const overallScore =
            rawScore != null
                ? Math.round(Math.min(100, Math.max(0, rawScore)) * 10) / 10
                : null;

        const coverage = criteria.length > 0 ? available.length / criteria.length : 0;

        return {
            ...row,
            overallScore,
            coverage,
            availableCriteria: available,
            missingCriteria: missing,
            totalCriteria: criteria.length,
        };
    });
}

/**
 * Build an equal-weight map for a list of criteria.
 * Each criterion gets weight = 100/N.
 * @param {string[]} criteriaIds
 * @returns {Record<string, number>}
 */
export function equalWeights(criteriaIds) {
    if (!criteriaIds.length) return {};
    const w = 100 / criteriaIds.length;
    return Object.fromEntries(criteriaIds.map((id) => [id, w]));
}

/**
 * Build a ScoringSystem object (for writing to Firestore).
 * @param {{ id: string; version: number; displayName: string; criteria: import('./types.ts').ScoringCriterion[]; uid: string }} params
 * @returns {import('./types.ts').ScoringSystem}
 */
export function buildScoringSystem({ id, version, displayName, criteria, uid }) {
    return {
        id,
        version,
        displayName,
        description: `${criteria.length}-criterion spreadsheet import`,
        criteria,
        status: 'DRAFT',
        createdAt: Date.now(),
        createdBy: uid || null,
    };
}
