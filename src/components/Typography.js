import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES } from '../constants/theme';

const Typography = ({
    children,
    variant = 'body',
    color = COLORS.primary,
    style,
    ...props
}) => {
    return (
        <Text
            style={[styles[variant], { color }, style]}
            {...props}
        >
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    h1: {
        fontSize: 24, // Reduced from 26
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 20, // Reduced from 22
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    h3: {
        fontSize: 16,
        fontWeight: '600',
    },
    body: {
        fontSize: FONT_SIZES.m,
        fontWeight: '400',
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    caption: {
        fontSize: FONT_SIZES.s,
        fontWeight: '400',
        color: COLORS.secondary,
    },
    small: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    }
});

export default Typography;
