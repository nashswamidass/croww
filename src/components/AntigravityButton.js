import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const AntigravityButton = ({
    title,
    onPress,
    variant = 'primary',
    loading = false,
    style,
    disabled,
    icon
}) => {
    const isPrimary = variant === 'primary';
    const iconColor = isPrimary ? COLORS.background : COLORS.primary;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isPrimary ? styles.primary : styles.secondary,
                disabled && styles.disabled,
                style
            ]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={iconColor} />
            ) : (
                <View style={styles.content}>
                    {icon && (
                        <Ionicons
                            name={icon}
                            size={20}
                            color={iconColor}
                            style={{ marginRight: SPACING.s }}
                        />
                    )}
                    <Typography
                        variant="body"
                        style={{
                            fontWeight: '600',
                            color: iconColor
                        }}
                    >
                        {title}
                    </Typography>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 44,
        borderRadius: BORDER_RADIUS.m,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        minWidth: 120,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primary: {
        backgroundColor: COLORS.primary,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    secondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    disabled: {
        opacity: 0.5,
    },
});

export default AntigravityButton;
