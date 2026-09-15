import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES } from '../constants/theme';

const Typography = ({
    children,
    variant = 'body',
    color = COLORS.primary,
    weight,
    style,
    ...props
}) => {
    return (
        <Text
            style={[
                styles[variant] || styles.body,
                { color },
                weight ? { fontWeight: weight } : null,
                style
            ]}
            {...props}
        >
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    display: {
        fontSize: FONT_SIZES.display,
        fontWeight: '800',
        letterSpacing: -0.8,
        lineHeight: 42,
    },
    titleLarge: {
        fontSize: FONT_SIZES.title,
        fontWeight: '700',
        letterSpacing: -0.5,
        lineHeight: 34,
    },
    h1: {
        fontSize: FONT_SIZES.title,
        fontWeight: '700',
        letterSpacing: -0.5,
        lineHeight: 34,
    },
    titleMedium: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: '700',
        letterSpacing: -0.3,
        lineHeight: 30,
    },
    h2: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: '700',
        letterSpacing: -0.3,
        lineHeight: 30,
    },
    titleSmall: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        letterSpacing: -0.2,
        lineHeight: 26,
    },
    h3: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        letterSpacing: -0.2,
        lineHeight: 26,
    },
    price: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.6,
        lineHeight: 34,
        color: COLORS.primary,
    },
    bodyLarge: {
        fontSize: FONT_SIZES.l,
        fontWeight: '400',
        lineHeight: 24,
        letterSpacing: 0,
    },
    body: {
        fontSize: FONT_SIZES.m,
        fontWeight: '400',
        lineHeight: 22,
        letterSpacing: 0.1,
    },
    bodyMedium: {
        fontSize: FONT_SIZES.m,
        fontWeight: '500',
        lineHeight: 22,
        letterSpacing: 0.1,
    },
    caption: {
        fontSize: FONT_SIZES.s,
        fontWeight: '400',
        lineHeight: 18,
        color: COLORS.secondary,
    },
    micro: {
        fontSize: FONT_SIZES.micro,
        fontWeight: '600',
        lineHeight: 15,
        letterSpacing: 0.2,
        color: COLORS.secondary,
    },
    small: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: COLORS.secondary,
    }
});

export default Typography;
