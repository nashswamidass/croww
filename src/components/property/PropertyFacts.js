import React from 'react';
import { View, StyleSheet } from 'react-native';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';
import { buildPropertyFacts } from '../../utils/propertyDetailView';

const PropertyFacts = ({ property, listing }) => {
    const facts = buildPropertyFacts(property || {}, listing || {});
    if (!facts.length) return null;

    return (
        <View style={styles.wrap} accessibilityLabel="Property facts">
            <Typography variant="h3" style={styles.heading}>Facts</Typography>
            <View style={styles.grid}>
                {facts.map((fact) => (
                    <View key={fact.label} style={styles.cell}>
                        <Typography variant="caption" style={styles.label}>{fact.label}</Typography>
                        <Typography variant="body" style={styles.value}>{fact.value}</Typography>
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
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.m,
    },
    cell: {
        width: '46%',
        minWidth: 140,
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        padding: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    label: {
        color: COLORS.secondary,
        textTransform: 'none',
        marginBottom: 4,
    },
    value: {
        fontWeight: '600',
    },
});

export default PropertyFacts;
