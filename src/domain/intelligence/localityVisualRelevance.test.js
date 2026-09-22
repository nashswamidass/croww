import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeLocalityRelevanceTier,
    getLocalityPolygonStyle,
    RELEVANCE_TIERS,
    RELEVANCE_CONFIG,
} from './localityVisualRelevance.js';

describe('Locality Visual Relevance Domain Engine', () => {
    test('1. computes correct relevance tiers based on scores', () => {
        assert.equal(computeLocalityRelevanceTier({ score: 92 }), 'STRONG_MATCH');
        assert.equal(computeLocalityRelevanceTier({ score: 85 }), 'STRONG_MATCH');
        assert.equal(computeLocalityRelevanceTier({ score: 84 }), 'GOOD_MATCH');
        assert.equal(computeLocalityRelevanceTier({ score: 70 }), 'GOOD_MATCH');
        assert.equal(computeLocalityRelevanceTier({ score: 69 }), 'POSSIBLE_MATCH');
        assert.equal(computeLocalityRelevanceTier({ score: 55 }), 'POSSIBLE_MATCH');
        assert.equal(computeLocalityRelevanceTier({ score: 54 }), 'NEUTRAL');
        assert.equal(computeLocalityRelevanceTier({ score: 30 }), 'NEUTRAL');
    });

    test('2. gates missing evidence, low confidence, or low coverage to NEUTRAL', () => {
        // High static score but insufficient evidence status -> NEUTRAL
        assert.equal(
            computeLocalityRelevanceTier({
                score: 95,
                result: { status: 'INSUFFICIENT_EVIDENCE', score: 95 },
            }),
            'NEUTRAL'
        );

        // Unavailable evidence status -> NEUTRAL
        assert.equal(
            computeLocalityRelevanceTier({
                score: 88,
                result: { status: 'UNAVAILABLE', score: 88 },
            }),
            'NEUTRAL'
        );

        // Low coverage (< 0.35) -> NEUTRAL
        assert.equal(
            computeLocalityRelevanceTier({
                score: 90,
                result: { coverage: 0.2, score: 90 },
            }),
            'NEUTRAL'
        );

        // Insufficient confidence -> NEUTRAL
        assert.equal(
            computeLocalityRelevanceTier({
                score: 89,
                confidence: 'INSUFFICIENT',
            }),
            'NEUTRAL'
        );

        // Null / undefined score -> NEUTRAL
        assert.equal(computeLocalityRelevanceTier(null), 'NEUTRAL');
        assert.equal(computeLocalityRelevanceTier({ score: null }), 'NEUTRAL');
    });

    test('3. caps tier at GOOD_MATCH when confidence is LOW even if score is high', () => {
        assert.equal(
            computeLocalityRelevanceTier({
                score: 92,
                confidence: 'LOW',
            }),
            'GOOD_MATCH'
        );
    });

    test('4. produces distinct, high-contrast visual styles for all tiers', () => {
        const strongStyle = getLocalityPolygonStyle({ score: 90 });
        assert.equal(strongStyle.tier, 'STRONG_MATCH');
        assert.equal(strongStyle.strokeColor, '#059669'); // Emerald 600
        assert.ok(strongStyle.strokeWidth >= 2.0);
        assert.equal(strongStyle.fillColor, 'transparent');
        assert.equal(strongStyle.fillOpacity, 0.0);

        const goodStyle = getLocalityPolygonStyle({ score: 75 });
        assert.equal(goodStyle.tier, 'GOOD_MATCH');
        assert.equal(goodStyle.strokeColor, '#D97706'); // Amber 600
        assert.equal(goodStyle.fillColor, 'transparent');

        const possibleStyle = getLocalityPolygonStyle({ score: 62 });
        assert.equal(possibleStyle.tier, 'POSSIBLE_MATCH');
        assert.equal(possibleStyle.strokeColor, '#CA8A04'); // Yellow 600
        assert.equal(possibleStyle.fillColor, 'transparent');

        const neutralStyle = getLocalityPolygonStyle({ score: 45 });
        assert.equal(neutralStyle.tier, 'NEUTRAL');
        assert.equal(neutralStyle.strokeColor, '#1F1F1F'); // Charcoal 1F1F1F
        assert.equal(neutralStyle.fillColor, 'transparent');
    });

    test('5. enhances selected locality and subdues others while preserving tier colors', () => {
        const strongItem = { score: 90 };
        const goodItem = { score: 75 };

        // Unselected state
        const unselectedStrong = getLocalityPolygonStyle(strongItem, false, false);
        const unselectedGood = getLocalityPolygonStyle(goodItem, false, false);

        // When strongItem is selected:
        const selectedStrong = getLocalityPolygonStyle(strongItem, true, true);
        const subduedGood = getLocalityPolygonStyle(goodItem, false, true);

        // Selected strong has thicker stroke and higher zIndex
        assert.ok(selectedStrong.strokeWidth > unselectedStrong.strokeWidth);
        assert.equal(selectedStrong.zIndex, 12);
        assert.equal(selectedStrong.strokeColor, RELEVANCE_CONFIG.STRONG_MATCH.strokeColorSelected);

        // Subdued good still maintains its amber color family but with lower opacity
        assert.ok(subduedGood.strokeOpacity < unselectedGood.strokeOpacity);
        assert.ok(subduedGood.strokeWidth <= unselectedGood.strokeWidth);
        assert.equal(subduedGood.zIndex, 1);
        assert.equal(subduedGood.strokeColor, RELEVANCE_CONFIG.GOOD_MATCH.strokeColorSubdued);
    });
});
