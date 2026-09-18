import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrowwAreaIntelligenceIcon from '../icons/CrowwAreaIntelligenceIcon';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { getFloatingNavbarClearance } from '../../constants/layout';
import LocalityScoreBubble from './LocalityScoreBubble';

export default function IntelligenceMapOverlay({
    scoredLocalities = [],
    selectedLocality,
    onSelectLocality,
    onResetPreferences,
    onClose,
}) {
    const insets = useSafeAreaInsets();

    if (!scoredLocalities || scoredLocalities.length === 0) {
        return null;
    }

    const topPadding = Math.max(insets.top, 16) + 10;
    const bottomClearance = getFloatingNavbarClearance(insets, 12);

    return (
        <View style={[styles.container, { paddingTop: topPadding }]} pointerEvents="box-none">
            {/* Top header control bar: Area Intelligence + Tune + Exit */}
            <View style={styles.headerRow} pointerEvents="box-none">
                <View style={styles.brandPill}>
                    <CrowwAreaIntelligenceIcon size={16} color={COLORS.accent} style={{ marginRight: 7 }} focused />
                    <Text style={styles.brandText}>Area Intelligence</Text>
                </View>

                <View style={styles.controlsGroup}>
                    {onResetPreferences && (
                        <TouchableOpacity
                            style={styles.actionPill}
                            onPress={onResetPreferences}
                            activeOpacity={0.82}
                            hitSlop={TOUCH_TARGETS.hitSlop}
                            accessibilityRole="button"
                            accessibilityLabel="Tune preferences"
                        >
                            <Ionicons name="options-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                            <Text style={styles.actionText}>Tune</Text>
                        </TouchableOpacity>
                    )}

                    {onClose && (
                        <TouchableOpacity
                            style={styles.actionPill}
                            onPress={onClose}
                            activeOpacity={0.82}
                            hitSlop={TOUCH_TARGETS.hitSlop}
                            accessibilityRole="button"
                            accessibilityLabel="Exit intelligence mode"
                        >
                            <Ionicons name="close" size={15} color={COLORS.primary} style={{ marginRight: 3 }} />
                            <Text style={styles.actionText}>Exit</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Bottom horizontal carousel of top ranked areas */}
            <View
                style={[
                    styles.bottomSection,
                    { paddingBottom: bottomClearance },
                ]}
                pointerEvents="box-none"
            >
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
                                    variant="card"
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
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    brandPill: {
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.pill,
        paddingHorizontal: 13,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.soft,
    },
    brandText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: 0.1,
    },
    controlsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionPill: {
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.pill,
        paddingHorizontal: 13,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.soft,
    },
    actionText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.primary,
    },
    bottomSection: {
        paddingHorizontal: 16,
    },
    stripTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.secondary,
        letterSpacing: 0.8,
        marginBottom: 8,
        textShadowColor: 'rgba(255, 255, 255, 0.9)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    bubbleScroll: {
        paddingRight: 24,
    },
    bubbleWrapper: {
        marginRight: 8,
    },
});
