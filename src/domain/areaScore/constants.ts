/**
 * Croww Area Score v1 — personalized scoring over locality evidence.
 *
 * Default weights and city thresholds are PRODUCT HEURISTICS.
 * They are not scientifically optimal and are not a city-wide ranking.
 * Methodology version must change if formulas change.
 */

export const AREA_SCORE_METHODOLOGY_VERSION = 'croww-area-score-v1';
export const AREA_SCORE_PREFERENCE_VERSION = 'area-score-preferences-v1';

export const SCORE_DIMENSION_IDS = [
    'affordability',
    'transport',
    'schools',
    'healthcare',
    'airport',
    'connectivity',
    'flood',
    'marketFit',
] as const;

export const SCORE_STATUSES = [
    'AVAILABLE',
    'INSUFFICIENT_EVIDENCE',
    'UNAVAILABLE',
    'LIMITED_CONFIG',
    'ZERO_WEIGHTS',
] as const;

export const DIMENSION_EVAL_STATUSES = [
    'AVAILABLE',
    'STALE',
    'UNAVAILABLE',
    'INSUFFICIENT_SAMPLE',
    'ZERO_WEIGHT',
] as const;

/** Product-heuristic default weights. Not objective truth. Sum is 100 before normalization. */
export const DEFAULT_AREA_SCORE_WEIGHTS = {
    affordability: 20,
    transport: 16,
    schools: 14,
    healthcare: 12,
    airport: 10,
    connectivity: 10,
    flood: 10,
    marketFit: 8,
} as const;

/** Show a numeric 0–100 score only when weighted coverage meets this share. */
export const MIN_COVERAGE_TO_SHOW_SCORE = 0.4;

export const CONFIDENCE_NUMERIC = {
    HIGH: 1,
    MEDIUM: 0.65,
    LOW: 0.35,
    UNKNOWN: 0,
} as const;

export const SOURCE_TRUST_NUMERIC = {
    GOVERNMENT: 1,
    OFFICIAL: 1,
    OPEN_DATA: 0.8,
    VERIFIED_PROVIDER: 0.8,
    INTERNAL: 0.7,
    DERIVED: 0.6,
    COMMUNITY: 0.3,
} as const;

/** Stale evidence (Prompt 9: 90 days) still scores but confidence is scaled. */
export const STALE_CONFIDENCE_FACTOR = 0.6;

export const SCORE_DIMENSION_LABELS = {
    affordability: 'Affordability',
    transport: 'Metro & transport',
    schools: 'Schools nearby',
    healthcare: 'Healthcare nearby',
    airport: 'Airport access',
    connectivity: 'Major-road access',
    flood: 'Flood evidence',
    marketFit: 'Croww listing activity',
} as const;

export const USER_PREFERENCES_SUBCOLLECTION = 'preferences';
export const AREA_SCORE_PREFERENCE_DOC_ID = 'areaScore';
export const AREA_SCORE_PREFERENCE_STORAGE_KEY = 'croww.areaScore.preferences.v1';
