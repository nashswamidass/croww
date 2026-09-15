import { INTELLIGENCE_DOMAINS, MARKET_MEDIAN_MIN_SAMPLE, SOURCE_CLASSES } from './constants.ts';
import { classifySource } from './metric.ts';
import { normalizeFloodClassification } from './flood.ts';

export type ValidationIssue = { field: string; message: string };

/**
 * Validates a public intelligence snapshot. Does not fetch source datasets.
 */
export function validateIntelligenceSnapshot(input: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (input == null) return issues;
    if (typeof input !== 'object') {
        issues.push({ field: 'intelligence', message: 'Must be an object or null' });
        return issues;
    }
    const row = input as Record<string, unknown>;
    if (row.userWeight != null || row.personalScore != null || row.areaScore != null) {
        issues.push({ field: 'intelligence', message: 'Personalized score fields are not allowed on locality intelligence' });
    }
    const domains = row.domains;
    if (domains != null && typeof domains !== 'object') {
        issues.push({ field: 'domains', message: 'Must be an object' });
        return issues;
    }
    if (domains && typeof domains === 'object') {
        Object.keys(domains as object).forEach((key) => {
            if (!(INTELLIGENCE_DOMAINS as readonly string[]).includes(key)
                && key !== 'groundwater'
            ) {
                /* extra future domains are allowed as unused maps; groundwater must stay empty in v1 */
            }
            if (key === 'groundwater') {
                issues.push({ field: 'domains.groundwater', message: 'GROUNDWATER is deferred; do not store groundwater metrics yet' });
            }
        });
        const flood = (domains as Record<string, unknown>).flood as Record<string, unknown> | undefined;
        if (flood && normalizeFloodClassification(flood.classification) === 'LOW' && !classifySource(flood.sourceClass)) {
            issues.push({ field: 'domains.flood', message: 'LOW flood class requires an acceptable sourced dataset' });
        }
        const market = (domains as Record<string, unknown>).market as { metrics?: Record<string, { status?: string; value?: unknown; coverage?: { sampleSize?: number } }> } | undefined;
        const median = market?.metrics?.medianSalePrice;
        if (median && median.status === 'AVAILABLE' && median.value != null) {
            const n = median.coverage?.sampleSize;
            if (typeof n === 'number' && n > 0 && n < MARKET_MEDIAN_MIN_SAMPLE) {
                issues.push({ field: 'domains.market.metrics.medianSalePrice', message: 'AVAILABLE median requires minimum sample threshold' });
            }
        }
    }
    if (row.sourceClass != null && !classifySource(row.sourceClass) && !(SOURCE_CLASSES as readonly string[]).includes(String(row.sourceClass))) {
        issues.push({ field: 'sourceClass', message: 'Unknown source class' });
    }
    return issues;
}

export function assertNoIntelligenceIssues(issues: ValidationIssue[]): void {
    if (issues.length) {
        const error = new Error(issues.map((i) => `${i.field}: ${i.message}`).join('; '));
        error.name = 'IntelligenceValidationError';
        throw error;
    }
}
