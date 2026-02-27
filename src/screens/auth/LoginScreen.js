import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { auth, db } from '../../services/firebaseConfig';
import { userService } from '../../services/userService';
import { authService } from '../../services/authService';
import { getRandomAvatar } from '../../utils/avatarHelper';

import { showAlert } from '../../utils/showAlert';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        const trimmedEmail = email.trim();
        console.log(`[Login] Attempting login for: ${trimmedEmail}`);

        if (!trimmedEmail || !password) {
            showAlert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const user = await authService.login(trimmedEmail, password);
            console.log(`[Login] Success for uid: ${user.id}`);
        } catch (error) {
            console.error('[Login] Error Details:', error);
            console.error('[Login] Error Code:', error.code);
            console.error('[Login] Error Message:', error.message);

            let message = 'Login failed. Please check your credentials.';

            if (
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential' ||
                error.code === 'auth/invalid-email'
            ) {
                message = 'Email or password is incorrect. Please try again.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many failed attempts. Please try again later.';
            } else if (error.message) {
                message = error.message;
            }

            showAlert('Login Failed', message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            showAlert('Error', 'Please enter your email address first');
            return;
        }

        showAlert(
            'Reset Password',
            `Send a password reset email to ${email}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await authService.resetPassword(email);
                            showAlert('Success', 'Password reset email sent. Please check your inbox.');
                        } catch (error) {
                            showAlert('Error', error.message || 'Failed to send reset email.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScreenWrapper>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Image
                            source={require('../../../assets/croww-logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Typography variant="h1" style={styles.title}>Welcome back</Typography>
                        <Typography variant="body" style={styles.subtitle}>Sign in to find events near you.</Typography>
                    </View>

                    <View style={styles.form}>
                        <NotionInput
                            label="Email"
                            placeholder="name@example.com"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                        />
                        <NotionInput
                            label="Password"
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <AntigravityButton
                            title="Login"
                            onPress={handleLogin}
                            loading={loading}
                            style={styles.button}
                        />

                        <TouchableOpacity
                            onPress={handleResetPassword}
                            style={styles.forgotPasswordContainer}
                        >
                            <Typography variant="caption" style={styles.forgotPasswordText}>
                                Forgot Password?
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Typography variant="caption">Don't have an account? </Typography>
                        <AntigravityButton
                            title="Sign Up"
                            variant="secondary"
                            style={styles.linkButton}
                            onPress={() => navigation.navigate('Signup')}
                        />
                    </View>

                    <View style={styles.legalFooter}>
                        <TouchableOpacity onPress={() => navigation.navigate('LegalPolicy', { type: 'privacy' })}>
                            <Typography variant="caption" style={styles.legalLink}>Privacy Policy</Typography>
                        </TouchableOpacity>
                        <Typography variant="caption" color={COLORS.secondary}> • </Typography>
                        <TouchableOpacity onPress={() => navigation.navigate('LegalPolicy', { type: 'security' })}>
                            <Typography variant="caption" style={styles.legalLink}>Security Policy</Typography>
                        </TouchableOpacity>
                        <Typography variant="caption" color={COLORS.secondary}> • </Typography>
                        <TouchableOpacity onPress={() => navigation.navigate('LegalPolicy', { type: 'refund' })}>
                            <Typography variant="caption" style={styles.legalLink}>Refund Policy</Typography>
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
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    logo: {
        width: 160,
        height: 70,
        marginBottom: SPACING.l,
    },
    title: {
        marginBottom: SPACING.xs,
    },
    subtitle: {
        color: COLORS.secondary,
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    button: {
        marginTop: SPACING.m,
    },
    forgotPasswordContainer: {
        marginTop: SPACING.m,
        alignItems: 'flex-end',
    },
    forgotPasswordText: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    footer: {
        marginTop: SPACING.xxl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkButton: {
        height: 32,
        minWidth: 0,
        paddingHorizontal: SPACING.s,
        borderWidth: 0,
    },
    legalFooter: {
        marginTop: SPACING.xl,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    legalLink: {
        color: COLORS.secondary,
        textDecorationLine: 'underline',
    }
});

export default LoginScreen;

