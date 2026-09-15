import React from 'react';
import { View, StyleSheet } from 'react-native';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatBhk, formatArea, formatOfferPrice, formatSubtype } from '../../utils/propertyFormat';

const PropertySummary = ({ listing, property, localityName }) => {
    const offer = formatOfferPrice(listing || {});
    const source = property || listing || {};
    const bhk = source.category === 'land' || source.category === 'commercial'
        ? null
        : formatBhk(source.bedrooms);
    const area = formatArea(source);
    const subtype = formatSubtype(source.subtype);
    const place = [localityName, listing?.city || property?.city].filter(Boolean).join(', ');
    const deal = listing?.transactionType === 'rent' ? 'For Rent' : listing?.transactionType === 'buy' ? 'For Sale' : null;
    const chips = [deal, bhk, area, subtype].filter(Boolean);

    return (
        <View style={styles.wrap}>
            {/* Quick Spec Pills */}
            <View style={styles.topRow}>
                {chips.length ? (
                    <View style={styles.chips} accessibilityLabel={chips.join(', ')}>
                        {chips.map((chip, idx) => (
                            <View key={chip} style={[styles.chip, idx === 0 && styles.chipHighlight]}>
                                <Typography
                                    variant="caption"
                                    style={[styles.chipText, idx === 0 && styles.chipHighlightText]}
                                >
                                    {chip}
                                </Typography>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>

            {/* Dominant Price */}
            <View style={styles.priceRow}>
                {offer.primary ? (
                    <Typography variant="display" style={styles.price} accessibilityRole="header">
                        {offer.primary}
                    </Typography>
                ) : null}
                {offer.negotiable ? (
                    <View style={styles.negotiablePill}>
                        <Typography variant="micro" style={styles.negotiableText}>Negotiable</Typography>
                    </View>
                ) : null}
            </View>

            {offer.secondary.map((line) => (
                <Typography key={line} variant="bodyMedium" style={styles.secondaryPrice}>{line}</Typography>
            ))}

            {/* Property Title */}
            {listing?.title ? (
                <Typography variant="titleLarge" style={styles.title}>{listing.title}</Typography>
            ) : null}

            {/* Locality & City */}
            {place ? (
                <Typography variant="bodyLarge" style={styles.place}>📍 {place}</Typography>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    price: {
        fontSize: 34,
        fontWeight: '900',
        letterSpacing: -1,
        color: COLORS.primary,
    },
    negotiablePill: {
        backgroundColor: COLORS.accentMuted,
        paddingHorizontal: SPACING.s,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.round,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    negotiableText: {
        color: COLORS.accent,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    secondaryPrice: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    title: {
        marginTop: SPACING.s,
        fontWeight: '800',
        color: COLORS.primary,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        backgroundColor: COLORS.surface,
        ...SHADOWS.subtle,
    },
    chipHighlight: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    chipText: {
        color: COLORS.secondary,
        fontWeight: '700',
    },
    chipHighlightText: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    place: {
        color: COLORS.secondary,
        marginTop: SPACING.xs,
        fontWeight: '600',
    },
});

export default PropertySummary;
