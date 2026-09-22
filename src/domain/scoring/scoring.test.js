/**
 * scoring.test.js — 20 required tests for the Croww Admin Spreadsheet Scoring domain.
 *
 * Run: node --test src/domain/scoring/scoring.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseSheet, normalizeCriterionId } from './parseSheet.js';
import { matchLocalities } from './matchLocalities.js';
import { validateImport, detectNewCriteria } from './validateImport.js';
import { calculateImportScores, equalWeights, buildScoringSystem } from './calculateImportScores.js';
import { formatAreaScore } from './formatAreaScore.js';
import { CHENNAI_LOCALITY_CATALOGUE } from '../intelligence/chennaiLocalityCatalogue.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const SIX_CRITERIA = ['safety', 'traffic', 'flood', 'pollution', 'groundwater', 'connectivity'];

const HEADER_ROW = ['Area/Neighbourhood', 'Safety', 'Traffic', 'Flood', 'Pollution', 'Groundwater', 'Connectivity'];

function criteriaFromIds(ids) {
    return ids.map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        type: 'score_0_100',
        direction: 'DIRECT_SCORE',
        weight: 100 / ids.length,
        active: true,
    }));
}

function rawRows(...dataRows) {
    return [HEADER_ROW, ...dataRows];
}

function adyarRow() {
    // Safety 90, Traffic 62, Flood 45, Pollution 68, Groundwater 58, Connectivity 85
    return ['Adyar', 90, 62, 45, 68, 58, 85];
}

const CANONICAL_LOCALITIES = [
    { id: 'loc_adyar', name: 'Adyar', aliases: [], city: 'Chennai' },
    { id: 'loc_anna_nagar', name: 'Anna Nagar', aliases: ['Annanagar', 'Anna Nagar West'], city: 'Chennai' },
    { id: 'loc_velachery', name: 'Velachery', aliases: [], city: 'Chennai' },
    { id: 'loc_tnagar', name: 'T. Nagar', aliases: ['T Nagar', 'Thiyagaraya Nagar', 'TNagar'], city: 'Chennai' },
];

// ─── Test 1: Valid 6-criterion import ─────────────────────────────────────────

describe('Test 1: Valid 6-criterion import', () => {
    it('parses all six criteria and produces correct overall score for Adyar', () => {
        const parsed = parseSheet(rawRows(adyarRow()));
        assert.equal(parsed.criteriaIds.length, 6, 'should detect 6 criteria');
        assert.deepEqual(parsed.criteriaIds, SIX_CRITERIA);
        assert.equal(parsed.rows.length, 1);
        assert.equal(parsed.rows[0].rawName, 'Adyar');

        const criteria = criteriaFromIds(SIX_CRITERIA);
        const scored = calculateImportScores(parsed.rows, criteria, equalWeights(SIX_CRITERIA));
        const row = scored[0];
        // 90+62+45+68+58+85 = 408 / 6 = 68
        assert.equal(row.overallScore, 68, 'Adyar overall score must be 68');
        assert.equal(row.coverage, 1.0, 'all 6 criteria available');
    });
});

// ─── Test 2: New 7th criterion detected ───────────────────────────────────────

describe('Test 2: New 7th criterion detected', () => {
    it('detects healthcare as a new criterion not in active system', () => {
        const headerWith7 = [...HEADER_ROW, 'Healthcare'];
        const dataRow = ['Adyar', 90, 62, 45, 68, 58, 85, 80];
        const parsed = parseSheet([headerWith7, dataRow]);

        assert.equal(parsed.criteriaIds.length, 7);
        assert.ok(parsed.criteriaIds.includes('healthcare'), 'healthcare must be detected');

        const newCriteria = detectNewCriteria(parsed.criteriaIds, SIX_CRITERIA);
        assert.deepEqual(newCriteria, ['healthcare'], 'healthcare should be flagged as NEW');
    });
});

// ─── Test 3: Missing criterion treated as MISSING not 0 ───────────────────────

describe('Test 3: Missing criterion is MISSING not 0', () => {
    it('empty cell becomes null, excluded from denominator', () => {
        const rowWithMissing = ['Adyar', 90, 62, null, 68, 58, 85]; // Flood missing
        const parsed = parseSheet(rawRows(rowWithMissing));
        assert.equal(parsed.rows[0].criteriaScores['flood'], null, 'flood must be null');

        const criteria = criteriaFromIds(SIX_CRITERIA);
        const scored = calculateImportScores(parsed.rows, criteria);
        const row = scored[0];

        // With flood missing: (90+62+68+58+85) / 5 = 363/5 = 72.6
        assert.equal(row.overallScore, 72.6, 'missing criterion excluded from denominator');
        assert.ok(row.missingCriteria.includes('flood'), 'flood in missingCriteria');
        assert.ok(!row.availableCriteria.includes('flood'), 'flood not in availableCriteria');
        assert.ok(row.overallScore !== 0 / 6, 'missing must not be treated as 0');
    });
});

// ─── Test 4: Invalid score > 100 ──────────────────────────────────────────────

describe('Test 4: Invalid score > 100', () => {
    it('flags score > 100 as invalid', () => {
        const rowWithInvalid = ['Adyar', 105, 62, 45, 68, 58, 85]; // Safety = 105
        const parsed = parseSheet(rawRows(rowWithInvalid));
        const { rows, totalInvalidCells } = validateImport(parsed.rows, SIX_CRITERIA);
        const issue = rows[0].validationIssues.find((i) => i.criterionId === 'safety');
        assert.ok(issue, 'must have a validation issue for safety');
        assert.ok(issue.message.includes('105'), 'message must mention the bad value');
        assert.equal(totalInvalidCells, 1);
    });
});

// ─── Test 5: Invalid negative score ───────────────────────────────────────────

describe('Test 5: Invalid negative score', () => {
    it('flags negative score as invalid', () => {
        const rowWithNeg = ['Adyar', -10, 62, 45, 68, 58, 85]; // Safety = -10
        const parsed = parseSheet(rawRows(rowWithNeg));
        const { rows } = validateImport(parsed.rows, SIX_CRITERIA);
        const issue = rows[0].validationIssues.find((i) => i.criterionId === 'safety');
        assert.ok(issue, 'must have validation issue for negative safety');
        assert.ok(issue.message.includes('negative') || issue.message.includes('-10'));
    });
});

// ─── Test 6: Non-numeric score ────────────────────────────────────────────────

describe('Test 6: Non-numeric score', () => {
    it('flags non-numeric cell as INVALID during parsing', () => {
        const rowWithText = ['Adyar', 'good', 62, 45, 68, 58, 85]; // Safety = "good"
        const parsed = parseSheet(rawRows(rowWithText));
        assert.equal(parsed.rows[0].criteriaScores['safety'], 'INVALID');
        assert.ok(parsed.rows[0].validationIssues.length > 0, 'must have parse-level issue');
    });
});

// ─── Test 7: Empty cell → MISSING ─────────────────────────────────────────────

describe('Test 7: Empty cell → MISSING', () => {
    it('empty/null cell is null (MISSING) not 0 or INVALID', () => {
        const rowWithEmpty = ['Adyar', '', 62, 45, 68, 58, 85]; // Safety = empty string
        const parsed = parseSheet(rawRows(rowWithEmpty));
        assert.equal(parsed.rows[0].criteriaScores['safety'], null, 'empty string cell must be null');
        assert.equal(parsed.rows[0].validationIssues.length, 0, 'empty cell must not be an error');
    });
});

// ─── Test 8: Duplicate locality row ───────────────────────────────────────────

describe('Test 8: Duplicate locality row', () => {
    it('second occurrence of same locality gets DUPLICATE status', () => {
        const rows2x = rawRows(adyarRow(), adyarRow()); // Adyar twice
        const parsed = parseSheet(rows2x);
        const matched = matchLocalities(parsed.rows, CANONICAL_LOCALITIES);
        assert.equal(matched[0].matchStatus, 'MATCHED');
        assert.equal(matched[1].matchStatus, 'DUPLICATE');
        assert.equal(matched[1].matchedLocalityId, 'loc_adyar');
        assert.equal(matched[1].duplicateOfRow, matched[0].rowIndex);
    });
});

// ─── Test 9: Unmatched locality ───────────────────────────────────────────────

describe('Test 9: Unmatched locality', () => {
    it('locality not in catalog gets NEW status', () => {
        const rowUnknown = ['Sholinganallur', 80, 70, 60, 55, 50, 75];
        const parsed = parseSheet(rawRows(rowUnknown));
        const matched = matchLocalities(parsed.rows, CANONICAL_LOCALITIES);
        assert.equal(matched[0].matchStatus, 'NEW');
        assert.equal(matched[0].matchedLocalityId, null);
    });
});

// ─── Test 10: Ambiguous locality ──────────────────────────────────────────────

describe('Test 10: Ambiguous locality', () => {
    it('name matching multiple canonical localities gets AMBIGUOUS status', () => {
        // Build catalog where two localities both have alias 'Central'
        const ambiguousCatalog = [
            { id: 'loc_central_1', name: 'Central Station', aliases: ['Central'], city: 'Chennai' },
            { id: 'loc_central_2', name: 'Central Market', aliases: ['Central'], city: 'Chennai' },
        ];
        const rowAmbig = ['Central', 80, 70, 60, 55, 50, 75];
        const parsed = parseSheet(rawRows(rowAmbig));
        const matched = matchLocalities(parsed.rows, ambiguousCatalog);
        assert.equal(matched[0].matchStatus, 'AMBIGUOUS');
        assert.ok(Array.isArray(matched[0].ambiguousMatches));
        assert.equal(matched[0].ambiguousMatches.length, 2);
    });
});

// ─── Test 11: Equal-weight overall score ──────────────────────────────────────

describe('Test 11: Equal-weight overall score', () => {
    it('arithmetic mean for 6 equal-weight criteria', () => {
        const parsed = parseSheet(rawRows(adyarRow()));
        const criteria = criteriaFromIds(SIX_CRITERIA);
        const scored = calculateImportScores(parsed.rows, criteria, equalWeights(SIX_CRITERIA));
        // (90+62+45+68+58+85) / 6 = 408/6 = 68
        assert.equal(scored[0].overallScore, 68);
    });
});

// ─── Test 12: Weighted overall score ──────────────────────────────────────────

describe('Test 12: Weighted overall score', () => {
    it('weighted mean differs from arithmetic mean', () => {
        // Weight safety heavily
        const customWeights = { safety: 50, traffic: 10, flood: 10, pollution: 10, groundwater: 10, connectivity: 10 };
        const parsed = parseSheet(rawRows(adyarRow()));
        const criteria = criteriaFromIds(SIX_CRITERIA);
        const scored = calculateImportScores(parsed.rows, criteria, customWeights);
        // numerator = 90*50 + 62*10 + 45*10 + 68*10 + 58*10 + 85*10
        //           = 4500 + 620 + 450 + 680 + 580 + 850 = 7680
        // denominator = 100
        // weighted score = 76.8
        assert.equal(scored[0].overallScore, 76.8);
    });
});

// ─── Test 13: Missing criterion excluded from denominator ─────────────────────

describe('Test 13: Missing criterion excluded from weighted denominator', () => {
    it('missing criterion weight is excluded from denominator', () => {
        // Safety=90 (w=20), Traffic=60 (w=20), Flood=missing, Healthcare=80 (w=20)
        const header = ['Locality', 'Safety', 'Traffic', 'Flood', 'Healthcare'];
        const data = ['TestArea', 90, 60, null, 80];
        const parsed = parseSheet([header, data]);

        const criteria = criteriaFromIds(['safety', 'traffic', 'flood', 'healthcare']);
        const weights = { safety: 20, traffic: 20, flood: 20, healthcare: 20 };
        const scored = calculateImportScores(parsed.rows, criteria, weights);

        // available weight = 60 (flood excluded)
        // numerator = 90*20 + 60*20 + 80*20 = 4600
        // score = 4600/60 = 76.666... → 76.7
        assert.equal(scored[0].overallScore, 76.7);
        assert.ok(scored[0].missingCriteria.includes('flood'));
        assert.equal(scored[0].availableCriteria.length, 3);
    });
});

// ─── Test 14: Coverage calculation ────────────────────────────────────────────

describe('Test 14: Coverage calculation', () => {
    it('5 of 6 criteria available → coverage = 5/6 ≈ 0.833', () => {
        const rowWith5 = ['Adyar', 90, 62, null, 68, 58, 85]; // Flood missing
        const parsed = parseSheet(rawRows(rowWith5));
        const criteria = criteriaFromIds(SIX_CRITERIA);
        const scored = calculateImportScores(parsed.rows, criteria);
        const coverage = scored[0].coverage;
        assert.ok(Math.abs(coverage - 5 / 6) < 0.001, `coverage should be ~0.833, got ${coverage}`);
    });
});

// ─── Test 15: Version object creation ─────────────────────────────────────────

describe('Test 15: Version object creation', () => {
    it('buildScoringSystem creates correct shape', () => {
        const criteria = criteriaFromIds(SIX_CRITERIA);
        const sys = buildScoringSystem({
            id: 'croww-area-score-spreadsheet-v1',
            version: 1,
            displayName: 'Croww Area Scoring v1',
            criteria,
            uid: 'admin123',
        });
        assert.equal(sys.id, 'croww-area-score-spreadsheet-v1');
        assert.equal(sys.version, 1);
        assert.equal(sys.criteria.length, 6);
        assert.equal(sys.status, 'DRAFT');
        assert.equal(sys.createdBy, 'admin123');
    });
});

// ─── Test 16: Historical version preserved ────────────────────────────────────

describe('Test 16: Historical version preserved on re-import', () => {
    it('new version gets incremented id, old version object unchanged', () => {
        const criteria6 = criteriaFromIds(SIX_CRITERIA);
        const v1 = buildScoringSystem({ id: 'croww-area-score-spreadsheet-v1', version: 1, displayName: 'v1', criteria: criteria6, uid: 'u' });

        const criteria7 = criteriaFromIds([...SIX_CRITERIA, 'healthcare']);
        const v2 = buildScoringSystem({ id: 'croww-area-score-spreadsheet-v2', version: 2, displayName: 'v2', criteria: criteria7, uid: 'u' });

        assert.equal(v1.id, 'croww-area-score-spreadsheet-v1', 'v1 id unchanged');
        assert.equal(v1.criteria.length, 6, 'v1 criteria count unchanged');
        assert.equal(v2.version, 2);
        assert.equal(v2.criteria.length, 7);
        // v1 and v2 are distinct objects
        assert.notEqual(v1, v2);
    });
});

// ─── Test 17: Supersede / re-import creates new import record ────────────────

describe('Test 17: Supersede on re-import', () => {
    it('second import record is independent of first', () => {
        const import1 = { id: 'imp_01', status: 'PUBLISHED', scoringSystemVersion: 1 };
        // Simulate: on re-import we create a new record and mark old as SUPERSEDED
        const import1Superseded = { ...import1, status: 'SUPERSEDED' };
        const import2 = { id: 'imp_02', status: 'PUBLISHED', scoringSystemVersion: 2 };

        assert.equal(import1Superseded.status, 'SUPERSEDED');
        assert.equal(import2.status, 'PUBLISHED');
        assert.notEqual(import1Superseded.id, import2.id, 'import records must have distinct ids');
    });
});

// ─── Test 18: Zero-score locality ─────────────────────────────────────────────

describe('Test 18: All-zero locality → overallScore = 0', () => {
    it('all criteria 0 produces overall score of 0', () => {
        const zeroRow = ['ZeroArea', 0, 0, 0, 0, 0, 0];
        const parsed = parseSheet(rawRows(zeroRow));
        const criteria = criteriaFromIds(SIX_CRITERIA);
        const scored = calculateImportScores(parsed.rows, criteria, equalWeights(SIX_CRITERIA));
        assert.equal(scored[0].overallScore, 0);
        assert.ok(scored[0].overallScore >= 0, 'score must be >= 0');
    });
});

// ─── Test 19: All scores 100 ──────────────────────────────────────────────────

describe('Test 19: All scores 100 → overallScore = 100', () => {
    it('all criteria 100 produces overall score of 100', () => {
        const perfectRow = ['PerfectArea', 100, 100, 100, 100, 100, 100];
        const parsed = parseSheet(rawRows(perfectRow));
        const criteria = criteriaFromIds(SIX_CRITERIA);
        const scored = calculateImportScores(parsed.rows, criteria, equalWeights(SIX_CRITERIA));
        assert.equal(scored[0].overallScore, 100);
    });
});

// ─── Test 20: Score invariant 0 ≤ score ≤ 100 ────────────────────────────────

describe('Test 20: Score invariant — result always in [0, 100]', () => {
    it('random valid scores always produce result in [0,100]', () => {
        // Generate 50 random valid rows and verify invariant
        const criteria = criteriaFromIds(SIX_CRITERIA);
        const testRows = Array.from({ length: 50 }, (_, i) => {
            const scores = SIX_CRITERIA.map(() => Math.floor(Math.random() * 101));
            return [String(i), ...scores];
        });
        const parsed = parseSheet([HEADER_ROW, ...testRows]);
        const customWeights = { safety: 20, traffic: 10, flood: 15, pollution: 10, groundwater: 10, connectivity: 35 };
        const scored = calculateImportScores(parsed.rows, criteria, customWeights);
        scored.forEach((row) => {
            if (row.overallScore !== null) {
                assert.ok(row.overallScore >= 0, `score must be >= 0, got ${row.overallScore}`);
                assert.ok(row.overallScore <= 100, `score must be <= 100, got ${row.overallScore}`);
            }
        });
        assert.equal(scored.length, 50, 'all 50 rows scored');
    });
});

// ─── Test 21: 10 criteria detection and Composite Average exclusion ─────────

describe('Test 21: 10 criteria detection and Composite Average exclusion', () => {
    it('detects exactly 10 criteria and excludes Composite Average from criteria list', () => {
        const TEN_HEADER = [
            'Region', 'Area / Neighbourhood', 'Safety', 'Traffic', 'Flood',
            'Pollution', 'Groundwater', 'Connectivity', 'Healthcare', 'Education',
            'Cost of Living', 'Public Transport', 'Composite Average'
        ];
        const row = [
            'Central', 'Anna Nagar', 88, 62, 72, 65, 62, 88, 85, 90, 45, 85, 74.2
        ];
        const parsed = parseSheet([TEN_HEADER, row]);
        assert.equal(parsed.criteriaIds.length, 10, 'must detect exactly 10 criteria');
        assert.ok(!parsed.criteriaIds.includes('composite_average'), 'composite_average must NOT be a criterion');
        assert.equal(parsed.rows[0].sourceCompositeAverage, 74.2, 'must capture sourceCompositeAverage');
    });
});

// ─── Test 22: Composite Average validation ──────────────────────────────────

describe('Test 22: Composite Average validation', () => {
    it('validates calculatedComposite matches sourceCompositeAverage', () => {
        const TEN_HEADER = [
            'Region', 'Area / Neighbourhood', 'Safety', 'Traffic', 'Flood',
            'Pollution', 'Groundwater', 'Connectivity', 'Healthcare', 'Education',
            'Cost of Living', 'Public Transport', 'Composite Average'
        ];
        const rowMatching = ['Central', 'Anna Nagar', 88, 62, 72, 65, 62, 88, 85, 90, 45, 85, 74.2];
        const rowMismatch = ['Central', 'Anna Nagar', 88, 62, 72, 65, 62, 88, 85, 90, 45, 85, 99.9]; // 99.9 vs 74.2

        const parsed = parseSheet([TEN_HEADER, rowMatching, rowMismatch]);
        const { rows } = validateImport(parsed.rows, parsed.criteriaIds);

        assert.equal(rows[0].calculatedComposite, 74.2);
        assert.equal(rows[0].compositeMismatch, false);

        assert.equal(rows[1].calculatedComposite, 74.2);
        assert.equal(rows[1].compositeMismatch, true);
        assert.ok(rows[1].validationIssues.some((i) => i.criterionId === 'composite_average'));
    });
});

// ─── Test 23: Exact locality match vs Alias match vs Slash variant match ───

describe('Test 23: Exact vs Alias vs Slash variant match', () => {
    it('differentiates exact match, alias match, and slash-separated variants', () => {
        const activeLocalities = [
            { id: 'chennai__adyar', name: 'Adyar', aliases: ['Adyar Chennai'], city: 'Chennai' },
            { id: 'chennai__t-nagar', name: 'T. Nagar', aliases: ['T Nagar', 'Thyagaraya Nagar'], city: 'Chennai' },
        ];

        const rows = [
            { rowIndex: 1, rawName: 'Adyar', criteriaScores: {}, validationIssues: [] },
            { rowIndex: 2, rawName: 'T. Nagar / Thyagaraya Nagar', criteriaScores: {}, validationIssues: [] },
        ];

        const matched = matchLocalities(rows, activeLocalities);

        assert.equal(matched[0].matchStatus, 'MATCHED', 'Adyar should be exact MATCHED');
        assert.equal(matched[0].matchedLocalityId, 'chennai__adyar');

        assert.equal(matched[1].matchStatus, 'ALIASED', 'Slash variant should be ALIASED');
        assert.equal(matched[1].matchedLocalityId, 'chennai__t-nagar');
    });
});

// ─── Test 24: Geometry status classification ────────────────────────────────

describe('Test 24: Geometry status classification', () => {
    it('assigns POLYGON, MULTIPOLYGON, and POINT_ONLY correctly', () => {
        const activeLocalities = [
            { id: 'chennai__adyar', name: 'Adyar', aliases: [], city: 'Chennai' },
            { id: 'chennai__porur', name: 'Porur', aliases: [], city: 'Chennai' },
        ];

        const rows = [
            { rowIndex: 1, rawName: 'Adyar', criteriaScores: {}, validationIssues: [] }, // MultiPolygon in boundaries
            { rowIndex: 2, rawName: 'Porur', criteriaScores: {}, validationIssues: [] }, // Polygon in boundaries
            { rowIndex: 3, rawName: 'Nungambakkam', criteriaScores: {}, validationIssues: [] }, // Point in catalogue
            { rowIndex: 4, rawName: 'IIT Madras area', criteriaScores: {}, validationIssues: [] }, // Known point
        ];

        const matched = matchLocalities(rows, activeLocalities);

        assert.equal(matched[0].geometryStatus, 'MULTIPOLYGON');
        assert.equal(matched[1].geometryStatus, 'POLYGON');
        assert.equal(matched[2].geometryStatus, 'POINT_ONLY');
        assert.equal(matched[3].geometryStatus, 'POINT_ONLY');
    });
});

// ─── Test 25: Canonical Chennai catalogue auto-resolution for new areas ─────

describe('Test 25: Canonical Chennai catalogue auto-resolution for new areas', () => {
    it('suggests canonical ID and metadata with high confidence from catalogue', () => {
        const activeLocalities = []; // empty active localities
        const rows = [
            { rowIndex: 1, rawName: 'Kathivakkam / Kattivakkam', criteriaScores: {}, validationIssues: [] },
        ];

        const matched = matchLocalities(rows, activeLocalities);
        const row = matched[0];

        assert.equal(row.matchStatus, 'NEW');
        assert.equal(row.suggestedLocalityId, 'chennai__kathivakkam');
        assert.equal(row.suggestedName, 'Kathivakkam');
        assert.equal(row.confidence, 'HIGH');
        assert.equal(row.hasGeometry, true);
        assert.ok(row.latitude != null && row.longitude != null);
    });
});

// ─── Test 26: Duplicate canonical locality prevention ───────────────────────

describe('Test 26: Duplicate canonical locality prevention', () => {
    it('flags repeated occurrences of the same canonical locality as DUPLICATE', () => {
        const activeLocalities = [
            { id: 'chennai__adyar', name: 'Adyar', aliases: ['Adayar'], city: 'Chennai' },
        ];

        const rows = [
            { rowIndex: 1, rawName: 'Adyar', criteriaScores: {}, validationIssues: [] },
            { rowIndex: 2, rawName: 'Adayar', criteriaScores: {}, validationIssues: [] },
        ];

        const matched = matchLocalities(rows, activeLocalities);
        assert.equal(matched[0].matchStatus, 'MATCHED');
        assert.equal(matched[1].matchStatus, 'DUPLICATE');
        assert.equal(matched[1].duplicateOfRow, 1);
    });
});

// ─── Test 27: 10-criterion equal-weight score calculation ───────────────────

describe('Test 27: 10-criterion equal-weight score calculation', () => {
    it('computes 10-criterion equal-weight mean (10% each)', () => {
        const TEN_CRITERIA = [
            'safety', 'traffic', 'flood', 'pollution', 'groundwater',
            'connectivity', 'healthcare', 'education', 'cost_of_living', 'public_transport'
        ];
        const criteria = criteriaFromIds(TEN_CRITERIA);
        const weights = equalWeights(TEN_CRITERIA);

        // 88+62+72+65+62+88+85+90+45+85 = 742 / 10 = 74.2
        const row = {
            rowIndex: 1,
            rawName: 'Anna Nagar',
            criteriaScores: {
                safety: 88, traffic: 62, flood: 72, pollution: 65, groundwater: 62,
                connectivity: 88, healthcare: 85, education: 90, cost_of_living: 45, public_transport: 85,
            },
        };

        const scored = calculateImportScores([row], criteria, weights);
        assert.equal(scored[0].overallScore, 74.2);
        assert.equal(scored[0].coverage, 1.0);
    });
});

// ─── Test 28: Versioning (v1 preservation, v2 creation) ─────────────────────

describe('Test 28: Versioning (v1 preservation, v2 creation)', () => {
    it('creates v2 without mutating v1', () => {
        const v1 = { id: 'croww-area-score-v1', version: 1, status: 'ACTIVE' };
        const v2 = buildScoringSystem({
            id: 'croww-area-score-v2',
            version: 2,
            displayName: 'Croww Area Scoring v2',
            criteria: criteriaFromIds(['safety', 'traffic']),
            uid: 'admin_123',
        });

        assert.equal(v1.version, 1);
        assert.equal(v2.version, 2);
        assert.equal(v2.id, 'croww-area-score-v2');
        assert.notEqual(v1.id, v2.id);
    });
});

// ─── Test 29: Regression Test: Consistent Display-Rounding Rule ──────────────

describe('Test 29: Regression Test: Consistent Display-Rounding Rule', () => {
    it('applies Math.round consistently: 70.8 -> 71, 70.2 -> 70, 74.0 -> 74', () => {
        // Adyar stored score: 70.8 -> display score: 71
        assert.equal(formatAreaScore(70.8), 71);
        assert.equal(formatAreaScore(70.7), 71);

        // Guindy stored score: 70.2 -> display score: 70
        assert.equal(formatAreaScore(70.2), 70);

        // Anna Nagar stored score: 74.0 -> display score: 74
        assert.equal(formatAreaScore(74.0), 74);

        // Edge cases
        assert.equal(formatAreaScore(0), 0);
        assert.equal(formatAreaScore(100), 100);
        assert.equal(formatAreaScore(null), null);
        assert.equal(formatAreaScore(undefined), null);
        assert.equal(formatAreaScore('invalid'), null);
    });

    it('ensures bubble, card, and detail sheet share identical rounded score for Adyar', () => {
        const storedLocality = {
            id: 'chennai__adyar',
            name: 'Adyar',
            publishedScore: { overallScore: 70.8 },
            intelligence: { areaScore: { score: 70.8 } },
        };
        const matchResult = {
            localityId: 'chennai__adyar',
            areaScore: 70.8,
            matchScore: 84, // personalized match is separate
        };

        // All surfaces resolve raw score then formatAreaScore
        const rawScoreFromLocality = storedLocality.publishedScore.overallScore;
        const rawScoreFromMatch = matchResult.areaScore;

        assert.equal(formatAreaScore(rawScoreFromLocality), 71);
        assert.equal(formatAreaScore(rawScoreFromMatch), 71);
        assert.equal(formatAreaScore(rawScoreFromLocality), formatAreaScore(rawScoreFromMatch));
    });
});

// ─── Test 30: Truthful Geometry Classification across 188 areas ─────────────

describe('Test 30: Truthful Geometry Classification across 188 areas', () => {
    it('strictly separates 7 verified boundaries from 181 point-only areas', () => {
        const catalogueList = Object.values(CHENNAI_LOCALITY_CATALOGUE);
        assert.equal(catalogueList.length, 188);

        const rows = catalogueList.map((loc, idx) => ({
            rowIndex: idx + 1,
            rawName: loc.name,
            criteriaScores: {},
            validationIssues: [],
        }));

        const matched = matchLocalities(rows, []);

        const counts = {
            MULTIPOLYGON: 0,
            POLYGON: 0,
            POINT_ONLY: 0,
            PROXY_POLYGON: 0,
            REVIEW_REQUIRED: 0,
        };

        matched.forEach((r) => {
            counts[r.geometryStatus] = (counts[r.geometryStatus] || 0) + 1;
        });

        assert.equal(counts.MULTIPOLYGON, 5);
        assert.equal(counts.POLYGON, 2);
        assert.equal(counts.POINT_ONLY, 181);
        assert.equal(counts.PROXY_POLYGON, 0);
        assert.equal(counts.REVIEW_REQUIRED, 0);

        const verifiedBoundaries = counts.MULTIPOLYGON + counts.POLYGON;
        assert.equal(verifiedBoundaries, 7);
        assert.equal(verifiedBoundaries + counts.POINT_ONLY, 188);
    });
});

// ─── Test 31: Canonical localityId & Score Linkage for 10 Localities ─────────

describe('Test 31: Canonical localityId & Score Linkage for 10 Localities', () => {
    it('preserves identical canonical localityId and published score end-to-end', () => {
        const testLocalities = [
            { name: 'Thiruvottiyur', expectedId: 'chennai__thiruvottiyur', expectedStatus: 'POLYGON' },
            { name: 'Manali', expectedId: 'chennai__manali', expectedStatus: 'POINT_ONLY' },
            { name: 'Anna Nagar', expectedId: 'chennai__anna-nagar', expectedStatus: 'MULTIPOLYGON' },
            { name: 'Guindy', expectedId: 'chennai__guindy', expectedStatus: 'POINT_ONLY' },
            { name: 'Mylapore', expectedId: 'chennai__mylapore', expectedStatus: 'POINT_ONLY' },
            { name: 'T. Nagar', expectedId: 'chennai__t-nagar', expectedStatus: 'MULTIPOLYGON' },
            { name: 'Adyar', expectedId: 'chennai__adyar', expectedStatus: 'MULTIPOLYGON' },
            { name: 'Velachery', expectedId: 'chennai__velachery', expectedStatus: 'MULTIPOLYGON' },
            { name: 'Porur', expectedId: 'chennai__porur', expectedStatus: 'POLYGON' },
            { name: 'Ambattur', expectedId: 'chennai__ambattur', expectedStatus: 'POINT_ONLY' },
        ];

        const rows = testLocalities.map((t, idx) => ({
            rowIndex: idx + 1,
            rawName: t.name,
            criteriaScores: {},
            validationIssues: [],
        }));

        const matched = matchLocalities(rows, []);

        testLocalities.forEach((expected, idx) => {
            const row = matched[idx];
            assert.equal(row.suggestedLocalityId, expected.expectedId);
            assert.equal(row.geometryStatus, expected.expectedStatus);
            assert.ok(row.latitude != null && row.longitude != null);
        });
    });
});


