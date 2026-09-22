import React from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { getFloatingNavbarClearance } from '../../constants/layout';
import RelevanceLegend from './RelevanceLegend';
import CompactAreaResultCard from './CompactAreaResultCard';

export default function IntelligenceMapOverlay({
    scoredLocalities = [],
    selectedLocality,
    selectedLocalityData,
    matcherRan = false,
    city = 'Chennai',
    onSelectLocality,
    onResetPreferences,
    onClose,
    onExploreLocality,
    onDismissLocality,
}) {
    const insets = useSafeAreaInsets();

    // Top padding: ScreenWrapper already applies insets.top, so use 8dp consistent with normal floatingTop
    const topPadding = 8;
    const bottomClearance = getFloatingNavbarClearance(insets, 12);

    return (
        <View style={[styles.container, { paddingTop: topPadding }]} pointerEvents="box-none">
            {/* Top header control bar: Croww Logo + Areas + Tune + Exit */}
            <View style={styles.headerRow} pointerEvents="box-none">
                <View style={styles.brandPill}>
                    <Image
                        source={require('../../../assets/croww-logo.png')}
                        style={styles.brandLogo}
                        resizeMode="contain"
                        accessibilityLabel="Croww"
                    />
                    <View style={styles.brandDivider} />
                    <Text style={styles.brandText}>Areas</Text>
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

            {/* Corner Relevance Legend: top-right below the controls group */}
            {scoredLocalities.length > 0 && (
                <View style={styles.legendCorner} pointerEvents="none">
                    <RelevanceLegend orientation="vertical" />
                </View>
            )}

            {/* Compact Area Result Card when a locality is selected */}
            {selectedLocality && (
                <CompactAreaResultCard
                    locality={selectedLocality}
                    matchResult={selectedLocalityData}
                    onExplore={onExploreLocality}
                    onDismiss={onDismissLocality}
                />
            )}

            {/* Truthful Empty State Card when criteria yields 0 localities */}
            {matcherRan && scoredLocalities.length === 0 && (
                <View
                    style={[styles.emptyCardWrapper, { bottom: bottomClearance }]}
                    pointerEvents="box-none"
                >
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="search-outline" size={18} color={COLORS.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>No matching areas found</Text>
                        <Text style={styles.emptySubtitle}>
                            No localities in {city || 'Chennai'} met all your commute and budget criteria.
                        </Text>
                        {onResetPreferences && (
                            <TouchableOpacity
                                style={styles.emptyTuneBtn}
                                onPress={onResetPreferences}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="Tune search criteria"
                            >
                                <Ionicons name="options-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                <Text style={styles.emptyTuneBtnText}>Tune Preferences</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
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
    legendCorner: {
        position: 'absolute',
        top: 52,
        right: 16,
    },
    brandPill: {
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.pill,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.soft,
    },
    brandLogo: {
        width: 58,
        height: 18,
    },
    brandDivider: {
        width: 1,
        height: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
        marginHorizontal: 8,
    },
    brandText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.2,
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
    emptyCardWrapper: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 35,
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        ...SHADOWS.floating,
    },
    emptyIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
        marginBottom: 4,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 14,
        lineHeight: 18,
    },
    emptyTuneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    emptyTuneBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
