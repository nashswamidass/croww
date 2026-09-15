import React from 'react';
import { View, StyleSheet } from 'react-native';
import Typography from '../Typography';
import NotionCard from '../NotionCard';
import { COLORS, SPACING } from '../../constants/theme';

const LocalityEvidenceSection = ({
    title,
    statusLabel,
    footnote,
    rows,
    children,
}) => {
    const showRows = Array.isArray(rows) && rows.length > 0;
    const empty = !showRows && !children;

    return (
        <NotionCard
            style={styles.card}
            accessibilityRole="summary"
            accessibilityLabel={`${title}${statusLabel ? `, ${statusLabel}` : ''}`}
        >
            <Typography variant="h3" accessibilityRole="header">{title}</Typography>
            {statusLabel ? (
                <Typography variant="caption" style={styles.status}>{statusLabel}</Typography>
            ) : null}
            {showRows ? rows.map((row) => (
                <View key={row.label} style={styles.row} accessible accessibilityLabel={`${row.label}: ${row.value}${row.meta ? `. ${row.meta}` : ''}`}>
                    <Typography variant="caption" style={styles.label}>{row.label}</Typography>
                    <Typography variant="body" style={styles.value}>{row.value}</Typography>
                    {row.meta ? (
                        <Typography variant="caption" style={styles.meta}>{row.meta}</Typography>
                    ) : null}
                </View>
            )) : null}
            {empty ? (
                <Typography variant="body" style={styles.empty}>Data unavailable</Typography>
            ) : null}
            {children}
            {footnote ? (
                <Typography variant="caption" style={styles.footnote}>{footnote}</Typography>
            ) : null}
        </NotionCard>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: SPACING.m,
    },
    status: {
        color: COLORS.secondary,
        marginTop: 4,
        textTransform: 'none',
    },
    row: {
        marginTop: SPACING.m,
    },
    label: {
        color: COLORS.secondary,
        textTransform: 'none',
    },
    value: {
        marginTop: 2,
    },
    meta: {
        color: COLORS.secondary,
        marginTop: 2,
        textTransform: 'none',
    },
    empty: {
        color: COLORS.secondary,
        marginTop: SPACING.s,
    },
    footnote: {
        color: COLORS.secondary,
        marginTop: SPACING.m,
        textTransform: 'none',
    },
});

export default LocalityEvidenceSection;
