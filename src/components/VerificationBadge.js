import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING } from '../constants/theme';

const VerificationBadge = ({ status = 'none', type = null }) => {
    const getConfig = () => {
        switch (status) {
            case 'verified':
                return {
                    icon: 'checkmark-circle',
                    color: COLORS.success,
                    text: type === 'business' ? 'Business Verified' : 'Verified',
                    bgColor: `${COLORS.success}20`
                };
            case 'pending':
                return {
                    icon: 'time-outline',
                    color: COLORS.accent,
                    text: 'Verification Pending',
                    bgColor: `${COLORS.accent}20`
                };
            default:
                return null;
        }
    };

    const config = getConfig();

    if (!config) return null;

    return (
        <View style={[styles.container, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={16} color={config.color} />
            <Typography variant="caption" style={[styles.text, { color: config.color }]}>
                {config.text}
            </Typography>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    text: {
        marginLeft: 4,
        fontWeight: '600',
    },
});

export default VerificationBadge;
