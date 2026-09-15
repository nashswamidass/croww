import {
    CROWW_MARKET_SOURCE_LABEL,
    CROWW_MARKET_SOURCE_REF,
    MARKET_AREA_UNIT,
    MARKET_CONFIDENCE_HIGH_SAMPLE,
    MARKET_MEDIAN_MIN_SAMPLE,
    MARKET_METHODOLOGY_VERSION,
    MARKET_PRICE_UNIT,
    MARKET_RENT_PSF_UNIT,
    MARKET_RENT_UNIT,
    MARKET_SALE_PSF_UNIT,
} from './constants.ts';
import { confidenceFromSample, normalizeMetric } from './metric.ts';
import type { DomainSection, IntelligenceMetric, MarketListingInput } from './types.ts';

export const MARKET_LISTING_STATUSES = ['PUBLISHED'] as const;

const METHODOLOGY = [
    'Published Croww listings only (exclude DRAFT, PAUSED, SOLD, RENTED, EXPIRED, ARCHIVED).',
    'Numeric askingPrice / rentMonthly fields only — never parse display strings.',
    `Area normalized to ${MARKET_AREA_UNIT}: builtUpAreaSqft, else plotAreaSqft, else carpetAreaSqft.`,
    'Buy and rent are separate. Median is the primary statistic (no mean).',
    `Medians require at least ${MARKET_MEDIAN_MIN_SAMPLE} valid samples.`,
    'Invalid (non-finite or ≤ 0) prices/areas are dropped as domain-invalid, not as statistical outliers.',
    'Expensive or cheap valid listings are kept. Croww-derived, not external market truth.',
].join(' ');

export function isPublishedMarketListing(listing: MarketListingInput | null | undefined): boolean {
    return listing?.status === 'PUBLISHED';
}

export function listingAreaSqft(listing: MarketListingInput | null | undefined): number | null {
    if (!listing) return null;
    const keys = ['builtUpAreaSqft', 'plotAreaSqft', 'carpetAreaSqft'] as const;
    for (const key of keys) {
        const value = Number(listing[key]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
}

export function numericAmount(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    return null;
}

export function median(numbers: number[]): number | null {
    const sorted = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

function moneyMedian(values: number[]): number | null {
    const value = median(values);
    return value == null ? null : Math.round(value);
}

function psfMedian(values: number[]): number | null {
    const value = median(values);
    return value == null ? null : Math.round(value * 100) / 100;
}

function countMetric(key: string, sampleSize: number, computedAt: number): IntelligenceMetric {
    return normalizeMetric({
        key,
        value: sampleSize,
        unit: 'count',
        status: 'AVAILABLE',
        sourceClass: 'DERIVED',
        sourceLabel: CROWW_MARKET_SOURCE_LABEL,
        sourceRef: CROWW_MARKET_SOURCE_REF,
        computedAt,
        methodology: METHODOLOGY,
        methodologyVersion: MARKET_METHODOLOGY_VERSION,
        confidence: confidenceFromSample(sampleSize),
        coverage: {
            sampleSize,
            minimumSampleThreshold: 1,
            geographic: 'Croww published listings attributed to this localityId',
        },
    });
}

function medianMetric(
    key: string,
    values: number[],
    unit: string,
    computedAt: number,
    round: (values: number[]) => number | null
): IntelligenceMetric {
    const sampleSize = values.length;
    const enough = sampleSize >= MARKET_MEDIAN_MIN_SAMPLE;
    return normalizeMetric({
        key,
        value: enough ? round(values) : null,
        unit,
        status: enough ? 'AVAILABLE' : sampleSize > 0 ? 'INSUFFICIENT_SAMPLE' : 'UNAVAILABLE',
        sourceClass: 'DERIVED',
        sourceLabel: CROWW_MARKET_SOURCE_LABEL,
        sourceRef: CROWW_MARKET_SOURCE_REF,
        computedAt,
        methodology: METHODOLOGY,
        methodologyVersion: MARKET_METHODOLOGY_VERSION,
        confidence: enough
            ? confidenceFromSample(sampleSize)
            : sampleSize > 0
                ? 'LOW'
                : 'UNKNOWN',
        coverage: {
            sampleSize,
            minimumSampleThreshold: MARKET_MEDIAN_MIN_SAMPLE,
            geographic: 'Croww published listings attributed to this localityId',
        },
    });
}

/**
 * Pure market aggregation. Call from admin/server jobs, never from LocalityScreen
 * against live inventory.
 */
export function computeMarketDomain(
    listings: MarketListingInput[] | null | undefined,
    options: { computedAt?: number; capped?: boolean } = {}
): DomainSection {
    const computedAt = options.computedAt ?? Date.now();
    const published = (listings || []).filter(isPublishedMarketListing);
    const sale = published.filter((row) => row.transactionType === 'buy');
    const rent = published.filter((row) => row.transactionType === 'rent');

    const salePrices = sale.map((row) => numericAmount(row.askingPrice)).filter((n): n is number => n != null);
    const rentPrices = rent.map((row) => numericAmount(row.rentMonthly)).filter((n): n is number => n != null);

    const salePsf = sale.map((row) => {
        const price = numericAmount(row.askingPrice);
        const area = listingAreaSqft(row);
        if (price == null || area == null) return null;
        return price / area;
    }).filter((n): n is number => n != null);

    const rentPsf = rent.map((row) => {
        const price = numericAmount(row.rentMonthly);
        const area = listingAreaSqft(row);
        if (price == null || area == null) return null;
        return price / area;
    }).filter((n): n is number => n != null);

    const metrics: Record<string, IntelligenceMetric> = {
        activeListingCount: countMetric('activeListingCount', published.length, computedAt),
        activeSaleCount: countMetric('activeSaleCount', sale.length, computedAt),
        activeRentCount: countMetric('activeRentCount', rent.length, computedAt),
        medianSalePrice: medianMetric('medianSalePrice', salePrices, MARKET_PRICE_UNIT, computedAt, moneyMedian),
        medianRent: medianMetric('medianRent', rentPrices, MARKET_RENT_UNIT, computedAt, moneyMedian),
        medianPricePerSqft: medianMetric(
            'medianPricePerSqft',
            salePsf,
            MARKET_SALE_PSF_UNIT,
            computedAt,
            psfMedian
        ),
        medianRentPerSqft: medianMetric(
            'medianRentPerSqft',
            rentPsf,
            MARKET_RENT_PSF_UNIT,
            computedAt,
            psfMedian
        ),
    };

    if (options.capped) {
        Object.values(metrics).forEach((metric) => {
            if (metric.coverage) metric.coverage.capped = true;
        });
    }

    const available = Object.values(metrics).filter((m) => m.status === 'AVAILABLE').length;
    const insufficient = Object.values(metrics).filter((m) => m.status === 'INSUFFICIENT_SAMPLE').length;
    let status: DomainSection['status'] = 'UNAVAILABLE';
    if (available === Object.keys(metrics).length) status = 'AVAILABLE';
    else if (available > 0 || insufficient > 0) status = 'PARTIAL';

    const sampleForConfidence = Math.max(published.length, salePrices.length, rentPrices.length);
    return {
        status,
        confidence: confidenceFromSample(
            sampleForConfidence,
            MARKET_MEDIAN_MIN_SAMPLE,
            MARKET_CONFIDENCE_HIGH_SAMPLE
        ),
        metrics,
    };
}

export function affordabilityFromMarket(market: DomainSection): DomainSection {
    const keys = ['medianSalePrice', 'medianRent', 'medianPricePerSqft'] as const;
    const metrics: Record<string, IntelligenceMetric> = {};
    keys.forEach((key) => {
        const source = market.metrics[key];
        metrics[key] = source
            ? { ...source, key }
            : normalizeMetric({ key, status: 'UNAVAILABLE', value: null, confidence: 'UNKNOWN' });
    });
    const available = Object.values(metrics).filter((m) => m.status === 'AVAILABLE').length;
    const insufficient = Object.values(metrics).filter((m) => m.status === 'INSUFFICIENT_SAMPLE').length;
    return {
        status: available ? (available === keys.length ? 'AVAILABLE' : 'PARTIAL')
            : insufficient ? 'PARTIAL' : 'UNAVAILABLE',
        confidence: market.confidence,
        metrics,
    };
}
