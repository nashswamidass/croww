import {
    SCORE_DIMENSION_IDS,
    SCORE_STATUSES,
    DIMENSION_EVAL_STATUSES,
} from './constants.ts';
import type { ConfidenceLevel, SourceClass, TimestampLike } from '../intelligence/types.ts';

export type ScoreDimensionId = (typeof SCORE_DIMENSION_IDS)[number];
export type AreaScoreStatus = (typeof SCORE_STATUSES)[number];
export type DimensionEvalStatus = (typeof DIMENSION_EVAL_STATUSES)[number];

export type ScoreWeights = Record<ScoreDimensionId, number>;
export type PartialScoreWeights = Partial<ScoreWeights>;

export type RangeThreshold = {
    /** Value at or better than this maps toward 100. */
    favorable: number;
    /** Value at or worse than this maps toward 0. */
    unfavorable: number;
};

export type CountThreshold = {
    /** Count at or above this maps to 100. */
    favorable: number;
};

export type DimensionNormalization = {
    salePrice?: RangeThreshold;
    rentMonthly?: RangeThreshold;
    pricePerSqft?: RangeThreshold;
    distanceM?: RangeThreshold;
    count?: CountThreshold;
    listingCount?: CountThreshold;
};

export type AreaScoreCityConfig = {
    city: string;
    cityKey: string;
    dimensions: Record<ScoreDimensionId, DimensionNormalization | Record<string, never>>;
};

export type AreaScoreConfig = {
    methodologyVersion: string;
    minCoverageToShowScore: number;
    defaultWeights: ScoreWeights;
    cities: Record<string, AreaScoreCityConfig>;
};

export type DimensionEvidenceRef = {
    metricKeys: string[];
    sourceClass: SourceClass | null;
    sourceLabel: string | null;
    confidence: ConfidenceLevel;
    sampleSize: number | null;
    fetchedAt: TimestampLike;
    computedAt: TimestampLike;
    sourceUpdatedAt: TimestampLike;
};

export type DimensionScore = {
    id: ScoreDimensionId;
    label: string;
    status: DimensionEvalStatus;
    normalizedScore: number | null;
    weight: number;
    weightShare: number;
    contribution: number | null;
    evidenceRef: DimensionEvidenceRef | null;
    evidenceSummary: string;
};

export type AreaScoreResult = {
    methodologyVersion: string;
    city: string | null;
    cityKey: string | null;
    scoreStatus: AreaScoreStatus;
    overallScore: number | null;
    coverage: number;
    confidence: ConfidenceLevel;
    confidenceNumeric: number;
    dimensions: DimensionScore[];
    unavailableDimensions: ScoreDimensionId[];
    staleDimensions: ScoreDimensionId[];
    insufficientSampleDimensions: ScoreDimensionId[];
    notes: string[];
    usedDefaultWeights: boolean;
};
