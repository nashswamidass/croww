import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatBhk, formatListingPrice, formatSubtype } from '../../utils/propertyFormat';
import { listingCardTrustHint } from '../../domain/verification';
import { exploreSpatialHint } from '../../domain/spatial';
import { formatAvailabilityLabel } from '../../domain/property';

/**
 * Compact Property Result Card:
 * Sized conservatively to keep the map as the dominant surface.
 *
 * Structure:
 * ┌──────────────────────────────┐
 * │ image                        │
 * ├──────────────────────────────┤
 * │ ₹12K   Private Room          │
 * │ Adyar · Furnished · AC       │
 * └──────────────────────────────┘
 */
const PropertyResultCard = ({ item, selected, onPress, onDismiss, fullWidth, layout }) => {
    if (!item) return null;

    const isListLayout = Boolean(fullWidth || layout === 'list');
    const priceText = formatListingPrice(item);

    const formatCategory = (cat) => {
        if (!cat) return null;
        if (cat === 'stay_private_room') return 'Private Room';
        if (cat === 'stay_shared_room') return 'Shared Room';
        if (cat === 'stay_coliving') return 'Co-living';
        if (cat === 'stay_bed') return 'Bed';
        if (cat === 'stay_pg') return 'PG';
        if (cat === 'stay_roommate_replacement') return 'Roommate';
        return cat.replace(/^stay_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    // Stay Type: use category displayName / stay type, fallback to bhk/subtype
    const stayType = item.categoryDisplayName
        || item.categoryName
        || item.stayType
        || formatSubtype(item.subtype)
        || formatCategory(item.category)
        || [formatBhk(item.bedrooms), formatSubtype(item.subtype)].filter(Boolean).join(' ')
        || (item.category === 'land' ? 'Plot' : 'Stay');

    // Locality & City
    const rawLocality = item.localityName || item.locality || 'Adyar';
    const city = item.city || 'Chennai';
    const shortLocality = rawLocality.split(',')[0].trim();

    const availabilityData = item.availability || (
        item.availableCount != null
            ? {
                availableCount: item.availableCount,
                availabilityMode: item.availabilityMode || 'BED',
                availableFrom: item.availableFrom || null,
            }
            : null
    );
    const availabilityLabel = formatAvailabilityLabel(availabilityData);

    // 1-2 important facts
    const facts = [];
    if (availabilityLabel) {
        facts.push(availabilityLabel);
    }
    if (item.bathrooms) {
        facts.push(`${item.bathrooms} Bath`);
    } else if (item.furnishing) {
        facts.push(item.furnishing.charAt(0).toUpperCase() + item.furnishing.slice(1));
    } else if (item.furnished === true) {
        facts.push('Furnished');
    } else if (item.areaSqFt) {
        facts.push(`${item.areaSqFt} sq.ft`);
    }

    const factsText = facts.slice(0, 2).join(' · ');
    const subtitle = [shortLocality, factsText].filter(Boolean).join(' · ');

    const trustHint = listingCardTrustHint(item);
    const spatialHint = exploreSpatialHint(item);

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.card,
                isListLayout ? styles.fullWidth : styles.carouselWidth,
                selected && styles.cardSelected,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${priceText}, ${stayType}, in ${shortLocality}`}
            activeOpacity={0.92}
        >
            {/* 1. Compact Image Container */}
            <View style={[styles.imageContainer, isListLayout && styles.fullWidthImage]}>
                {item.coverThumbnailUrl || item.coverUrl ? (
                    <Image
                        source={{ uri: item.coverThumbnailUrl || item.coverUrl }}
                        style={styles.image}
                        contentFit="cover"
                        transition={120}
                    />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons name="home-outline" size={22} color={COLORS.tertiary} />
                    </View>
                )}

                {/* Badges on Image */}
                <View style={styles.badgeRow} pointerEvents="box-none">
                    {trustHint ? (
                        <View style={styles.trustBadge}>
                            <Ionicons name="shield-checkmark" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
                            <Text style={styles.trustBadgeText}>{trustHint}</Text>
                        </View>
                    ) : <View />}

                    <View style={styles.topRightControls}>
                        {spatialHint ? (
                            <View style={styles.spatialBadge}>
                                <Ionicons name="cube-outline" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
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
                                <Ionicons name="close" size={11} color="#FFFFFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* 2. Compact Body */}
            <View style={styles.body}>
                <View style={styles.topRow}>
                    <Text style={styles.price} numberOfLines={1}>{priceText}</Text>
                    <Text style={styles.stayType} numberOfLines={1}>{stayType}</Text>
                </View>

                <Text numberOfLines={1} style={styles.subText}>
                    {subtitle || `${shortLocality}, ${city}`}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        ...SHADOWS.floating,
    },
    carouselWidth: {
        width: 220,
        marginRight: 10,
    },
    fullWidth: {
        width: '100%',
        marginRight: 0,
        marginBottom: 12,
    },
    cardSelected: {
        borderColor: '#111827',
        borderWidth: 2,
    },
    imageContainer: {
        width: '100%',
        height: 84,
        backgroundColor: COLORS.surfaceHighlight,
        position: 'relative',
    },
    fullWidthImage: {
        height: 130,
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
    badgeRow: {
        position: 'absolute',
        top: 5,
        left: 5,
        right: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trustBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.success,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.pill,
    },
    trustBadgeText: {
        fontWeight: '700',
        fontSize: 9.5,
        color: '#FFFFFF',
    },
    topRightControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    spatialBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.pill,
    },
    spatialBadgeText: {
        fontWeight: '700',
        fontSize: 9.5,
        color: '#FFFFFF',
    },
    dismissBtn: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 6,
    },
    price: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.3,
    },
    stayType: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#4B5563',
        flexShrink: 1,
    },
    subText: {
        marginTop: 2,
        fontSize: 10.5,
        color: COLORS.secondary,
        fontWeight: '500',
    },
});

export default memo(PropertyResultCard);
