import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { getFloatingNavbarClearance } from '../../constants/layout';
import { RELEVANCE_CONFIG } from '../../domain/intelligence/localityVisualRelevance';
import { normalizeLocalityIntelligence } from '../../domain/intelligence/localityIntelligenceContract';

/**
 * Compact Area Result Card
 * Sits directly above the bottom navigation in Areas map mode (~130-165dp height).
 *
 * Structure:
 * ┌──────────────────────────────────────┐
 * │ Adyar                         92     │
 * │ Chennai                              │
 * │                                      │
 * │ ₹9.5K typical rent    13 min        │
 * │ Bus                   23 stays       │
 * │                                      │
 * │ ✓ Within budget      ✓ Quick commute │
 * │                                      │
 * │ [ Explore Adyar → ]                  │
 * └──────────────────────────────────────┘
 */
export default function CompactAreaResultCard({
    locality,
    matchResult,
    onExplore,
    onDismiss,
}) {
    const insets = useSafeAreaInsets();

    if (!locality) return null;

    const intel = normalizeLocalityIntelligence(locality, matchResult);
    const {
        name,
        city,
        areaScore: score,
        rental,
        commute,
        staysSupply,
        highlights: rawHighlights,
    } = intel;

    // Determine tier color dot
    let tierColor = RELEVANCE_CONFIG.NEUTRAL.dotColor;
    if (score != null) {
        if (score >= 80) {
            tierColor = RELEVANCE_CONFIG.STRONG_MATCH.dotColor;
        } else if (score >= 65) {
            tierColor = RELEVANCE_CONFIG.GOOD_MATCH.dotColor;
        } else if (score >= 50) {
            tierColor = RELEVANCE_CONFIG.POSSIBLE_MATCH.dotColor;
        }
    }

    // Metrics (truthful: only present when available)
    const typicalRent = rental.typicalRentFormatted;
    const inBudget = rental.inBudget;
    const travelMinutes = commute.travelMinutes;
    const commuteModeTag = commute.modeTag;
    const staysCount = staysSupply.staysCount;

    // Highlights (deterministic triggers, top 2 on compact card)
    const highlights = rawHighlights.slice(0, 2);

    const bottomClearance = getFloatingNavbarClearance(insets, 12);

    return (
        <View
            style={[styles.wrapper, { bottom: bottomClearance }]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.92}
                onPress={() => onExplore?.(locality, matchResult)}
                accessibilityRole="button"
                accessibilityLabel={`${name}, score ${score || 'unavailable'}, tap for full intelligence report`}
            >
                {/* Header Row: Area Name + City & Score */}
                <View style={styles.headerRow}>
                    <View style={styles.titleGroup}>
                        <Text style={styles.areaName} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={styles.cityName}>
                            {city}
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        {score != null && (
                            <View style={styles.scorePill}>
                                <View style={[styles.scoreDot, { backgroundColor: tierColor }]} />
                                <Text style={styles.scoreValue}>{score}</Text>
                            </View>
                        )}
                        {onDismiss && (
                            <TouchableOpacity
                                style={styles.dismissBtn}
                                onPress={onDismiss}
                                hitSlop={TOUCH_TARGETS.hitSlop}
                                accessibilityRole="button"
                                accessibilityLabel="Deselect area"
                            >
                                <Ionicons name="close" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Metrics Row */}
                <View style={styles.metricsRow}>
                    {typicalRent ? (
                        <View style={[styles.metricPill, inBudget === true && styles.metricPillInBudget]}>
                            <Ionicons
                                name="pricetag-outline"
                                size={12}
                                color={inBudget === true ? '#059669' : '#4B5563'}
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.metricText, inBudget === true && styles.metricTextInBudget]}>
                                {typicalRent} typical rent
                            </Text>
                        </View>
                    ) : null}

                    {travelMinutes != null ? (
                        <View style={styles.metricPill}>
                            <Ionicons
                                name="time-outline"
                                size={12}
                                color="#4B5563"
                                style={{ marginRight: 4 }}
                            />
                            <Text style={styles.metricText}>
                                {travelMinutes} min
                            </Text>
                        </View>
                    ) : null}

                    {commuteModeTag ? (
                        <View style={styles.metricPill}>
                            <Ionicons
                                name="navigate-outline"
                                size={12}
                                color="#4B5563"
                                style={{ marginRight: 4 }}
                            />
                            <Text style={styles.metricText}>
                                {commuteModeTag}
                            </Text>
                        </View>
                    ) : null}

                    {staysCount != null ? (
                        <View style={styles.metricPill}>
                            <Ionicons
                                name="bed-outline"
                                size={12}
                                color="#4B5563"
                                style={{ marginRight: 4 }}
                            />
                            <Text style={styles.metricText}>
                                {staysCount === 0 ? '0 stays' : `${staysCount} stays`}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* Highlights Row (if present) */}
                {highlights.length > 0 && (
                    <View style={styles.highlightsRow}>
                        {highlights.map((h, i) => (
                            <View key={i} style={styles.highlightBadge}>
                                <Text style={styles.highlightText}>✓ {h}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Explore Action Button */}
                <TouchableOpacity
                    style={styles.exploreBtn}
                    activeOpacity={0.88}
                    onPress={() => onExplore?.(locality, matchResult)}
                    accessibilityRole="button"
                    accessibilityLabel={`Explore ${name}`}
                >
                    <Text style={styles.exploreBtnText}>
                        Explore {name}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 35,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        ...SHADOWS.floating,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    titleGroup: {
        flex: 1,
        marginRight: 8,
    },
    areaName: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.3,
    },
    cityName: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
        marginTop: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: BORDER_RADIUS.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginRight: 6,
    },
    scoreDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        marginRight: 5,
    },
    scoreValue: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.2,
    },
    dismissBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    metricPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    metricPillInBudget: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    metricText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    metricTextInBudget: {
        color: '#059669',
        fontWeight: '700',
    },
    highlightsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    highlightBadge: {
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    highlightText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#4B5563',
    },
    exploreBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    exploreBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});
