import {
    AREA_SCORE_METHODOLOGY_VERSION,
    DEFAULT_AREA_SCORE_WEIGHTS,
    MIN_COVERAGE_TO_SHOW_SCORE,
} from './constants.ts';
import type { AreaScoreCityConfig, AreaScoreConfig, ScoreWeights } from './types.ts';

/**
 * Chennai reference ranges are product heuristics for V1, not empirical
 * percentiles of Croww inventory (the catalog is too sparse for that).
 * Do not reuse these numbers for other cities.
 */
const CHENNAI: AreaScoreCityConfig = {
    city: 'Chennai',
    cityKey: 'chennai',
    dimensions: {
        affordability: {
            salePrice: { favorable: 6000000, unfavorable: 25000000 },
            rentMonthly: { favorable: 20000, unfavorable: 80000 },
            pricePerSqft: { favorable: 5000, unfavorable: 18000 },
        },
        transport: {
            distanceM: { favorable: 400, unfavorable: 6000 },
            count: { favorable: 2 },
        },
        schools: {
            distanceM: { favorable: 400, unfavorable: 3000 },
            count: { favorable: 4 },
        },
        healthcare: {
            distanceM: { favorable: 600, unfavorable: 4000 },
            count: { favorable: 3 },
        },
        airport: {
            distanceM: { favorable: 8000, unfavorable: 40000 },
        },
        connectivity: {
            distanceM: { favorable: 300, unfavorable: 3000 },
        },
        flood: {},
        marketFit: {
            listingCount: { favorable: 40 },
        },
    },
};

export const AREA_SCORE_CONFIG: AreaScoreConfig = {
    methodologyVersion: AREA_SCORE_METHODOLOGY_VERSION,
    minCoverageToShowScore: MIN_COVERAGE_TO_SHOW_SCORE,
    defaultWeights: { ...DEFAULT_AREA_SCORE_WEIGHTS } as ScoreWeights,
    cities: {
        chennai: CHENNAI,
    },
};

export function normalizeCityKey(city: string | null | undefined): string | null {
    if (typeof city !== 'string') return null;
    const key = city.trim().toLowerCase();
    if (!key) return null;
    if (key === 'madras') return 'chennai';
    return key;
}

/**
 * City-scoped config. Unknown cities return null — never fall back to Chennai.
 */
export function getAreaScoreConfig(city?: string | null): AreaScoreCityConfig | null {
    const key = normalizeCityKey(city);
    if (!key) return null;
    return AREA_SCORE_CONFIG.cities[key] || null;
}

export function getAreaScoreMethodology() {
    return {
        methodologyVersion: AREA_SCORE_CONFIG.methodologyVersion,
        minCoverageToShowScore: AREA_SCORE_CONFIG.minCoverageToShowScore,
        defaultWeights: AREA_SCORE_CONFIG.defaultWeights,
    };
}
