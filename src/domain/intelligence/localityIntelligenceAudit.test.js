import test from 'node:test';
import assert from 'node:assert/strict';
import { CHENNAI_LOCALITY_CATALOGUE, CHENNAI_LOCALITY_LIST } from './chennaiLocalityCatalogue.js';
import { VERIFIED_LOCALITY_BOUNDARIES } from './localityBoundaries.js';
import { normalizeLocalityIntelligence } from './localityIntelligenceContract.js';
import { matchLocalities } from '../scoring/matchLocalities.js';
import { parseSheet } from '../scoring/parseSheet.js';
import { calculateImportScores, equalWeights } from '../scoring/calculateImportScores.js';
import {
    formatTypicalRent,
    extractTypicalRent,
} from '../areaScore/localityMatcher.js';
import fs from 'fs';

// Load workbook if available on local machine
const WORKBOOK_PATH = '/Users/nashnewton/Downloads/Chennai_Areas_Deep_Analysis_Scores (1).xlsx';
const hasWorkbook = fs.existsSync(WORKBOOK_PATH);

let parsedWorkbook = null;
let scoredRows = [];

if (hasWorkbook) {
    try {
        const XLSX = await import('/Users/nashnewton/Documents/Croww/croww-admin/node_modules/xlsx/xlsx.mjs');
        const wb = XLSX.readFile(WORKBOOK_PATH);
        const raw = XLSX.utils.sheet_to_json(wb.Sheets['Chennai Area Scores'], { header: 1 });
        parsedWorkbook = parseSheet(raw);
        const matched = matchLocalities(parsedWorkbook.rows, CHENNAI_LOCALITY_LIST);
        const weights = equalWeights(parsedWorkbook.criteriaIds);
        const allCriteria = parsedWorkbook.criteriaIds.map((id) => ({
            id,
            name: parsedWorkbook.criteriaNames[id],
            weight: weights[id],
        }));
        scoredRows = calculateImportScores(matched, allCriteria, weights);
    } catch {
        // fallback if dynamic xlsx import fails in test runner
    }
}

test('188-Area Intelligence Data Completeness & Detail Experience Audit Matrix', async (t) => {
    // Check A: 188 canonical localities are present
    await t.test('Check A: Exactly 188 canonical localities are present in the catalogue', () => {
        assert.equal(CHENNAI_LOCALITY_LIST.length, 188);
        assert.equal(Object.keys(CHENNAI_LOCALITY_CATALOGUE).length, 188);
    });

    // Check B: 188 canonical locality IDs are unique
    await t.test('Check B: All 188 canonical locality IDs are unique and well-formed', () => {
        const ids = new Set();
        CHENNAI_LOCALITY_LIST.forEach((loc) => {
            assert.ok(loc.id, 'Locality must have an ID');
            assert.ok(loc.id.startsWith('chennai__'), `Locality ID must be prefixed with chennai__: ${loc.id}`);
            assert.equal(ids.has(loc.id), false, `Duplicate locality ID found: ${loc.id}`);
            ids.add(loc.id);
        });
        assert.equal(ids.size, 188);
    });

    // Check C: Every locality has coordinates
    await t.test('Check C: Every locality has valid finite coordinates (latitude & longitude)', () => {
        CHENNAI_LOCALITY_LIST.forEach((loc) => {
            assert.equal(typeof loc.latitude, 'number', `Missing latitude for ${loc.id}`);
            assert.equal(typeof loc.longitude, 'number', `Missing longitude for ${loc.id}`);
            assert.equal(isNaN(loc.latitude), false, `NaN latitude for ${loc.id}`);
            assert.equal(isNaN(loc.longitude), false, `NaN longitude for ${loc.id}`);
            // Bound within Chennai metropolitan geographic envelope [12.7, 13.4] N, [79.9, 80.4] E
            assert.ok(loc.latitude >= 12.7 && loc.latitude <= 13.4, `Latitude out of Chennai bounds: ${loc.latitude} for ${loc.id}`);
            assert.ok(loc.longitude >= 79.9 && loc.longitude <= 80.4, `Longitude out of Chennai bounds: ${loc.longitude} for ${loc.id}`);
        });
    });

    // Check D: Every locality has valid geographyStatus
    await t.test('Check D: Every locality has valid boundaryStatus and geometryType (7 verified, 181 point-only)', () => {
        let verifiedCount = 0;
        let pointOnlyCount = 0;

        CHENNAI_LOCALITY_LIST.forEach((loc) => {
            assert.ok(
                ['VERIFIED', 'POINT_ONLY', 'PROXY_POLYGON', 'REVIEW_REQUIRED'].includes(loc.boundaryStatus),
                `Invalid boundaryStatus ${loc.boundaryStatus} for ${loc.id}`
            );
            assert.ok(
                ['Polygon', 'MultiPolygon', 'POINT', 'Point'].includes(loc.geometryType),
                `Invalid geometryType ${loc.geometryType} for ${loc.id}`
            );

            if (loc.boundaryStatus === 'VERIFIED') {
                verifiedCount++;
                assert.ok(
                    loc.geometryType === 'Polygon' || loc.geometryType === 'MultiPolygon',
                    `Verified boundary must have Polygon or MultiPolygon geometryType: ${loc.id}`
                );
            } else if (loc.boundaryStatus === 'POINT_ONLY') {
                pointOnlyCount++;
                assert.ok(
                    loc.geometryType === 'POINT' || loc.geometryType === 'Point',
                    `POINT_ONLY must have POINT geometryType: ${loc.id}`
                );
            }
        });

        assert.equal(verifiedCount, 7, 'Expected exactly 7 verified boundaries');
        assert.equal(pointOnlyCount, 181, 'Expected exactly 181 POINT_ONLY localities');
        assert.equal(verifiedCount + pointOnlyCount, 188);
    });

    // Check E: Every published score points to an existing locality
    await t.test('Check E: Every scored row from the authoritative sheet matches an existing canonical locality', () => {
        if (!hasWorkbook || scoredRows.length === 0) return;

        assert.equal(scoredRows.length, 188);
        scoredRows.forEach((row) => {
            assert.ok(row.matchedLocalityId, `Row ${row.localityName} must have matchedLocalityId`);
            assert.ok(
                CHENNAI_LOCALITY_CATALOGUE[row.matchedLocalityId],
                `matchedLocalityId ${row.matchedLocalityId} must exist in catalogue`
            );
        });
    });

    // Check F: No score exists for a nonexistent locality
    await t.test('Check F: No score record exists without a canonical locality mapping', () => {
        if (!hasWorkbook || scoredRows.length === 0) return;

        const unlinked = scoredRows.filter((r) => !r.matchedLocalityId || !CHENNAI_LOCALITY_CATALOGUE[r.matchedLocalityId]);
        assert.equal(unlinked.length, 0);
    });

    // Check G: Area Score and Match Score remain separate
    await t.test('Check G: Area Score and Match Score remain strictly separate', () => {
        const locality = {
            id: 'chennai__adyar',
            name: 'Adyar',
            publishedScore: { overallScore: 70.8 },
        };
        const matchResult = {
            localityId: 'chennai__adyar',
            matchScore: 92, // personalized relevance
            areaScore: 70.8, // objective published score
        };

        const intel = normalizeLocalityIntelligence(locality, matchResult);
        assert.equal(intel.areaScore, 71, 'Area Score must be rounded objective score (70.8 -> 71)');
        assert.equal(intel.matchScore, 92, 'Match Score must retain 92% personal relevance');
        assert.notEqual(intel.areaScore, intel.matchScore, 'Area Score and Match Score must never conflate');

        // Test with missing area score: matchScore must NOT leak into areaScore
        const matchOnly = {
            localityId: 'chennai__adyar',
            matchScore: 85,
        };
        const intelNoAreaScore = normalizeLocalityIntelligence({ id: 'chennai__adyar', name: 'Adyar' }, matchOnly);
        assert.equal(intelNoAreaScore.areaScore, null, 'Area score must be null when unpublished');
        assert.equal(intelNoAreaScore.matchScore, 85, 'Match score remains intact');
    });

    // Check H: Missing metrics are not converted to zero
    await t.test('Check H: Missing metrics remain null or UNAVAILABLE, never converted to 0 or fake text', () => {
        const localitySparse = {
            id: 'chennai__sample',
            name: 'Sample Area',
            latitude: 13.0,
            longitude: 80.2,
        };

        const intel = normalizeLocalityIntelligence(localitySparse);
        assert.equal(intel.rental.typicalRent, null, 'Typical rent must be null when missing');
        assert.equal(intel.rental.typicalRentFormatted, null, 'Typical rent formatted must be null');
        assert.equal(intel.rental.status, 'UNAVAILABLE');
        assert.equal(intel.commute.travelMinutes, null);
        assert.equal(intel.commute.status, 'UNAVAILABLE');
        assert.equal(intel.transport.score, null);
        assert.equal(intel.transport.nearestMetroDistanceM, null);
        assert.equal(intel.dataAvailability.rental, 'UNAVAILABLE');
        assert.equal(intel.dataAvailability.commute, 'UNAVAILABLE');

        // Verify formatTypicalRent returns null on invalid/zero
        assert.equal(formatTypicalRent(0), null);
        assert.equal(formatTypicalRent(null), null);
        assert.equal(formatTypicalRent(undefined), null);
        assert.equal(formatTypicalRent(-500), null);

        // Verify extractTypicalRent returns null when no medianRent and not in baseline
        assert.equal(extractTypicalRent({ name: 'Unknown Place XYZ' }), null);
    });

    // Check I: Zero listing supply remains zero
    await t.test('Check I: Zero listing supply is explicitly ZERO, distinct from UNAVAILABLE', () => {
        // Locality with 0 listings
        const locZero = {
            id: 'chennai__adyar',
            name: 'Adyar',
            staysCount: 0,
        };
        const intelZero = normalizeLocalityIntelligence(locZero);
        assert.equal(intelZero.staysSupply.staysCount, 0);
        assert.equal(intelZero.staysSupply.status, 'ZERO');
        assert.notEqual(intelZero.staysSupply.status, 'UNAVAILABLE');

        // Locality with missing supply data
        const locMissing = {
            id: 'chennai__adyar',
            name: 'Adyar',
            staysCount: null,
        };
        const intelMissing = normalizeLocalityIntelligence(locMissing);
        assert.equal(intelMissing.staysSupply.staysCount, null);
        assert.equal(intelMissing.staysSupply.status, 'UNAVAILABLE');

        // Locality with positive supply
        const locPositive = {
            id: 'chennai__adyar',
            name: 'Adyar',
            staysCount: 15,
        };
        const intelPositive = normalizeLocalityIntelligence(locPositive);
        assert.equal(intelPositive.staysSupply.staysCount, 15);
        assert.equal(intelPositive.staysSupply.status, 'AVAILABLE');
    });

    // Check J: Generated highlights have a deterministic data source
    await t.test('Check J: Highlights require explicit domain criteria, never inferred from overall score', () => {
        // High overall score but low individual criteria: should NOT generate 'Good Connectivity' or 'Healthcare Access'
        const locHighOverall = {
            id: 'chennai__test',
            name: 'Test Area',
            publishedScore: {
                overallScore: 85,
                criteriaScores: {
                    connectivity: 50,
                    healthcare: 40,
                    safety: 60,
                    flood: 55,
                    cost_of_living: 50,
                },
            },
        };
        const intelHigh = normalizeLocalityIntelligence(locHighOverall);
        assert.equal(intelHigh.highlights.includes('Good Connectivity'), false);
        assert.equal(intelHigh.highlights.includes('Healthcare Access'), false);
        assert.equal(intelHigh.highlights.includes('High Safety'), false);

        // Locality with connectivity >= 75 and healthcare >= 75
        const locGoodDomain = {
            id: 'chennai__test2',
            name: 'Connected Area',
            publishedScore: {
                overallScore: 65,
                criteriaScores: {
                    connectivity: 88,
                    healthcare: 82,
                    safety: 60,
                },
            },
        };
        const intelGood = normalizeLocalityIntelligence(locGoodDomain);
        assert.equal(intelGood.highlights.includes('Good Connectivity'), true);
        assert.equal(intelGood.highlights.includes('Healthcare Access'), true);
        assert.equal(intelGood.highlights.includes('High Safety'), false);
    });

    // Check K: Compact card normalization does not crash when optional data is missing
    await t.test('Check K: Compact card normalization handles completely sparse or empty locality without throwing', () => {
        const bareLocality = { id: 'chennai__sparse' };
        assert.doesNotThrow(() => {
            const result = normalizeLocalityIntelligence(bareLocality);
            assert.equal(result.localityId, 'chennai__sparse');
            assert.equal(result.name, 'Area');
            assert.equal(result.areaScore, null);
            assert.equal(result.rental.typicalRent, null);
            assert.equal(result.highlights.length, 0);
        });
    });

    // Check L: Detail sheet normalization does not crash when optional data is missing
    await t.test('Check L: Detail sheet normalization handles null criteria, missing commute, and empty reasons safely', () => {
        const emptyData = {
            id: 'chennai__empty',
            name: 'Empty Locality',
            publishedScore: null,
            intelligence: null,
        };
        assert.doesNotThrow(() => {
            const intel = normalizeLocalityIntelligence(emptyData, null);
            assert.equal(intel.scoreCriteria, null);
            assert.equal(intel.commute.travelMinutes, null);
            assert.equal(intel.commute.status, 'UNAVAILABLE');
            assert.equal(intel.staysSupply.staysCount, null);
            assert.equal(intel.staysSupply.status, 'UNAVAILABLE');
        });
    });

    // Check M: Canonical localityId remains the join key across all intelligence surfaces
    await t.test('Check M: Canonical localityId is the single join key across catalogue, boundaries, and scores', () => {
        CHENNAI_LOCALITY_LIST.forEach((loc) => {
            // Join with verified boundaries
            if (loc.boundaryStatus === 'VERIFIED') {
                const boundary = VERIFIED_LOCALITY_BOUNDARIES[loc.id] || VERIFIED_LOCALITY_BOUNDARIES[loc.name];
                assert.ok(boundary, `Verified boundary missing for canonical localityId ${loc.id}`);
            }

            // Normalization maintains identical localityId
            const intel = normalizeLocalityIntelligence(loc);
            assert.equal(intel.localityId, loc.id);
        });
    });

    // Check N: No legacy locality name silently creates a second locality identity
    await t.test('Check N: Aliases and slash variants resolve strictly to canonical ID without creating duplicates', () => {
        const testAliases = [
            { input: 'T. Nagar', expectedId: 'chennai__t-nagar' },
            { input: 'Thyagaraya Nagar', expectedId: 'chennai__t-nagar' },
            { input: 'Thiruvottiyur / Tiruvottiyur', expectedId: 'chennai__thiruvottiyur' },
            { input: 'Tiruvottiyur', expectedId: 'chennai__thiruvottiyur' },
            { input: 'Kathivakkam / Kattivakkam', expectedId: 'chennai__kathivakkam' },
            { input: 'Kattivakkam', expectedId: 'chennai__kathivakkam' },
        ];

        const rows = testAliases.map((a, i) => ({
            rowIndex: i + 1,
            rawName: a.input,
            criteriaScores: {},
            validationIssues: [],
        }));

        const matched = matchLocalities(rows, CHENNAI_LOCALITY_LIST);
        matched.forEach((m, i) => {
            assert.equal(
                m.matchedLocalityId,
                testAliases[i].expectedId,
                `Alias ${testAliases[i].input} resolved to ${m.matchedLocalityId} instead of ${testAliases[i].expectedId}`
            );
            assert.ok(
                m.matchStatus === 'MATCHED' || m.matchStatus === 'ALIASED' || m.matchStatus === 'DUPLICATE',
                `Expected MATCHED, ALIASED, or DUPLICATE for ${testAliases[i].input}, got ${m.matchStatus}`
            );
        });
    });
});
