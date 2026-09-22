/**
 * Croww Admin Spreadsheet Scoring Domain — Types
 *
 * This is a separate layer from the personalized Area Score engine (areaScore/).
 * Spreadsheet-imported criterion scores are pre-normalized 0–100 values.
 * They are NOT derived through city thresholds or metric inversion.
 */

export type CriterionDirection = 'DIRECT_SCORE';
export type CriterionType = 'score_0_100';

/** One criterion in a scoring system (e.g. Safety, Traffic, Flood). */
export type ScoringCriterion = {
    id: string;          // normalized snake_case key, e.g. "safety"
    name: string;        // display name from spreadsheet header, e.g. "Safety"
    type: CriterionType;
    direction: CriterionDirection;
    weight: number;      // raw weight, e.g. 16.6667 for equal-weight 6-criterion
    active: boolean;
    description?: string;
};

export type ScoringSystemStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';

/** A versioned set of criteria + weights used for one import session. */
export type ScoringSystem = {
    id: string;               // e.g. "croww-area-score-spreadsheet-v1"
    version: number;
    displayName: string;
    description?: string;
    criteria: ScoringCriterion[];
    status: ScoringSystemStatus;
    createdAt: number | null;  // epoch ms (Firestore Timestamp on write)
    createdBy: string | null;  // uid
};

export type MatchStatus = 'MATCHED' | 'ALIASED' | 'NEW' | 'AMBIGUOUS' | 'DUPLICATE' | 'REVIEW_REQUIRED';

export type GeometryStatus = 'POLYGON' | 'MULTIPOLYGON' | 'POINT_ONLY' | 'PROXY_POLYGON' | 'REVIEW_REQUIRED' | 'UNAVAILABLE';

export type CellValidationIssue = {
    criterionId: string;
    value: unknown;
    message: string;
    isNotice?: boolean;
};

/** One row from the import spreadsheet, after parsing and enrichment. */
export type ImportRow = {
    rowIndex: number;
    rawName: string;
    canonicalName?: string;
    matchStatus: MatchStatus | null;
    matchedLocalityId: string | null;
    suggestedLocalityId?: string | null;
    suggestedName?: string | null;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    ambiguousMatches?: string[];
    duplicateOfRow?: number;
    hasGeometry?: boolean;
    geometryType?: string;
    geometryStatus?: GeometryStatus;
    boundarySource?: string;
    latitude?: number;
    longitude?: number;
    criteriaScores: Record<string, number | null | 'INVALID'>;
    overallScore: number | null;
    coverage: number;
    availableCriteria: string[];
    missingCriteria: string[];
    sourceCompositeAverage?: number | null;
    calculatedComposite?: number | null;
    compositeMismatch?: boolean;
    validationIssues: CellValidationIssue[];
};

export type ImportSummary = {
    criteriaDetected: string[];
    newCriteria: string[];           // criteria not in active system
    localitiesDetected: number;
    matchedCount: number;
    aliasedCount: number;
    unmatchedCount: number;
    ambiguousCount: number;
    duplicateCount: number;
    reviewRequiredCount: number;
    geometryReadyCount: number;
    geometryMissingCount: number;
    invalidCellCount: number;
    readyCount: number;
};

export type ParsedSheet = {
    headers: string[];
    localityColumnIdx: number;
    compositeAverageColumnIdx?: number;
    criteriaColumns: Array<{ idx: number; name: string; id: string }>;
    criteriaIds: string[];
    criteriaNames: Record<string, string>;   // id → display name
    rows: ImportRow[];
};

export type ImportStatus = 'DRAFT' | 'RECONCILIATION_REQUIRED' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'REJECTED' | 'SUPERSEDED';

/** Written to area_scoring_imports/{importId} in Firestore. */
export type ScoringImportRecord = {
    fileName: string;
    uploadedAt: number | null;
    uploadedBy: string | null;
    scoringSystemId: string;
    scoringSystemVersion: number;
    criteriaDetected: string[];
    localitiesDetected: number;
    matchedCount: number;
    aliasedCount?: number;
    unmatchedCount: number;
    ambiguousCount: number;
    invalidCount: number;
    geometryReadyCount?: number;
    geometryMissingCount?: number;
    status: ImportStatus;
};

/** Written to localities/{id}/scoring/{scoringSystemId} in Firestore. */
export type PublishedScore = {
    criteria: Record<string, number>;       // raw criterion scores
    overallScore: number;
    coverage: number;
    availableCriteria: string[];
    missingCriteria: string[];
    totalCriteria: number;
    scoringSystemId: string;
    scoringSystemVersion: number;
    source: {
        type: 'ADMIN_SPREADSHEET';
        importId: string;
        fileName: string;
        uploadedBy: string;
        uploadedAt: number | null;
    };
    publishedAt: number | null;
    publishedBy: string | null;
};

/** Denormalized summary written to localities/{id}.publishedScore for consumer reads. */
export type LocalityPublishedScoreSummary = {
    overallScore: number;
    scoringSystemId: string;
    scoringSystemVersion: number;
    publishedAt: number | null;
    criteriaCount: number;
    coverage: number;
};
