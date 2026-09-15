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

const SignupScreen = ({ route, navigation }) => {
    const returnAction = route.params?.returnAction || null;
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const handleSignup = async () => {
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();

        if (!trimmedName || !trimmedEmail || !password) {
            setErrorMessage('Please fill in all fields.');
            return;
        }

        if (password.length < 6) {
            setErrorMessage('Password must be at least 6 characters long.');
            return;
        }

        setErrorMessage(null);
        setLoading(true);

        const userData = {
            name: trimmedName,
            email: trimmedEmail,
            userType: 'individual',
            role: 'individual',
            isVerified: false,
            aadhaarVerified: false,
            joinedDate: new Date().toISOString(),
        };

        try {
            await authService.signup(trimmedEmail, password, userData);
            console.log(`[Signup] Successfully created account for: ${trimmedEmail}`);

            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('Tabs', { screen: 'Explore' });
            }
        } catch (error) {
            console.error('[Signup] Error Details:', error);
            let message = 'Signup failed. Please try again.';

            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already associated with an account. Try logging in.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password is too weak. Use at least 6 characters.';
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
                    {/* Top Bar with Back Arrow */}
                    <View style={styles.topBar}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.closeButton}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                            hitSlop={TOUCH_TARGETS.hitSlop}
                        >
                            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.container}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Typography variant="display" style={styles.title}>
                                Create account
                            </Typography>
                            <Typography variant="bodyLarge" style={styles.subtitle}>
                                Discover, save, and list properties with Croww.
                            </Typography>
                        </View>

                        {/* Error Message */}
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
                                    Full Name
                                </Typography>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Your full name"
                                        placeholderTextColor={COLORS.tertiary}
                                        value={name}
                                        onChangeText={(t) => {
                                            setName(t);
                                            if (errorMessage) setErrorMessage(null);
                                        }}
                                        autoCapitalize="words"
                                    />
                                </View>
                            </View>

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

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" style={styles.inputLabel}>
                                    Password
                                </Typography>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={[styles.input, { paddingRight: 40 }]}
                                        placeholder="At least 6 characters"
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

                            {/* Terms Notice */}
                            <Typography variant="caption" style={styles.termsText}>
                                {"By continuing, you agree to Croww's "}
                                <Typography
                                    variant="caption"
                                    style={styles.termsLink}
                                    onPress={() => navigation.navigate('LegalPolicy', { type: 'privacy' })}
                                >
                                    Privacy Policy
                                </Typography>{' '}
                                and{' '}
                                <Typography
                                    variant="caption"
                                    style={styles.termsLink}
                                    onPress={() => navigation.navigate('LegalPolicy', { type: 'security' })}
                                >
                                    Security Policy
                                </Typography>.
                            </Typography>

                            {/* Submit Button */}
                            <AntigravityButton
                                title="Create account"
                                onPress={handleSignup}
                                loading={loading}
                                size="large"
                                style={styles.createButton}
                            />
                        </View>

                        {/* Return to Login */}
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Login', { returnAction })}
                            style={styles.returnButton}
                            accessibilityRole="button"
                            hitSlop={TOUCH_TARGETS.hitSlop}
                        >
                            <Typography variant="bodyMedium" style={styles.returnText}>
                                Already have an account? <Typography variant="bodyMedium" style={styles.returnTextBold}>Log in</Typography>
                            </Typography>
                        </TouchableOpacity>
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
    title: {
        fontWeight: '900',
        color: COLORS.primary,
        fontSize: 34,
        letterSpacing: -0.6,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        color: COLORS.secondary,
        fontSize: 16,
        lineHeight: 22,
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
    termsText: {
        color: COLORS.secondary,
        lineHeight: 18,
        marginBottom: SPACING.l,
    },
    termsLink: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    createButton: {
        height: 54,
        borderRadius: BORDER_RADIUS.button,
        marginTop: SPACING.s,
    },
    returnButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xl,
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

export default SignupScreen;
