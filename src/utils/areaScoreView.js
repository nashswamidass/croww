import { SCORE_DIMENSION_LABELS } from '../domain/areaScore/constants.ts';

function coverageLabel(coverage) {
    const pct = Math.round((coverage || 0) * 100);
    return `${pct}% of your weighted priorities had evidence`;
}

function confidenceLabel(confidence) {
    if (confidence === 'HIGH') return 'High confidence';
    if (confidence === 'MEDIUM') return 'Medium confidence';
    if (confidence === 'LOW') return 'Low confidence';
    return 'Confidence unknown';
}

function statusHeadline(result) {
    if (result.scoreStatus === 'LIMITED_CONFIG') {
        return 'Area Score unavailable for this city';
    }
    if (result.scoreStatus === 'ZERO_WEIGHTS') {
        return 'Set at least one priority to see a score';
    }
    if (result.scoreStatus === 'UNAVAILABLE') {
        return 'Area Score unavailable';
    }
    if (result.scoreStatus === 'INSUFFICIENT_EVIDENCE') {
        return 'Not enough evidence yet';
    }
    return null;
}

function dimensionStatusText(dim) {
    if (dim.status === 'UNAVAILABLE') return 'Data unavailable';
    if (dim.status === 'INSUFFICIENT_SAMPLE') return 'Insufficient sample';
    if (dim.status === 'STALE') return 'May be out of date';
    if (dim.status === 'ZERO_WEIGHT') return 'Not a current priority';
    return null;
}

/**
 * Presentation only. Does not recompute the score.
 */
export function buildAreaScoreViewModel(result) {
    if (!result) {
        return {
            showNumeric: false,
            headline: 'Area Score unavailable',
            personalization: 'For your priorities',
            coverageText: coverageLabel(0),
            confidenceText: confidenceLabel('UNKNOWN'),
            notes: [],
            dimensions: [],
        };
    }
    const showNumeric = result.scoreStatus === 'AVAILABLE' && result.overallScore != null;
    return {
        showNumeric,
        score: result.overallScore,
        headline: statusHeadline(result),
        personalization: result.usedDefaultWeights
            ? 'For default priorities (product heuristic)'
            : 'For your priorities',
        coverageText: coverageLabel(result.coverage),
        confidenceText: confidenceLabel(result.confidence),
        methodologyVersion: result.methodologyVersion,
        notes: result.notes || [],
        dimensions: (result.dimensions || []).map((dim) => ({
            id: dim.id,
            label: dim.label || SCORE_DIMENSION_LABELS[dim.id],
            status: dim.status,
            statusText: dimensionStatusText(dim),
            scoreText: dim.normalizedScore != null ? `${Math.round(dim.normalizedScore)} / 100` : '—',
            priorityText: `${Math.round((dim.weightShare || 0) * 100)}% priority`,
            contributionText: dim.contribution != null
                ? `Contribution ${dim.contribution.toFixed(1)}`
                : null,
            summary: dim.evidenceSummary,
        })),
    };
}
