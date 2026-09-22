import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BORDER_RADIUS, COLORS, SHADOWS } from '../../constants/theme';
import { formatAreaScore } from '../../domain/scoring/formatAreaScore';

/**
 * Editorial map annotation label for localities.
 *
 * Implements a minimalist map label:
 * - Transparent / crisp white background with a thin charcoal border
 * - Dark text: e.g. "ADYAR · 88"
 * - Subtle optional relevance dot indicator
 * - Zero purple fill, zero colored bubbles, zero glow/gradients
 * - Safe on Android Maps without shadow box artifacts
 */
export default function LocalityScoreBubble({
    name,
    score,
    selected = false,
    onPress,
    variant = 'card', // 'card' | 'marker'
    size = 'regular', // 'compact' | 'regular' | 'large'
    relevanceColor = null,
}) {
    const isMarker = variant === 'marker';
    const isLarge = size === 'large';
    const isCompact = size === 'compact';

    const displayName = (name || '').toUpperCase();
    const formattedScore = formatAreaScore(score);

    return (
        <TouchableOpacity
            activeOpacity={onPress ? 0.85 : 1}
            onPress={onPress}
            disabled={!onPress}
            style={[
                styles.annotation,
                isMarker ? styles.markerAnnotation : styles.cardAnnotation,
                selected && styles.annotationSelected,
                isLarge && styles.annotationLarge,
                isCompact && styles.annotationCompact,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${name}, Area Score ${formattedScore || ''}`}
        >
            {/* Subtle relevance accent dot */}
            {relevanceColor ? (
                <View style={[styles.relevanceDot, { backgroundColor: relevanceColor }]} />
            ) : null}

            <Text
                style={[
                    styles.nameText,
                    selected && styles.nameTextSelected,
                ]}
                numberOfLines={1}
            >
                {displayName}
            </Text>

            {formattedScore != null ? (
                <>
                    <Text style={styles.dotSeparator}>·</Text>
                    <Text
                        style={[
                            styles.scoreText,
                            selected && styles.scoreTextSelected,
                        ]}
                    >
                        {formattedScore}
                    </Text>
                </>
            ) : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    annotation: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1.2,
        borderColor: '#222222',
        paddingVertical: 4.5,
        paddingHorizontal: 9,
    },
    // Map markers must not have elevation/shadow on Android to avoid black/grey box artifacts
    markerAnnotation: {
        elevation: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        borderColor: '#1F1F1F',
    },
    // Carousel cards use subtle soft shadow
    cardAnnotation: {
        borderColor: 'rgba(0, 0, 0, 0.14)',
        ...SHADOWS.soft,
    },
    annotationCompact: {
        paddingVertical: 3.5,
        paddingHorizontal: 7,
    },
    annotationLarge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    annotationSelected: {
        borderColor: '#111827',
        borderWidth: 2,
        backgroundColor: '#FFFFFF',
    },
    relevanceDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },
    nameText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.4,
    },
    nameTextSelected: {
        fontWeight: '800',
        color: '#000000',
    },
    dotSeparator: {
        fontSize: 12,
        fontWeight: '700',
        color: '#9CA3AF',
        marginHorizontal: 3.5,
    },
    scoreText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.2,
    },
    scoreTextSelected: {
        color: '#000000',
    },
});
