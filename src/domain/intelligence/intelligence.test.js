import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    classifySource,
    confidenceFromSample,
    confidenceFromSource,
    freshnessState,
    normalizeMetric,
} from './metric.ts';
import { INTELLIGENCE_STALE_AFTER_MS, MARKET_MEDIAN_MIN_SAMPLE } from './constants.ts';
import {
    computeMarketDomain,
    listingAreaSqft,
    median,
    numericAmount,
} from './market.ts';
import { normalizeFloodClassification, normalizeFloodDomain } from './flood.ts';
import { emptySnapshot, normalizeSnapshot } from './snapshot.ts';
import { validateIntelligenceSnapshot } from './validate.ts';
import { viewportFromLocality } from './viewport.ts';
import { computeAirportDomain, computeTransportDomain } from './proximity.ts';
import { validateLocalityInput } from '../property/validate.ts';
import { buildLocalityViewModel } from '../../utils/localityIntelligenceView.js';

function publishedBuy(price, area) {
    return {
        status: 'PUBLISHED',
        transactionType: 'buy',
        askingPrice: price,
        builtUpAreaSqft: area,
    };
}

describe('metric normalization', () => {
    it('fills UNAVAILABLE with null value and UNKNOWN confidence', () => {
        const metric = normalizeMetric({ key: 'nearestMetroDistanceM', status: 'UNAVAILABLE', value: 1800 });
        assert.equal(metric.status, 'UNAVAILABLE');
        assert.equal(metric.value, null);
        assert.equal(metric.confidence, 'UNKNOWN');
    });

    it('does not treat a display string as a numeric market value', () => {
        assert.equal(numericAmount('₹1.35 Cr'), null);
        assert.equal(numericAmount(13500000), 13500000);
        assert.equal(numericAmount(0), null);
        assert.equal(numericAmount(-1), null);
    });
});

describe('confidence handling', () => {
    it('maps sample size to LOW / MEDIUM / HIGH / UNKNOWN', () => {
        assert.equal(confidenceFromSample(0), 'UNKNOWN');
        assert.equal(confidenceFromSample(2), 'LOW');
        assert.equal(confidenceFromSample(MARKET_MEDIAN_MIN_SAMPLE), 'MEDIUM');
        assert.equal(confidenceFromSample(40), 'HIGH');
    });

    it('does not invent HIGH when source is missing', () => {
        assert.equal(confidenceFromSource(null, { status: 'AVAILABLE', sampleSize: 100 }), 'UNKNOWN');
        assert.equal(confidenceFromSource('GOVERNMENT', { status: 'AVAILABLE' }), 'HIGH');
        assert.equal(confidenceFromSource('DERIVED', { status: 'INSUFFICIENT_SAMPLE', sampleSize: 2 }), 'LOW');
    });
});

describe('unavailable and freshness', () => {
    it('empty snapshot is UNAVAILABLE with flood UNKNOWN', () => {
        const snap = emptySnapshot();
        assert.equal(snap.status, 'UNAVAILABLE');
        assert.equal(snap.domains.flood.classification, 'UNKNOWN');
        assert.equal(snap.domains.flood.status, 'UNAVAILABLE');
        assert.equal(snap.domains.market.status, 'UNAVAILABLE');
        assert.equal(snap.generatedAt, null);
    });

    it('marks current vs stale vs unknown freshness', () => {
        assert.equal(freshnessState(null), 'unknown');
        assert.equal(freshnessState(Date.now()), 'current');
        assert.equal(freshnessState(Date.now() - INTELLIGENCE_STALE_AFTER_MS - 1000), 'stale');
    });

    it('stale generatedAt marks domain STALE without fabricating values', () => {
        const snap = normalizeSnapshot({
            generatedAt: Date.now() - INTELLIGENCE_STALE_AFTER_MS - 5000,
            domains: {
                market: {
                    status: 'AVAILABLE',
                    confidence: 'MEDIUM',
                    metrics: {
                        activeListingCount: {
                            key: 'activeListingCount',
                            value: 12,
                            status: 'AVAILABLE',
                            sourceClass: 'DERIVED',
                            confidence: 'MEDIUM',
                        },
                    },
                },
            },
        });
        assert.equal(snap.status, 'STALE');
        assert.equal(snap.domains.market.status, 'STALE');
        assert.equal(snap.domains.market.metrics.activeListingCount.value, 12);
        assert.equal(snap.domains.market.metrics.activeListingCount.status, 'STALE');
    });
});

describe('sample-size thresholds and median', () => {
    it('computes median without using the mean', () => {
        assert.equal(median([1, 2, 100]), 2);
        assert.equal(median([2, 4]), 3);
        assert.equal(median([]), null);
    });

    it('does not publish a median from two listings', () => {
        const domain = computeMarketDomain([
            publishedBuy(12000000, 1000),
            publishedBuy(14000000, 1000),
            { status: 'DRAFT', transactionType: 'buy', askingPrice: 50000000, builtUpAreaSqft: 1000 },
        ]);
        assert.equal(domain.metrics.medianSalePrice.status, 'INSUFFICIENT_SAMPLE');
        assert.equal(domain.metrics.medianSalePrice.value, null);
        assert.equal(domain.metrics.medianSalePrice.coverage.sampleSize, 2);
        assert.equal(domain.metrics.medianSalePrice.coverage.minimumSampleThreshold, MARKET_MEDIAN_MIN_SAMPLE);
        assert.equal(domain.metrics.activeListingCount.value, 2);
        assert.equal(domain.metrics.activeListingCount.status, 'AVAILABLE');
    });

    it('publishes median when sample threshold is met and excludes non-published', () => {
        const listings = Array.from({ length: 8 }, (_, i) => publishedBuy(10000000 + i * 100000, 1000));
        listings.push({ status: 'SOLD', transactionType: 'buy', askingPrice: 999999999, builtUpAreaSqft: 1000 });
        listings.push({ status: 'PAUSED', transactionType: 'buy', askingPrice: 1, builtUpAreaSqft: 1000 });
        const domain = computeMarketDomain(listings);
        assert.equal(domain.metrics.medianSalePrice.status, 'AVAILABLE');
        assert.equal(domain.metrics.medianSalePrice.coverage.sampleSize, 8);
        assert.equal(domain.metrics.activeListingCount.value, 8);
        assert.equal(domain.metrics.medianSalePrice.unit, 'INR');
        assert.equal(domain.metrics.medianPricePerSqft.unit, 'INR_PER_SQFT');
    });
});

describe('price normalization', () => {
    it('uses built-up sq ft then plot then carpet', () => {
        assert.equal(listingAreaSqft({ builtUpAreaSqft: 1100, plotAreaSqft: 2000 }), 1100);
        assert.equal(listingAreaSqft({ plotAreaSqft: 2000 }), 2000);
        assert.equal(listingAreaSqft({ carpetAreaSqft: 900 }), 900);
        assert.equal(listingAreaSqft({ builtUpAreaSqft: 0, plotAreaSqft: -1 }), null);
    });

    it('computes sale price per sq ft from numeric fields only', () => {
        const listings = Array.from({ length: 8 }, () => publishedBuy(10000000, 1000));
        const domain = computeMarketDomain(listings);
        assert.equal(domain.metrics.medianPricePerSqft.value, 10000);
    });
});

describe('source classification', () => {
    it('normalizes known classes and rejects unknown labels', () => {
        assert.equal(classifySource('government'), 'GOVERNMENT');
        assert.equal(classifySource('OPEN_DATA'), 'OPEN_DATA');
        assert.equal(classifySource('gov'), 'GOVERNMENT');
        assert.equal(classifySource('wikipedia'), null);
        assert.equal(classifySource('DERIVED'), 'DERIVED');
    });
});

describe('flood UNKNOWN behavior', () => {
    it('never defaults missing flood data to LOW', () => {
        assert.equal(normalizeFloodClassification(null), 'UNKNOWN');
        assert.equal(normalizeFloodClassification('nope'), 'UNKNOWN');
        const domain = normalizeFloodDomain(null);
        assert.equal(domain.classification, 'UNKNOWN');
        assert.equal(domain.status, 'UNAVAILABLE');
        assert.notEqual(domain.classification, 'LOW');
    });

    it('does not accept LOW without an official/open dataset version', () => {
        const guessed = normalizeFloodDomain({ classification: 'LOW', sourceClass: 'COMMUNITY' });
        assert.equal(guessed.classification, 'UNKNOWN');
        assert.equal(guessed.status, 'UNAVAILABLE');
        const sourced = normalizeFloodDomain({
            classification: 'HIGH',
            sourceClass: 'GOVERNMENT',
            datasetVersion: 'tn-flood-2024',
            sourceLabel: 'State disaster dataset',
        });
        assert.equal(sourced.classification, 'HIGH');
        assert.equal(sourced.status, 'AVAILABLE');
        assert.equal(sourced.confidence, 'HIGH');
    });
});

describe('locality model validation', () => {
    it('rejects client writes of intelligence and stats', () => {
        const issues = validateLocalityInput({
            name: 'Adyar',
            city: 'Chennai',
            state: 'TN',
            latitude: 13.0067,
            longitude: 80.257,
            intelligence: { domains: {} },
            stats: { score: 91 },
        });
        assert.ok(issues.some((i) => i.field === 'intelligence'));
        assert.ok(issues.some((i) => i.field === 'stats'));
    });

    it('rejects personalized score fields and unsourced LOW flood', () => {
        const issues = validateIntelligenceSnapshot({
            areaScore: 91,
            userWeight: { metro: 2 },
            domains: {
                flood: { classification: 'LOW' },
            },
        });
        assert.ok(issues.some((i) => i.field === 'intelligence'));
        assert.ok(issues.some((i) => i.field === 'domains.flood'));
    });

    it('rejects groundwater metrics as deferred', () => {
        const issues = validateIntelligenceSnapshot({
            domains: { groundwater: { metrics: { level: 1 } } },
        });
        assert.ok(issues.some((i) => i.field === 'domains.groundwater'));
    });
});

describe('proximity without POI data', () => {
    it('returns UNAVAILABLE rather than inventing metro or airport access', () => {
        const origin = { latitude: 13.0067, longitude: 80.257 };
        assert.equal(computeTransportDomain(origin, []).status, 'UNAVAILABLE');
        assert.equal(computeAirportDomain(origin, []).status, 'UNAVAILABLE');
        const withAirport = computeAirportDomain(origin, [
            { latitude: 12.9941, longitude: 80.1709, name: 'MAA', id: 'MAA' },
        ]);
        assert.equal(withAirport.status, 'AVAILABLE');
        assert.equal(withAirport.metrics.calculationMethod.value, 'haversine');
        assert.equal(withAirport.metrics.nearestAirportDistanceM.unit, 'm');
    });
});

describe('viewport from locality', () => {
    it('uses centroid camera approximation when bounds are missing', () => {
        const camera = viewportFromLocality({ latitude: 13.0067, longitude: 80.257 });
        assert.equal(camera.geometrySource, 'centroid-camera');
        assert.ok(camera.latitudeDelta > 0);
    });

    it('uses documented bounds when present', () => {
        const camera = viewportFromLocality({
            latitude: 13.01,
            longitude: 80.25,
            bounds: { north: 13.04, south: 12.98, east: 80.28, west: 80.22 },
        });
        assert.equal(camera.geometrySource, 'bounds');
    });
});

describe('locality view evidence language', () => {
    it('shows Data unavailable rather than optimistic copy', () => {
        const view = buildLocalityViewModel(emptySnapshot());
        assert.equal(view.market.statusLabel, 'Data unavailable');
        assert.equal(view.environment.rows[0].value, 'Data unavailable');
        assert.match(view.notes.freshnessText, /No published snapshot/);
        assert.doesNotMatch(JSON.stringify(view), /excellent|safest|Area Score/i);
    });

    it('shows insufficient data for a tiny-sample median', () => {
        const domain = computeMarketDomain([publishedBuy(12000000, 1000), publishedBuy(14000000, 1000)]);
        const snap = normalizeSnapshot({
            generatedAt: Date.now(),
            domains: { market: domain },
        });
        const view = buildLocalityViewModel(snap);
        const medianRow = view.market.rows.find((row) => row.label === 'Median asking price');
        assert.equal(medianRow.value, 'Insufficient data');
        assert.match(medianRow.meta, /need 8/);
    });
});
