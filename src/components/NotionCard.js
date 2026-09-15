import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

const NotionCard = ({ children, style, onPress, ...props }) => {
    const Container = onPress ? TouchableOpacity : View;

    return (
        <Container
            style={[styles.card, style]}
            onPress={onPress}
            activeOpacity={0.88}
            {...props}
        >
            {children}
        </Container>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.l,
        ...SHADOWS.subtle,
    },
});

export default NotionCard;
