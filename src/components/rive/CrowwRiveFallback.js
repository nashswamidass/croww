import React from 'react';
import { View, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * High-fidelity fallback renderer matching the state machines.
 * Strictly adheres to the light Croww consumer visual system.
 */
export const CrowwRiveFallback = ({
    type,
    state,
    size = 40,
    style,
    color,
    label,
}) => {
    const accentColor = color || COLORS.accent || '#0F766E';

    switch (type) {
        case 'brand': {
            const isLoading = state?.isLoading;
            return (
                <View style={[styles.brandWrap, { width: size, height: size, borderRadius: Math.round(size * 0.22) }, style]}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={accentColor} />
                    ) : (
                        <Image
                            source={require('../../../assets/croww favicon.jpg')}
                            style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
                            resizeMode="cover"
                        />
                    )}
                </View>
            );
        }

        case 'save': {
            const isSaved = Boolean(state?.isSaved);
            const isPressed = Boolean(state?.isPressed);
            return (
                <View style={[styles.center, { width: size, height: size, opacity: isPressed ? 0.75 : 1 }, style]}>
                    <Ionicons
                        name={isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={size * 0.55}
                        color={isSaved ? accentColor : COLORS.primary}
                    />
                </View>
            );
        }

        case 'location-share': {
            // Status: 0=idle, 1=requesting, 2=pending, 3=approved, 4=declined, 5=revoked
            const statusNum = typeof state?.status === 'number' ? state.status : 0;
            const isApproved = statusNum === 3;
            const isPending = statusNum === 2;
            const isDeclined = statusNum === 4;

            let iconName = 'shield-outline';
            let iconColor = COLORS.secondary;

            if (isApproved) {
                iconName = 'location';
                iconColor = COLORS.success || '#10B981';
            } else if (isPending) {
                iconName = 'time-outline';
                iconColor = accentColor;
            } else if (isDeclined) {
                iconName = 'close-circle-outline';
                iconColor = COLORS.secondary;
            }

            return (
                <View style={[styles.rowCenter, style]}>
                    <Ionicons name={iconName} size={size * 0.45} color={iconColor} />
                    {label ? (
                        <Typography variant="caption" style={[styles.label, { color: iconColor }]}>
                            {label}
                        </Typography>
                    ) : null}
                </View>
            );
        }

        case 'empty-discovery': {
            return (
                <View style={[styles.emptyWrap, style]}>
                    <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
                        <Ionicons name="map-outline" size={size * 0.5} color={accentColor} />
                    </View>
                </View>
            );
        }

        case 'empty-saved': {
            return (
                <View style={[styles.emptyWrap, style]}>
                    <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
                        <Ionicons name="bookmark-outline" size={size * 0.5} color={accentColor} />
                    </View>
                </View>
            );
        }

        case 'empty-messages': {
            return (
                <View style={[styles.emptyWrap, style]}>
                    <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
                        <Ionicons name="chatbubbles-outline" size={size * 0.5} color={accentColor} />
                    </View>
                </View>
            );
        }

        case 'success': {
            return (
                <View style={[styles.center, { width: size, height: size }, style]}>
                    <View style={[styles.iconCircle, { width: size, height: size, backgroundColor: (COLORS.success || '#10B981') + '15' }]}>
                        <Ionicons name="checkmark-circle" size={size * 0.65} color={COLORS.success || '#10B981'} />
                    </View>
                </View>
            );
        }

        case 'post-wizard': {
            const step = state?.step || 1;
            return (
                <View style={[styles.wizardWrap, style]}>
                    <Typography variant="caption" style={{ color: accentColor, fontWeight: '700' }}>
                        Step {step} of 4
                    </Typography>
                </View>
            );
        }

        default:
            return (
                <View style={[styles.center, { width: size, height: size }, style]}>
                    <Ionicons name="sparkles-outline" size={size * 0.5} color={accentColor} />
                </View>
            );
    }
};

const styles = StyleSheet.create({
    center: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    brandWrap: {
        backgroundColor: (COLORS.accent || '#0F766E') + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.s,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontWeight: '600',
    },
    wizardWrap: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
    },
});

export default CrowwRiveFallback;
