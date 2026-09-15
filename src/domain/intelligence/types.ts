import {
    CONFIDENCE_LEVELS,
    DOMAIN_STATUSES,
    FLOOD_CLASSES,
    INTELLIGENCE_DOMAINS,
    METRIC_STATUSES,
    SOURCE_CLASSES,
} from './constants.ts';

export type IntelligenceDomain = (typeof INTELLIGENCE_DOMAINS)[number];
export type SourceClass = (typeof SOURCE_CLASSES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];
export type MetricStatus = (typeof METRIC_STATUSES)[number];
export type FloodClass = (typeof FLOOD_CLASSES)[number];

export type TimestampLike = { toDate?: () => Date; seconds?: number } | string | Date | number | null;

export type MetricCoverage = {
    sampleSize?: number | null;
    minimumSampleThreshold?: number | null;
    geographic?: string | null;
    percent?: number | null;
    capped?: boolean;
};

export type IntelligenceMetric = {
    key: string;
    value: number | string | null;
    unit: string | null;
    status: MetricStatus;
    sourceClass: SourceClass | null;
    sourceLabel: string | null;
    sourceRef: string | null;
    sourceUrl: string | null;
    fetchedAt: TimestampLike;
    computedAt: TimestampLike;
    sourceUpdatedAt: TimestampLike;
    methodology: string | null;
    methodologyVersion: string | null;
    datasetVersion: string | null;
    confidence: ConfidenceLevel;
    coverage: MetricCoverage | null;
};

export type DomainSection = {
    status: DomainStatus;
    confidence: ConfidenceLevel;
    metrics: Record<string, IntelligenceMetric>;
};

export type FloodDomainSection = DomainSection & {
    classification: FloodClass;
};

export type IntelligenceSnapshot = {
    version: string;
    methodologyVersion: string;
    generatedAt: TimestampLike;
    sourceSummary: string | null;
    confidence: ConfidenceLevel;
    coverage: MetricCoverage | null;
    status: DomainStatus;
    domains: {
        market: DomainSection;
        transport: DomainSection;
        schools: DomainSection;
        healthcare: DomainSection;
        airport: DomainSection;
        connectivity: DomainSection;
        flood: FloodDomainSection;
        affordability: DomainSection;
    };
};

export type MarketListingInput = {
    status?: string | null;
    transactionType?: string | null;
    askingPrice?: number | null;
    rentMonthly?: number | null;
    builtUpAreaSqft?: number | null;
    plotAreaSqft?: number | null;
    carpetAreaSqft?: number | null;
};

export type GeoPointInput = {
    latitude: number;
    longitude: number;
    name?: string | null;
    id?: string | null;
};
