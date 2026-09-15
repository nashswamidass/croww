import { emptySnapshot } from '../intelligence/snapshot.ts';
import type { IntelligenceSnapshot } from '../intelligence/types.ts';
import {
    AREA_SCORE_METHODOLOGY_VERSION,
    SCORE_DIMENSION_IDS,
    SCORE_DIMENSION_LABELS,
} from './constants.ts';
import { AREA_SCORE_CONFIG, getAreaScoreConfig, normalizeCityKey } from './config.ts';
import { dimensionConfidenceNumeric, labelConfidence } from './confidence.ts';
import { evidenceSummary, overallNotes } from './explain.ts';
import { extractDimension } from './extract.ts';
import {
    averageScores,
    countLinear,
    floodClassScore,
    invertLinear,
    marketActivityScore,
    roundScore,
} from './normalize.ts';
import type {
    AreaScoreCityConfig,
    AreaScoreResult,
    DimensionEvalStatus,
    DimensionScore,
    PartialScoreWeights,
    ScoreDimensionId,
} from './types.ts';
import { normalizeWeights } from './weights.ts';

function unavailableResult(partial: Partial<AreaScoreResult> & Pick<AreaScoreResult, 'scoreStatus' | 'notes'>): AreaScoreResult {
    return {
        methodologyVersion: AREA_SCORE_METHODOLOGY_VERSION,
        city: null,
        cityKey: null,
        overallScore: null,
        coverage: 0,
        confidence: 'UNKNOWN',
        confidenceNumeric: 0,
        dimensions: [],
        unavailableDimensions: [...SCORE_DIMENSION_IDS],
        staleDimensions: [],
        insufficientSampleDimensions: [],
        usedDefaultWeights: true,
        ...partial,
    };
}

function normalizeDimension(
    id: ScoreDimensionId,
    cityConfig: AreaScoreCityConfig,
    snapshot: IntelligenceSnapshot
): { score: number | null; extracted: ReturnType<typeof extractDimension> } {
    const extracted = extractDimension(snapshot, id);
    const spec = cityConfig.dimensions[id] || {};
    if (extracted.status === 'UNAVAILABLE' || extracted.status === 'INSUFFICIENT_SAMPLE') {
        return { score: null, extracted };
    }
    if (id === 'flood') {
        const score = floodClassScore(extracted.floodClass);
        return { score, extracted };
    }
    if (id === 'affordability') {
        const parts: number[] = [];
        const metrics = {
            ...snapshot.domains.market.metrics,
            ...snapshot.domains.affordability.metrics,
        };
        const sale = metrics.medianSalePrice;
        const rent = metrics.medianRent;
        const psf = metrics.medianPricePerSqft;
        if (sale && typeof sale.value === 'number' && spec.salePrice
            && (sale.status === 'AVAILABLE' || sale.status === 'PARTIAL' || sale.status === 'STALE')) {
            parts.push(invertLinear(sale.value, spec.salePrice));
        }
        if (rent && typeof rent.value === 'number' && spec.rentMonthly
            && (rent.status === 'AVAILABLE' || rent.status === 'PARTIAL' || rent.status === 'STALE')) {
            parts.push(invertLinear(rent.value, spec.rentMonthly));
        }
        if (psf && typeof psf.value === 'number' && spec.pricePerSqft
            && (psf.status === 'AVAILABLE' || psf.status === 'PARTIAL' || psf.status === 'STALE')) {
            parts.push(invertLinear(psf.value, spec.pricePerSqft));
        }
        return { score: averageScores(parts), extracted };
    }
    if (id === 'airport' || id === 'connectivity') {
        const distance = extracted.numbers[0];
        if (distance == null || !spec.distanceM) return { score: null, extracted };
        return { score: invertLinear(distance, spec.distanceM), extracted };
    }
    if (id === 'transport' || id === 'schools' || id === 'healthcare') {
        const parts: number[] = [];
        const metrics = (id === 'transport'
            ? snapshot.domains.transport.metrics
            : id === 'schools'
                ? snapshot.domains.schools.metrics
                : snapshot.domains.healthcare.metrics) || {};
        const distanceKey = id === 'transport'
            ? 'nearestMetroDistanceM'
            : id === 'schools'
                ? 'nearestSchoolDistanceM'
                : 'nearestHospitalDistanceM';
        const countKey = id === 'transport'
            ? 'metroStationsWithinRadius'
            : id === 'schools'
                ? 'schoolsWithinRadius'
                : 'hospitalsWithinRadius';
        const distanceMetric = metrics[distanceKey];
        const countMetric = metrics[countKey];
        if (distanceMetric && typeof distanceMetric.value === 'number' && spec.distanceM
            && (distanceMetric.status === 'AVAILABLE' || distanceMetric.status === 'PARTIAL' || distanceMetric.status === 'STALE')) {
            parts.push(invertLinear(distanceMetric.value, spec.distanceM));
        }
        if (countMetric && typeof countMetric.value === 'number' && spec.count
            && (countMetric.status === 'AVAILABLE' || countMetric.status === 'PARTIAL' || countMetric.status === 'STALE')) {
            parts.push(countLinear(countMetric.value, spec.count.favorable));
        }
        return { score: averageScores(parts), extracted };
    }
    const count = extracted.numbers[0];
    if (count == null || !spec.listingCount) return { score: null, extracted };
    return { score: marketActivityScore(count, spec.listingCount.favorable), extracted };
}

/**
 * Personalized Area Score. Deterministic for the same snapshot, weights, city config, and `now`.
 * Does not write to localities. Does not scan listings.
 */
export function calculateAreaScore(input: {
    snapshot?: IntelligenceSnapshot | null;
    city?: string | null;
    weights?: PartialScoreWeights | null;
} = {}): AreaScoreResult {
    const snapshot = input.snapshot || emptySnapshot();
    const city = typeof input.city === 'string' ? input.city : null;
    const cityKey = normalizeCityKey(city);
    const cityConfig = getAreaScoreConfig(city);
    const { weights, total, usedDefault } = normalizeWeights(input.weights);

    if (!cityConfig) {
        return unavailableResult({
            city,
            cityKey,
            scoreStatus: 'LIMITED_CONFIG',
            usedDefaultWeights: usedDefault,
            dimensions: SCORE_DIMENSION_IDS.map((id) => ({
                id,
                label: SCORE_DIMENSION_LABELS[id],
                status: 'UNAVAILABLE',
                normalizedScore: null,
                weight: weights[id],
                weightShare: weights[id],
                contribution: null,
                evidenceRef: null,
                evidenceSummary: city
                    ? `No Area Score thresholds for ${city}.`
                    : 'City is required for Area Score thresholds.',
            })),
            notes: overallNotes({
                scoreStatus: 'LIMITED_CONFIG',
                coverage: 0,
                staleIds: [],
                unavailableIds: [...SCORE_DIMENSION_IDS],
                city,
                hasConfig: false,
            }),
        });
    }

    if (!(total > 0)) {
        return unavailableResult({
            city: cityConfig.city,
            cityKey: cityConfig.cityKey,
            scoreStatus: 'ZERO_WEIGHTS',
            usedDefaultWeights: usedDefault,
            unavailableDimensions: [],
            notes: overallNotes({
                scoreStatus: 'ZERO_WEIGHTS',
                coverage: 0,
                staleIds: [],
                unavailableIds: [],
                city: cityConfig.city,
                hasConfig: true,
            }),
        });
    }

    const evaluated = SCORE_DIMENSION_IDS.map((id) => {
        const { score, extracted } = normalizeDimension(id, cityConfig, snapshot);
        let status: DimensionEvalStatus = extracted.status;
        if (weights[id] === 0) status = 'ZERO_WEIGHT';
        else if (score == null && status !== 'INSUFFICIENT_SAMPLE') status = 'UNAVAILABLE';
        else if (score != null && extracted.stale) status = 'STALE';
        else if (score != null && status !== 'STALE') status = 'AVAILABLE';
        return { id, score, extracted, status, weight: weights[id] };
    });

    const active = evaluated.filter((row) => row.weight > 0);
    const scored = active.filter((row) => row.score != null && (row.status === 'AVAILABLE' || row.status === 'STALE'));
    const weightAvailable = scored.reduce((sum, row) => sum + row.weight, 0);
    const weightConsidered = active.reduce((sum, row) => sum + row.weight, 0);
    const coverage = weightConsidered > 0 ? weightAvailable / weightConsidered : 0;

    const confidenceNumeric = scored.length && weightAvailable > 0
        ? scored.reduce((sum, row) => sum + dimensionConfidenceNumeric(row.extracted) * row.weight, 0) / weightAvailable
        : 0;
    const confidence = labelConfidence(confidenceNumeric, coverage);

    const overall = weightAvailable > 0
        ? roundScore(scored.reduce((sum, row) => sum + (row.score || 0) * row.weight, 0) / weightAvailable)
        : null;

    let scoreStatus: AreaScoreResult['scoreStatus'] = 'AVAILABLE';
    if (scored.length === 0 || overall == null) scoreStatus = 'UNAVAILABLE';
    else if (coverage < AREA_SCORE_CONFIG.minCoverageToShowScore) scoreStatus = 'INSUFFICIENT_EVIDENCE';

    const showNumeric = scoreStatus === 'AVAILABLE';
    const overallScore = showNumeric && overall != null ? Math.round(overall) : null;

    const dimensions: DimensionScore[] = evaluated.map((row) => {
        const contribution = showNumeric && row.score != null && weightAvailable > 0 && row.weight > 0
            ? roundScore(((row.score * row.weight) / weightAvailable))
            : null;
        return {
            id: row.id,
            label: SCORE_DIMENSION_LABELS[row.id],
            status: row.status,
            normalizedScore: row.score,
            weight: row.weight,
            weightShare: row.weight,
            contribution,
            evidenceRef: row.extracted.metricKeys.length || row.extracted.floodClass ? {
                metricKeys: row.extracted.metricKeys,
                sourceClass: row.extracted.sourceClass,
                sourceLabel: row.extracted.sourceLabel,
                confidence: row.extracted.confidence,
                sampleSize: row.extracted.sampleSize,
                fetchedAt: row.extracted.fetchedAt,
                computedAt: row.extracted.computedAt,
                sourceUpdatedAt: row.extracted.sourceUpdatedAt,
            } : null,
            evidenceSummary: evidenceSummary(row.extracted, row.status === 'ZERO_WEIGHT' ? row.extracted.status : row.status),
        };
    });

    const unavailableDimensions = evaluated
        .filter((row) => row.weight > 0 && (row.status === 'UNAVAILABLE'))
        .map((row) => row.id);
    const staleDimensions = evaluated.filter((row) => row.status === 'STALE').map((row) => row.id);
    const insufficientSampleDimensions = evaluated
        .filter((row) => row.status === 'INSUFFICIENT_SAMPLE')
        .map((row) => row.id);

    return {
        methodologyVersion: AREA_SCORE_METHODOLOGY_VERSION,
        city: cityConfig.city,
        cityKey: cityConfig.cityKey,
        scoreStatus,
        overallScore,
        coverage: roundScore(coverage * 100) / 100,
        confidence,
        confidenceNumeric: roundScore(confidenceNumeric * 1000) / 1000,
        dimensions,
        unavailableDimensions,
        staleDimensions,
        insufficientSampleDimensions,
        usedDefaultWeights: usedDefault,
        notes: overallNotes({
            scoreStatus,
            coverage,
            staleIds: staleDimensions,
            unavailableIds: unavailableDimensions,
            city: cityConfig.city,
            hasConfig: true,
        }),
    };
}
