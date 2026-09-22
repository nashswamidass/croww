/**
 * validateImport — validates criterion scores within parsed rows.
 *
 * Rules:
 * - null → MISSING (valid but excluded from scoring denominator)
 * - 'INVALID' → already flagged by parseSheet (non-numeric)
 * - number < 0 → invalid
 * - number > 100 → invalid
 * - number in [0, 100] → valid
 *
 * CRITICAL: Missing does NOT mean 0.
 */

/**
 * @param {import('./types.ts').ImportRow[]} rows
 * @param {string[]} criteriaIds  the expected criteria ids
 * @returns {{ rows: import('./types.ts').ImportRow[], totalInvalidCells: number }}
 */
export function validateImport(rows, criteriaIds) {
    let totalInvalidCells = 0;

    const validatedRows = rows.map((row) => {
        const issues = [...(row.validationIssues || [])];

        criteriaIds.forEach((id) => {
            const score = row.criteriaScores[id];
            if (score === null || score === undefined) return; // MISSING — valid
            if (score === 'INVALID') {
                totalInvalidCells++;
                return; // already has an issue from parseSheet
            }
            if (typeof score !== 'number' || !Number.isFinite(score)) {
                issues.push({ criterionId: id, value: score, message: 'Non-numeric value' });
                totalInvalidCells++;
                return;
            }
            if (score < 0) {
                issues.push({ criterionId: id, value: score, message: `Score ${score} is negative (must be 0–100)` });
                totalInvalidCells++;
            } else if (score > 100) {
                issues.push({ criterionId: id, value: score, message: `Score ${score} exceeds 100 (must be 0–100)` });
                totalInvalidCells++;
            }
        });

        // Validate sourceCompositeAverage against criteria average if present
        let calculatedComposite = null;
        const validNumericScores = criteriaIds
            .map((id) => row.criteriaScores[id])
            .filter((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100);

        if (validNumericScores.length > 0) {
            calculatedComposite = Math.round((validNumericScores.reduce((a, b) => a + b, 0) / validNumericScores.length) * 10) / 10;
        }

        let compositeMismatch = false;
        if (row.sourceCompositeAverage != null && calculatedComposite != null) {
            if (Math.abs(row.sourceCompositeAverage - calculatedComposite) > 0.15) {
                compositeMismatch = true;
                issues.push({
                    criterionId: 'composite_average',
                    value: row.sourceCompositeAverage,
                    message: `Source composite average (${row.sourceCompositeAverage}) differs from criteria average (${calculatedComposite})`,
                    isNotice: true,
                });
            }
        }

        return {
            ...row,
            calculatedComposite,
            compositeMismatch,
            validationIssues: issues,
        };
    });

    return { rows: validatedRows, totalInvalidCells };
}

/**
 * Determine which detected criteria are new (not in the active scoring system).
 * @param {string[]} detectedIds
 * @param {string[]} activeSystemCriteriaIds
 * @returns {string[]} newCriteriaIds
 */
export function detectNewCriteria(detectedIds, activeSystemCriteriaIds) {
    const existing = new Set(activeSystemCriteriaIds);
    return detectedIds.filter((id) => !existing.has(id));
}
