import {
    CONFIDENCE_LEVELS,
    INTELLIGENCE_STALE_AFTER_MS,
    MARKET_CONFIDENCE_HIGH_SAMPLE,
    MARKET_MEDIAN_MIN_SAMPLE,
    METRIC_STATUSES,
    SOURCE_CLASSES,
} from './constants.ts';
import type {
    ConfidenceLevel,
    IntelligenceMetric,
    MetricCoverage,
    MetricStatus,
    SourceClass,
    TimestampLike,
} from './types.ts';

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
    return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export function toMillis(value: TimestampLike | undefined): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value < 1e12 ? value * 1000 : value;
    }
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === 'object') {
        if (typeof value.toDate === 'function') {
            const date = value.toDate();
            const ms = date instanceof Date ? date.getTime() : NaN;
            return Number.isFinite(ms) ? ms : null;
        }
        if (typeof value.seconds === 'number' && Number.isFinite(value.seconds)) {
            return value.seconds * 1000;
        }
    }
    return null;
}

export function isStaleTimestamp(value: TimestampLike | undefined, now = Date.now()): boolean {
    const ms = toMillis(value);
    if (ms == null) return false;
    return now - ms > INTELLIGENCE_STALE_AFTER_MS;
}

export function freshnessState(
    value: TimestampLike | undefined,
    now = Date.now()
): 'current' | 'stale' | 'unknown' {
    const ms = toMillis(value);
    if (ms == null) return 'unknown';
    if (now - ms > INTELLIGENCE_STALE_AFTER_MS) return 'stale';
    return 'current';
}

export function confidenceFromSample(
    sampleSize: number | null | undefined,
    minimumSampleThreshold = MARKET_MEDIAN_MIN_SAMPLE,
    highThreshold = MARKET_CONFIDENCE_HIGH_SAMPLE
): ConfidenceLevel {
    if (sampleSize == null || !Number.isFinite(sampleSize) || sampleSize <= 0) return 'UNKNOWN';
    if (sampleSize >= highThreshold) return 'HIGH';
    if (sampleSize >= minimumSampleThreshold) return 'MEDIUM';
    return 'LOW';
}

/**
 * Confidence is derived from source class + sample/status. Missing source → UNKNOWN.
 * Do not invent HIGH for empty metrics.
 */
export function confidenceFromSource(
    sourceClass: SourceClass | null | undefined,
    options: { sampleSize?: number | null; status?: MetricStatus | null } = {}
): ConfidenceLevel {
    if (options.status === 'UNAVAILABLE') return 'UNKNOWN';
    if (options.status === 'INSUFFICIENT_SAMPLE') return 'LOW';
    if (!sourceClass) return 'UNKNOWN';
    if (sourceClass === 'GOVERNMENT' || sourceClass === 'OFFICIAL') return 'HIGH';
    if (sourceClass === 'OPEN_DATA' || sourceClass === 'VERIFIED_PROVIDER') return 'MEDIUM';
    if (sourceClass === 'DERIVED') return confidenceFromSample(options.sampleSize);
    if (sourceClass === 'INTERNAL') return 'MEDIUM';
    if (sourceClass === 'COMMUNITY') return 'LOW';
    return 'UNKNOWN';
}

export function unavailableMetric(key: string, extras: Partial<IntelligenceMetric> = {}): IntelligenceMetric {
    return normalizeMetric({
        key,
        value: null,
        unit: extras.unit ?? null,
        status: 'UNAVAILABLE',
        sourceClass: extras.sourceClass ?? null,
        sourceLabel: extras.sourceLabel ?? null,
        sourceRef: extras.sourceRef ?? null,
        sourceUrl: extras.sourceUrl ?? null,
        fetchedAt: extras.fetchedAt ?? null,
        computedAt: extras.computedAt ?? null,
        sourceUpdatedAt: extras.sourceUpdatedAt ?? null,
        methodology: extras.methodology ?? null,
        methodologyVersion: extras.methodologyVersion ?? null,
        datasetVersion: extras.datasetVersion ?? null,
        confidence: 'UNKNOWN',
        coverage: extras.coverage ?? null,
    });
}

export function normalizeMetric(input: Partial<IntelligenceMetric> & { key: string }): IntelligenceMetric {
    const key = String(input.key || '').trim() || 'unknown';
    const status: MetricStatus = includes(METRIC_STATUSES, input.status) ? input.status : 'UNAVAILABLE';
    const sourceClass: SourceClass | null = includes(SOURCE_CLASSES, input.sourceClass)
        ? input.sourceClass
        : null;
    const confidence: ConfidenceLevel = includes(CONFIDENCE_LEVELS, input.confidence)
        ? input.confidence
        : confidenceFromSource(sourceClass, {
            sampleSize: input.coverage?.sampleSize,
            status,
        });

    let value: number | string | null = null;
    if (typeof input.value === 'number' && Number.isFinite(input.value)) {
        value = input.value;
    } else if (typeof input.value === 'string' && input.value.trim()) {
        value = input.value.trim();
    }

    if (status === 'UNAVAILABLE' || status === 'INSUFFICIENT_SAMPLE') {
        if (status === 'INSUFFICIENT_SAMPLE') {
            /* keep coverage; value must not look like a published median */
            if (key.toLowerCase().includes('median')) value = null;
        } else {
            value = null;
        }
    }

    const coverage: MetricCoverage | null = input.coverage && typeof input.coverage === 'object'
        ? {
            sampleSize: Number.isFinite(Number(input.coverage.sampleSize))
                ? Number(input.coverage.sampleSize)
                : null,
            minimumSampleThreshold: Number.isFinite(Number(input.coverage.minimumSampleThreshold))
                ? Number(input.coverage.minimumSampleThreshold)
                : null,
            geographic: typeof input.coverage.geographic === 'string' ? input.coverage.geographic : null,
            percent: Number.isFinite(Number(input.coverage.percent)) ? Number(input.coverage.percent) : null,
            capped: input.coverage.capped === true,
        }
        : null;

    return {
        key,
        value,
        unit: typeof input.unit === 'string' ? input.unit : null,
        status,
        sourceClass,
        sourceLabel: typeof input.sourceLabel === 'string' ? input.sourceLabel : null,
        sourceRef: typeof input.sourceRef === 'string' ? input.sourceRef : null,
        sourceUrl: typeof input.sourceUrl === 'string' ? input.sourceUrl : null,
        fetchedAt: input.fetchedAt ?? null,
        computedAt: input.computedAt ?? null,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
        methodology: typeof input.methodology === 'string' ? input.methodology : null,
        methodologyVersion: typeof input.methodologyVersion === 'string' ? input.methodologyVersion : null,
        datasetVersion: typeof input.datasetVersion === 'string' ? input.datasetVersion : null,
        confidence: status === 'UNAVAILABLE' ? 'UNKNOWN' : confidence,
        coverage,
    };
}

export function classifySource(value: unknown): SourceClass | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (normalized === 'GOV' || normalized === 'GOVT') return 'GOVERNMENT';
    return includes(SOURCE_CLASSES, normalized) ? normalized : null;
}
