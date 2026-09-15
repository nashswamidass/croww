import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';
import { trustBadges } from '../../domain/verification';

const PropertyVerification = ({ property, listing, actorTrust }) => {
    const badges = trustBadges({ property, listing, actorTrust });
    if (!badges.length) return null;

    return (
        <View style={styles.wrap} accessibilityLabel="Verification status">
            {badges.map((badge) => (
                <View
                    key={badge.key}
                    style={styles.badge}
                    accessibilityRole="text"
                    accessibilityLabel={`${badge.label}. ${badge.explanation}`}
                >
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <View>
                        <Typography variant="caption" style={styles.text}>{badge.label}</Typography>
                    </View>
                </View>
            ))}
            <Typography variant="caption" style={styles.hint}>
                Verified by Croww based on submitted evidence. Not a legal guarantee.
            </Typography>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.surface,
        borderRadius: 999,
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    text: {
        color: COLORS.success,
        fontWeight: '600',
        textTransform: 'none',
    },
    hint: {
        color: COLORS.secondary,
        width: '100%',
        marginTop: SPACING.s,
    },
});

export default PropertyVerification;
