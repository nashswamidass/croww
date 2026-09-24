/**
 * Commute & Destination-Driven Locality Matcher Domain.
 *
 * Evaluates candidate localities against user's:
 * 1. Destination (office / college / landmark)
 * 2. Budget range (e.g. ₹12,000 - ₹20,000)
 * 3. Commute mode (metro, bus, any public transit, walk, two_wheeler, car)
 * 4. Up to 3 area priority criteria from the canonical 10-criterion set
 *    (safety, traffic, flood, pollution, groundwater, connectivity,
 *     healthcare, education, cost_of_living, public_transport)
 *
 * Deterministic read-time scoring. Never writes back to public locality records.
 * Personal Match and Croww Area Score are kept strictly separate.
 */

import { haversineMeters } from '../property/geo.ts';
import type { GeoCoordinate } from '../property/geo.ts';
import { DEFAULT_AREA_SCORE_WEIGHTS } from './constants.ts';
import type { ScoreDimensionId } from './types.ts';

export type CommuteMode =
    | 'metro'
    | 'bus'
    | 'transit'
    | 'walk'
    | 'two_wheeler'
    | 'car';

/**
 * The canonical 10 area criteria that match the LocalityDetailSheet CRITERIA_CONFIG.
 * Users select exactly 3 to form their personal priority vector.
 */
export type AreaPriorityId =
    | 'safety'
    | 'traffic'
    | 'flood'
    | 'pollution'
    | 'groundwater'
    | 'connectivity'
    | 'healthcare'
    | 'education'
    | 'cost_of_living'
    | 'public_transport';

/** @deprecated Use AreaPriorityId — kept for backwards compat */
export type MatterPriority = AreaPriorityId;

export type DestinationPoint = {
    id?: string;
    name: string;
    landmark?: string;
    latitude: number;
    longitude: number;
};

export type BudgetRange = {
    min: number;
    max: number;
    label?: string;
};

export type LocalityMatchInput = {
    destination: DestinationPoint;
    budget: BudgetRange;
    commuteMode: CommuteMode;
    /**
     * Exactly 3 area criteria selected by the user.
     * Do not silently default. If fewer than 3 are present the Personal Match
     * score will use whichever criteria were provided; the UI enforces 3.
     */
    topPriorities: AreaPriorityId[];
    /** Maximum acceptable travel time in minutes. Null means unconstrained. */
    maxTravelMinutes?: number | null;
    city?: string;
    /** @deprecated Use topPriorities */
    priorities?: AreaPriorityId[];
};

export type LocalityCandidate = {
    id: string;
    name: string;
    city: string;
    latitude: number;
    longitude: number;
    intelligence?: any;
    aliases?: string[];
    stats?: any;
    boundaries?: any;
    staysCount?: number | null;
};

export type CommuteEstimate = {
    distanceKm: number;
    travelMinutes: number;
    modeTag: string;
    modeDescription: string;
};

/**
 * Deterministic breakdown of the Personal Match signal.
 * Never conflated with the objective Croww Area Score.
 */
export type PersonalMatchBreakdown = {
    /** Commute score 0-100 derived from estimated travel time */
    commuteScore: number;
    /** Budget fit score 0-100 */
    budgetScore: number | null;
    /**
     * Priority dimension scores: up to 3 entries, one per user-selected criterion.
     * Each score is taken from the locality's criteriaScores; null when unavailable.
     */
    priorityScores: { criterionId: AreaPriorityId; score: number | null }[];
    /**
     * Composite Personal Match 0-100.
     * Commute 40% + Budget 30% + Average of priority criteria 30%.
     * When budget data is unavailable, commute 50% + priority criteria 50%.
     * Never stored on public locality documents.
     */
    composite: number;
    travelMinutes: number;
    inBudget: boolean | null;
    commuteUnavailable: boolean;
    budgetUnavailable: boolean;
};

export type LocalityMatchResult = {
    localityId: string;
    localityName: string;
    city: string;
    /** Objective Croww Area Score (0-100 or null). Source: publishedScore or calculated. */
    areaScore: number | null;
    /**
     * Personal Match composite score (0-100).
     * Derived from user's commute, budget, and 3 priorities — never from areaScore.
     */
    matchScore: number;
    personalMatchBreakdown: PersonalMatchBreakdown;
    typicalRent: number | null;
    typicalRentFormatted: string | null;
    inBudget: boolean | null;
    commute: CommuteEstimate;
    highlights: string[];
    latitude: number;
    longitude: number;
    boundaries?: any;
    intelligence?: any;
    staysCount?: number | null;
};

export const COMMUTE_MODE_CONFIG: Record<CommuteMode, { label: string; icon: string }> = {
    transit: { label: 'Any public transport', icon: 'bus-outline' },
    metro: { label: 'Metro', icon: 'subway-outline' },
    bus: { label: 'Bus', icon: 'bus-outline' },
    walk: { label: 'Walk', icon: 'walk-outline' },
    two_wheeler: { label: 'Two wheeler', icon: 'bicycle-outline' },
    car: { label: 'Car', icon: 'car-outline' },
};

/**
 * All 10 canonical area criteria. Users must pick exactly 3.
 * Deterministic label + icon for each criterion.
 */
export const AREA_CRITERIA_CONFIG: Record<AreaPriorityId, { label: string; icon: string; description: string }> = {
    safety:          { label: 'Safety',           icon: 'shield-checkmark-outline', description: 'Street safety, crime patterns, and night security' },
    traffic:         { label: 'Traffic Flow',     icon: 'car-outline',              description: 'Peak-hour congestion and road ease' },
    flood:           { label: 'Flood Safety',     icon: 'water-outline',            description: 'Monsoon flooding history and drainage quality' },
    pollution:       { label: 'Clean Air',        icon: 'leaf-outline',             description: 'Air and noise pollution levels' },
    groundwater:     { label: 'Groundwater',      icon: 'rainy-outline',            description: 'Water table depth and availability' },
    connectivity:    { label: 'Connectivity',     icon: 'navigate-outline',         description: 'Major road and highway access' },
    healthcare:      { label: 'Healthcare',       icon: 'medkit-outline',           description: 'Multi-specialty hospitals and clinics nearby' },
    education:       { label: 'Education',        icon: 'school-outline',           description: 'Schools, colleges, and coaching centres nearby' },
    cost_of_living:  { label: 'Cost of Living',   icon: 'wallet-outline',           description: 'General cost of services, groceries, and daily needs' },
    public_transport:{ label: 'Public Transit',   icon: 'bus-outline',              description: 'Metro, bus, and auto-rickshaw availability' },
};

/** All 10 criteria in a stable ordered array */
export const ALL_AREA_CRITERIA: AreaPriorityId[] = [
    'safety', 'traffic', 'flood', 'pollution', 'groundwater',
    'connectivity', 'healthcare', 'education', 'cost_of_living', 'public_transport',
];

/** @deprecated Use AREA_CRITERIA_CONFIG */
export const MATTERS_CONFIG: Record<string, { label: string; icon: string }> = Object.fromEntries(
    ALL_AREA_CRITERIA.map((id) => [id, { label: AREA_CRITERIA_CONFIG[id].label, icon: AREA_CRITERIA_CONFIG[id].icon }])
);

export const POPULAR_CHENNAI_DESTINATIONS: DestinationPoint[] = [
    {
        id: 'tidel_park',
        name: 'Tidel Park, Taramani',
        landmark: 'IT Corridor · Taramani',
        latitude: 12.9890,
        longitude: 80.2483,
    },
    {
        id: 'dlf_cybercity',
        name: 'DLF Cybercity, Manapakkam',
        landmark: 'Mount Poonamallee Rd · IT Hub',
        latitude: 13.0180,
        longitude: 80.1650,
    },
    {
        id: 'iit_madras',
        name: 'IIT Madras, Adyar',
        landmark: 'Sardar Patel Road · Campus',
        latitude: 12.9915,
        longitude: 80.2337,
    },
    {
        id: 'olympia_tech_park',
        name: 'Olympia Tech Park, Guindy',
        landmark: 'Inner Ring Rd · Guindy',
        latitude: 13.0135,
        longitude: 80.2075,
    },
    {
        id: 'ascendas_omr',
        name: 'Ascendas IT Park, Taramani',
        landmark: 'CSIR Road · Taramani',
        latitude: 12.9860,
        longitude: 80.2430,
    },
    {
        id: 'sipcot_siruseri',
        name: 'SIPCOT IT Park, Siruseri',
        landmark: 'OMR South · IT Special Economic Zone',
        latitude: 12.8250,
        longitude: 80.2180,
    },
];

export const BUDGET_PRESETS: (BudgetRange & { id: string })[] = [
    { id: 'under_8k', label: '< ₹8,000', min: 4000, max: 8000 },
    { id: '8k_12k', label: '₹8,000 – ₹12,000', min: 8000, max: 12000 },
    { id: '12k_18k', label: '₹12,000 – ₹18,000', min: 12000, max: 18000 },
    { id: '18k_25k', label: '₹18,000 – ₹25,000', min: 18000, max: 25000 },
    { id: '25k_plus', label: '₹25,000+', min: 25000, max: 60000 },
];

/**
 * Estimates commute distance, travel duration, and mode tag
 */
export function estimateCommute(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    mode: CommuteMode,
    localityIntelligence?: any
): CommuteEstimate {
    const straightKm = Math.max(0.2, haversineMeters(origin, destination) / 1000);
    // Indian metro road factor: ~1.32x straight line
    const roadKm = Number((straightKm * 1.32).toFixed(1));

    let travelMinutes = 15;
    let modeTag = 'Transit';
    let modeDescription = 'Transit';

    switch (mode) {
        case 'walk': {
            travelMinutes = Math.round((roadKm / 4.5) * 60);
            modeTag = 'Walk';
            modeDescription = `${roadKm} km walk`;
            break;
        }
        case 'two_wheeler': {
            travelMinutes = Math.round((roadKm / 26) * 60 + 3);
            modeTag = 'Two wheeler';
            modeDescription = `${roadKm} km drive`;
            break;
        }
        case 'car': {
            travelMinutes = Math.round((roadKm / 19) * 60 + 6);
            modeTag = 'Car / Cab';
            modeDescription = `${roadKm} km drive`;
            break;
        }
        case 'metro': {
            const metroDistM = localityIntelligence?.domains?.transport?.metrics?.nearestMetroDistanceM?.value;
            const hasNearbyMetro = typeof metroDistM === 'number' && metroDistM <= 2500;
            if (hasNearbyMetro && roadKm >= 3) {
                travelMinutes = Math.round(7 + (roadKm / 32) * 60 + 4);
                modeTag = roadKm > 8 ? 'Metro + bus' : 'Metro';
                modeDescription = `${modeTag} · ~${travelMinutes} min`;
            } else {
                travelMinutes = Math.round((roadKm / 17) * 60 + 7);
                modeTag = 'Bus';
                modeDescription = `Bus route · ~${travelMinutes} min`;
            }
            break;
        }
        case 'bus': {
            travelMinutes = Math.round((roadKm / 16) * 60 + 7);
            modeTag = 'Bus';
            modeDescription = `Bus route · ~${travelMinutes} min`;
            break;
        }
        case 'transit':
        default: {
            const metroDistM = localityIntelligence?.domains?.transport?.metrics?.nearestMetroDistanceM?.value;
            const hasNearbyMetro = typeof metroDistM === 'number' && metroDistM <= 2500;
            if (roadKm <= 1.5) {
                travelMinutes = Math.round((roadKm / 4.5) * 60);
                modeTag = 'Walk';
            } else if (hasNearbyMetro && roadKm >= 4) {
                travelMinutes = Math.round(6 + (roadKm / 32) * 60 + 4);
                modeTag = roadKm > 6 ? 'Metro + bus' : 'Metro';
            } else {
                travelMinutes = Math.round((roadKm / 17) * 60 + 6);
                modeTag = roadKm > 10 ? 'Metro + bus' : 'Bus';
            }
            modeDescription = `${modeTag} · ~${travelMinutes} min`;
            break;
        }
    }

    return {
        distanceKm: roadKm,
        travelMinutes: Math.max(5, travelMinutes),
        modeTag,
        modeDescription,
    };
}

/**
 * Formats Indian rent amounts to clean display (e.g. 9500 -> "₹9.5K", 12000 -> "₹12K")
 */
export function formatTypicalRent(amount?: number | null): string | null {
    if (!amount || amount <= 0) return null;
    if (amount >= 100000) {
        return `₹${(amount / 100000).toFixed(1).replace(/\.0$/, '')}L`;
    }
    if (amount >= 1000) {
        return `₹${(amount / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return `₹${amount}`;
}

/**
 * Fallback typical monthly rent for single rooms / beds in key localities
 */
const LOCALITY_RENT_BASELINES: Record<string, number> = {
    adyar: 9500,
    velachery: 8200,
    omr: 7500,
    thiruvanmiyur: 9800,
    guindy: 8800,
    mylapore: 10500,
    taramani: 8500,
    porur: 7200,
    'anna nagar': 11500,
    'besant nagar': 12500,
    'hsr layout': 14000,
    koramangala: 16000,
    indiranagar: 17500,
    whitefield: 11000,
};

export function extractTypicalRent(locality: LocalityCandidate): number | null {
    const rawMedian = locality.intelligence?.domains?.market?.metrics?.medianRent?.value;
    if (typeof rawMedian === 'number' && rawMedian > 2000 && rawMedian < 200000) {
        // Median rent for an entire unit is scaled down to private room / bed typical rent (~35-40%)
        return Math.round((rawMedian * 0.38) / 100) * 100;
    }
    const key = locality.name.toLowerCase().trim();
    if (LOCALITY_RENT_BASELINES[key]) {
        return LOCALITY_RENT_BASELINES[key];
    }
    return null;
}

/**
 * Evaluates budget affinity score (0-100)
 */
export function computeBudgetScore(typicalRent: number | null, budget: BudgetRange): { score: number | null; inBudget: boolean | null } {
    if (typicalRent == null || !budget) {
        return { score: null, inBudget: null };
    }
    if (typicalRent >= budget.min && typicalRent <= budget.max) {
        return { score: 100, inBudget: true };
    }
    if (typicalRent < budget.min) {
        // Below minimum budget is even better for tenant
        const savingsRatio = (budget.min - typicalRent) / budget.min;
        return { score: Math.round(95 + Math.min(5, savingsRatio * 5)), inBudget: true };
    }
    // Above maximum budget: penalize smoothly
    const overageRatio = (typicalRent - budget.max) / budget.max;
    const penalized = Math.max(20, Math.round(100 - (overageRatio * 140)));
    return { score: penalized, inBudget: false };
}

/**
 * Evaluates commute duration score (0-100)
 */
export function computeCommuteScore(travelMinutes: number): number {
    if (travelMinutes <= 15) return 100;
    if (travelMinutes <= 30) {
        return Math.round(100 - (travelMinutes - 15) * 1.4);
    }
    if (travelMinutes <= 45) {
        return Math.round(79 - (travelMinutes - 30) * 1.3);
    }
    if (travelMinutes <= 60) {
        return Math.round(59 - (travelMinutes - 45) * 1.2);
    }
    return Math.max(15, Math.round(41 - (travelMinutes - 60) * 0.6));
}

/**
 * Maps the user's selected area criteria to Area Score dimension weights.
 * Used only for the objective Croww Area Score calculation pathway.
 * Do not use to compute Personal Match.
 */
export function buildPriorityWeights(priorities: AreaPriorityId[]): Record<ScoreDimensionId, number> {
    const weights: Record<ScoreDimensionId, number> = { ...DEFAULT_AREA_SCORE_WEIGHTS };
    priorities.forEach((priority) => {
        switch (priority) {
            case 'cost_of_living':
                weights.affordability = (weights.affordability || 20) + 35;
                break;
            case 'flood':
                weights.flood = (weights.flood || 10) + 30;
                break;
            case 'public_transport':
                weights.transport = (weights.transport || 16) + 25;
                weights.connectivity = (weights.connectivity || 10) + 15;
                break;
            case 'connectivity':
                weights.connectivity = (weights.connectivity || 10) + 30;
                break;
            case 'healthcare':
                weights.healthcare = (weights.healthcare || 12) + 30;
                break;
            case 'education':
                weights.schools = (weights.schools || 14) + 25;
                break;
            case 'safety':
                weights.flood = (weights.flood || 10) + 15;
                weights.connectivity = (weights.connectivity || 10) + 10;
                break;
            // traffic, pollution, groundwater — no direct score dimension; have no effect on weights
        }
    });
    return weights;
}

/**
 * Extracts a published criteria score (0-100) for a given criterion from the locality.
 * Returns null when unavailable — never fabricates a score.
 */
export function extractCriterionScore(locality: LocalityCandidate, criterionId: AreaPriorityId): number | null {
    const rawCriteria = (locality as any).publishedScore?.criteriaScores
        ?? locality.intelligence?.areaScore?.criteriaScores
        ?? (locality as any).scoring?.criteria
        ?? null;
    if (!rawCriteria) return null;
    const value = rawCriteria[criterionId];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.min(100, Math.max(0, Math.round(value)));
    }
    return null;
}

/**
 * Computes the Personal Match breakdown for a single locality.
 *
 * Weights:
 *   - Commute: 40%
 *   - Budget: 30% (skipped if data unavailable)
 *   - Priority criteria average: 30%
 *
 * When budget or priority criteria are unavailable the remaining weights
 * are proportionally renormalized. This ensures the composite always reflects
 * whatever signal is available without inventing data.
 *
 * The resulting score is NEVER stored on any public document.
 */
export function computePersonalMatch({
    commuteScore,
    budgetScore,
    priorityScores,
    travelMinutes,
    inBudget,
}: {
    commuteScore: number;
    budgetScore: number | null;
    priorityScores: { criterionId: AreaPriorityId; score: number | null }[];
    travelMinutes: number;
    inBudget: boolean | null;
}): PersonalMatchBreakdown {
    const budgetUnavailable = budgetScore == null;

    // Average of available priority criterion scores
    const availablePriorityScores = priorityScores.filter((ps) => ps.score != null);
    const priorityAvg = availablePriorityScores.length > 0
        ? availablePriorityScores.reduce((sum, ps) => sum + (ps.score as number), 0) / availablePriorityScores.length
        : null;
    const priorityUnavailable = priorityAvg == null;

    // Base weights
    let wCommute = 0.40;
    let wBudget = 0.30;
    let wPriority = 0.30;

    // Renormalize for unavailable signals
    if (budgetUnavailable && priorityUnavailable) {
        wCommute = 1.0; wBudget = 0; wPriority = 0;
    } else if (budgetUnavailable) {
        // Split budget's 30% equally to commute and priority
        wCommute = 0.55; wBudget = 0; wPriority = 0.45;
    } else if (priorityUnavailable) {
        wCommute = 0.57; wBudget = 0.43; wPriority = 0;
    }

    let composite = commuteScore * wCommute;
    if (!budgetUnavailable) composite += (budgetScore as number) * wBudget;
    if (!priorityUnavailable) composite += (priorityAvg as number) * wPriority;

    return {
        commuteScore,
        budgetScore,
        priorityScores,
        composite: Math.min(99, Math.max(30, Math.round(composite))),
        travelMinutes,
        inBudget,
        commuteUnavailable: false,
        budgetUnavailable,
    };
}

/**
 * Matches and ranks localities against the destination, budget, commute, and priorities.
 * Returns both the objective Croww Area Score and a personal Personal Match score.
 * These two scores are kept strictly separate.
 */
export function matchLocalities(
    input: LocalityMatchInput,
    localities: LocalityCandidate[]
): LocalityMatchResult[] {
    // Support both topPriorities (new) and priorities (deprecated)
    const topPriorities: AreaPriorityId[] = input.topPriorities ?? input.priorities ?? [];
    const { destination, budget, commuteMode, maxTravelMinutes, city = 'Chennai' } = input;
    const destCoord: GeoCoordinate = {
        latitude: destination.latitude,
        longitude: destination.longitude,
    };

    const scored = localities.map((locality) => {
        const originCoord: GeoCoordinate = {
            latitude: locality.latitude,
            longitude: locality.longitude,
        };

        const commute = estimateCommute(originCoord, destCoord, commuteMode, locality.intelligence);
        const typicalRent = extractTypicalRent(locality);
        const { score: budgetScore, inBudget } = computeBudgetScore(typicalRent, budget);
        const commuteScore = computeCommuteScore(commute.travelMinutes);

        // Objective Croww Area Score — from published admin score only, never from Personal Match
        const publishedAdminScore = (locality as any).publishedScore?.overallScore
            ?? locality.intelligence?.areaScore?.score
            ?? locality.intelligence?.publishedScore
            ?? null;

        const areaScore: number | null = typeof publishedAdminScore === 'number'
            ? Math.min(100, Math.max(0, Math.round(publishedAdminScore)))
            : null;

        // Personal Match — computed from commute + budget + user's 3 selected priority criteria
        const priorityScores: { criterionId: AreaPriorityId; score: number | null }[] = topPriorities.map(
            (criterionId) => ({
                criterionId,
                score: extractCriterionScore(locality, criterionId),
            })
        );

        const personalMatchBreakdown = computePersonalMatch({
            commuteScore,
            budgetScore,
            priorityScores,
            travelMinutes: commute.travelMinutes,
            inBudget,
        });
        const matchScore = personalMatchBreakdown.composite;

        // Deterministic highlights — driven only by specific criteria/commute signals, never from scores
        const highlights: string[] = [];
        if (inBudget === true) highlights.push('In budget');
        if (commute.travelMinutes <= 30) highlights.push('Quick commute');
        if (commute.travelMinutes <= (maxTravelMinutes ?? Infinity)) {
            // No extra tag — within user's max is baseline
        } else if (maxTravelMinutes != null) {
            highlights.push(`>${maxTravelMinutes} min commute`);
        }
        if (commute.modeTag.includes('Metro')) highlights.push('Metro connected');

        const rawCriteria = (locality as any).publishedScore?.criteriaScores
            ?? locality.intelligence?.areaScore?.criteriaScores
            ?? (locality as any).scoring?.criteria;
        if (rawCriteria) {
            if (rawCriteria.connectivity >= 75) highlights.push('Good Connectivity');
            if (rawCriteria.healthcare >= 75) highlights.push('Healthcare Access');
            if (rawCriteria.safety >= 75) highlights.push('High Safety');
            if (rawCriteria.flood >= 75) highlights.push('Flood Resilient');
            if (rawCriteria.cost_of_living >= 75) highlights.push('Lower Cost of Living');
        }

        return {
            localityId: locality.id,
            localityName: locality.name,
            city: locality.city,
            areaScore,
            matchScore,
            personalMatchBreakdown,
            typicalRent,
            typicalRentFormatted: formatTypicalRent(typicalRent),
            inBudget,
            commute,
            highlights,
            latitude: locality.latitude,
            longitude: locality.longitude,
            boundaries: locality.boundaries || null,
            intelligence: locality.intelligence || null,
            staysCount: locality.stats?.activeListingCount ?? locality.staysCount ?? null,
        };
    });

    // Sort descending by Personal Match score
    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored;
}
