import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';
import { formatBhk, formatSubtype } from '../../../utils/propertyFormat';

const SavedPropertyCard = ({ item, onPress, onUnsave }) => {
    const property = item?.property;
    const snapshot = item?.snapshot || {};
    const title = formatSubtype(property?.subtype || snapshot.subtype) || snapshot.title || 'Property';
    const place = [property?.city || snapshot.city, snapshot.localityName].filter(Boolean).join(' · ');
    const cover = property?.coverThumbnailUrl || snapshot.coverThumbnailUrl;
    const count = item?.publishedListingCount || 0;
    const missing = item?.missing;
    const inactive = property && property.status && property.status !== 'ACTIVE';

    return (
        <View style={styles.wrap}>
            <TouchableOpacity
                onPress={onPress}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${place || 'saved property'}`}
            >
                <View style={styles.thumb}>
                    {cover ? (
                        <Image source={{ uri: cover }} style={styles.image} contentFit="cover" />
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="home-outline" size={22} color={COLORS.secondary} />
                        </View>
                    )}
                </View>
                <View style={styles.body}>
                    <Typography variant="h3" numberOfLines={1}>{title}</Typography>
                    <Typography variant="caption" style={styles.meta} numberOfLines={1}>
                        {[formatBhk(property?.bedrooms || snapshot.bedrooms), place].filter(Boolean).join(' · ')}
                    </Typography>
                    <Typography variant="caption" style={styles.meta}>
                        {missing
                            ? 'Property is no longer available'
                            : inactive
                                ? 'This property is not active'
                                : count
                                    ? `${count} published listing${count === 1 ? '' : 's'}`
                                    : 'No published listings right now'}
                    </Typography>
                </View>
            </TouchableOpacity>
            {onUnsave ? (
                <TouchableOpacity
                    onPress={onUnsave}
                    accessibilityRole="button"
                    accessibilityLabel="Remove saved property"
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
    card: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    thumb: {
        width: 88,
        height: 88,
        backgroundColor: COLORS.surfaceHighlight,
    },
    image: { width: '100%', height: '100%' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, padding: SPACING.s, justifyContent: 'center' },
    meta: { color: COLORS.secondary, marginTop: 2, textTransform: 'none' },
    remove: { minHeight: 44, justifyContent: 'center' },
    removeText: { color: COLORS.secondary, textTransform: 'none' },
});

export default SavedPropertyCard;
