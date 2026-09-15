/**
 * Keep aligned with src/domain/intelligence/market.ts (croww-median-v1).
 * Cloud Functions cannot import the Expo TypeScript domain package.
 */

const MARKET_MEDIAN_MIN_SAMPLE = 8;
const MARKET_CONFIDENCE_HIGH_SAMPLE = 40;
const MARKET_METHODOLOGY_VERSION = 'croww-median-v1';
const CROWW_MARKET_SOURCE_LABEL = 'Croww published listings';
const CROWW_MARKET_SOURCE_REF = 'croww:listings:PUBLISHED';

const METHODOLOGY = [
    'Published Croww listings only (exclude DRAFT, PAUSED, SOLD, RENTED, EXPIRED, ARCHIVED).',
    'Numeric askingPrice / rentMonthly fields only — never parse display strings.',
    'Area normalized to sqft: builtUpAreaSqft, else plotAreaSqft, else carpetAreaSqft.',
    'Buy and rent are separate. Median is the primary statistic (no mean).',
    `Medians require at least ${MARKET_MEDIAN_MIN_SAMPLE} valid samples.`,
    'Invalid (non-finite or ≤ 0) prices/areas are dropped as domain-invalid, not as statistical outliers.',
].join(' ');

function confidenceFromSample(sampleSize) {
    if (!sampleSize || sampleSize <= 0) return 'UNKNOWN';
    if (sampleSize >= MARKET_CONFIDENCE_HIGH_SAMPLE) return 'HIGH';
    if (sampleSize >= MARKET_MEDIAN_MIN_SAMPLE) return 'MEDIUM';
    return 'LOW';
}

function listingAreaSqft(listing) {
    const keys = ['builtUpAreaSqft', 'plotAreaSqft', 'carpetAreaSqft'];
    for (const key of keys) {
        const value = Number(listing[key]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
}

function numericAmount(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    return null;
}

function median(numbers) {
    const sorted = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

function countMetric(key, sampleSize, computedAt) {
    return {
        key,
        value: sampleSize,
        unit: 'count',
        status: 'AVAILABLE',
        sourceClass: 'DERIVED',
        sourceLabel: CROWW_MARKET_SOURCE_LABEL,
        sourceRef: CROWW_MARKET_SOURCE_REF,
        sourceUrl: null,
        fetchedAt: null,
        computedAt,
        sourceUpdatedAt: null,
        methodology: METHODOLOGY,
        methodologyVersion: MARKET_METHODOLOGY_VERSION,
        datasetVersion: null,
        confidence: confidenceFromSample(sampleSize),
        coverage: {
            sampleSize,
            minimumSampleThreshold: 1,
            geographic: 'Croww published listings attributed to this localityId',
        },
    };
}

function medianMetric(key, values, unit, computedAt, roundFn) {
    const sampleSize = values.length;
    const enough = sampleSize >= MARKET_MEDIAN_MIN_SAMPLE;
    return {
        key,
        value: enough ? roundFn(values) : null,
        unit,
        status: enough ? 'AVAILABLE' : sampleSize > 0 ? 'INSUFFICIENT_SAMPLE' : 'UNAVAILABLE',
        sourceClass: 'DERIVED',
        sourceLabel: CROWW_MARKET_SOURCE_LABEL,
        sourceRef: CROWW_MARKET_SOURCE_REF,
        sourceUrl: null,
        fetchedAt: null,
        computedAt,
        sourceUpdatedAt: null,
        methodology: METHODOLOGY,
        methodologyVersion: MARKET_METHODOLOGY_VERSION,
        datasetVersion: null,
        confidence: enough ? confidenceFromSample(sampleSize) : sampleSize > 0 ? 'LOW' : 'UNKNOWN',
        coverage: {
            sampleSize,
            minimumSampleThreshold: MARKET_MEDIAN_MIN_SAMPLE,
            geographic: 'Croww published listings attributed to this localityId',
        },
    };
}

function computeMarketDomain(listings, options = {}) {
    const computedAt = options.computedAt || Date.now();
    const published = (listings || []).filter((row) => row && row.status === 'PUBLISHED');
    const sale = published.filter((row) => row.transactionType === 'buy');
    const rent = published.filter((row) => row.transactionType === 'rent');
    const salePrices = sale.map((row) => numericAmount(row.askingPrice)).filter((n) => n != null);
    const rentPrices = rent.map((row) => numericAmount(row.rentMonthly)).filter((n) => n != null);
    const salePsf = sale.map((row) => {
        const price = numericAmount(row.askingPrice);
        const area = listingAreaSqft(row);
        if (price == null || area == null) return null;
        return price / area;
    }).filter((n) => n != null);

    const metrics = {
        activeListingCount: countMetric('activeListingCount', published.length, computedAt),
        activeSaleCount: countMetric('activeSaleCount', sale.length, computedAt),
        activeRentCount: countMetric('activeRentCount', rent.length, computedAt),
        medianSalePrice: medianMetric('medianSalePrice', salePrices, 'INR', computedAt, (v) => Math.round(median(v))),
        medianRent: medianMetric('medianRent', rentPrices, 'INR_PER_MONTH', computedAt, (v) => Math.round(median(v))),
        medianPricePerSqft: medianMetric('medianPricePerSqft', salePsf, 'INR_PER_SQFT', computedAt, (v) => Math.round(median(v) * 100) / 100),
    };
    if (options.capped) {
        Object.values(metrics).forEach((metric) => {
            if (metric.coverage) metric.coverage.capped = true;
        });
    }
    const available = Object.values(metrics).filter((m) => m.status === 'AVAILABLE').length;
    const insufficient = Object.values(metrics).filter((m) => m.status === 'INSUFFICIENT_SAMPLE').length;
    let status = 'UNAVAILABLE';
    if (available === Object.keys(metrics).length) status = 'AVAILABLE';
    else if (available > 0 || insufficient > 0) status = 'PARTIAL';
    return {
        status,
        confidence: confidenceFromSample(Math.max(published.length, salePrices.length, rentPrices.length)),
        metrics,
    };
}

function affordabilityFromMarket(market) {
    const keys = ['medianSalePrice', 'medianRent', 'medianPricePerSqft'];
    const metrics = {};
    keys.forEach((key) => {
        metrics[key] = market.metrics[key] || {
            key,
            value: null,
            status: 'UNAVAILABLE',
            confidence: 'UNKNOWN',
        };
    });
    const available = Object.values(metrics).filter((m) => m.status === 'AVAILABLE').length;
    const insufficient = Object.values(metrics).filter((m) => m.status === 'INSUFFICIENT_SAMPLE').length;
    return {
        status: available ? (available === keys.length ? 'AVAILABLE' : 'PARTIAL') : insufficient ? 'PARTIAL' : 'UNAVAILABLE',
        confidence: market.confidence,
        metrics,
    };
}

module.exports = {
    MARKET_MEDIAN_MIN_SAMPLE,
    computeMarketDomain,
    affordabilityFromMarket,
    median,
};
