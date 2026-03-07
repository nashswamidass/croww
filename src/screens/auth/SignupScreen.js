import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { getRandomAvatar } from '../../utils/avatarHelper';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { authService } from '../../services/authService';
import { SERVICE_CATEGORIES } from '../../constants/services';

const SignupScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('individual'); // 'individual', 'business', or 'provider'
    const [category, setCategory] = useState('Bar');
    const [providerCategory, setProviderCategory] = useState('Music/DJ');

    // Filter categories based on userType
    const businessCategories = SERVICE_CATEGORIES.filter(c => c.type === 'business');
    const providerCategories = SERVICE_CATEGORIES.filter(c => c.type === 'provider');

    const handleSignup = async () => {
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();

        if (!trimmedName || !trimmedEmail || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const { url: randomAvatarUrl } = userType === 'business' ? { url: null } : getRandomAvatar();

        const userData = {
            name: trimmedName,
            email: trimmedEmail,
            userType,
            isProvider: userType === 'provider',
            isBusiness: userType === 'business',
            photoURL: randomAvatarUrl,
            avatar: randomAvatarUrl,
            category: userType === 'business' ? category : (userType === 'provider' ? providerCategory : null),
            isVerified: false,
            profilePhotos: [],
            joinedDate: new Date().toISOString(),
            stats: userType === 'provider' ? {
                bookings: 0,
                rating: 0,
                experience: '0 years',
                reviews: 0
            } : (userType === 'business' ? {
                totalEvents: 0,
                followers: 0,
                rating: 0,
                reviews: 0
            } : {
                eventsAttended: 0,
                friends: 0,
                buddyConnections: 0
            }),
            policyAccepted: (userType !== 'business' && userType !== 'provider'),
            policyAcceptedAt: null
        };

        try {
            await authService.signup(trimmedEmail, password, userData);
            Alert.alert(
                'Account Created',
                'A verification email has been sent to your inbox. Please verify your email to access all features.',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Signup Error Details:', error);
            let message = error.message || 'Signup failed. Please try again.';
            if (error.code === 'auth/email-already-in-use') message = 'This email is already in use.';
            if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
            if (error.code === 'auth/weak-password') message = 'Password is too weak.';
            Alert.alert('Signup Failed', message);
        }
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Typography variant="h1">Create account</Typography>
                    <Typography variant="caption">Join Croww to discover, host, or provide services.</Typography>
                </View>

                <View style={styles.roleSelector}>
                    <TouchableOpacity
                        style={[styles.roleButton, userType === 'individual' && styles.roleButtonActive]}
                        onPress={() => setUserType('individual')}
                    >
                        <Typography variant="caption" style={{ color: userType === 'individual' ? COLORS.primary : COLORS.secondary }}>Individual</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.roleButton, userType === 'business' && styles.roleButtonActive]}
                        onPress={() => setUserType('business')}
                    >
                        <Typography variant="caption" style={{ color: userType === 'business' ? COLORS.primary : COLORS.secondary }}>Business</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.roleButton, userType === 'provider' && styles.roleButtonActive]}
                        onPress={() => setUserType('provider')}
                    >
                        <Typography variant="caption" style={{ color: userType === 'provider' ? COLORS.primary : COLORS.secondary }}>Provider</Typography>
                    </TouchableOpacity>
                </View>

                <View style={styles.form}>
                    <NotionInput
                        label={userType === 'business' ? "Business Name" : (userType === 'provider' ? "Professional Name" : "Full Name")}
                        placeholder={userType === 'business' ? "The Blue Flamingo" : (userType === 'provider' ? "DJ Pulse" : "Jane Doe")}
                        value={name}
                        onChangeText={setName}
                    />

                    {userType === 'business' && (
                        <View style={styles.categoryContainer}>
                            <Typography variant="caption" style={styles.label}>Venue Category</Typography>
                            <View style={styles.categoryGrid}>
                                {businessCategories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.catChip, category === cat.name && styles.catChipActive]}
                                        onPress={() => setCategory(cat.name)}
                                    >
                                        <Typography
                                            variant="small"
                                            style={[
                                                styles.catText,
                                                category === cat.name && styles.catTextActive
                                            ]}
                                        >
                                            {cat.name}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {userType === 'provider' && (
                        <View style={styles.categoryContainer}>
                            <Typography variant="caption" style={styles.label}>Service Category</Typography>
                            <View style={styles.categoryGrid}>
                                {providerCategories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.catChip, providerCategory === cat.name && styles.catChipActive]}
                                        onPress={() => setProviderCategory(cat.name)}
                                    >
                                        <Typography
                                            variant="small"
                                            style={[
                                                styles.catText,
                                                providerCategory === cat.name && styles.catTextActive
                                            ]}
                                        >
                                            {cat.name}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    <NotionInput
                        label="Email"
                        placeholder="name@example.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                    <NotionInput
                        label="Password"
                        placeholder="Create a password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <AntigravityButton
                        title="Sign Up"
                        onPress={handleSignup}
                        style={styles.button}
                    />

                    <View style={styles.footer}>
                        <Typography variant="caption">Already have an account? </Typography>
                        <AntigravityButton
                            title="Log In"
                            variant="secondary"
                            style={styles.linkButton}
                            onPress={() => navigation.navigate('Login')}
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
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        padding: SPACING.l,
        paddingBottom: SPACING.xl * 2,
    },
    header: {
        marginBottom: SPACING.xl,
    },
    roleSelector: {
        flexDirection: 'row',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        padding: 4,
        marginBottom: SPACING.l,
    },
    roleButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.s,
    },
    roleButtonActive: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    form: {
        width: '100%',
    },
    label: {
        marginBottom: SPACING.xs,
        color: COLORS.secondary,
    },
    categoryContainer: {
        marginBottom: SPACING.m,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: SPACING.xs,
    },
    catChip: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    catChipActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface,
    },
    catText: {
        color: COLORS.secondary,
    },
    catTextActive: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    button: {
        marginTop: SPACING.m,
    },
    footer: {
        marginTop: SPACING.l,
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

export default SignupScreen;
