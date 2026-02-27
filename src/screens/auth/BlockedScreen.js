import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS } from '../../constants/theme';
import { authService } from '../../services/authService';

const BlockedScreen = () => {
    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <Ionicons name="ban" size={80} color={COLORS.error || '#FF4B4B'} />
                </View>

                <Typography variant="h1" style={styles.title}>Account Blocked</Typography>

                <Typography variant="body" style={styles.message}>
                    Your account has been suspended due to a violation of our community guidelines or terms of service.
                </Typography>

                <View style={styles.infoBox}>
                    <Typography variant="caption" style={styles.infoTitle}>What can I do?</Typography>
                    <Typography variant="caption" style={styles.infoText}>
                        If you believe this is a mistake, please contact our support team at:
                    </Typography>
                    <Typography variant="body" style={styles.email}>admin@croww.ai</Typography>
                </View>

                <AntigravityButton
                    title="Logout"
                    variant="secondary"
                    onPress={handleLogout}
                    style={styles.button}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    iconContainer: {
        marginBottom: SPACING.xl,
    },
    title: {
        marginBottom: SPACING.m,
        textAlign: 'center',
    },
    message: {
        textAlign: 'center',
        color: COLORS.secondary,
        marginBottom: SPACING.xxl,
        lineHeight: 24,
    },
    infoBox: {
        width: '100%',
        backgroundColor: COLORS.surfaceHighlight || '#F5F5F5',
        padding: SPACING.l,
        borderRadius: 12,
        marginBottom: SPACING.xxl,
    },
    infoTitle: {
        fontWeight: 'bold',
        marginBottom: SPACING.xs,
        color: COLORS.primary,
    },
    infoText: {
        color: COLORS.secondary,
        marginBottom: SPACING.s,
    },
    email: {
        fontWeight: '600',
        color: COLORS.accent,
    },
    button: {
        width: '100%',
    }
});

export default BlockedScreen;
