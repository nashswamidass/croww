import {
    CONFIDENCE_LEVELS,
    DOMAIN_STATUSES,
    INTELLIGENCE_DOMAINS,
    INTELLIGENCE_METHODOLOGY_VERSION,
    INTELLIGENCE_VERSION,
} from './constants.ts';
import { normalizeFloodDomain } from './flood.ts';
import { affordabilityFromMarket } from './market.ts';
import { freshnessState, isStaleTimestamp, normalizeMetric } from './metric.ts';
import type {
    ConfidenceLevel,
    DomainSection,
    DomainStatus,
    IntelligenceSnapshot,
    MetricStatus,
} from './types.ts';

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
    return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function emptyDomain(): DomainSection {
    return { status: 'UNAVAILABLE', confidence: 'UNKNOWN', metrics: {} };
}

function domainStatusFromMetrics(
    metrics: DomainSection['metrics'],
    generatedAt: IntelligenceSnapshot['generatedAt'],
    now: number
): DomainStatus {
    const values = Object.values(metrics);
    const stale = isStaleTimestamp(generatedAt, now);
    if (!values.length) return stale ? 'STALE' : 'UNAVAILABLE';
    const available = values.filter((m) => m.status === 'AVAILABLE' || m.status === 'PARTIAL').length;
    const insufficient = values.filter((m) => m.status === 'INSUFFICIENT_SAMPLE').length;
    if (!available && !insufficient) return stale ? 'STALE' : 'UNAVAILABLE';
    if (stale) return 'STALE';
    if (available > 0 && available < values.length) return 'PARTIAL';
    if (insufficient > 0 && available < values.length) return 'PARTIAL';
    return 'AVAILABLE';
}

function normalizeDomain(raw: unknown, generatedAt: IntelligenceSnapshot['generatedAt'], now: number): DomainSection {
    if (!raw || typeof raw !== 'object') {
        return emptyDomain();
    }
    const row = raw as Record<string, unknown>;
    const metricsIn = row.metrics && typeof row.metrics === 'object'
        ? row.metrics as Record<string, Record<string, unknown>>
        : {};
    const metrics: DomainSection['metrics'] = {};
    Object.entries(metricsIn).forEach(([key, metric]) => {
        metrics[key] = normalizeMetric({ ...(metric || {}), key });
    });
    const status = includes(DOMAIN_STATUSES, row.status)
        ? row.status
        : domainStatusFromMetrics(metrics, generatedAt, now);
    const confidence: ConfidenceLevel = includes(CONFIDENCE_LEVELS, row.confidence)
        ? row.confidence
        : status === 'UNAVAILABLE'
            ? 'UNKNOWN'
            : 'LOW';
    const effectiveStatus = isStaleTimestamp(generatedAt, now) && status !== 'UNAVAILABLE' ? 'STALE' : status;
    if (effectiveStatus === 'STALE') {
        Object.keys(metrics).forEach((key) => {
            if (metrics[key].status === 'AVAILABLE' || metrics[key].status === 'PARTIAL') {
                metrics[key] = { ...metrics[key], status: 'STALE' as MetricStatus };
            }
        });
    }
    return { status: effectiveStatus, confidence: effectiveStatus === 'UNAVAILABLE' ? 'UNKNOWN' : confidence, metrics };
}

export function emptySnapshot(): IntelligenceSnapshot {
    const flood = normalizeFloodDomain(null);
    return {
        version: INTELLIGENCE_VERSION,
        methodologyVersion: INTELLIGENCE_METHODOLOGY_VERSION,
        generatedAt: null,
        sourceSummary: 'No published intelligence snapshot',
        confidence: 'UNKNOWN',
        coverage: { percent: 0, geographic: null },
        status: 'UNAVAILABLE',
        domains: {
            market: emptyDomain(),
            transport: emptyDomain(),
            schools: emptyDomain(),
            healthcare: emptyDomain(),
            airport: emptyDomain(),
            connectivity: emptyDomain(),
            flood,
            affordability: emptyDomain(),
        },
    };
}

export function normalizeSnapshot(
    raw: unknown,
    options: { now?: number } = {}
): IntelligenceSnapshot {
    const now = options.now ?? Date.now();
    if (!raw || typeof raw !== 'object') {
        return emptySnapshot();
    }
    const row = raw as Record<string, unknown>;
    const generatedAt = (row.generatedAt as IntelligenceSnapshot['generatedAt']) ?? null;
    const domainsRaw = (row.domains && typeof row.domains === 'object')
        ? row.domains as Record<string, unknown>
        : {};

    const market = normalizeDomain(domainsRaw.market, generatedAt, now);
    const transport = normalizeDomain(domainsRaw.transport, generatedAt, now);
    const schools = normalizeDomain(domainsRaw.schools, generatedAt, now);
    const healthcare = normalizeDomain(domainsRaw.healthcare, generatedAt, now);
    const airport = normalizeDomain(domainsRaw.airport, generatedAt, now);
    const connectivity = normalizeDomain(domainsRaw.connectivity, generatedAt, now);
    const flood = normalizeFloodDomain(
        domainsRaw.flood && typeof domainsRaw.flood === 'object'
            ? domainsRaw.flood as Record<string, unknown>
            : null
    );
    if (isStaleTimestamp(generatedAt, now) && flood.status !== 'UNAVAILABLE') {
        flood.status = 'STALE';
        flood.confidence = flood.confidence === 'UNKNOWN' ? 'UNKNOWN' : flood.confidence;
    }

    let affordability = normalizeDomain(domainsRaw.affordability, generatedAt, now);
    if (affordability.status === 'UNAVAILABLE' && market.status !== 'UNAVAILABLE') {
        affordability = affordabilityFromMarket(market);
        if (isStaleTimestamp(generatedAt, now) && affordability.status !== 'UNAVAILABLE') {
            affordability.status = 'STALE';
        }
    }

    const domains = {
        market,
        transport,
        schools,
        healthcare,
        airport,
        connectivity,
        flood,
        affordability,
    };

    const statuses = INTELLIGENCE_DOMAINS.map((key) => domains[key].status);
    const available = statuses.filter((s) => s === 'AVAILABLE' || s === 'PARTIAL' || s === 'STALE').length;
    const freshness = freshnessState(generatedAt, now);
    let status: DomainStatus = 'UNAVAILABLE';
    if (available === 0) status = 'UNAVAILABLE';
    else if (freshness === 'stale') status = 'STALE';
    else if (available < INTELLIGENCE_DOMAINS.length) status = 'PARTIAL';
    else status = 'AVAILABLE';

    const confidences = INTELLIGENCE_DOMAINS
        .map((key) => domains[key].confidence)
        .filter((c) => c !== 'UNKNOWN');
    let confidence: ConfidenceLevel = 'UNKNOWN';
    if (status === 'UNAVAILABLE') confidence = 'UNKNOWN';
    else if (confidences.includes('LOW')) confidence = 'LOW';
    else if (confidences.includes('MEDIUM')) confidence = 'MEDIUM';
    else if (confidences.includes('HIGH')) confidence = 'HIGH';

    return {
        version: typeof row.version === 'string' ? row.version : INTELLIGENCE_VERSION,
        methodologyVersion: typeof row.methodologyVersion === 'string'
            ? row.methodologyVersion
            : INTELLIGENCE_METHODOLOGY_VERSION,
        generatedAt,
        sourceSummary: typeof row.sourceSummary === 'string'
            ? row.sourceSummary
            : available
                ? 'Published locality intelligence snapshot'
                : 'No published intelligence snapshot',
        confidence,
        coverage: row.coverage && typeof row.coverage === 'object'
            ? {
                sampleSize: Number.isFinite(Number((row.coverage as { sampleSize?: unknown }).sampleSize))
                    ? Number((row.coverage as { sampleSize?: unknown }).sampleSize)
                    : null,
                geographic: typeof (row.coverage as { geographic?: unknown }).geographic === 'string'
                    ? (row.coverage as { geographic: string }).geographic
                    : null,
                percent: Number.isFinite(Number((row.coverage as { percent?: unknown }).percent))
                    ? Number((row.coverage as { percent?: unknown }).percent)
                    : null,
                capped: (row.coverage as { capped?: unknown }).capped === true,
            }
            : { percent: available ? Math.round((available / INTELLIGENCE_DOMAINS.length) * 100) : 0 },
        status,
        domains,
    };
}

export function hasAnyAvailableEvidence(snapshot: IntelligenceSnapshot): boolean {
    return INTELLIGENCE_DOMAINS.some((key) => {
        const domain = snapshot.domains[key];
        return domain.status === 'AVAILABLE' || domain.status === 'PARTIAL' || domain.status === 'STALE';
    });
}
