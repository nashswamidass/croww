import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BORDER_RADIUS, COLORS, SHADOWS } from '../../constants/theme';

/**
 * Clean, single rounded score bubble representing an analyzed locality.
 *
 * Designed to eliminate Android Google Maps marker rectangular shadow artifacts:
 * - When used as a map marker (variant="marker"), disables elevation/shadows
 *   which otherwise cause Android Maps SDK to render a gray square bitmap bounding box.
 * - When used in floating carousels (variant="card"), applies a single, subtle
 *   cross-platform shadow to the outermost pill container without nested shadow layers.
 */
export default function LocalityScoreBubble({
    name,
    score,
    selected = false,
    onPress,
    variant = 'card', // 'card' | 'marker'
    size = 'regular', // 'compact' | 'regular' | 'large'
}) {
    const isMarker = variant === 'marker';
    const isLarge = size === 'large';
    const isCompact = size === 'compact';

    return (
        <TouchableOpacity
            activeOpacity={onPress ? 0.85 : 1}
            onPress={onPress}
            disabled={!onPress}
            style={[
                styles.bubble,
                isMarker ? styles.markerBubble : styles.cardBubble,
                selected && styles.bubbleSelected,
                isLarge && styles.bubbleLarge,
                isCompact && styles.bubbleCompact,
            ]}
        >
            <View style={[styles.scoreBadge, selected && styles.scoreBadgeSelected]}>
                <Text style={[styles.scoreText, selected && styles.scoreTextSelected]}>
                    {Math.round(score)}
                </Text>
            </View>
            <Text
                style={[styles.nameText, selected && styles.nameTextSelected]}
                numberOfLines={1}
            >
                {name}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    bubble: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        paddingVertical: 5,
        paddingHorizontal: 9,
    },
    // Map markers must NOT use elevation or shadows to avoid Android Maps bitmap box artifacts
    markerBubble: {
        elevation: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        borderColor: 'rgba(0, 0, 0, 0.12)',
    },
    // In-carousel card uses single soft shadow on the pill surface
    cardBubble: {
        ...SHADOWS.soft,
    },
    bubbleCompact: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    bubbleLarge: {
        paddingVertical: 7,
        paddingHorizontal: 12,
    },
    bubbleSelected: {
        borderColor: COLORS.accent,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
    },
    scoreBadge: {
        backgroundColor: COLORS.accentMuted,
        borderRadius: BORDER_RADIUS.pill,
        paddingHorizontal: 7,
        paddingVertical: 2,
        marginRight: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreBadgeSelected: {
        backgroundColor: COLORS.accent,
    },
    scoreText: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.accent,
        letterSpacing: -0.2,
    },
    scoreTextSelected: {
        color: '#FFFFFF',
    },
    nameText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primary,
        maxWidth: 110,
    },
    nameTextSelected: {
        color: COLORS.accent,
    },
});
