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
import { CrowwBrandLogo } from '../../components/rive/CrowwBrandLogo';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { authService } from '../../services/authService';

const LoginScreen = ({ route, navigation }) => {
    const returnAction = route.params?.returnAction || null;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const handleLogin = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setErrorMessage('Please enter both your email and password.');
            return;
        }

        setErrorMessage(null);
        setLoading(true);

        try {
            const user = await authService.login(trimmedEmail, password);
            console.log(`[Login] Successful authentication for UID: ${user.id}`);

            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('Tabs', { screen: 'Explore' });
            }
        } catch (error) {
            console.error('[Login] Error:', error.code, error.message);
            let message = 'Login failed. Please check your credentials.';

            if (
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential'
            ) {
                message = 'Invalid email or password. Please verify your credentials.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many attempts. Please wait a moment and try again.';
            } else if (error.message) {
                message = error.message;
            }

            setErrorMessage(message);
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
                    {/* Top Bar with Close/Back */}
                    <View style={styles.topBar}>
                        {navigation.canGoBack() ? (
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.closeButton}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                hitSlop={TOUCH_TARGETS.hitSlop}
                            >
                                <Ionicons name="close" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                        ) : <View style={{ width: 44 }} />}
                    </View>

                    <View style={styles.container}>
                        {/* Consumer Wordmark & Headline */}
                        <View style={styles.header}>
                            <View style={styles.brandRow}>
                                <CrowwBrandLogo size={40} isLoading={loading} style={{ marginRight: 6 }} />
                                <Typography variant="display" style={styles.brandTitle}>
                                    Croww
                                </Typography>
                            </View>
                            <Typography variant="bodyLarge" style={styles.brandSubtitle}>
                                Find the place that feels right.
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

                        {/* Form Inputs */}
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" style={styles.inputLabel}>
                                    Email
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

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" style={styles.inputLabel}>
                                    Password
                                </Typography>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={[styles.input, { paddingRight: 40 }]}
                                        placeholder="Enter your password"
                                        placeholderTextColor={COLORS.tertiary}
                                        value={password}
                                        onChangeText={(t) => {
                                            setPassword(t);
                                            if (errorMessage) setErrorMessage(null);
                                        }}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeButton}
                                        accessibilityRole="button"
                                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                        hitSlop={TOUCH_TARGETS.hitSlop}
                                    >
                                        <Ionicons
                                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={20}
                                            color={COLORS.secondary}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Primary Action Button */}
                            <AntigravityButton
                                title="Sign in"
                                onPress={handleLogin}
                                loading={loading}
                                size="large"
                                style={styles.continueButton}
                            />

                            {/* Forgot Password Link */}
                            <TouchableOpacity
                                onPress={() => navigation.navigate('ForgotPassword')}
                                style={styles.forgotPasswordContainer}
                                accessibilityRole="button"
                                hitSlop={TOUCH_TARGETS.hitSlop}
                            >
                                <Typography variant="bodyMedium" style={styles.forgotPasswordText}>
                                    Forgot password?
                                </Typography>
                            </TouchableOpacity>
                        </View>

                        {/* Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Typography variant="caption" style={styles.dividerText}>
                                or
                            </Typography>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Secondary Action: Create Account */}
                        <AntigravityButton
                            title="Create new account"
                            variant="secondary"
                            onPress={() => navigation.navigate('Signup', { returnAction })}
                            size="large"
                            style={styles.createAccountButton}
                        />

                        {/* Legal Links */}
                        <View style={styles.legalFooter}>
                            <TouchableOpacity onPress={() => navigation.navigate('LegalPolicy', { type: 'privacy' })}>
                                <Typography variant="caption" style={styles.legalLink}>Privacy Policy</Typography>
                            </TouchableOpacity>
                            <Typography variant="caption" style={styles.legalDot}> • </Typography>
                            <TouchableOpacity onPress={() => navigation.navigate('LegalPolicy', { type: 'security' })}>
                                <Typography variant="caption" style={styles.legalLink}>Security Policy</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
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
        alignItems: 'flex-start',
    },
    closeButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    container: {
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
        paddingTop: SPACING.m,
    },
    header: {
        marginBottom: SPACING.xl,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.m,
        marginBottom: SPACING.xs,
    },
    logoBadge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandTitle: {
        fontWeight: '900',
        color: COLORS.primary,
        fontSize: 34,
        letterSpacing: -0.8,
    },
    brandSubtitle: {
        color: COLORS.secondary,
        fontSize: 17,
        lineHeight: 24,
        marginTop: 4,
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
    form: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: SPACING.l,
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
        position: 'relative',
        ...SHADOWS.subtle,
    },
    input: {
        color: COLORS.primary,
        fontSize: 16,
        height: '100%',
    },
    eyeButton: {
        position: 'absolute',
        right: 14,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        width: 32,
    },
    continueButton: {
        height: 54,
        borderRadius: BORDER_RADIUS.button,
        marginTop: SPACING.s,
    },
    forgotPasswordContainer: {
        marginTop: SPACING.l,
        alignItems: 'center',
        paddingVertical: 4,
    },
    forgotPasswordText: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.xl,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        marginHorizontal: SPACING.m,
        color: COLORS.secondary,
        textTransform: 'lowercase',
    },
    createAccountButton: {
        height: 52,
        borderRadius: BORDER_RADIUS.button,
    },
    legalFooter: {
        marginTop: SPACING.xxl,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    legalLink: {
        color: COLORS.secondary,
        fontSize: 13,
    },
    legalDot: {
        color: COLORS.secondary,
        marginHorizontal: 6,
    },
});

export default LoginScreen;
