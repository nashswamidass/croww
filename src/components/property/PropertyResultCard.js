import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatArea, formatBhk, formatListingPrice, formatSubtype } from '../../utils/propertyFormat';
import { listingCardTrustHint } from '../../domain/verification';
import { exploreSpatialHint } from '../../domain/spatial';

const PropertyResultCard = ({ item, selected, onPress, onDismiss, fullWidth }) => {
    if (!item) return null;

    const priceText = formatListingPrice(item);
    const bhk = formatBhk(item.bedrooms);
    const area = formatArea(item);
    const subtype = formatSubtype(item.subtype) || (item.category === 'land' ? 'Plot' : 'Property');
    const title = [bhk, subtype].filter(Boolean).join(' ');
    const locality = item.localityName || item.city || 'Chennai';
    const subMeta = [locality, area].filter(Boolean).join(' · ');

    const trustHint = listingCardTrustHint(item);
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
            activeOpacity={0.92}
        >
            {/* Image Container */}
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

                {/* Overlays on Image */}
                <View style={styles.badgeRow}>
                    {trustHint ? (
                        <View style={styles.trustBadge}>
                            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Typography variant="micro" style={styles.trustBadgeText}>
                                {trustHint}
                            </Typography>
                        </View>
                    ) : <View />}

                    <View style={styles.topRightControls}>
                        {spatialHint ? (
                            <View style={styles.spatialBadge}>
                                <Ionicons name="cube-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Typography variant="micro" style={styles.spatialBadgeText}>
                                    3D
                                </Typography>
                            </View>
                        ) : null}

                        {selected && onDismiss && (
                            <TouchableOpacity
                                style={styles.dismissBtn}
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    onDismiss();
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* Card Content Body */}
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

                <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={COLORS.secondary} style={{ marginRight: 3 }} />
                    <Typography variant="bodyMedium" numberOfLines={1} style={styles.subMeta}>
                        {subMeta}
                    </Typography>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        width: 300,
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
        height: 175,
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
        top: 10,
        left: 10,
        right: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trustBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.success,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.pill,
        ...SHADOWS.subtle,
    },
    trustBadgeText: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
    topRightControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    spatialBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.pill,
    },
    spatialBadgeText: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
    dismissBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        padding: 14,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    price: {
        fontSize: 24,
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
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    subMeta: {
        color: COLORS.secondary,
        flex: 1,
    },
});

export default memo(PropertyResultCard);
