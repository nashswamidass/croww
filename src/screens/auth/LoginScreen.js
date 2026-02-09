import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionButton from '../../components/NotionButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        // Mocking logic for different user types
        let userType = 'individual';

        // TEST TRICK: use "business@example.com" to log in as business
        if (email.toLowerCase() === 'business@example.com') {
            userType = 'business';
        } else if (email.toLowerCase() === 'provider@example.com') {
            userType = 'provider';
        }

        await userService.saveUser({
            name: userType === 'business' ? 'Club Indigo' : (userType === 'provider' ? 'DJ Pulse' : 'Alex Johnson'),
            email: email,
            userType: userType,
            verificationStatus: 'verified'
        });

        navigation.replace('Main');
    };

    const handleGoogleLogin = () => {
        // TODO: Integrate Google Auth
        navigation.replace('Main');
    };

    return (
        <ScreenWrapper style={styles.container}>
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

                <NotionButton
                    title="Login"
                    onPress={handleLogin}
                    style={styles.button}
                />

                <View style={styles.dividerContainer}>
                    <View style={styles.line} />
                    <Typography variant="caption" style={styles.dividerText}>OR</Typography>
                    <View style={styles.line} />
                </View>

                <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleLogin}
                    activeOpacity={0.8}
                >
                    <Ionicons name="logo-google" size={20} color={COLORS.primary} style={{ marginRight: SPACING.s }} />
                    <Typography variant="body" style={{ fontWeight: '600' }}>
                        Continue with Google
                    </Typography>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Typography variant="caption">Don't have an account? </Typography>
                    <NotionButton
                        title="Sign Up"
                        variant="secondary"
                        style={styles.linkButton}
                        onPress={() => navigation.navigate('Signup')}
                    />
                </View>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    logo: {
        width: 140,
        height: 60,
        marginBottom: SPACING.m,
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
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.l,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        marginHorizontal: SPACING.m,
        color: COLORS.secondary,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surfaceHighlight,
    },
    footer: {
        marginTop: SPACING.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkButton: {
        height: 32,
        minWidth: 0,
        paddingHorizontal: SPACING.s,
        borderWidth: 0,
    }
});

export default LoginScreen;
