import { SCORE_DIMENSION_IDS } from './constants.ts';
import { validateWeights } from './weights.ts';
import type { AreaScoreResult } from './types.ts';

export type ValidationIssue = { field: string; message: string };

export function validateAreaScoreResult(result: AreaScoreResult): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if ('personalScore' in result || 'areaScore' in result) {
        issues.push({ field: 'result', message: 'Personalized scores must not use locality-document field names' });
    }
    if (result.overallScore != null && (result.overallScore < 0 || result.overallScore > 100)) {
        issues.push({ field: 'overallScore', message: 'Must be 0–100 or null' });
    }
    if (result.scoreStatus !== 'AVAILABLE' && result.overallScore != null) {
        issues.push({ field: 'overallScore', message: 'Numeric score must be null unless status is AVAILABLE' });
    }
    if (result.scoreStatus === 'UNAVAILABLE' && result.overallScore != null) {
        issues.push({ field: 'overallScore', message: 'Unavailable evidence must not produce 0 or 50' });
    }
    result.dimensions.forEach((dim) => {
        if (!(SCORE_DIMENSION_IDS as readonly string[]).includes(dim.id)) {
            issues.push({ field: dim.id, message: 'Unknown dimension' });
        }
        if (dim.status === 'UNAVAILABLE' && dim.contribution != null) {
            issues.push({ field: `${dim.id}.contribution`, message: 'Unavailable dimensions must not contribute' });
        }
    });
    return issues;
}

export function validatePreferencePatch(input: unknown): ValidationIssue[] {
    return validateWeights(input);
}
