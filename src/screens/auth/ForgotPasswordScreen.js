import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS, TOUCH_TARGETS, SHADOWS } from '../../constants/theme';
import { authService } from '../../services/authService';

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const handleSend = async () => {
        const trimmed = email.trim();
        if (!trimmed) {
            setErrorMessage('Please enter your email address.');
            return;
        }
        setErrorMessage(null);
        setLoading(true);
        try {
            await authService.resetPassword(trimmed);
            setSent(true);
        } catch (error) {
            console.error('[ForgotPassword] Error:', error);
            let msg = 'Failed to send reset email. Please try again.';
            if (error.code === 'auth/user-not-found') {
                msg = 'No account found with this email address.';
            } else if (error.code === 'auth/invalid-email') {
                msg = 'Please enter a valid email address.';
            } else if (error.message) {
                msg = error.message;
            }
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Top Bar with Back Button */}
                    <View style={styles.topBar}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                            hitSlop={TOUCH_TARGETS.hitSlop}
                        >
                            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    {sent ? (
                        <View style={styles.successContainer}>
                            <View style={styles.successIconWrapper}>
                                <Ionicons name="mail-unread-outline" size={44} color={COLORS.accent} />
                            </View>
                            <Typography variant="display" style={styles.title}>
                                Check your inbox
                            </Typography>
                            <Typography variant="bodyLarge" style={styles.subtitle}>
                                {"We've sent password reset instructions to"}
                                <Typography variant="bodyLarge" style={{ fontWeight: '700', color: COLORS.primary }}>
                                    {' '}{email.trim()}
                                </Typography>.
                            </Typography>

                            <AntigravityButton
                                title="Back to Sign in"
                                onPress={() => navigation.navigate('Login')}
                                size="large"
                                style={styles.primaryButton}
                            />
                        </View>
                    ) : (
                        <View style={styles.formContainer}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Typography variant="display" style={styles.title}>
                                    Reset password
                                </Typography>
                                <Typography variant="bodyLarge" style={styles.subtitle}>
                                    {"Enter the email associated with your Croww account and we'll send you a reset link."}
                                </Typography>
                            </View>

                            {/* Error Banner */}
                            {errorMessage ? (
                                <View style={styles.errorBanner}>
                                    <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
                                    <Typography variant="bodyMedium" style={styles.errorText}>
                                        {errorMessage}
                                    </Typography>
                                </View>
                            ) : null}

                            {/* Form Input */}
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" style={styles.inputLabel}>
                                    Email address
                                </Typography>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="name@example.com"
                                        placeholderTextColor={COLORS.tertiary}
                                        value={email}
                                        onChangeText={(t) => {
                                            setEmail(t);
                                            if (errorMessage) setErrorMessage(null);
                                        }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            {/* CTA */}
                            <AntigravityButton
                                title="Send reset link"
                                onPress={handleSend}
                                loading={loading}
                                size="large"
                                style={styles.primaryButton}
                            />

                            <TouchableOpacity
                                onPress={() => navigation.navigate('Login')}
                                style={styles.returnButton}
                                accessibilityRole="button"
                                hitSlop={TOUCH_TARGETS.hitSlop}
                            >
                                <Typography variant="bodyMedium" style={styles.returnText}>
                                    Remember your password? <Typography variant="bodyMedium" style={styles.returnTextBold}>Log in</Typography>
                                </Typography>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxl,
        backgroundColor: COLORS.background,
    },
    topBar: {
        height: 48,
        justifyContent: 'center',
        marginBottom: SPACING.l,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    header: {
        marginBottom: SPACING.xxl,
    },
    title: {
        fontWeight: '900',
        color: COLORS.primary,
        marginBottom: SPACING.s,
        letterSpacing: -0.6,
    },
    subtitle: {
        color: COLORS.secondary,
        lineHeight: 22,
    },
    formContainer: {
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
    },
    successContainer: {
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
        alignItems: 'center',
        paddingTop: SPACING.xxl,
    },
    successIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        marginBottom: SPACING.l,
    },
    errorText: {
        color: COLORS.error,
        flex: 1,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: SPACING.xl,
    },
    inputLabel: {
        color: COLORS.primary,
        fontWeight: '700',
        marginBottom: 8,
        fontSize: 14,
    },
    inputWrapper: {
        height: 52,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.input,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.m,
        justifyContent: 'center',
        ...SHADOWS.subtle,
    },
    input: {
        color: COLORS.primary,
        fontSize: 16,
        height: '100%',
    },
    primaryButton: {
        height: 54,
        borderRadius: BORDER_RADIUS.button,
        marginTop: SPACING.s,
    },
    returnButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.l,
        marginTop: SPACING.m,
    },
    returnText: {
        color: COLORS.secondary,
    },
    returnTextBold: {
        color: COLORS.accent,
        fontWeight: '700',
    },
});

export default ForgotPasswordScreen;
