import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import CrowwRive from './CrowwRive';
import { BRAND_RIVE_SPEC } from './specs/brand.spec';
import { TOUCH_TARGETS } from '../../constants/theme';

/**
 * Priority #1: Croww Brand Logo
 * 
 * Short, calm, subtle brand presence for header, auth screens, or splash.
 * Never delays interactive discovery.
 */
export const CrowwBrandLogo = ({
    size = 48,
    isLoading = false,
    onPress,
    style,
    accessibilityLabel = 'Croww home logo',
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const inputs = {
        isLoading,
        triggerHover: isHovered ? 'trigger' : undefined,
    };

    const content = (
        <CrowwRive
            artboard={BRAND_RIVE_SPEC.artboard}
            artboardName={BRAND_RIVE_SPEC.artboard}
            stateMachineName={BRAND_RIVE_SPEC.stateMachine}
            inputs={inputs}
            fallbackType="brand"
            fallbackState={{ isLoading, isHovered }}
            fallbackSize={size}
            style={[{ width: size, height: size }, style]}
        />
    );

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                hitSlop={TOUCH_TARGETS.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                style={[styles.pressable, { width: size, height: size }]}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return content;
};

const styles = StyleSheet.create({
    pressable: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CrowwBrandLogo;
