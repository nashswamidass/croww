import React from 'react';
import { View, StyleSheet } from 'react-native';
import CrowwRive from './CrowwRive';
import { EMPTY_STATES_RIVE_SPEC } from './specs/emptyStates.spec';
import Typography from '../Typography';
import AntigravityButton from '../AntigravityButton';
import FloatingCard from '../FloatingCard';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * Priority #5: Reusable Rive Empty State Component
 * 
 * Supports: 'discovery', 'saved', 'messages'
 * Renders light, calm, activity-inspiring motion rather than static dead ends.
 */
export const CrowwEmptyState = ({
    type = 'discovery',
    title,
    subtitle,
    actionTitle,
    onAction,
    actionIcon,
    size = 80,
    style,
}) => {
    const artboard = EMPTY_STATES_RIVE_SPEC.artboards[type] || EMPTY_STATES_RIVE_SPEC.artboards.discovery;

    return (
        <FloatingCard style={[styles.card, style]}>
            <View style={styles.riveWrap}>
                <CrowwRive
                    artboard={artboard}
                    artboardName={artboard}
                    stateMachineName={EMPTY_STATES_RIVE_SPEC.stateMachine}
                    inputs={{ isActive: true }}
                    fallbackType={`empty-${type}`}
                    fallbackSize={size}
                    style={{ width: size, height: size }}
                />
            </View>

            {title ? (
                <Typography variant="titleLarge" style={styles.title}>
                    {title}
                </Typography>
            ) : null}

            {subtitle ? (
                <Typography variant="bodyMedium" style={styles.subtitle}>
                    {subtitle}
                </Typography>
            ) : null}

            {actionTitle && onAction ? (
                <AntigravityButton
                    title={actionTitle}
                    icon={actionIcon}
                    onPress={onAction}
                    style={styles.actionBtn}
                />
            ) : null}
        </FloatingCard>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: SPACING.xl,
        alignItems: 'center',
        marginHorizontal: SPACING.l,
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
    },
    riveWrap: {
        marginBottom: SPACING.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontWeight: '800',
        textAlign: 'center',
        color: COLORS.primary,
        marginBottom: 6,
    },
    subtitle: {
        textAlign: 'center',
        color: COLORS.secondary,
        lineHeight: 22,
        maxWidth: 340,
        marginBottom: SPACING.l,
    },
    actionBtn: {
        width: '100%',
        maxWidth: 280,
    },
});

export default CrowwEmptyState;
