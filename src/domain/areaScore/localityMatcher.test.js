import test from 'node:test';
import assert from 'node:assert/strict';
import {
    estimateCommute,
    computeBudgetScore,
    computeCommuteScore,
    buildPriorityWeights,
    matchLocalities,
    POPULAR_CHENNAI_DESTINATIONS,
    formatTypicalRent,
} from './localityMatcher.js';

test('Locality Matcher Domain Engine', async (t) => {
    await t.test('1. estimates commute times and modes deterministically', () => {
        const adyarCoord = { latitude: 13.0012, longitude: 80.2565 };
        const tidelParkCoord = { latitude: 12.9890, longitude: 80.2483 };

        // Two wheeler
        const twoWheeler = estimateCommute(adyarCoord, tidelParkCoord, 'two_wheeler');
        assert.equal(twoWheeler.modeTag, 'Two wheeler');
        assert.ok(twoWheeler.travelMinutes > 5 && twoWheeler.travelMinutes < 20);

        // Walk
        const walk = estimateCommute(adyarCoord, tidelParkCoord, 'walk');
        assert.equal(walk.modeTag, 'Walk');
        assert.ok(walk.travelMinutes >= 20);

        // Transit
        const transit = estimateCommute(adyarCoord, tidelParkCoord, 'transit', {
            domains: { transport: { metrics: { nearestMetroDistanceM: { value: 1200 } } } }
        });
        assert.ok(transit.travelMinutes >= 10);
        assert.ok(['Metro', 'Metro + bus', 'Bus', 'Walk'].includes(transit.modeTag));
    });

    await t.test('2. computes budget affinity scoring', () => {
        const budget = { min: 8000, max: 12000 };

        // Exactly in budget
        const inBudget = computeBudgetScore(9500, budget);
        assert.equal(inBudget.inBudget, true);
        assert.equal(inBudget.score, 100);

        // Below budget (cheaper)
        const belowBudget = computeBudgetScore(7500, budget);
        assert.equal(belowBudget.inBudget, true);
        assert.ok(belowBudget.score >= 95);

        // Above budget (penalized)
        const aboveBudget = computeBudgetScore(16000, budget);
        assert.equal(aboveBudget.inBudget, false);
        assert.ok(aboveBudget.score < 80);
    });

    await t.test('3. boosts priority weights according to user selections', () => {
        const weights = buildPriorityWeights(['low_rent', 'safety', 'transit']);
        assert.ok(weights.affordability > 20);
        assert.ok(weights.flood > 10);
        assert.ok(weights.transport > 16);
    });

    await t.test('4. matches and ranks localities for Tidel Park destination', () => {
        const tidel = POPULAR_CHENNAI_DESTINATIONS[0]; // Tidel Park, Taramani
        const sampleLocalities = [
            {
                id: 'loc_adyar',
                name: 'Adyar',
                city: 'Chennai',
                latitude: 13.0012,
                longitude: 80.2565,
                intelligence: {
                    domains: {
                        market: { metrics: { medianRent: { value: 25000 } } },
                        transport: { metrics: { nearestMetroDistanceM: { value: 1400 } } },
                    }
                }
            },
            {
                id: 'loc_velachery',
                name: 'Velachery',
                city: 'Chennai',
                latitude: 12.9750,
                longitude: 80.2200,
                intelligence: {
                    domains: {
                        market: { metrics: { medianRent: { value: 21500 } } },
                        transport: { metrics: { nearestMetroDistanceM: { value: 1800 } } },
                    }
                }
            },
            {
                id: 'loc_omr',
                name: 'OMR',
                city: 'Chennai',
                latitude: 12.8950,
                longitude: 80.2280,
                intelligence: {
                    domains: {
                        market: { metrics: { medianRent: { value: 19500 } } },
                        transport: { metrics: { nearestMetroDistanceM: { value: 5000 } } },
                    }
                }
            }
        ];

        const results = matchLocalities({
            destination: tidel,
            budget: { min: 8000, max: 12000 },
            commuteMode: 'transit',
            priorities: ['short_commute', 'low_rent'],
            city: 'Chennai'
        }, sampleLocalities);

        assert.equal(results.length, 3);
        // All localities should have valid scores between 60 and 99
        results.forEach((r) => {
            assert.ok(r.matchScore >= 60 && r.matchScore <= 99);
            assert.ok(r.typicalRentFormatted.startsWith('₹'));
            assert.ok(r.commute.travelMinutes > 0);
        });

        // Adyar and Velachery should be near the top for Tidel Park
        const topLocality = results[0].localityName;
        assert.ok(['Adyar', 'Velachery'].includes(topLocality));
    });

    await t.test('5. formats typical rent numbers correctly', () => {
        assert.equal(formatTypicalRent(9500), '₹9.5K');
        assert.equal(formatTypicalRent(12000), '₹12K');
        assert.equal(formatTypicalRent(8200), '₹8.2K');
        assert.equal(formatTypicalRent(150000), '₹1.5L');
    });

    await t.test('6. preserves boundaries, intelligence, and staysCount on candidates', () => {
        const tidel = {
            name: 'Tidel Park',
            latitude: 12.9893,
            longitude: 80.2486
        };
        const sampleWithMetadata = [
            {
                id: 'loc_adyar',
                name: 'Adyar',
                city: 'Chennai',
                latitude: 13.0012,
                longitude: 80.2565,
                boundaries: { type: 'Polygon', coordinates: [] },
                stats: { activeListingCount: 14 },
                intelligence: {
                    domains: {
                        market: { metrics: { medianRent: { value: 14500 } } },
                        transport: { metrics: { nearestMetroDistanceM: { value: 1200 } } }
                    }
                }
            }
        ];

        const results = matchLocalities({
            destination: tidel,
            budget: { min: 8000, max: 18000 },
            commuteMode: 'bus',
            priorities: ['short_commute'],
            city: 'Chennai'
        }, sampleWithMetadata);

        assert.equal(results.length, 1);
        assert.deepEqual(results[0].boundaries, { type: 'Polygon', coordinates: [] });
        assert.equal(results[0].staysCount, 14);
        assert.ok(results[0].intelligence);
    });
});

