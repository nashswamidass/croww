import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import CrowwRive from './CrowwRive';
import { BRAND_RIVE_SPEC } from './specs/brand.spec';
import CrowwRiveFallback from './CrowwRiveFallback';
import { TOUCH_TARGETS } from '../../constants/theme';

/**
 * Reusable Rive-powered Croww Logo with State Machine integration.
 * 
 * Supports states:
 * - 'intro'
 * - 'idle'
 * - 'loading'
 * - 'success'
 * - 'error'
 * 
 * Never blocks app initialization or delays navigation.
 * Gracefully falls back to CrowwRiveFallback if Rive cannot render.
 */
export const CrowwLogo = ({
    state = 'idle',
    size = 48,
    onPress,
    style,
    accessibilityLabel = 'Croww logo',
}) => {
    const isLoading = state === 'loading';
    const isSuccess = state === 'success';
    const isError = state === 'error';
    const isIntro = state === 'intro';

    // Map high-level state machine inputs to Rive BrandSM
    const inputs = {
        isLoading,
        isSuccess,
        isError,
        isIntro,
        triggerHover: undefined,
    };

    const content = (
        <CrowwRive
            artboard={BRAND_RIVE_SPEC.artboard}
            artboardName={BRAND_RIVE_SPEC.artboard}
            stateMachineName={BRAND_RIVE_SPEC.stateMachine}
            inputs={inputs}
            fallbackType={isSuccess ? 'success' : 'brand'}
            fallbackState={{ isLoading, state }}
            fallbackSize={size}
            style={[{ width: size, height: size }, style]}
        />
    );

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                hitSlop={TOUCH_TARGETS.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                style={[styles.container, { width: size, height: size }]}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return <View style={[styles.container, { width: size, height: size }]}>{content}</View>;
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CrowwLogo;
