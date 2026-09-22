/**
 * Locality Visual Relevance & Dynamic Boundary Colors (Runtime JS)
 */

export const RELEVANCE_TIERS = {
    STRONG_MATCH: 'STRONG_MATCH',
    GOOD_MATCH: 'GOOD_MATCH',
    POSSIBLE_MATCH: 'POSSIBLE_MATCH',
    NEUTRAL: 'NEUTRAL',
};

export const RELEVANCE_CONFIG = {
    STRONG_MATCH: {
        id: 'STRONG_MATCH',
        label: 'Strong match',
        dotColor: '#10B981', // Emerald 500
        strokeColor: '#059669', // Emerald 600
        strokeColorSelected: '#059669',
        strokeColorSubdued: 'rgba(5, 150, 105, 0.40)',
        strokeWidth: 2.0,
        strokeWidthSelected: 3.0,
        strokeWidthSubdued: 1.4,
        fillColor: 'transparent',
        fillColorSelected: 'transparent',
        fillColorSubdued: 'transparent',
        strokeOpacity: 0.85,
        strokeOpacitySelected: 1.0,
        strokeOpacitySubdued: 0.40,
        fillOpacity: 0.0,
        fillOpacitySelected: 0.0,
        fillOpacitySubdued: 0.0,
    },
    GOOD_MATCH: {
        id: 'GOOD_MATCH',
        label: 'Good match',
        dotColor: '#F59E0B', // Amber 500
        strokeColor: '#D97706', // Amber 600
        strokeColorSelected: '#D97706',
        strokeColorSubdued: 'rgba(217, 119, 6, 0.40)',
        strokeWidth: 1.8,
        strokeWidthSelected: 2.8,
        strokeWidthSubdued: 1.2,
        fillColor: 'transparent',
        fillColorSelected: 'transparent',
        fillColorSubdued: 'transparent',
        strokeOpacity: 0.80,
        strokeOpacitySelected: 1.0,
        strokeOpacitySubdued: 0.40,
        fillOpacity: 0.0,
        fillOpacitySelected: 0.0,
        fillOpacitySubdued: 0.0,
    },
    POSSIBLE_MATCH: {
        id: 'POSSIBLE_MATCH',
        label: 'Possible match',
        dotColor: '#EAB308', // Yellow 500
        strokeColor: '#CA8A04', // Yellow 600
        strokeColorSelected: '#CA8A04',
        strokeColorSubdued: 'rgba(202, 138, 4, 0.35)',
        strokeWidth: 1.5,
        strokeWidthSelected: 2.5,
        strokeWidthSubdued: 1.1,
        fillColor: 'transparent',
        fillColorSelected: 'transparent',
        fillColorSubdued: 'transparent',
        strokeOpacity: 0.75,
        strokeOpacitySelected: 0.95,
        strokeOpacitySubdued: 0.35,
        fillOpacity: 0.0,
        fillOpacitySelected: 0.0,
        fillOpacitySubdued: 0.0,
    },
    NEUTRAL: {
        id: 'NEUTRAL',
        label: 'Low relevance / Limited data',
        dotColor: '#64748B', // Slate 500
        strokeColor: '#1F1F1F', // Charcoal outline per spec: #1F1F1F / #222222
        strokeColorSelected: '#111827',
        strokeColorSubdued: 'rgba(31, 31, 31, 0.35)',
        strokeWidth: 1.4,
        strokeWidthSelected: 2.6,
        strokeWidthSubdued: 1.0,
        fillColor: 'transparent',
        fillColorSelected: 'transparent',
        fillColorSubdued: 'transparent',
        strokeOpacity: 0.60,
        strokeOpacitySelected: 0.90,
        strokeOpacitySubdued: 0.25,
        fillOpacity: 0.0,
        fillOpacitySelected: 0.0,
        fillOpacitySubdued: 0.0,
    },
};

/**
 * Computes the data-driven visual relevance tier.
 */
export function computeLocalityRelevanceTier(item) {
    if (!item) return 'NEUTRAL';

    if (item.relevanceLevel && RELEVANCE_CONFIG[item.relevanceLevel]) {
        return item.relevanceLevel;
    }
    if (item.locality?.relevanceLevel && RELEVANCE_CONFIG[item.locality.relevanceLevel]) {
        return item.locality.relevanceLevel;
    }

    const effectiveScore = typeof item.score === 'number'
        ? item.score
        : (typeof item.result?.score === 'number' ? item.result.score : null);

    if (effectiveScore == null || isNaN(effectiveScore)) {
        return 'NEUTRAL';
    }

    const confidence = item.confidence || item.result?.confidence || item.locality?.confidence;
    const status = item.status || item.result?.scoreStatus || item.result?.status || item.locality?.status;
    const coverage = item.coverage ?? item.result?.coverage ?? item.locality?.coverage ?? 1.0;

    // Gate missing or insufficient evidence to NEUTRAL (Section 24)
    if (
        status === 'INSUFFICIENT_EVIDENCE' ||
        status === 'UNAVAILABLE' ||
        confidence === 'INSUFFICIENT' ||
        confidence === 'UNKNOWN' ||
        coverage < 0.35
    ) {
        return 'NEUTRAL';
    }

    // Low confidence caps the maximum tier
    if (confidence === 'LOW' && effectiveScore >= 85) {
        return 'GOOD_MATCH';
    }

    if (effectiveScore >= 85) {
        return 'STRONG_MATCH';
    }
    if (effectiveScore >= 70) {
        return 'GOOD_MATCH';
    }
    if (effectiveScore >= 55) {
        return 'POSSIBLE_MATCH';
    }

    return 'NEUTRAL';
}

/**
 * Returns rendering styles for a locality boundary on Android and Web.
 */
export function getLocalityPolygonStyle(item, isSelected = false, anySelected = false) {
    const tier = computeLocalityRelevanceTier(item);
    const config = RELEVANCE_CONFIG[tier] || RELEVANCE_CONFIG.NEUTRAL;

    if (isSelected) {
        return {
            tier,
            label: config.label,
            strokeColor: config.strokeColorSelected,
            strokeWidth: config.strokeWidthSelected,
            strokeOpacity: config.strokeOpacitySelected,
            fillColor: config.fillColorSelected,
            fillOpacity: config.fillOpacitySelected,
            zIndex: 12,
            dotColor: config.dotColor,
        };
    }

    if (anySelected) {
        return {
            tier,
            label: config.label,
            strokeColor: config.strokeColorSubdued,
            strokeWidth: config.strokeWidthSubdued,
            strokeOpacity: config.strokeOpacitySubdued,
            fillColor: config.fillColorSubdued,
            fillOpacity: config.fillOpacitySubdued,
            zIndex: 1,
            dotColor: config.dotColor,
        };
    }

    const baseZIndex = tier === 'STRONG_MATCH' ? 4 : tier === 'GOOD_MATCH' ? 3 : tier === 'POSSIBLE_MATCH' ? 2 : 1;

    return {
        tier,
        label: config.label,
        strokeColor: config.strokeColor,
        strokeWidth: config.strokeWidth,
        strokeOpacity: config.strokeOpacity,
        fillColor: config.fillColor,
        fillOpacity: config.fillOpacity,
        zIndex: baseZIndex,
        dotColor: config.dotColor,
    };
}
