import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, TOUCH_TARGETS, SHADOWS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const AntigravityButton = ({
    title,
    onPress,
    variant = 'primary',
    size = 'default', // 'default' (52dp), 'large' (56dp), 'small' (44dp)
    loading = false,
    style,
    textStyle,
    disabled,
    icon,
    iconPosition = 'left',
    accessibilityLabel,
}) => {
    const isPrimary = variant === 'primary';
    const isSecondary = variant === 'secondary';
    const isOutline = variant === 'outline';
    const isDestructive = variant === 'destructive';
    const isGhost = variant === 'ghost';

    let iconColor = '#FFFFFF';
    let textColor = '#FFFFFF';

    if (isSecondary) {
        iconColor = COLORS.primary;
        textColor = COLORS.primary;
    } else if (isOutline || isGhost) {
        iconColor = COLORS.primary;
        textColor = COLORS.primary;
    } else if (isDestructive) {
        iconColor = '#FFFFFF';
        textColor = '#FFFFFF';
    } else if (isPrimary) {
        iconColor = '#FFFFFF';
        textColor = '#FFFFFF';
    }

    const height = size === 'large'
        ? TOUCH_TARGETS.buttonLarge
        : size === 'small'
            ? TOUCH_TARGETS.buttonSmall
            : TOUCH_TARGETS.button;

    return (
        <TouchableOpacity
            style={[
                styles.base,
                { height },
                isPrimary && styles.primary,
                isSecondary && styles.secondary,
                isOutline && styles.outline,
                isDestructive && styles.destructive,
                isGhost && styles.ghost,
                disabled && styles.disabled,
                style
            ]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            accessibilityState={{ disabled: !!(disabled || loading) }}
            hitSlop={TOUCH_TARGETS.hitSlop}
        >
            {loading ? (
                <ActivityIndicator color={iconColor} size="small" />
            ) : (
                <View style={styles.content}>
                    {icon && iconPosition === 'left' && (
                        <Ionicons
                            name={icon}
                            size={size === 'large' ? 22 : 19}
                            color={iconColor}
                            style={styles.iconLeft}
                        />
                    )}
                    <Typography
                        variant={size === 'large' ? 'bodyLarge' : 'bodyMedium'}
                        style={[
                            styles.label,
                            { color: textColor },
                            textStyle
                        ]}
                    >
                        {title}
                    </Typography>
                    {icon && iconPosition === 'right' && (
                        <Ionicons
                            name={icon}
                            size={size === 'large' ? 22 : 19}
                            color={iconColor}
                            style={styles.iconRight}
                        />
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: BORDER_RADIUS.button,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        minWidth: 120,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    primary: {
        backgroundColor: COLORS.accent,
        borderWidth: 0,
        ...SHADOWS.subtle,
    },
    secondary: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: COLORS.borderLight,
    },
    destructive: {
        backgroundColor: COLORS.error,
        borderWidth: 0,
    },
    ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    iconLeft: {
        marginRight: SPACING.s,
    },
    iconRight: {
        marginLeft: SPACING.s,
    },
    disabled: {
        opacity: 0.45,
        shadowOpacity: 0,
        elevation: 0,
    },
});

export default AntigravityButton;
