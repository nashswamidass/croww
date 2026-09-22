import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS } from '../../constants/theme';
import { RELEVANCE_CONFIG } from '../../domain/intelligence/localityVisualRelevance';

/**
 * Compact, premium map legend explaining the data-driven locality relevance colors.
 * Shows:
 * ● Strong match (Emerald)
 * ● Good match (Amber)
 * ● Possible match (Yellow)
 */
export default function RelevanceLegend({ style, orientation = 'vertical' }) {
    const isVertical = orientation === 'vertical';
    const items = [
        { label: RELEVANCE_CONFIG.STRONG_MATCH.label, color: RELEVANCE_CONFIG.STRONG_MATCH.dotColor },
        { label: RELEVANCE_CONFIG.GOOD_MATCH.label, color: RELEVANCE_CONFIG.GOOD_MATCH.dotColor },
        { label: RELEVANCE_CONFIG.POSSIBLE_MATCH.label, color: RELEVANCE_CONFIG.POSSIBLE_MATCH.dotColor },
    ];

    return (
        <View style={[styles.legendPill, isVertical && styles.legendVertical, style]} pointerEvents="none">
            {items.map((item) => (
                <View key={item.label} style={[styles.legendItem, isVertical && styles.legendItemVertical]}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <Text style={styles.label}>{item.label}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    legendPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderRadius: BORDER_RADIUS.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        alignSelf: 'center',
        ...SHADOWS.soft,
    },
    legendVertical: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        alignSelf: 'flex-end',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 5,
    },
    legendItemVertical: {
        marginHorizontal: 0,
        marginVertical: 2,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    label: {
        fontSize: 10.5,
        fontWeight: '600',
        color: COLORS.primary,
        letterSpacing: -0.1,
    },
});
