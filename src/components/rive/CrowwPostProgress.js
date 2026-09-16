import React from 'react';
import { View, StyleSheet } from 'react-native';
import CrowwRive from './CrowwRive';
import { POST_WIZARD_RIVE_SPEC } from './specs/postWizard.spec';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * Priority #4: Post Listing Wizard Progress & Status Motion
 * 
 * Provides subtle state transitions between step 1 to 4, submission loading,
 * and completion celebration without distracting form inputs.
 */
export const CrowwPostProgress = ({
    step = 1,
    isSubmitting = false,
    isSuccess = false,
    isFailed = false,
    totalSteps = 4,
    size = 32,
    style,
}) => {
    const inputs = {
        step,
        isSubmitting,
        isSuccess,
        isFailed,
    };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.riveWrap}>
                <CrowwRive
                    artboard={POST_WIZARD_RIVE_SPEC.artboard}
                    artboardName={POST_WIZARD_RIVE_SPEC.artboard}
                    stateMachineName={POST_WIZARD_RIVE_SPEC.stateMachine}
                    inputs={inputs}
                    fallbackType="post-wizard"
                    fallbackState={{ step, isSubmitting, isSuccess, isFailed }}
                    fallbackSize={size}
                    style={{ width: size, height: size }}
                />
            </View>

            <View style={styles.barContainer}>
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => {
                    const isCompleted = s < step || isSuccess;
                    const isCurrent = s === step && !isSuccess;
                    return (
                        <View
                            key={s}
                            style={[
                                styles.barSegment,
                                isCompleted && styles.barCompleted,
                                isCurrent && styles.barCurrent,
                            ]}
                        />
                    );
                })}
            </View>

            <Typography variant="caption" style={styles.stepText}>
                Step {step} of {totalSteps}
            </Typography>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: SPACING.s,
    },
    riveWrap: {
        marginBottom: 6,
    },
    barContainer: {
        flexDirection: 'row',
        width: '100%',
        maxWidth: 240,
        gap: 6,
        marginBottom: 6,
    },
    barSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.surfaceHighlight || '#E5E7EB',
    },
    barCompleted: {
        backgroundColor: COLORS.accent,
    },
    barCurrent: {
        backgroundColor: COLORS.accent,
        opacity: 0.85,
    },
    stepText: {
        color: COLORS.secondary,
        fontWeight: '600',
    },
});

export default CrowwPostProgress;
