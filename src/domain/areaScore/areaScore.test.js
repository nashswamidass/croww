import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { emptySnapshot, normalizeSnapshot } from '../intelligence/snapshot.ts';
import { INTELLIGENCE_STALE_AFTER_MS } from '../intelligence/constants.ts';
import {
    AREA_SCORE_METHODOLOGY_VERSION,
    DEFAULT_AREA_SCORE_WEIGHTS,
    MIN_COVERAGE_TO_SHOW_SCORE,
    calculateAreaScore,
    countLinear,
    defaultWeights,
    floodClassScore,
    getAreaScoreConfig,
    invertLinear,
    normalizeWeights,
    validateWeights,
} from './index.ts';

function metric(key, value, extras = {}) {
    return {
        key,
        value,
        unit: extras.unit || null,
        status: extras.status || 'AVAILABLE',
        sourceClass: extras.sourceClass || 'DERIVED',
        sourceLabel: extras.sourceLabel || 'test',
        sourceRef: null,
        sourceUrl: null,
        fetchedAt: extras.fetchedAt ?? Date.now(),
        computedAt: extras.computedAt ?? Date.now(),
        sourceUpdatedAt: extras.sourceUpdatedAt ?? Date.now(),
        methodology: 'test',
        methodologyVersion: 'test',
        datasetVersion: extras.datasetVersion || 'v1',
        confidence: extras.confidence || 'MEDIUM',
        coverage: extras.coverage || { sampleSize: extras.sampleSize ?? 20, minimumSampleThreshold: 8 },
    };
}

function snapshotWith(domains) {
    return normalizeSnapshot({
        generatedAt: Date.now(),
        domains,
    });
}

const RICH = snapshotWith({
    market: {
        metrics: {
            activeListingCount: metric('activeListingCount', 24, { sampleSize: 24 }),
            medianSalePrice: metric('medianSalePrice', 9000000, { sampleSize: 20, unit: 'INR' }),
            medianRent: metric('medianRent', 25000, { sampleSize: 12, unit: 'INR_PER_MONTH' }),
            medianPricePerSqft: metric('medianPricePerSqft', 7000, { sampleSize: 18, unit: 'INR_PER_SQFT' }),
        },
    },
    transport: {
        metrics: {
            nearestMetroDistanceM: metric('nearestMetroDistanceM', 800, { sourceClass: 'OFFICIAL', confidence: 'HIGH' }),
            metroStationsWithinRadius: metric('metroStationsWithinRadius', 2, { sourceClass: 'OFFICIAL' }),
        },
    },
    schools: {
        metrics: {
            nearestSchoolDistanceM: metric('nearestSchoolDistanceM', 500, { sourceClass: 'OPEN_DATA' }),
            schoolsWithinRadius: metric('schoolsWithinRadius', 3, { sourceClass: 'OPEN_DATA' }),
        },
    },
    healthcare: {
        metrics: {
            nearestHospitalDistanceM: metric('nearestHospitalDistanceM', 900, { sourceClass: 'OPEN_DATA' }),
            hospitalsWithinRadius: metric('hospitalsWithinRadius', 2, { sourceClass: 'OPEN_DATA' }),
        },
    },
    airport: {
        metrics: {
            nearestAirportDistanceM: metric('nearestAirportDistanceM', 12000, { sourceClass: 'INTERNAL', confidence: 'MEDIUM' }),
        },
    },
    connectivity: {
        metrics: {
            nearestMajorRoadDistanceM: metric('nearestMajorRoadDistanceM', 400, { sourceClass: 'OPEN_DATA' }),
        },
    },
    flood: {
        classification: 'LOW',
        sourceClass: 'GOVERNMENT',
        datasetVersion: 'tn-flood-test',
        sourceLabel: 'Test flood dataset',
    },
});

describe('weight normalization and validation', () => {
    it('rejects negative, non-finite, and unknown dimensions', () => {
        assert.ok(validateWeights({ affordability: -1 }).length);
        assert.ok(validateWeights({ affordability: Infinity }).length);
        assert.ok(validateWeights({ pets: 3 }).some((i) => i.field === 'pets'));
        assert.equal(validateWeights(defaultWeights()).length, 0);
    });

    it('normalizes raw totals that are not 100', () => {
        const { weights, total } = normalizeWeights({
            affordability: 30,
            transport: 20,
            schools: 10,
            healthcare: 0,
            airport: 0,
            connectivity: 0,
            flood: 0,
            marketFit: 0,
        });
        const known = weights.affordability + weights.transport + weights.schools;
        assert.ok(Math.abs(known - 1) < 1e-9);
        assert.equal(total, 60);
        assert.ok(Math.abs(weights.affordability - 0.5) < 1e-9);
        assert.equal(weights.flood, 0);
    });

    it('uses product-heuristic defaults when input is null', () => {
        const { weights, usedDefault } = normalizeWeights(null);
        assert.equal(usedDefault, true);
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - 1) < 1e-9);
        assert.equal(DEFAULT_AREA_SCORE_WEIGHTS.affordability, 20);
    });
});

describe('evidence normalization', () => {
    it('maps lower prices and shorter distances to higher scores', () => {
        const cheap = invertLinear(6000000, { favorable: 6000000, unfavorable: 25000000 });
        const dear = invertLinear(25000000, { favorable: 6000000, unfavorable: 25000000 });
        assert.equal(cheap, 100);
        assert.equal(dear, 0);
        const near = invertLinear(400, { favorable: 400, unfavorable: 6000 });
        const far = invertLinear(6000, { favorable: 400, unfavorable: 6000 });
        assert.equal(near, 100);
        assert.equal(far, 0);
        assert.ok(invertLinear(800, { favorable: 400, unfavorable: 6000 }) > 50);
    });

    it('maps flood LOW > MODERATE > HIGH and UNKNOWN to null', () => {
        assert.equal(floodClassScore('LOW'), 100);
        assert.equal(floodClassScore('MODERATE'), 50);
        assert.equal(floodClassScore('HIGH'), 15);
        assert.equal(floodClassScore('UNKNOWN'), null);
        assert.equal(floodClassScore(null), null);
        assert.ok(countLinear(4, 4) === 100);
        assert.equal(countLinear(0, 4), 0);
    });
});

describe('missing and partial evidence', () => {
    it('returns no numeric score when all evidence is unavailable', () => {
        const result = calculateAreaScore({ snapshot: emptySnapshot(), city: 'Chennai' });
        assert.equal(result.scoreStatus, 'UNAVAILABLE');
        assert.equal(result.overallScore, null);
        assert.equal(result.coverage, 0);
        assert.notEqual(result.overallScore, 0);
        assert.notEqual(result.overallScore, 50);
        assert.ok(result.unavailableDimensions.includes('transport'));
        assert.ok(result.unavailableDimensions.includes('flood'));
        assert.equal(result.methodologyVersion, AREA_SCORE_METHODOLOGY_VERSION);
    });

    it('does not use Chennai thresholds for an unknown city', () => {
        const result = calculateAreaScore({ snapshot: RICH, city: 'Bengaluru' });
        assert.equal(result.scoreStatus, 'LIMITED_CONFIG');
        assert.equal(result.overallScore, null);
        assert.equal(getAreaScoreConfig('Bengaluru'), null);
        assert.ok(getAreaScoreConfig('Chennai'));
        assert.ok(getAreaScoreConfig('madras'));
    });

    it('treats insufficient sample as unscored affordability', () => {
        const snap = snapshotWith({
            market: {
                metrics: {
                    activeListingCount: metric('activeListingCount', 2, { sampleSize: 2 }),
                    medianSalePrice: metric('medianSalePrice', null, {
                        status: 'INSUFFICIENT_SAMPLE',
                        sampleSize: 2,
                        confidence: 'LOW',
                    }),
                },
            },
        });
        const result = calculateAreaScore({
            snapshot: snap,
            city: 'Chennai',
            weights: { affordability: 1, marketFit: 0, transport: 0, schools: 0, healthcare: 0, airport: 0, connectivity: 0, flood: 0 },
        });
        const aff = result.dimensions.find((d) => d.id === 'affordability');
        assert.equal(aff.status, 'INSUFFICIENT_SAMPLE');
        assert.equal(aff.normalizedScore, null);
        assert.equal(aff.contribution, null);
        assert.equal(result.overallScore, null);
    });

    it('does not score UNKNOWN flood as LOW or as 50', () => {
        const snap = snapshotWith({
            flood: { classification: 'UNKNOWN' },
            market: {
                metrics: {
                    medianSalePrice: metric('medianSalePrice', 8000000, { sampleSize: 20 }),
                },
            },
        });
        const result = calculateAreaScore({ snapshot: snap, city: 'Chennai' });
        const flood = result.dimensions.find((d) => d.id === 'flood');
        assert.equal(flood.status, 'UNAVAILABLE');
        assert.equal(flood.normalizedScore, null);
        assert.ok(result.unavailableDimensions.includes('flood'));
        assert.ok(result.notes.some((n) => /flood/i.test(n)));
    });

    it('does not treat a metro station count as a distance in metres', () => {
        const snap = snapshotWith({
            transport: {
                metrics: {
                    metroStationsWithinRadius: metric('metroStationsWithinRadius', 1, { sourceClass: 'OFFICIAL' }),
                },
            },
        });
        const result = calculateAreaScore({
            snapshot: snap,
            city: 'Chennai',
            weights: {
                affordability: 0,
                transport: 1,
                schools: 0,
                healthcare: 0,
                airport: 0,
                connectivity: 0,
                flood: 0,
                marketFit: 0,
            },
        });
        const metro = result.dimensions.find((d) => d.id === 'transport');
        assert.equal(metro.normalizedScore, 50);
        assert.notEqual(metro.normalizedScore, 100);
    });

    it('leaves transport unavailable without inventing metro access', () => {
        const snap = snapshotWith({
            market: {
                metrics: { medianSalePrice: metric('medianSalePrice', 8000000, { sampleSize: 20 }) },
            },
        });
        const result = calculateAreaScore({ snapshot: snap, city: 'Chennai' });
        const metro = result.dimensions.find((d) => d.id === 'transport');
        assert.equal(metro.status, 'UNAVAILABLE');
        assert.equal(metro.normalizedScore, null);
        assert.ok(result.coverage > 0);
        assert.ok(result.coverage < 1);
    });
});

describe('aggregation, coverage, and confidence', () => {
    it('computes a 0–100 score with coverage and breakdown for rich evidence', () => {
        const result = calculateAreaScore({ snapshot: RICH, city: 'Chennai' });
        assert.equal(result.scoreStatus, 'AVAILABLE');
        assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
        assert.ok(result.coverage >= MIN_COVERAGE_TO_SHOW_SCORE);
        assert.equal(result.methodologyVersion, AREA_SCORE_METHODOLOGY_VERSION);
        assert.equal(result.dimensions.length, 8);
        const contrib = result.dimensions
            .filter((d) => d.contribution != null)
            .reduce((s, d) => s + d.contribution, 0);
        assert.ok(Math.abs(contrib - result.overallScore) < 1.5);
        assert.ok(result.notes.some((n) => /personalized/i.test(n)));
        assert.doesNotMatch(JSON.stringify(result), /best area|excellent|safe neighbourhood/i);
        const aff = result.dimensions.find((d) => d.id === 'affordability');
        assert.ok(aff.evidenceSummary);
        assert.ok(aff.weightShare > 0);
        assert.ok(aff.contribution != null);
        assert.equal(typeof aff.normalizedScore, 'number');
    });

    it('suppresses the numeric score when weighted coverage is too low', () => {
        const snap = snapshotWith({
            flood: {
                classification: 'LOW',
                sourceClass: 'GOVERNMENT',
                datasetVersion: 'x',
            },
        });
        const result = calculateAreaScore({ snapshot: snap, city: 'Chennai' });
        assert.ok(result.coverage < MIN_COVERAGE_TO_SHOW_SCORE);
        assert.equal(result.scoreStatus, 'INSUFFICIENT_EVIDENCE');
        assert.equal(result.overallScore, null);
        const flood = result.dimensions.find((d) => d.id === 'flood');
        assert.equal(flood.normalizedScore, 100);
        assert.equal(flood.contribution, null);
    });

    it('reduces confidence for stale evidence without dropping the value', () => {
        const fresh = calculateAreaScore({ snapshot: RICH, city: 'Chennai' });
        const staleSnap = normalizeSnapshot({
            generatedAt: Date.now() - INTELLIGENCE_STALE_AFTER_MS - 5000,
            domains: {
                market: RICH.domains.market,
                transport: RICH.domains.transport,
                schools: RICH.domains.schools,
                healthcare: RICH.domains.healthcare,
                airport: RICH.domains.airport,
                connectivity: RICH.domains.connectivity,
                flood: {
                    classification: 'LOW',
                    sourceClass: 'GOVERNMENT',
                    datasetVersion: 'tn-flood-test',
                },
            },
        });
        const stale = calculateAreaScore({ snapshot: staleSnap, city: 'Chennai' });
        assert.ok(stale.staleDimensions.length);
        assert.ok(stale.confidenceNumeric < fresh.confidenceNumeric);
        assert.ok(stale.dimensions.some((d) => d.status === 'STALE' && d.normalizedScore != null));
    });

    it('is deterministic for the same snapshot and weights', () => {
        const a = calculateAreaScore({ snapshot: RICH, city: 'Chennai' });
        const b = calculateAreaScore({ snapshot: RICH, city: 'Chennai' });
        assert.equal(JSON.stringify(a), JSON.stringify(b));
    });

    it('zero-weight dimensions do not affect coverage or contribution', () => {
        const result = calculateAreaScore({
            snapshot: RICH,
            city: 'Chennai',
            weights: {
                affordability: 1,
                transport: 0,
                schools: 0,
                healthcare: 0,
                airport: 0,
                connectivity: 0,
                flood: 0,
                marketFit: 0,
            },
        });
        assert.equal(result.coverage, 1);
        const metro = result.dimensions.find((d) => d.id === 'transport');
        assert.equal(metro.status, 'ZERO_WEIGHT');
        assert.equal(metro.contribution, null);
        const aff = result.dimensions.find((d) => d.id === 'affordability');
        assert.equal(Math.round(aff.contribution), result.overallScore);
    });
});

describe('personalization', () => {
    it('gives different scores for affordability-heavy vs metro-heavy profiles', () => {
        const expensiveFarMetro = snapshotWith({
            market: {
                metrics: {
                    medianSalePrice: metric('medianSalePrice', 24000000, { sampleSize: 30 }),
                    activeListingCount: metric('activeListingCount', 20, { sampleSize: 20 }),
                },
            },
            transport: {
                metrics: {
                    nearestMetroDistanceM: metric('nearestMetroDistanceM', 500, { sourceClass: 'OFFICIAL', confidence: 'HIGH' }),
                },
            },
        });
        const cheap = calculateAreaScore({
            snapshot: expensiveFarMetro,
            city: 'Chennai',
            weights: { affordability: 10, transport: 1, schools: 0, healthcare: 0, airport: 0, connectivity: 0, flood: 0, marketFit: 0 },
        });
        const metro = calculateAreaScore({
            snapshot: expensiveFarMetro,
            city: 'Chennai',
            weights: { affordability: 1, transport: 10, schools: 0, healthcare: 0, airport: 0, connectivity: 0, flood: 0, marketFit: 0 },
        });
        assert.equal(cheap.scoreStatus, 'AVAILABLE');
        assert.equal(metro.scoreStatus, 'AVAILABLE');
        assert.ok(metro.overallScore > cheap.overallScore);
    });
});
