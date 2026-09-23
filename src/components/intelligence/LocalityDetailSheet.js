import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { normalizeLocalityIntelligence } from '../../domain/intelligence/localityIntelligenceContract';

const CRITERIA_CONFIG = [
    { id: 'safety', label: 'Safety', icon: 'shield-checkmark-outline' },
    { id: 'traffic', label: 'Traffic Flow', icon: 'car-outline' },
    { id: 'flood', label: 'Flood Safety', icon: 'water-outline' },
    { id: 'pollution', label: 'Clean Air', icon: 'leaf-outline' },
    { id: 'groundwater', label: 'Groundwater', icon: 'rainy-outline' },
    { id: 'connectivity', label: 'Connectivity', icon: 'navigate-outline' },
    { id: 'healthcare', label: 'Healthcare', icon: 'medkit-outline' },
    { id: 'education', label: 'Education', icon: 'school-outline' },
    { id: 'cost_of_living', label: 'Cost of Living', icon: 'wallet-outline' },
    { id: 'public_transport', label: 'Public Transit', icon: 'bus-outline' },
];

export default function LocalityDetailSheet({
    locality,
    scoreResult,
    onExplore,
    onClose,
    isDesktop = false,
}) {
    if (!locality) return null;

    const intel = normalizeLocalityIntelligence(locality, scoreResult);
    const {
        name,
        city,
        areaScore: score,
        matchScore,
        scoreCriteria,
        scoringSystemVersion,
        rental,
        transport,
        flood,
        commute,
        staysSupply,
        highlights: reasons,
    } = intel;

    const staysAvailable = staysSupply.staysCount;
    const typicalRent = rental.typicalRentFormatted;
    const floodClass = flood.classification;
    const metroDistanceM = transport.nearestMetroDistanceM;
    const metroAvailable = transport.metroAvailable;

    return (
        <View style={[styles.container, isDesktop && styles.desktopContainer]}>
            {!isDesktop && (
                <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                </View>
            )}

            <View style={styles.header}>
                <View style={styles.titleArea}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.city}>{city || 'Chennai'}</Text>
                </View>

                <View style={styles.headerScores}>
                    {score != null ? (
                        <View style={styles.scoreContainer}>
                            <View style={styles.scoreRow}>
                                <Text style={styles.scoreValue}>{score}</Text>
                            </View>
                            <Text style={styles.scoreLabel}>Croww Area Score</Text>
                        </View>
                    ) : (
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreUnavailable}>Score unavailable</Text>
                        </View>
                    )}

                    {matchScore != null && (
                        <View style={styles.matchContainer}>
                            <View style={styles.matchBadge}>
                                <Text style={styles.matchValue}>{matchScore}%</Text>
                            </View>
                            <Text style={styles.matchLabel}>Personal Match</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close locality details"
                >
                    <Ionicons name="close" size={20} color={COLORS.secondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={[styles.scroll, isDesktop && styles.desktopScroll]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Stays Available Badge (truthful: 0 stays is explicitly 0 stays) */}
                {staysAvailable != null ? (
                    <View style={styles.staysBadgeRow}>
                        <Ionicons
                            name="bed-outline"
                            size={16}
                            color={staysAvailable === 0 ? COLORS.secondary : COLORS.primary}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.staysBadgeText, staysAvailable === 0 && { color: COLORS.secondary }]}>
                            {staysAvailable === 0 ? '0 stays currently available' : `${staysAvailable} stays available`}
                        </Text>
                    </View>
                ) : null}

                {/* Highlights / Reasons */}
                {reasons.length > 0 ? (
                    <View style={styles.sectionBlock}>
                        <Text style={styles.sectionTitle}>Key Highlights</Text>
                        {reasons.map((reason, idx) => (
                            <View key={idx} style={styles.reasonRow}>
                                <View style={styles.checkIcon}>
                                    <Ionicons name="checkmark" size={14} color="#059669" />
                                </View>
                                <Text style={styles.reasonText}>{reason}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* 10-Criteria Locality Dimensions (authoritative published breakdown) */}
                {scoreCriteria && (
                    <View style={styles.sectionBlock}>
                        <View style={styles.criteriaHeaderRow}>
                            <Text style={styles.sectionTitle}>Area Dimensions</Text>
                            {scoringSystemVersion ? (
                                <Text style={styles.versionBadge}>{scoringSystemVersion}</Text>
                            ) : null}
                        </View>
                        <View style={styles.criteriaGrid}>
                            {CRITERIA_CONFIG.map((cfg) => {
                                const val = scoreCriteria[cfg.id];
                                const hasVal = val != null && typeof val === 'number';
                                return (
                                    <View key={cfg.id} style={styles.criterionCard}>
                                        <View style={styles.criterionTop}>
                                            <Ionicons name={cfg.icon} size={13} color={COLORS.secondary} style={{ marginRight: 4 }} />
                                            <Text style={styles.criterionLabel} numberOfLines={1}>{cfg.label}</Text>
                                        </View>
                                        <Text style={[styles.criterionScore, !hasVal && styles.criterionScoreMissing]}>
                                            {hasVal ? `${Math.round(val)}` : 'Not available'}
                                        </Text>
                                        {hasVal && (
                                            <View style={styles.barTrack}>
                                                <View
                                                    style={[
                                                        styles.barFill,
                                                        { width: `${Math.min(100, Math.max(0, val))}%` },
                                                    ]}
                                                />
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Commute Evidence */}
                {commute?.travelMinutes != null ? (
                    <View style={styles.metricCard}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Commute to Destination</Text>
                            <Text style={styles.metricValue}>
                                {commute.travelMinutes} min ({commute.distanceKm} km) via {commute.modeTag}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {/* Rent Evidence (only when authentic data exists) */}
                {typicalRent ? (
                    <View style={styles.metricCard}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="pricetag-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Typical Monthly Rent</Text>
                            <Text style={styles.metricValue}>{typicalRent}</Text>
                        </View>
                    </View>
                ) : null}

                {/* Flood Resilience */}
                {floodClass ? (
                    <View style={styles.metricCard}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="water-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Flood Resilience</Text>
                            <Text style={styles.metricValue}>
                                {floodClass} Risk
                            </Text>
                        </View>
                    </View>
                ) : null}

                {/* Metro Proximity */}
                {metroAvailable ? (
                    <View style={styles.metricCard}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="train-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Metro Proximity</Text>
                            <Text style={styles.metricValue}>
                                {metroDistanceM != null ? `Metro station within ${(metroDistanceM / 1000).toFixed(1)} km` : 'Station within reach'}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.exploreBtn}
                    activeOpacity={0.88}
                    onPress={() => onExplore(locality)}
                >
                    <Text style={styles.exploreBtnText}>
                        Explore {name}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.sheet,
        borderTopRightRadius: BORDER_RADIUS.sheet,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        overflow: 'hidden',
        maxHeight: 520,
        ...SHADOWS.floating,
    },
    desktopContainer: {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderWidth: 0,
        maxHeight: '100%',
        flex: 1,
        shadowOpacity: 0,
        elevation: 0,
    },
    desktopScroll: {
        maxHeight: 9000,
        flex: 1,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
    },
    titleArea: {
        flex: 1,
    },
    name: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: -0.3,
    },
    city: {
        fontSize: FONT_SIZES.s,
        color: COLORS.secondary,
        marginTop: 2,
    },
    headerScores: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    scoreContainer: {
        alignItems: 'flex-end',
        marginRight: 12,
    },
    scoreLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.secondary,
        letterSpacing: 0.4,
    },
    scoreUnavailable: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.primary,
    },
    matchContainer: {
        alignItems: 'flex-end',
    },
    matchBadge: {
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: '#059669',
    },
    matchValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#059669',
    },
    matchLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#059669',
        letterSpacing: 0.3,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        maxHeight: 320,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    sectionBlock: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 10,
    },
    criteriaHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    versionBadge: {
        fontSize: 10,
        color: COLORS.tertiary,
        fontWeight: '600',
    },
    criteriaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    criterionCard: {
        width: '50%',
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    criterionTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    criterionLabel: {
        fontSize: 11,
        color: COLORS.secondary,
        fontWeight: '600',
        flex: 1,
    },
    criterionScore: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.primary,
        marginTop: 2,
        marginBottom: 3,
    },
    criterionScoreMissing: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.secondary,
    },
    barTrack: {
        height: 3,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 2,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    checkIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    reasonText: {
        fontSize: FONT_SIZES.s,
        color: COLORS.primary,
        fontWeight: '500',
        flex: 1,
    },
    staysBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: BORDER_RADIUS.pill,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    staysBadgeText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.primary,
    },
    metricCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceSubtle,
        padding: 10,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: 8,
    },
    metricIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    metricInfo: {
        flex: 1,
    },
    metricLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.secondary,
    },
    metricValue: {
        fontSize: FONT_SIZES.s,
        fontWeight: '600',
        color: COLORS.primary,
        marginTop: 1,
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderSubtle,
    },
    exploreBtn: {
        height: TOUCH_TARGETS.button,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.button,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.medium,
    },
    exploreBtnText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.m,
        fontWeight: '700',
        marginRight: 8,
    },
});
