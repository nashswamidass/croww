import React from 'react';
import { View, StyleSheet } from 'react-native';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';
import { freshnessLines } from '../../utils/propertyDetailView';

const PropertyFreshness = ({ listing, property }) => {
    const lines = freshnessLines(listing || {}, property || {});
    if (!lines.length) return null;

    return (
        <View style={styles.wrap} accessibilityLabel="Listing freshness">
            {lines.map((line) => (
                <Typography key={line.key} variant="caption" style={styles.line}>
                    {line.text}
                </Typography>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        gap: 2,
    },
    line: {
        color: COLORS.secondary,
        textTransform: 'none',
    },
});

export default PropertyFreshness;
