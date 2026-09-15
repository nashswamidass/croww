import { SCORE_DIMENSION_LABELS } from './constants.ts';
import type { ExtractedDimension } from './extract.ts';
import type { DimensionEvalStatus, ScoreDimensionId } from './types.ts';

export function evidenceSummary(extracted: ExtractedDimension, status: DimensionEvalStatus): string {
    const label = SCORE_DIMENSION_LABELS[extracted.id];
    if (status === 'INSUFFICIENT_SAMPLE') {
        const n = extracted.sampleSize;
        return n != null
            ? `${label}: Croww sample is too small for a median (${n} listing${n === 1 ? '' : 's'}). Not scored.`
            : `${label}: sample is below the median threshold. Not scored.`;
    }
    if (status === 'UNAVAILABLE') {
        if (extracted.id === 'flood') {
            return 'Flood data is not available. UNKNOWN is not treated as low risk.';
        }
        if (extracted.id === 'airport') {
            return 'Airport distance is unavailable. Straight-line travel time is never inferred.';
        }
        if (extracted.id === 'transport') {
            return 'Metro / public-transport data unavailable.';
        }
        if (extracted.id === 'marketFit') {
            return 'No Croww published-listing count for this area.';
        }
        return `${label}: data unavailable.`;
    }
    if (extracted.id === 'affordability') {
        return 'Relative to the city reference price range (product heuristic, not a percentile of all homes).';
    }
    if (extracted.id === 'transport') {
        return 'Based on sourced metro distance / station count. Not travel time.';
    }
    if (extracted.id === 'schools') {
        return 'Based on nearby school count and/or nearest-school distance. Quality is not ranked.';
    }
    if (extracted.id === 'healthcare') {
        return 'Based on nearby hospital count and/or nearest-hospital distance. Quality is not ranked.';
    }
    if (extracted.id === 'airport') {
        return 'Straight-line distance to a sourced airport point. Not travel time or traffic.';
    }
    if (extracted.id === 'connectivity') {
        return 'Based on sourced major-road distance. Separate from metro.';
    }
    if (extracted.id === 'flood') {
        return `Flood class ${extracted.floodClass}. UNKNOWN would not be scored.`;
    }
    return 'Croww published listing count in this locality. Volume is not “a good area.”';
}

export function overallNotes(input: {
    scoreStatus: string;
    coverage: number;
    staleIds: ScoreDimensionId[];
    unavailableIds: ScoreDimensionId[];
    city: string | null;
    hasConfig: boolean;
}): string[] {
    const notes: string[] = [];
    notes.push('Croww Area Score is personalized for your priorities. It is not a fixed locality rating.');
    if (!input.hasConfig) {
        notes.push(input.city
            ? `No Area Score thresholds are configured for ${input.city}. Chennai ranges are not reused.`
            : 'No city is set, so Area Score thresholds cannot be applied.');
        return notes;
    }
    if (input.scoreStatus === 'UNAVAILABLE') {
        notes.push('Not enough sourced evidence to compute a score. Missing data is not treated as average or favorable.');
    }
    if (input.scoreStatus === 'INSUFFICIENT_EVIDENCE') {
        notes.push(`Coverage is ${(input.coverage * 100).toFixed(0)}%. A numeric score is hidden until enough weighted evidence is available.`);
    }
    if (input.scoreStatus === 'ZERO_WEIGHTS') {
        notes.push('All priorities are set to zero, so nothing can be scored.');
    }
    if (input.staleIds.length) {
        notes.push(`Stale evidence included: ${input.staleIds.join(', ')}. Confidence is reduced.`);
    }
    if (input.unavailableIds.includes('flood')) {
        notes.push('Flood evidence is unknown or missing and is not scored as low risk.');
    }
    notes.push('Default priority weights are a product heuristic, not an objectively correct profile.');
    return notes;
}
