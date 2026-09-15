import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import AntigravityButton from '../AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { formatArea, formatBhk, formatListingPrice, formatSubtype } from '../../utils/propertyFormat';
import { listingCardTrustHint } from '../../domain/verification';
import { exploreSpatialHint } from '../../domain/spatial';

const PropertyResultCard = ({ item, selected, onPress, fullWidth }) => {
    if (!item) return null;

    const priceText = formatListingPrice(item);
    const bhk = formatBhk(item.bedrooms);
    const area = formatArea(item);
    const subtype = formatSubtype(item.subtype) || (item.category === 'land' ? 'Plot' : 'Property');
    const title = [bhk, subtype].filter(Boolean).join(' ');
    const locality = item.localityName || item.city || 'Chennai';
    const subMeta = [locality, area].filter(Boolean).join(' · ');

    const trustHint = listingCardTrustHint(item);
    const isExact = item.locationPrecision === 'exact' || item.locationVisibility === 'exact';
    const spatialHint = exploreSpatialHint(item);

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.card,
                fullWidth && styles.fullWidth,
                selected && styles.cardSelected,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${priceText}, ${title}, in ${locality}`}
            activeOpacity={0.93}
        >
            {/* Image Hero: Large aspect ratio (16:10), rounded corners, minimal overlays */}
            <View style={styles.imageContainer}>
                {item.coverThumbnailUrl || item.coverUrl ? (
                    <Image
                        source={{ uri: item.coverThumbnailUrl || item.coverUrl }}
                        style={styles.image}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons name="home-outline" size={36} color={COLORS.tertiary} />
                        <Typography variant="caption" style={styles.placeholderText}>
                            Photo coming soon
                        </Typography>
                    </View>
                )}

                {/* Maximum 1 location/privacy badge + 1 3D tour badge */}
                <View style={styles.badgeRow}>
                    <View style={styles.locationBadge}>
                        <Ionicons
                            name={isExact ? 'location' : 'location-outline'}
                            size={13}
                            color={isExact ? COLORS.accent : COLORS.primary}
                            style={{ marginRight: 4 }}
                        />
                        <Typography variant="micro" style={styles.badgeText}>
                            {isExact ? 'Exact location' : 'Approximate location'}
                        </Typography>
                    </View>

                    {spatialHint ? (
                        <View style={styles.spatialBadge}>
                            <Ionicons name="cube-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
                            <Typography variant="micro" style={[styles.badgeText, { color: '#2563EB' }]}>
                                3D Tour
                            </Typography>
                        </View>
                    ) : null}
                </View>
            </View>

            {/* Content Body: Dominant Price, Clear Hierarchy */}
            <View style={styles.body}>
                <View style={styles.priceRow}>
                    <Typography variant="price" style={styles.price}>
                        {priceText}
                    </Typography>
                    {item.transactionType === 'rent' ? (
                        <Typography variant="caption" style={styles.rentPeriod}>
                            /month
                        </Typography>
                    ) : null}
                </View>

                <Typography variant="titleMedium" numberOfLines={1} style={styles.title}>
                    {title}
                </Typography>

                <Typography variant="bodyMedium" numberOfLines={1} style={styles.subMeta}>
                    {subMeta}
                </Typography>

                {/* Trust and Location Indicators */}
                <View style={styles.indicatorRow}>
                    {trustHint ? (
                        <View style={styles.trustIndicator}>
                            <Ionicons name="shield-checkmark" size={15} color={COLORS.success} style={{ marginRight: 4 }} />
                            <Typography variant="caption" style={styles.trustText}>
                                {trustHint}
                            </Typography>
                        </View>
                    ) : null}
                </View>

                {/* Obvious Primary Action Button */}
                <View style={styles.ctaWrap}>
                    <AntigravityButton
                        title="View property"
                        variant="primary"
                        size="default"
                        onPress={onPress}
                        icon="arrow-forward"
                        iconPosition="right"
                        style={styles.ctaButton}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        width: 310,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        marginRight: SPACING.m,
        ...SHADOWS.floating,
    },
    fullWidth: {
        width: '100%',
        marginRight: 0,
    },
    cardSelected: {
        borderColor: COLORS.accent,
        borderWidth: 2,
    },
    imageContainer: {
        width: '100%',
        height: 170,
        backgroundColor: COLORS.surfaceHighlight,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceSubtle,
    },
    placeholderText: {
        marginTop: SPACING.xs,
        color: COLORS.secondary,
    },
    badgeRow: {
        position: 'absolute',
        top: SPACING.s,
        left: SPACING.s,
        right: SPACING.s,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        paddingHorizontal: SPACING.s,
        paddingVertical: 5,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    spatialBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        paddingHorizontal: SPACING.s,
        paddingVertical: 5,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    badgeText: {
        fontWeight: '700',
        color: COLORS.primary,
    },
    body: {
        padding: SPACING.l,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    price: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.5,
    },
    rentPeriod: {
        marginLeft: 4,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    title: {
        marginTop: 4,
        fontWeight: '700',
        color: COLORS.primary,
    },
    subMeta: {
        marginTop: 2,
        color: COLORS.secondary,
    },
    indicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.s,
        gap: SPACING.s,
    },
    trustIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trustText: {
        fontWeight: '600',
        color: COLORS.success,
    },
    ctaWrap: {
        marginTop: SPACING.m,
    },
    ctaButton: {
        width: '100%',
        height: TOUCH_TARGETS.button,
        borderRadius: BORDER_RADIUS.button,
    },
});

export default memo(PropertyResultCard);
