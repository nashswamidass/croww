import React from 'react';
import {
    Modal,
    View,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import AntigravityButton from '../AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';

/**
 * Contextual authentication bottom sheet / modal.
 * Clean, light consumer design.
 */
const AuthPromptModal = ({
    visible,
    onClose,
    navigation,
    title = 'Create your Croww account',
    subtitle = "You're one step away from continuing this action.",
    icon = 'person-circle-outline',
    actionContext = null,
}) => {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    if (!visible) return null;

    const handleLogin = () => {
        onClose?.();
        navigation?.navigate('Auth', {
            screen: 'Login',
            params: { returnAction: actionContext },
        });
    };

    const handleSignup = () => {
        onClose?.();
        navigation?.navigate('Auth', {
            screen: 'Signup',
            params: { returnAction: actionContext },
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.backdrop}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.sheet, isDesktop && styles.desktopSheet]}>
                            {/* Drag Indicator */}
                            <View style={styles.indicator} />

                            {/* Header Icon */}
                            <View style={styles.iconContainer}>
                                <Ionicons name={icon} size={32} color={COLORS.accent} />
                            </View>

                            {/* Titles */}
                            <Typography variant="titleLarge" style={styles.title}>
                                {title}
                            </Typography>
                            <Typography variant="bodyMedium" style={styles.subtitle}>
                                {subtitle}
                            </Typography>

                            {/* Actions */}
                            <View style={styles.ctaGroup}>
                                <AntigravityButton
                                    title="Continue with Email"
                                    onPress={handleLogin}
                                    size="large"
                                    style={styles.primaryButton}
                                />

                                <AntigravityButton
                                    title="Create account"
                                    variant="secondary"
                                    onPress={handleSignup}
                                    size="large"
                                    style={styles.secondaryButton}
                                />

                                <TouchableOpacity
                                    onPress={onClose}
                                    style={styles.dismissButton}
                                    hitSlop={TOUCH_TARGETS.hitSlop}
                                    accessibilityRole="button"
                                    accessibilityLabel="Maybe later"
                                >
                                    <Typography variant="bodyMedium" style={styles.dismissText}>
                                        Maybe later
                                    </Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    sheet: {
        width: '100%',
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.sheet,
        borderTopRightRadius: BORDER_RADIUS.sheet,
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.m,
        paddingBottom: SPACING.xxl,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.floating,
    },
    desktopSheet: {
        maxWidth: 440,
        marginBottom: 40,
        borderRadius: BORDER_RADIUS.sheet,
    },
    indicator: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: 'center',
        marginBottom: SPACING.l,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: SPACING.m,
    },
    title: {
        textAlign: 'center',
        fontWeight: '800',
        color: COLORS.primary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        textAlign: 'center',
        color: COLORS.secondary,
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.xl,
        lineHeight: 22,
    },
    ctaGroup: {
        width: '100%',
        gap: 12,
    },
    primaryButton: {
        height: 52,
        borderRadius: BORDER_RADIUS.button,
    },
    secondaryButton: {
        height: 52,
        borderRadius: BORDER_RADIUS.button,
    },
    dismissButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.s,
        marginTop: 4,
    },
    dismissText: {
        color: COLORS.secondary,
        fontWeight: '600',
    },
});

export default AuthPromptModal;
