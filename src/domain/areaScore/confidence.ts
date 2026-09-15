import { CONFIDENCE_NUMERIC, SOURCE_TRUST_NUMERIC, STALE_CONFIDENCE_FACTOR } from './constants.ts';
import type { ExtractedDimension } from './extract.ts';
import type { ConfidenceLevel, SourceClass } from '../intelligence/types.ts';

export function sourceTrust(sourceClass: SourceClass | null | undefined): number {
    if (!sourceClass) return 0.4;
    return SOURCE_TRUST_NUMERIC[sourceClass] ?? 0.4;
}

/**
 * Dimension confidence in [0, 1].
 * Source quality and sample/freshness affect trust, not the normalized evidence value.
 */
export function dimensionConfidenceNumeric(extracted: ExtractedDimension): number {
    if (extracted.status === 'UNAVAILABLE' || extracted.status === 'INSUFFICIENT_SAMPLE') return 0;
    const evidence = CONFIDENCE_NUMERIC[extracted.confidence] ?? 0;
    const trust = sourceTrust(extracted.sourceClass);
    const blended = 0.65 * evidence + 0.35 * trust;
    const stale = extracted.stale || extracted.status === 'STALE' ? STALE_CONFIDENCE_FACTOR : 1;
    return Math.max(0, Math.min(1, blended * stale));
}

export function labelConfidence(value: number, coverage: number): ConfidenceLevel {
    if (!(coverage > 0) || !(value > 0)) return 'UNKNOWN';
    const adjusted = value * (0.5 + 0.5 * coverage);
    if (coverage < 0.4 && adjusted >= 0.75) return 'MEDIUM';
    if (adjusted >= 0.75) return 'HIGH';
    if (adjusted >= 0.45) return 'MEDIUM';
    return 'LOW';
}
