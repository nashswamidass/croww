/**
 * Commute & Destination-Driven Locality Matcher Domain.
 *
 * Evaluates candidate localities against user's:
 * 1. Destination (office / college / landmark)
 * 2. Budget range (e.g. ₹8,000 - ₹12,000)
 * 3. Commute mode (metro, bus, any public transit, walk, two_wheeler, car)
 * 4. Priority dimensions ("What matters?": low rent, short commute, safety, transit, healthcare, food)
 *
 * Deterministic read-time scoring. Never writes back to public locality records.
 */

import { haversineMeters } from '../property/geo.ts';
import type { GeoCoordinate } from '../property/geo.ts';
import { calculateAreaScore } from './score.ts';
import { DEFAULT_AREA_SCORE_WEIGHTS } from './constants.ts';
import type { ScoreDimensionId } from './types.ts';

export type CommuteMode =
    | 'metro'
    | 'bus'
    | 'transit'
    | 'walk'
    | 'two_wheeler'
    | 'car';

export type MatterPriority =
    | 'low_rent'
    | 'short_commute'
    | 'safety'
    | 'transit'
    | 'healthcare'
    | 'food';

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
    priorities: MatterPriority[];
    city?: string;
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

export type LocalityMatchResult = {
    localityId: string;
    localityName: string;
    city: string;
    matchScore: number;
    typicalRent: number | null;
    typicalRentFormatted: string | null;
    inBudget: boolean | null;
    commute: CommuteEstimate;
    areaScore: number;
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

export const MATTERS_CONFIG: Record<MatterPriority, { label: string; icon: string }> = {
    low_rent: { label: 'Low rent', icon: 'pricetag-outline' },
    short_commute: { label: 'Short commute', icon: 'time-outline' },
    safety: { label: 'Safety', icon: 'shield-checkmark-outline' },
    transit: { label: 'Transit', icon: 'train-outline' },
    healthcare: { label: 'Healthcare', icon: 'medkit-outline' },
    food: { label: 'Food', icon: 'restaurant-outline' },
};

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
 * Builds personalized Area Score weights from user's "What matters?" selections
 */
export function buildPriorityWeights(priorities: MatterPriority[]): Record<ScoreDimensionId, number> {
    const weights: Record<ScoreDimensionId, number> = { ...DEFAULT_AREA_SCORE_WEIGHTS };
    priorities.forEach((priority) => {
        switch (priority) {
            case 'low_rent':
                weights.affordability = (weights.affordability || 20) + 35;
                break;
            case 'safety':
                weights.flood = (weights.flood || 10) + 30;
                break;
            case 'transit':
                weights.transport = (weights.transport || 16) + 25;
                weights.connectivity = (weights.connectivity || 10) + 15;
                break;
            case 'healthcare':
                weights.healthcare = (weights.healthcare || 12) + 30;
                break;
            case 'food':
                weights.marketFit = (weights.marketFit || 8) + 25;
                break;
            case 'short_commute':
                // Handled in composite weights multiplier
                break;
        }
    });
    return weights;
}

/**
 * Matches and ranks localities against the destination, budget, commute, and priorities.
 */
export function matchLocalities(
    input: LocalityMatchInput,
    localities: LocalityCandidate[]
): LocalityMatchResult[] {
    const { destination, budget, commuteMode, priorities, city = 'Chennai' } = input;
    const destCoord: GeoCoordinate = {
        latitude: destination.latitude,
        longitude: destination.longitude,
    };

    const hasShortCommute = priorities.includes('short_commute');
    const hasLowRent = priorities.includes('low_rent');

    const priorityWeights = buildPriorityWeights(priorities);

    const scored = localities.map((locality) => {
        const originCoord: GeoCoordinate = {
            latitude: locality.latitude,
            longitude: locality.longitude,
        };

        const commute = estimateCommute(originCoord, destCoord, commuteMode, locality.intelligence);
        const typicalRent = extractTypicalRent(locality);
        const { score: budgetScore, inBudget } = computeBudgetScore(typicalRent, budget);
        const commuteScore = computeCommuteScore(commute.travelMinutes);

        // Objective Croww Area Score (from published spreadsheet admin score if available)
        const publishedAdminScore = (locality as any).publishedScore?.overallScore
            ?? locality.intelligence?.areaScore?.score
            ?? locality.intelligence?.publishedScore
            ?? null;

        // Personalized Area Score calculation
        const areaScoreRes = calculateAreaScore({
            snapshot: locality.intelligence,
            city,
            weights: priorityWeights,
        });
        const computedPersonalScore = typeof areaScoreRes.overallScore === 'number'
            ? areaScoreRes.overallScore
            : 70;

        const areaScore = typeof publishedAdminScore === 'number'
            ? publishedAdminScore
            : computedPersonalScore;

        // Composite scoring weights
        let wCommute = 0.35;
        let wBudget = 0.35;
        let wArea = 0.30;

        if (hasShortCommute && hasLowRent) {
            wCommute = 0.40;
            wBudget = 0.40;
            wArea = 0.20;
        } else if (hasShortCommute) {
            wCommute = 0.48;
            wBudget = 0.26;
            wArea = 0.26;
        } else if (hasLowRent) {
            wBudget = 0.48;
            wCommute = 0.26;
            wArea = 0.26;
        }

        let sumWeights = 0;
        let weightedSum = 0;
        if (commuteScore != null) {
            weightedSum += commuteScore * wCommute;
            sumWeights += wCommute;
        }
        if (budgetScore != null) {
            weightedSum += budgetScore * wBudget;
            sumWeights += wBudget;
        }
        if (areaScore != null) {
            weightedSum += areaScore * wArea;
            sumWeights += wArea;
        }
        const rawScore = sumWeights > 0 ? weightedSum / sumWeights : (areaScore ?? 70);
        const matchScore = Math.min(99, Math.max(40, Math.round(rawScore)));

        const highlights: string[] = [];
        if (inBudget === true) highlights.push('In budget');
        if (commute.travelMinutes <= 30) highlights.push('Quick commute');
        if (commute.modeTag.includes('Metro')) highlights.push('Metro connected');

        // Deterministic domain criteria triggers (never from overall score)
        const criteria = (locality as any).publishedScore?.criteriaScores
            ?? locality.intelligence?.areaScore?.criteriaScores
            ?? (locality as any).scoring?.criteria;
        if (criteria) {
            if (criteria.connectivity >= 75) highlights.push('Good Connectivity');
            if (criteria.healthcare >= 75) highlights.push('Healthcare Access');
            if (criteria.safety >= 75) highlights.push('High Safety');
            if (criteria.flood >= 75) highlights.push('Flood Resilient');
            if (criteria.cost_of_living >= 75) highlights.push('Lower Cost of Living');
        }

        return {
            localityId: locality.id,
            localityName: locality.name,
            city: locality.city,
            matchScore,
            typicalRent,
            typicalRentFormatted: formatTypicalRent(typicalRent),
            inBudget,
            commute,
            areaScore,
            highlights,
            latitude: locality.latitude,
            longitude: locality.longitude,
            boundaries: locality.boundaries || null,
            intelligence: locality.intelligence || null,
            staysCount: locality.stats?.activeListingCount ?? locality.staysCount ?? null,
        };
    });

    // Sort descending by matchScore
    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored;
}
