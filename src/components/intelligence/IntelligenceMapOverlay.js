import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS } from '../../constants/theme';
import LocalityScoreBubble from './LocalityScoreBubble';

export default function IntelligenceMapOverlay({
    scoredLocalities = [],
    selectedLocality,
    onSelectLocality,
    onResetPreferences,
    onClose,
}) {
    if (!scoredLocalities || scoredLocalities.length === 0) {
        return null;
    }

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Top header pill: "Croww Intelligence" + tune & close actions */}
            <View style={styles.headerRow}>
                <View style={styles.brandPill}>
                    <Ionicons name="sparkles" size={14} color={COLORS.accent} style={styles.sparkleIcon} />
                    <Text style={styles.brandText}>Area Intelligence Active</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {onResetPreferences && (
                        <TouchableOpacity
                            style={styles.filterPill}
                            onPress={onResetPreferences}
                            activeOpacity={0.8}
                            accessibilityLabel="Tune preferences"
                        >
                            <Ionicons name="options-outline" size={14} color={COLORS.primary} />
                            <Text style={styles.filterText}>Tune</Text>
                        </TouchableOpacity>
                    )}

                    {onClose && (
                        <TouchableOpacity
                            style={styles.closePill}
                            onPress={onClose}
                            activeOpacity={0.8}
                            accessibilityLabel="Exit intelligence mode"
                        >
                            <Ionicons name="close" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Bottom horizontal strip of top ranked areas */}
            <View style={styles.bottomSection} pointerEvents="box-none">
                <Text style={styles.stripTitle}>TOP AREAS FOR YOU</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bubbleScroll}
                >
                    {scoredLocalities.map((item) => {
                        const isSelected = selectedLocality?.id === item.locality.id;
                        return (
                            <View key={item.locality.id} style={styles.bubbleWrapper}>
                                <LocalityScoreBubble
                                    name={item.locality.name}
                                    score={item.score}
                                    selected={isSelected}
                                    onPress={() => onSelectLocality(item.locality, item)}
                                />
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        paddingTop: 54,
        paddingBottom: 96,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    brandPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.medium,
    },
    sparkleIcon: {
        marginRight: 6,
    },
    brandText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: 0.2,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.medium,
    },
    closePill: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.medium,
    },
    filterText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.primary,
        marginLeft: 4,
    },
    bottomSection: {
        paddingHorizontal: 16,
    },
    stripTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: 0.8,
        marginBottom: 8,
        textShadowColor: 'rgba(255, 255, 255, 0.9)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    bubbleScroll: {
        paddingRight: 16,
        gap: 8,
    },
    bubbleWrapper: {
        marginRight: 8,
    },
});
