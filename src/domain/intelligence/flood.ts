import { FLOOD_CLASSES, FLOOD_METHODOLOGY_VERSION, SOURCE_HIERARCHY } from './constants.ts';
import { classifySource, normalizeMetric } from './metric.ts';
import type { FloodClass, FloodDomainSection, SourceClass } from './types.ts';

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
    return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * Flood is high-sensitivity. Missing/invalid data is UNKNOWN, never LOW.
 * Elevation, water proximity, and agent copy are not inputs.
 */
export function normalizeFloodClassification(raw: unknown): FloodClass {
    if (raw == null || raw === '') return 'UNKNOWN';
    const value = String(raw).trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (value === 'MEDIUM') return 'MODERATE';
    if (includes(FLOOD_CLASSES, value)) return value;
    return 'UNKNOWN';
}

export function isFloodSourceAcceptable(sourceClass: SourceClass | null): boolean {
    if (!sourceClass) return false;
    return (SOURCE_HIERARCHY.flood as readonly string[]).includes(sourceClass);
}

export function normalizeFloodDomain(raw: Record<string, unknown> | null | undefined): FloodDomainSection {
    const sourceClass = classifySource(raw?.sourceClass || raw?.source);
    const datasetVersion = typeof raw?.datasetVersion === 'string' ? raw.datasetVersion : null;
    const sourced = isFloodSourceAcceptable(sourceClass) && !!datasetVersion;
    const classification = sourced
        ? normalizeFloodClassification(raw?.classification ?? raw?.value)
        : 'UNKNOWN';

    const status = sourced ? 'AVAILABLE' : 'UNAVAILABLE';

    const classificationMetric = normalizeMetric({
        key: 'floodClassification',
        value: classification,
        unit: 'class',
        status,
        sourceClass: sourced ? sourceClass : null,
        sourceLabel: typeof raw?.sourceLabel === 'string' ? raw.sourceLabel : null,
        sourceRef: typeof raw?.sourceRef === 'string' ? raw.sourceRef : null,
        sourceUrl: typeof raw?.sourceUrl === 'string' ? raw.sourceUrl : null,
        fetchedAt: (raw?.fetchedAt as FloodDomainSection['metrics'][string]['fetchedAt']) ?? null,
        computedAt: (raw?.computedAt as FloodDomainSection['metrics'][string]['computedAt']) ?? null,
        sourceUpdatedAt: (raw?.sourceUpdatedAt as FloodDomainSection['metrics'][string]['sourceUpdatedAt']) ?? null,
        methodology: sourced
            ? 'Passthrough of an official/open flood dataset class. No elevation or water-proximity inference.'
            : 'No acceptable flood dataset on this locality snapshot.',
        methodologyVersion: FLOOD_METHODOLOGY_VERSION,
        datasetVersion,
        confidence: sourced ? (sourceClass === 'GOVERNMENT' || sourceClass === 'OFFICIAL' ? 'HIGH' : 'MEDIUM') : 'UNKNOWN',
        coverage: {
            geographic: typeof raw?.coverageGeographic === 'string' ? raw.coverageGeographic : null,
            percent: Number.isFinite(Number(raw?.coveragePercent)) ? Number(raw?.coveragePercent) : null,
        },
    });

    return {
        status,
        confidence: classificationMetric.confidence,
        classification,
        metrics: {
            floodClassification: classificationMetric,
        },
    };
}
