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

export default function LocalityDetailSheet({
    locality,
    scoreResult,
    onExplore,
    onClose,
}) {
    if (!locality) return null;

    const score = scoreResult?.score != null ? Math.round(scoreResult.score) : 92;
    const reasons = scoreResult?.highlights && scoreResult.highlights.length > 0 ? scoreResult.highlights : [
        'Within your budget',
        'Short commute',
        'Great transport',
        'Strong amenities',
    ];
    const staysAvailable = locality.staysCount || 23;

    return (
        <View style={styles.container}>
            <View style={styles.handleContainer}>
                <View style={styles.handle} />
            </View>

            <View style={styles.header}>
                <View style={styles.titleArea}>
                    <Text style={styles.name} numberOfLines={1}>{locality.name}</Text>
                    <Text style={styles.city}>{locality.city || 'Chennai'}</Text>
                </View>

                {score != null && (
                    <View style={styles.scoreContainer}>
                        <View style={styles.scoreRow}>
                            <Text style={styles.scoreValue}>{score}</Text>
                        </View>
                        <Text style={styles.scoreLabel}>Croww Area Score</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Ionicons name="close" size={22} color={COLORS.secondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>Why this area?</Text>
                {reasons.map((reason, idx) => (
                    <View key={idx} style={styles.reasonRow}>
                        <View style={styles.checkIcon}>
                            <Ionicons name="checkmark" size={14} color={COLORS.accent} />
                        </View>
                        <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                ))}

                {/* Stays Available Badge */}
                <View style={styles.staysBadgeRow}>
                    <Ionicons name="bed-outline" size={16} color={COLORS.accent} style={{ marginRight: 6 }} />
                    <Text style={styles.staysBadgeText}>{staysAvailable} stays available</Text>
                </View>

                {locality.intelligence?.flood?.class && (
                    <View style={styles.metricCard}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="water-outline" size={18} color={COLORS.accent} />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Flood Resilience</Text>
                            <Text style={styles.metricValue}>
                                {locality.intelligence.flood.class}
                            </Text>
                        </View>
                    </View>
                )}

                {locality.intelligence?.transport?.metro?.available && (
                    <View style={styles.metricCard}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="train-outline" size={18} color={COLORS.accent} />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Metro Proximity</Text>
                            <Text style={styles.metricValue}>Station within reach</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.exploreBtn}
                    activeOpacity={0.88}
                    onPress={() => onExplore(locality)}
                >
                    <Text style={styles.exploreBtnText}>
                        Explore {locality.name}
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
        maxHeight: 460,
        ...SHADOWS.floating,
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
        paddingBottom: 16,
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
    scoreContainer: {
        alignItems: 'flex-end',
        marginRight: 16,
    },
    scoreLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.accent,
        letterSpacing: 0.5,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    scoreValue: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.accent,
    },
    scoreMax: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.tertiary,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        maxHeight: 220,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.s,
        fontWeight: '700',
        color: COLORS.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 12,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    checkIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    reasonText: {
        fontSize: FONT_SIZES.m,
        color: COLORS.primary,
        fontWeight: '500',
        flex: 1,
    },
    staysBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accentMuted,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.pill,
        alignSelf: 'flex-start',
        marginTop: 6,
        marginBottom: 8,
    },
    staysBadgeText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.accent,
    },
    metricCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceSubtle,
        padding: 12,
        borderRadius: BORDER_RADIUS.m,
        marginTop: 8,
    },
    metricIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    metricInfo: {
        flex: 1,
    },
    metricLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.secondary,
    },
    metricValue: {
        fontSize: FONT_SIZES.m,
        fontWeight: '600',
        color: COLORS.primary,
        marginTop: 1,
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderSubtle,
    },
    exploreBtn: {
        height: TOUCH_TARGETS.button,
        backgroundColor: COLORS.accent,
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
