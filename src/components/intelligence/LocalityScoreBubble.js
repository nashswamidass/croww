import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';

/**
 * Floating purple score bubble representing an analyzed locality.
 * Matches reference styling: high-contrast dark/purple pill with numeric score.
 */
export default function LocalityScoreBubble({
    name,
    score,
    selected = false,
    onPress,
    size = 'regular', // 'compact' | 'regular' | 'large'
}) {
    const isLarge = size === 'large';
    const isCompact = size === 'compact';

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={[
                styles.bubble,
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
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        ...SHADOWS.floating,
    },
    bubbleCompact: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 18,
    },
    bubbleLarge: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 28,
    },
    bubbleSelected: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.accent,
        borderWidth: 2,
        transform: [{ scale: 1.05 }],
    },
    scoreBadge: {
        backgroundColor: COLORS.accentMuted,
        borderRadius: 14,
        paddingHorizontal: 7,
        paddingVertical: 3,
        marginRight: 6,
    },
    scoreBadgeSelected: {
        backgroundColor: COLORS.accent,
    },
    scoreText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.accent,
        letterSpacing: -0.2,
    },
    scoreTextSelected: {
        color: '#FFFFFF',
    },
    nameText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
        maxWidth: 120,
    },
    nameTextSelected: {
        color: COLORS.accent,
        fontWeight: '700',
    },
});
