import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatArea, formatBhk, formatListingPrice, formatSubtype } from '../../utils/propertyFormat';
import { listingCardTrustHint } from '../../domain/verification';
import { exploreSpatialHint } from '../../domain/spatial';

/**
 * Compact Property Result Card for launch:
 * Prioritizes:
 * 1. Image (compact ratio)
 * 2. Price (prominent hierarchy)
 * 3. Stay type (Bed, Private Room, PG, etc.)
 * 4. Locality
 * 5. 1-2 important facts (e.g. Furnished · Immediate)
 *
 * Sized conservatively to sit cleanly above the floating navbar with zero overlap.
 */
const PropertyResultCard = ({ item, selected, onPress, onDismiss, fullWidth }) => {
    if (!item) return null;

    const priceText = formatListingPrice(item);

    // Stay Type: use category displayName / stay type, fallback to bhk/subtype
    const stayType = item.categoryDisplayName
        || item.categoryName
        || item.stayType
        || [formatBhk(item.bedrooms), formatSubtype(item.subtype)].filter(Boolean).join(' ')
        || (item.category === 'land' ? 'Plot' : 'Stay');

    // Locality & City
    const locality = item.localityName || item.locality || 'Adyar';
    const city = item.city || 'Chennai';
    const locationText = locality.toLowerCase().includes(city.toLowerCase())
        ? locality
        : `${locality}, ${city}`;

    // 1-2 important facts
    const facts = [];
    if (item.furnishing) {
        facts.push(item.furnishing.charAt(0).toUpperCase() + item.furnishing.slice(1));
    } else if (item.furnished === true) {
        facts.push('Furnished');
    } else if (item.areaSqFt) {
        facts.push(`${item.areaSqFt} sq.ft`);
    }

    if (item.availableFrom) {
        facts.push(`Available ${item.availableFrom}`);
    } else if (item.immediate === true || item.availability === 'immediate') {
        facts.push('Immediate');
    } else if (item.bathrooms) {
        facts.push(`${item.bathrooms} Bath`);
    } else {
        facts.push('Verified');
    }

    const factsText = facts.slice(0, 2).join(' · ');

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
            accessibilityLabel={`${priceText}, ${stayType}, in ${locationText}`}
            activeOpacity={0.92}
        >
            {/* 1. Compact Image Container */}
            <View style={styles.imageContainer}>
                {item.coverThumbnailUrl || item.coverUrl ? (
                    <Image
                        source={{ uri: item.coverThumbnailUrl || item.coverUrl }}
                        style={styles.image}
                        contentFit="cover"
                        transition={150}
                    />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons name="home-outline" size={26} color={COLORS.tertiary} />
                        <Text style={styles.placeholderText}>Photo coming soon</Text>
                    </View>
                )}

                {/* Badges on Image */}
                <View style={styles.badgeRow} pointerEvents="box-none">
                    {trustHint ? (
                        <View style={styles.trustBadge}>
                            <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                            <Text style={styles.trustBadgeText}>{trustHint}</Text>
                        </View>
                    ) : <View />}

                    <View style={styles.topRightControls}>
                        {spatialHint ? (
                            <View style={styles.spatialBadge}>
                                <Ionicons name="cube-outline" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                                <Text style={styles.spatialBadgeText}>3D</Text>
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
                                accessibilityLabel="Deselect property"
                            >
                                <Ionicons name="close" size={13} color="#FFFFFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* 2. Compact Body with Strong Price Hierarchy */}
            <View style={styles.body}>
                <View style={styles.priceRow}>
                    <Text style={styles.price}>{priceText}</Text>
                    {item.transactionType === 'rent' && !priceText.includes('/mo') && !priceText.includes('/month') ? (
                        <Text style={styles.rentPeriod}>/month</Text>
                    ) : null}
                </View>

                <Text numberOfLines={1} style={styles.stayType}>
                    {stayType}
                </Text>

                <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={12} color={COLORS.secondary} style={{ marginRight: 2 }} />
                    <Text numberOfLines={1} style={styles.locationText}>
                        {locationText}
                    </Text>
                </View>

                {factsText ? (
                    <Text numberOfLines={1} style={styles.factsText}>
                        {factsText}
                    </Text>
                ) : null}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        width: 275,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        marginRight: 10,
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
        height: 108,
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
        fontSize: 10,
        marginTop: 3,
        color: COLORS.secondary,
        fontWeight: '500',
    },
    badgeRow: {
        position: 'absolute',
        top: 6,
        left: 6,
        right: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trustBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.success,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: BORDER_RADIUS.pill,
        ...SHADOWS.subtle,
    },
    trustBadgeText: {
        fontWeight: '700',
        fontSize: 10,
        color: '#FFFFFF',
    },
    topRightControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    spatialBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: BORDER_RADIUS.pill,
    },
    spatialBadgeText: {
        fontWeight: '700',
        fontSize: 10,
        color: '#FFFFFF',
    },
    dismissBtn: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    price: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.3,
    },
    rentPeriod: {
        marginLeft: 3,
        fontSize: 11,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    stayType: {
        marginTop: 1,
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primary,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    locationText: {
        fontSize: 11.5,
        color: COLORS.secondary,
        fontWeight: '500',
        flex: 1,
    },
    factsText: {
        marginTop: 2,
        fontSize: 11,
        color: COLORS.accentDark,
        fontWeight: '600',
    },
});

export default memo(PropertyResultCard);
