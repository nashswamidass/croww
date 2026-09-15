import type { IntelligenceMetric, IntelligenceSnapshot, ConfidenceLevel, SourceClass } from '../intelligence/types.ts';
import type { DimensionEvalStatus, ScoreDimensionId } from './types.ts';

export type ExtractedDimension = {
    id: ScoreDimensionId;
    status: DimensionEvalStatus;
    stale: boolean;
    numbers: number[];
    floodClass: string | null;
    metricKeys: string[];
    sourceClass: SourceClass | null;
    sourceLabel: string | null;
    confidence: ConfidenceLevel;
    sampleSize: number | null;
    fetchedAt: IntelligenceMetric['fetchedAt'];
    computedAt: IntelligenceMetric['computedAt'];
    sourceUpdatedAt: IntelligenceMetric['sourceUpdatedAt'];
};

function scorable(metric: IntelligenceMetric | undefined): boolean {
    if (!metric) return false;
    if (metric.status === 'UNAVAILABLE' || metric.status === 'INSUFFICIENT_SAMPLE') return false;
    if (metric.value == null) return false;
    return metric.status === 'AVAILABLE' || metric.status === 'PARTIAL' || metric.status === 'STALE';
}

function numericValue(metric: IntelligenceMetric | undefined): number | null {
    if (!scorable(metric)) return null;
    if (typeof metric?.value === 'number' && Number.isFinite(metric.value)) return metric.value;
    return null;
}

function pick(
    metrics: Record<string, IntelligenceMetric> | undefined,
    keys: string[]
): IntelligenceMetric[] {
    if (!metrics) return [];
    return keys.map((key) => metrics[key]).filter(Boolean);
}

function pack(
    id: ScoreDimensionId,
    metrics: IntelligenceMetric[],
    extras: { numbers?: number[]; floodClass?: string | null; status?: DimensionEvalStatus } = {}
): ExtractedDimension {
    const insufficient = metrics.some((m) => m.status === 'INSUFFICIENT_SAMPLE') && !metrics.some(scorable);
    const stale = metrics.some((m) => m.status === 'STALE');
    const usable = metrics.filter(scorable);
    let status: DimensionEvalStatus = extras.status
        || (insufficient ? 'INSUFFICIENT_SAMPLE' : usable.length ? (stale ? 'STALE' : 'AVAILABLE') : 'UNAVAILABLE');
    const primary = usable[0] || metrics[0];
    const sampleSizes = usable.map((m) => m.coverage?.sampleSize).filter((n): n is number => Number.isFinite(Number(n)));
    return {
        id,
        status,
        stale,
        numbers: extras.numbers || [],
        floodClass: extras.floodClass ?? null,
        metricKeys: usable.map((m) => m.key),
        sourceClass: primary?.sourceClass ?? null,
        sourceLabel: primary?.sourceLabel ?? null,
        confidence: primary?.confidence || 'UNKNOWN',
        sampleSize: sampleSizes.length ? Math.max(...sampleSizes) : null,
        fetchedAt: primary?.fetchedAt ?? null,
        computedAt: primary?.computedAt ?? null,
        sourceUpdatedAt: primary?.sourceUpdatedAt ?? null,
    };
}

export function extractDimension(snapshot: IntelligenceSnapshot, id: ScoreDimensionId): ExtractedDimension {
    const domains = snapshot?.domains;
    if (id === 'affordability') {
        const metrics = {
            ...domains?.market?.metrics,
            ...domains?.affordability?.metrics,
        };
        const sale = numericValue(metrics.medianSalePrice);
        const rent = numericValue(metrics.medianRent);
        const psf = numericValue(metrics.medianPricePerSqft);
        const considered = pick(metrics, ['medianSalePrice', 'medianRent', 'medianPricePerSqft']);
        const numbers = [sale, rent, psf].filter((n): n is number => n != null);
        if (!numbers.length) {
            const insufficient = considered.some((m) => m.status === 'INSUFFICIENT_SAMPLE');
            return pack('affordability', considered, {
                numbers: [],
                status: insufficient ? 'INSUFFICIENT_SAMPLE' : 'UNAVAILABLE',
            });
        }
        return pack('affordability', considered, { numbers });
    }
    if (id === 'transport') {
        const metrics = domains?.transport?.metrics;
        const distance = numericValue(metrics?.nearestMetroDistanceM);
        const count = numericValue(metrics?.metroStationsWithinRadius);
        const considered = pick(metrics, ['nearestMetroDistanceM', 'metroStationsWithinRadius']);
        const numbers = [distance, count].filter((n): n is number => n != null);
        return pack('transport', considered, { numbers });
    }
    if (id === 'schools') {
        const metrics = domains?.schools?.metrics;
        const distance = numericValue(metrics?.nearestSchoolDistanceM);
        const count = numericValue(metrics?.schoolsWithinRadius);
        const considered = pick(metrics, ['nearestSchoolDistanceM', 'schoolsWithinRadius']);
        return pack('schools', considered, {
            numbers: [distance, count].filter((n): n is number => n != null),
        });
    }
    if (id === 'healthcare') {
        const metrics = domains?.healthcare?.metrics;
        const distance = numericValue(metrics?.nearestHospitalDistanceM);
        const count = numericValue(metrics?.hospitalsWithinRadius);
        const considered = pick(metrics, ['nearestHospitalDistanceM', 'hospitalsWithinRadius']);
        return pack('healthcare', considered, {
            numbers: [distance, count].filter((n): n is number => n != null),
        });
    }
    if (id === 'airport') {
        const metrics = domains?.airport?.metrics;
        const distance = numericValue(metrics?.nearestAirportDistanceM);
        const considered = pick(metrics, ['nearestAirportDistanceM']);
        return pack('airport', considered, {
            numbers: distance != null ? [distance] : [],
        });
    }
    if (id === 'connectivity') {
        const metrics = domains?.connectivity?.metrics;
        const distance = numericValue(metrics?.nearestMajorRoadDistanceM);
        const considered = pick(metrics, ['nearestMajorRoadDistanceM', 'majorRoadsWithinRadius']);
        return pack('connectivity', considered, {
            numbers: distance != null ? [distance] : [],
        });
    }
    if (id === 'flood') {
        const flood = domains?.flood;
        const metric = flood?.metrics?.floodClassification;
        const classification = flood?.classification || (typeof metric?.value === 'string' ? metric.value : null);
        if (classification === 'UNKNOWN' || classification == null) {
            return pack('flood', metric ? [metric] : [], { floodClass: 'UNKNOWN', status: 'UNAVAILABLE' });
        }
        if (classification === 'LOW' || classification === 'MODERATE' || classification === 'HIGH') {
            const considered = metric ? [metric] : [];
            const stale = flood?.status === 'STALE' || metric?.status === 'STALE';
            return pack('flood', considered, {
                floodClass: classification,
                status: stale ? 'STALE' : 'AVAILABLE',
            });
        }
        return pack('flood', metric ? [metric] : [], { floodClass: 'UNKNOWN', status: 'UNAVAILABLE' });
    }
    const metrics = domains?.market?.metrics;
    const count = numericValue(metrics?.activeListingCount);
    const considered = pick(metrics, ['activeListingCount']);
    return pack('marketFit', considered, {
        numbers: count != null ? [count] : [],
    });
}
