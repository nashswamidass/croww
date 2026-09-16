import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import AntigravityButton from '../AntigravityButton';
import PropertyMiniMap from './PropertyMiniMap';
import CrowwLocationShareState from '../rive/CrowwLocationShareState';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { formatPublicLocation } from '../../utils/propertyDetailView';

const PropertyLocation = ({
    precision,
    city,
    state,
    localityName,
    address,
    mapCoordinate,
    onPressLocality,
    localityId,
    isExactShared = false,
    shareStatus = 'NONE',
    isOwner = false,
    onRequestExactLocation,
    isRequestingLocation = false,
}) => {
    const location = formatPublicLocation({ precision, city, state, localityName, address, isExactShared });
    if (!location.headline && !mapCoordinate) return null;

    const mapLabel = location.precision === 'exact'
        ? 'Property location map'
        : 'Approximate property location map';

    const isExact = isExactShared || precision === 'exact';
    const canRequestShare = !isOwner && !isExact && (shareStatus === 'NONE' || shareStatus === 'REVOKED' || shareStatus === 'EXPIRED');

    let friendlyPrivacyTitle = '📍 Approximate location';
    let friendlyPrivacyDesc = "The exact location is shared only with buyers approved by the owner.";

    if (isExact) {
        friendlyPrivacyTitle = '📍 Exact location';
        friendlyPrivacyDesc = isExactShared
            ? 'The owner approved your request to view the exact location.'
            : 'Exact coordinates published for this property.';
    } else if (precision === 'approximate') {
        friendlyPrivacyTitle = '📍 Approximate location';
        friendlyPrivacyDesc = "Exact location isn't available for this listing.";
    }

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <View style={styles.titleArea}>
                    <Typography variant="titleMedium" style={styles.heading}>Location</Typography>
                    {location.headline ? (
                        localityId && onPressLocality ? (
                            <TouchableOpacity
                                onPress={() => onPressLocality(localityId)}
                                accessibilityRole="link"
                                accessibilityLabel={`Open area ${location.headline}`}
                                hitSlop={TOUCH_TARGETS.hitSlop}
                            >
                                <Typography variant="bodyLarge" style={styles.link}>{location.headline}</Typography>
                            </TouchableOpacity>
                        ) : (
                            <Typography variant="bodyLarge" style={styles.headlineText}>{location.headline}</Typography>
                        )
                    ) : null}
                </View>

                <View style={[styles.privacyBadge, isExact ? styles.privacyBadgeExact : styles.privacyBadgeApprox]}>
                    <CrowwLocationShareState
                        shareStatus={shareStatus}
                        precision={precision}
                        isExactShared={isExactShared}
                        isRequesting={isRequestingLocation}
                        size={16}
                        showLabel={true}
                    />
                </View>
            </View>

            {location.showExactAddress && location.street ? (
                <Typography variant="bodyMedium" style={styles.streetText}>{location.street}</Typography>
            ) : null}

            {/* Friendly Location Privacy Card */}
            <View style={[styles.privacyBox, isExact ? styles.privacyBoxExact : styles.privacyBoxApprox]}>
                <Typography variant="bodyMedium" style={styles.friendlyTitle}>
                    {friendlyPrivacyTitle}
                </Typography>
                <Typography variant="caption" style={styles.friendlyDesc}>
                    {friendlyPrivacyDesc}
                </Typography>
            </View>

            {/* Request Exact Location CTA for Prospective Buyers */}
            {!isOwner && !isExact ? (
                shareStatus === 'PENDING' ? (
                    <View style={styles.statusBox}>
                        <Ionicons name="time-outline" size={18} color={COLORS.accent} />
                        <Typography variant="caption" style={styles.statusText}>
                            Location request submitted. Waiting for owner approval.
                        </Typography>
                    </View>
                ) : shareStatus === 'DECLINED' ? (
                    <View style={styles.declinedBox}>
                        <Ionicons name="close-circle-outline" size={18} color={COLORS.secondary} />
                        <Typography variant="caption" style={styles.declinedText}>
                            The owner declined to share exact coordinates.
                        </Typography>
                    </View>
                ) : canRequestShare && onRequestExactLocation ? (
                    <View style={styles.requestWrap}>
                        <AntigravityButton
                            title="Request exact location"
                            variant="secondary"
                            size="large"
                            icon="location-outline"
                            onPress={onRequestExactLocation}
                            loading={isRequestingLocation}
                            accessibilityLabel="Request exact property location"
                        />
                    </View>
                ) : null
            ) : null}

            {mapCoordinate ? (
                <View style={styles.map}>
                    <PropertyMiniMap coordinate={mapCoordinate} accessibilityLabel={mapLabel} />
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: SPACING.l,
        marginTop: SPACING.l,
        padding: SPACING.l,
        borderRadius: BORDER_RADIUS.card,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.card,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.s,
        marginBottom: SPACING.xs,
    },
    titleArea: {
        flex: 1,
        minWidth: 160,
    },
    heading: {
        color: COLORS.secondary,
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    headlineText: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    link: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    privacyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.round,
        gap: 4,
    },
    privacyBadgeApprox: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    privacyBadgeExact: {
        backgroundColor: COLORS.accentMuted,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    privacyBadgeText: {
        fontWeight: '700',
    },
    textApprox: {
        color: COLORS.secondary,
    },
    textExact: {
        color: COLORS.success,
    },
    streetText: {
        color: COLORS.primary,
        marginTop: SPACING.xs,
    },
    privacyBox: {
        marginTop: SPACING.m,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
    },
    privacyBoxApprox: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    privacyBoxExact: {
        backgroundColor: COLORS.accentMuted,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    friendlyTitle: {
        color: COLORS.primary,
        fontWeight: '700',
        marginBottom: 2,
    },
    friendlyDesc: {
        color: COLORS.secondary,
        lineHeight: 18,
    },
    statusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        marginTop: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statusText: {
        color: COLORS.primary,
        fontWeight: '600',
        flex: 1,
    },
    declinedBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        marginTop: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    declinedText: {
        color: COLORS.secondary,
        fontWeight: '500',
        flex: 1,
    },
    requestWrap: {
        marginTop: SPACING.m,
    },
    map: {
        marginTop: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
});

export default PropertyLocation;
