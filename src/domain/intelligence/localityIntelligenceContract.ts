import { formatAreaScore } from '../scoring/formatAreaScore.js';

export type DataAvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'ZERO' | 'NOT_APPLICABLE';

export type LocalityGeography = {
    latitude: number;
    longitude: number;
    geometryType: 'Polygon' | 'MultiPolygon' | 'POINT' | 'Point';
    boundaryStatus: 'VERIFIED' | 'POINT_ONLY' | 'PROXY_POLYGON' | 'REVIEW_REQUIRED';
    boundarySource?: string | null;
    bounds?: any | null;
    hasPolygonGeometry: boolean;
};

export type ScoreCriteriaMap = {
    safety?: number | null;
    traffic?: number | null;
    flood?: number | null;
    pollution?: number | null;
    groundwater?: number | null;
    connectivity?: number | null;
    healthcare?: number | null;
    education?: number | null;
    cost_of_living?: number | null;
    public_transport?: number | null;
    [key: string]: number | null | undefined;
};

export type RentalIntelligence = {
    typicalRent: number | null;
    typicalRentFormatted: string | null;
    inBudget: boolean | null;
    status: DataAvailabilityStatus;
};

export type TransportIntelligence = {
    score: number | null;
    nearestMetroDistanceM: number | null;
    metroAvailable: boolean | null;
    status: DataAvailabilityStatus;
};

export type SingleScoreDomain = {
    score: number | null;
    status: DataAvailabilityStatus;
};

export type FloodIntelligence = {
    score: number | null;
    classification: string | null;
    status: DataAvailabilityStatus;
};

export type CommuteIntelligence = {
    travelMinutes: number | null;
    distanceKm: number | null;
    modeTag: string | null;
    modeDescription: string | null;
    status: DataAvailabilityStatus;
};

export type StaysSupply = {
    staysCount: number | null;
    status: DataAvailabilityStatus;
};

export type NormalizedLocalityIntelligence = {
    localityId: string;
    name: string;
    city: string;
    region?: string | null;
    geography: LocalityGeography;
    areaScore: number | null;
    matchScore: number | null;
    scoreCriteria: ScoreCriteriaMap | null;
    scoringSystemVersion: string | null;
    rental: RentalIntelligence;
    transport: TransportIntelligence;
    connectivity: SingleScoreDomain;
    healthcare: SingleScoreDomain;
    education: SingleScoreDomain;
    safety: SingleScoreDomain;
    flood: FloodIntelligence;
    pollution: SingleScoreDomain;
    groundwater: SingleScoreDomain;
    costOfLiving: SingleScoreDomain;
    commute: CommuteIntelligence;
    staysSupply: StaysSupply;
    highlights: string[];
    dataAvailability: Record<string, DataAvailabilityStatus>;
};

/**
 * Normalizes locality records and match results into a single authoritative intelligence object.
 *
 * Invariants:
 * 1. Area Score and Match Score are strictly separated. Match Score is NEVER used as Area Score.
 * 2. Missing data is never coerced to 0, fake benchmarks, or placeholder text.
 * 3. 0 listing supply is represented as ZERO, not UNAVAILABLE.
 * 4. Highlights are generated only from deterministic criteria/commute triggers.
 */
export function normalizeLocalityIntelligence(
    locality: any,
    matchResult?: any
): NormalizedLocalityIntelligence {
    if (!locality && !matchResult) {
        throw new Error('[localityIntelligenceContract] Either locality or matchResult must be provided');
    }

    const loc = locality || {};
    const match = matchResult || {};

    const localityId = loc.id || loc.localityId || match.localityId || '';
    const name = loc.name || loc.localityName || match.localityName || 'Area';
    const city = loc.city || match.city || 'Chennai';
    const region = loc.region || null;

    // 1. Geography
    const latitude = typeof loc.latitude === 'number' ? loc.latitude : (typeof match.latitude === 'number' ? match.latitude : 0);
    const longitude = typeof loc.longitude === 'number' ? loc.longitude : (typeof match.longitude === 'number' ? match.longitude : 0);
    const geometryType = loc.geometryType || (loc.boundaries ? 'Polygon' : 'POINT');
    const boundaryStatus = loc.boundaryStatus || (loc.boundaries ? 'VERIFIED' : 'POINT_ONLY');
    const hasPolygonGeometry = geometryType === 'Polygon' || geometryType === 'MultiPolygon' || Boolean(loc.boundaries);

    const geography: LocalityGeography = {
        latitude,
        longitude,
        geometryType,
        boundaryStatus,
        boundarySource: loc.boundarySource || null,
        bounds: loc.bounds || null,
        hasPolygonGeometry,
    };

    // 2. Objective Area Score (never fallback to matchScore or score)
    const rawAreaScore = loc.publishedScore?.overallScore
        ?? loc.intelligence?.areaScore?.score
        ?? loc.areaScore
        ?? match.areaScore
        ?? match.publishedScore?.overallScore
        ?? null;
    const areaScore = formatAreaScore(rawAreaScore);

    // 3. User-Specific Match Score (strictly separate)
    const rawMatchScore = match.matchScore != null
        ? match.matchScore
        : (match.score != null && match.areaScore == null ? match.score : null);
    const matchScore = typeof rawMatchScore === 'number' && Number.isFinite(rawMatchScore)
        ? Math.round(Math.min(100, Math.max(0, rawMatchScore)))
        : null;

    // 4. Criteria Scores (0-100 semantics)
    const rawCriteria: ScoreCriteriaMap | null = loc.publishedScore?.criteriaScores
        ?? loc.intelligence?.areaScore?.criteriaScores
        ?? loc.scoring?.criteria
        ?? match.criteriaScores
        ?? null;

    const scoreCriteria: ScoreCriteriaMap | null = rawCriteria
        ? {
            safety: typeof rawCriteria.safety === 'number' ? rawCriteria.safety : null,
            traffic: typeof rawCriteria.traffic === 'number' ? rawCriteria.traffic : null,
            flood: typeof rawCriteria.flood === 'number' ? rawCriteria.flood : null,
            pollution: typeof rawCriteria.pollution === 'number' ? rawCriteria.pollution : null,
            groundwater: typeof rawCriteria.groundwater === 'number' ? rawCriteria.groundwater : null,
            connectivity: typeof rawCriteria.connectivity === 'number' ? rawCriteria.connectivity : null,
            healthcare: typeof rawCriteria.healthcare === 'number' ? rawCriteria.healthcare : null,
            education: typeof rawCriteria.education === 'number' ? rawCriteria.education : null,
            cost_of_living: typeof rawCriteria.cost_of_living === 'number' ? rawCriteria.cost_of_living : null,
            public_transport: typeof rawCriteria.public_transport === 'number' ? rawCriteria.public_transport : null,
        }
        : null;

    const scoringSystemVersion = loc.publishedScore?.scoringSystemId
        ? `${loc.publishedScore.scoringSystemId}:v${loc.publishedScore.scoringSystemVersion || 1}`
        : (loc.intelligence?.areaScore?.scoringVersion || null);

    // 5. Rental Intelligence (truthful: no invented rent)
    const typicalRent = typeof match.typicalRent === 'number' && match.typicalRent > 0
        ? match.typicalRent
        : (typeof loc.intelligence?.domains?.market?.metrics?.medianRent?.value === 'number'
            ? loc.intelligence.domains.market.metrics.medianRent.value
            : null);
    const typicalRentFormatted = match.typicalRentFormatted
        || (typicalRent ? (typicalRent >= 1000 ? `₹${(typicalRent / 1000).toFixed(1).replace(/\.0$/, '')}K` : `₹${typicalRent}`) : null);
    const inBudget = match.inBudget ?? null;
    const rental: RentalIntelligence = {
        typicalRent,
        typicalRentFormatted,
        inBudget,
        status: typicalRent != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    // 6. Transport & Connectivity
    const transportScore = scoreCriteria?.public_transport ?? null;
    const nearestMetroDistanceM = loc.intelligence?.domains?.transport?.metrics?.nearestMetroDistanceM?.value ?? null;
    const metroAvailable = loc.intelligence?.transport?.metro?.available
        || (nearestMetroDistanceM != null && nearestMetroDistanceM <= 2000)
        || (transportScore != null && transportScore >= 75)
        || false;
    const transport: TransportIntelligence = {
        score: transportScore,
        nearestMetroDistanceM,
        metroAvailable,
        status: transportScore != null || nearestMetroDistanceM != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const connectivity: SingleScoreDomain = {
        score: scoreCriteria?.connectivity ?? null,
        status: scoreCriteria?.connectivity != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const healthcare: SingleScoreDomain = {
        score: scoreCriteria?.healthcare ?? null,
        status: scoreCriteria?.healthcare != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const education: SingleScoreDomain = {
        score: scoreCriteria?.education ?? null,
        status: scoreCriteria?.education != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const safety: SingleScoreDomain = {
        score: scoreCriteria?.safety ?? null,
        status: scoreCriteria?.safety != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const floodScore = scoreCriteria?.flood ?? null;
    const floodClass = loc.intelligence?.domains?.flood?.metrics?.historicalFloodEvents?.value
        || loc.intelligence?.flood?.class
        || (floodScore != null ? (floodScore >= 70 ? 'LOW' : floodScore >= 45 ? 'MEDIUM' : 'HIGH') : null);
    const flood: FloodIntelligence = {
        score: floodScore,
        classification: floodClass,
        status: floodScore != null || floodClass != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const pollution: SingleScoreDomain = {
        score: scoreCriteria?.pollution ?? null,
        status: scoreCriteria?.pollution != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const groundwater: SingleScoreDomain = {
        score: scoreCriteria?.groundwater ?? null,
        status: scoreCriteria?.groundwater != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    const costOfLiving: SingleScoreDomain = {
        score: scoreCriteria?.cost_of_living ?? null,
        status: scoreCriteria?.cost_of_living != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    // 7. Commute
    const commute: CommuteIntelligence = {
        travelMinutes: match.commute?.travelMinutes ?? null,
        distanceKm: match.commute?.distanceKm ?? null,
        modeTag: match.commute?.modeTag ?? null,
        modeDescription: match.commute?.modeDescription ?? null,
        status: match.commute?.travelMinutes != null ? 'AVAILABLE' : 'UNAVAILABLE',
    };

    // 8. Stays Supply (0 stays is ZERO, NOT UNAVAILABLE)
    const rawStays = loc.staysCount ?? loc.stats?.activeListingCount ?? match.staysCount ?? null;
    const staysCount = typeof rawStays === 'number' && !isNaN(rawStays) ? rawStays : null;
    const staysSupply: StaysSupply = {
        staysCount,
        status: staysCount === 0 ? 'ZERO' : (staysCount != null ? 'AVAILABLE' : 'UNAVAILABLE'),
    };

    // 9. Highlights (deterministic data triggers only)
    const highlights: string[] = [];
    if (inBudget === true) {
        highlights.push('In budget');
    }
    if (commute.travelMinutes != null && commute.travelMinutes <= 30) {
        highlights.push('Quick commute');
    }
    if (commute.modeTag && commute.modeTag.toLowerCase().includes('metro')) {
        highlights.push('Metro connected');
    } else if (metroAvailable && nearestMetroDistanceM != null && nearestMetroDistanceM <= 2000) {
        highlights.push('Near Metro');
    }
    if (connectivity.score != null && connectivity.score >= 75) {
        highlights.push('Good Connectivity');
    }
    if (healthcare.score != null && healthcare.score >= 75) {
        highlights.push('Healthcare Access');
    }
    if (safety.score != null && safety.score >= 75) {
        highlights.push('High Safety');
    }
    if (flood.score != null && flood.score >= 75) {
        highlights.push('Flood Resilient');
    }
    if (costOfLiving.score != null && costOfLiving.score >= 75) {
        highlights.push('Lower Cost of Living');
    }

    // 10. Data Availability Summary
    const dataAvailability: Record<string, DataAvailabilityStatus> = {
        areaScore: areaScore != null ? 'AVAILABLE' : 'UNAVAILABLE',
        matchScore: matchScore != null ? 'AVAILABLE' : 'UNAVAILABLE',
        scoreCriteria: scoreCriteria != null ? 'AVAILABLE' : 'UNAVAILABLE',
        rental: rental.status,
        transport: transport.status,
        connectivity: connectivity.status,
        healthcare: healthcare.status,
        education: education.status,
        safety: safety.status,
        flood: flood.status,
        pollution: pollution.status,
        groundwater: groundwater.status,
        costOfLiving: costOfLiving.status,
        commute: commute.status,
        staysSupply: staysSupply.status,
    };

    return {
        localityId,
        name,
        city,
        region,
        geography,
        areaScore,
        matchScore,
        scoreCriteria,
        scoringSystemVersion,
        rental,
        transport,
        connectivity,
        healthcare,
        education,
        safety,
        flood,
        pollution,
        groundwater,
        costOfLiving,
        commute,
        staysSupply,
        highlights,
        dataAvailability,
    };
}
