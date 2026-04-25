import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { getDistanceFromLatLonInKm, formatDistance } from '../utils/distance';

/**
 * Formats a raw date value (ISO string, timestamp number, or human-readable string)
 * into a friendly display like "Sat, 15 Mar • 6:00 PM"
 */
const formatEventDate = (raw) => {
    if (!raw) return null;
    try {
        // Handle numeric timestamps stored as strings
        const parsed = typeof raw === 'string' && /^\d+$/.test(raw.trim())
            ? new Date(Number(raw))
            : new Date(raw);

        if (isNaN(parsed.getTime())) return null;

        const dateStr = parsed.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
        const timeStr = parsed.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).toUpperCase();

        return `${dateStr} • ${timeStr}`;
    } catch {
        return null;
    }
};

const CATEGORY_ICONS = {
    Music: 'musical-notes',
    Sports: 'football',
    Food: 'restaurant',
    Art: 'color-palette',
    Tech: 'hardware-chip',
    Comedy: 'happy',
    Festival: 'sparkles',
    Networking: 'people',
    Workshop: 'construct',
    default: 'calendar',
};

const EventSummaryCard = ({ event, visible, onClose, onDetails, userLocation, hasActiveBuddyRequest }) => {
    if (!visible || !event) return null;

    const formattedDate = formatEventDate(event.date);
    const categoryIcon = CATEGORY_ICONS[event.category] || CATEGORY_ICONS.default;

    const distance = userLocation && event.coordinate
        ? formatDistance(getDistanceFromLatLonInKm(
            userLocation.latitude,
            userLocation.longitude,
            event.coordinate?.latitude || 0,
            event.coordinate?.longitude || 0,
        ))
        : null;

    const isBusinessEvent = event.isOfficial ||
        event.verificationType === 'business' ||
        event.verificationStatus === 'business';

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                {/* Top row: close button */}
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={18} color={COLORS.secondary} />
                </TouchableOpacity>

                {/* Icon + Title row */}
                <View style={styles.titleRow}>
                    <View style={[styles.iconBadge, isBusinessEvent && styles.iconBadgeBusiness]}>
                        <Ionicons name={categoryIcon} size={20} color={isBusinessEvent ? COLORS.accent : COLORS.primary} />
                    </View>
                    <View style={styles.titleBlock}>
                        <Typography variant="h3" numberOfLines={1} style={styles.title}>
                            {event.title}
                        </Typography>
                        <View style={styles.badgeRow}>
                            {isBusinessEvent && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={11} color={COLORS.accent} />
                                    <Typography variant="caption" style={styles.verifiedText}>Official</Typography>
                                </View>
                            )}
                            {hasActiveBuddyRequest && (
                                <View style={[styles.verifiedBadge, styles.buddyBadge]}>
                                    <Ionicons name="people" size={11} color="#9C27B0" />
                                    <Typography variant="caption" style={styles.buddyBadgeText}>Buddies</Typography>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Pills Row */}
                <View style={styles.pillsRow}>
                    {formattedDate && (
                        <View style={styles.pill}>
                            <Ionicons name="time-outline" size={12} color={COLORS.secondary} />
                            <Typography variant="caption" style={styles.pillText}>{formattedDate}</Typography>
                        </View>
                    )}
                    {event.category && (
                        <View style={[styles.pill, styles.pillAccent]}>
                            <Typography variant="caption" style={styles.pillAccentText}>{event.category}</Typography>
                        </View>
                    )}
                    {distance && (
                        <View style={styles.pill}>
                            <Ionicons name="location-outline" size={12} color={COLORS.secondary} />
                            <Typography variant="caption" style={styles.pillText}>{distance}</Typography>
                        </View>
                    )}
                </View>

                {/* CTA */}
                <TouchableOpacity style={styles.detailsBtn} onPress={() => onDetails(event)} activeOpacity={0.85}>
                    <Typography variant="body" style={styles.detailsBtnText}>View Details</Typography>
                    <Ionicons name="arrow-forward" size={16} color={COLORS.background} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 140,
        left: SPACING.m,
        right: SPACING.m,
        zIndex: 1000,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.m,
        ...SHADOWS.medium,
    },
    closeBtn: {
        position: 'absolute',
        top: SPACING.m,
        right: SPACING.m,
        zIndex: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
        paddingRight: 36, // leave space for close button
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconBadgeBusiness: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(193, 255, 114, 0.08)',
    },
    titleBlock: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.primary,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        marginTop: 2,
    },
    buddyBadge: {
        backgroundColor: 'rgba(156, 39, 176, 0.08)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    buddyBadgeText: {
        color: '#9C27B0',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    verifiedText: {
        color: COLORS.accent,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    pillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.xs,
        marginBottom: SPACING.m,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pillAccent: {
        borderColor: 'rgba(193, 255, 114, 0.3)',
        backgroundColor: 'rgba(193, 255, 114, 0.08)',
    },
    pillText: {
        color: COLORS.secondary,
        fontSize: 11,
        fontWeight: '500',
    },
    pillAccentText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '600',
    },
    detailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.m,
        paddingVertical: 10,
    },
    detailsBtnText: {
        color: COLORS.background,
        fontWeight: '700',
        fontSize: 14,
    },
});

export default EventSummaryCard;
