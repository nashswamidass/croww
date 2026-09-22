import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BORDER_RADIUS } from '../../constants/theme';

/**
 * Clean, restrained geographic cluster marker for POINT_ONLY localities.
 *
 * Implements:
 * - Crisp white background with thin charcoal outline (#1F1F1F)
 * - Restrained typography: "4 AREAS"
 * - Subtle relevance accent dot
 * - Zero purple, zero glow, zero gradients
 * - Native Android map safe (no shadow artifacts)
 */
export default function LocalityClusterBubble({
    count,
    relevanceColor = null,
    onPress,
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.82}
            onPress={onPress}
            style={styles.container}
            accessibilityRole="button"
            accessibilityLabel={`${count} areas cluster. Tap to expand.`}
        >
            {relevanceColor ? (
                <View style={[styles.relevanceDot, { backgroundColor: relevanceColor }]} />
            ) : null}

            <Text style={styles.countText}>{count}</Text>
            <Text style={styles.labelText}>AREAS</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1.2,
        borderColor: '#1F1F1F',
        paddingVertical: 4.5,
        paddingHorizontal: 8.5,
        elevation: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
    },
    relevanceDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },
    countText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 0.3,
        marginRight: 3,
    },
    labelText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#6B7280',
        letterSpacing: 0.5,
    },
});
