import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * Shared empty shell layout. No Firestore reads. No fake listings.
 */
const ShellPlaceholder = ({ title, subtitle, children }) => {
    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <Typography variant="h1">{title}</Typography>
                {subtitle ? (
                    <Typography variant="body" style={styles.subtitle}>
                        {subtitle}
                    </Typography>
                ) : null}
            </View>
            <View style={styles.body}>
                {children}
            </View>
        </ScreenWrapper>
    );
};

export const PlaceholderCard = ({ title, body }) => (
    <NotionCard style={styles.card}>
        <Typography variant="h3">{title}</Typography>
        <Typography variant="body" style={styles.cardBody}>{body}</Typography>
    </NotionCard>
);

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        paddingBottom: SPACING.s,
    },
    subtitle: {
        color: COLORS.secondary,
        marginTop: SPACING.s,
    },
    body: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.s,
        gap: SPACING.m,
    },
    card: {
        marginBottom: SPACING.m,
    },
    cardBody: {
        color: COLORS.secondary,
        marginTop: SPACING.s,
    },
});

export default ShellPlaceholder;
