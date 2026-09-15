import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from '../constants/theme';

const FloatingCard = ({
    children,
    style,
    elevation = 'soft', // 'subtle', 'soft', 'medium', 'floating'
    padding = SPACING.l,
    ...props
}) => {
    const shadowStyle = elevation === 'floating'
        ? SHADOWS.floating
        : elevation === 'medium'
            ? SHADOWS.medium
            : elevation === 'subtle'
                ? SHADOWS.subtle
                : SHADOWS.soft;

    return (
        <View
            style={[
                styles.card,
                shadowStyle,
                { padding },
                style
            ]}
            {...props}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
});

export default FloatingCard;
