import { DEFAULT_AREA_SCORE_WEIGHTS, SCORE_DIMENSION_IDS } from './constants.ts';
import type { PartialScoreWeights, ScoreDimensionId, ScoreWeights } from './types.ts';

export type WeightIssue = { field: string; message: string };

export function emptyWeights(): ScoreWeights {
    return {
        affordability: 0,
        transport: 0,
        schools: 0,
        healthcare: 0,
        airport: 0,
        connectivity: 0,
        flood: 0,
        marketFit: 0,
    };
}

export function defaultWeights(): ScoreWeights {
    return { ...DEFAULT_AREA_SCORE_WEIGHTS };
}

export function validateWeights(input: unknown): WeightIssue[] {
    const issues: WeightIssue[] = [];
    if (input == null || typeof input !== 'object') {
        issues.push({ field: 'weights', message: 'Must be an object' });
        return issues;
    }
    const row = input as Record<string, unknown>;
    Object.keys(row).forEach((key) => {
        if (!(SCORE_DIMENSION_IDS as readonly string[]).includes(key)) {
            issues.push({ field: key, message: 'Unknown score dimension' });
        }
    });
    SCORE_DIMENSION_IDS.forEach((id) => {
        if (!Object.prototype.hasOwnProperty.call(row, id)) return;
        const value = row[id];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            issues.push({ field: id, message: 'Weight must be a finite number' });
            return;
        }
        if (value < 0) {
            issues.push({ field: id, message: 'Weight cannot be negative' });
        }
    });
    return issues;
}

/**
 * Merge unknown keys out. Missing ids are 0 when a patch is provided.
 * Callers that want product defaults should pass null.
 */
export function sanitizeWeights(input?: PartialScoreWeights | null): ScoreWeights {
    if (!input || typeof input !== 'object') return defaultWeights();
    const next = emptyWeights();
    SCORE_DIMENSION_IDS.forEach((id) => {
        const value = input[id];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
            next[id] = value;
        }
    });
    return next;
}

/**
 * Unit simplex. Zero-total → all zeros (caller treats as ZERO_WEIGHTS).
 */
export function normalizeWeights(input?: PartialScoreWeights | null): {
    weights: ScoreWeights;
    total: number;
    usedDefault: boolean;
} {
    const usedDefault = input == null;
    const raw = sanitizeWeights(usedDefault ? defaultWeights() : input);
    const total = SCORE_DIMENSION_IDS.reduce((sum, id) => sum + raw[id], 0);
    if (!(total > 0)) {
        return { weights: emptyWeights(), total: 0, usedDefault };
    }
    const weights = emptyWeights();
    SCORE_DIMENSION_IDS.forEach((id) => {
        weights[id] = raw[id] / total;
    });
    return { weights, total, usedDefault };
}

export function isKnownDimension(value: unknown): value is ScoreDimensionId {
    return typeof value === 'string' && (SCORE_DIMENSION_IDS as readonly string[]).includes(value);
}
