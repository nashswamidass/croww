import React from 'react';
import { View, StyleSheet } from 'react-native';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';

const PropertyAmenities = ({ amenities }) => {
    const items = Array.isArray(amenities)
        ? amenities.map((item) => String(item).trim()).filter(Boolean)
        : [];
    if (!items.length) return null;

    return (
        <View style={styles.wrap} accessibilityLabel="Amenities">
            <Typography variant="h3" style={styles.heading}>Amenities</Typography>
            <View style={styles.chips}>
                {items.map((item) => (
                    <View key={item} style={styles.chip}>
                        <Typography variant="caption" style={styles.text}>{item}</Typography>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
    },
    heading: {
        marginBottom: SPACING.m,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    chip: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
    },
    text: {
        color: COLORS.primary,
        textTransform: 'none',
    },
});

export default PropertyAmenities;
