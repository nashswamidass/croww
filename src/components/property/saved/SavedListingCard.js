import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import PropertyResultCard from '../PropertyResultCard';
import Typography from '../../Typography';
import { COLORS, SPACING } from '../../../constants/theme';
import { listingOfferState, listingStatusLabel } from '../../../utils/propertyDetailView';

const SavedListingCard = ({ item, onPress, onUnsave }) => {
    const listing = item?.listing;
    const snapshot = item?.snapshot || {};
    const display = listing ? {
        listingId: listing.id,
        transactionType: listing.transactionType,
        price: listing.transactionType === 'rent' ? listing.rentMonthly : listing.askingPrice,
        bedrooms: listing.bedrooms,
        builtUpAreaSqft: listing.builtUpAreaSqft,
        plotAreaSqft: listing.plotAreaSqft,
        subtype: listing.subtype,
        city: listing.city || snapshot.city,
        coverThumbnailUrl: listing.coverThumbnailUrl || snapshot.coverThumbnailUrl,
        lastVerifiedAt: listing.lastVerifiedAt,
        publishedAt: listing.publishedAt,
    } : {
        listingId: item?.listingId,
        transactionType: snapshot.transactionType,
        price: snapshot.transactionType === 'rent' ? snapshot.rentMonthly : snapshot.askingPrice,
        bedrooms: snapshot.bedrooms,
        city: snapshot.city,
        coverThumbnailUrl: snapshot.coverThumbnailUrl,
        subtype: null,
    };
    const state = listingOfferState(listing);
    const statusText = item?.missing
        ? (item.propertyId ? 'This listing is no longer active. Open the property to see current offers.' : 'This listing is no longer available')
        : listingStatusLabel(listing);

    return (
        <View style={styles.wrap}>
            <PropertyResultCard item={display} onPress={onPress} fullWidth />
            {statusText && state !== 'published' ? (
                <Typography variant="caption" style={styles.status}>{statusText}</Typography>
            ) : null}
            {onUnsave ? (
                <TouchableOpacity
                    onPress={onUnsave}
                    accessibilityRole="button"
                    accessibilityLabel="Remove saved listing"
                    style={styles.remove}
                >
                    <Typography variant="caption" style={styles.removeText}>Remove</Typography>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        marginBottom: SPACING.m,
    },
    status: {
        color: COLORS.secondary,
        marginTop: SPACING.xs,
        textTransform: 'none',
    },
    remove: {
        minHeight: 44,
        justifyContent: 'center',
    },
    removeText: {
        color: COLORS.secondary,
        textTransform: 'none',
    },
});

export default SavedListingCard;
