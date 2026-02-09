import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionButton from '../../components/NotionButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { userService } from '../../services/userService';

const SignupScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('individual'); // 'individual', 'business', or 'provider'
    const [category, setCategory] = useState('Bar');
    const [providerCategory, setProviderCategory] = useState('DJ');

    const handleSignup = async () => {
        const userData = {
            id: 'user-' + Date.now(),
            name,
            email,
            userType,
            category: userType === 'business' ? category : (userType === 'provider' ? providerCategory : null),
            isVerified: false,
            joinedDate: new Date().toISOString(),
            stats: userType === 'provider' ? {
                bookings: 0,
                rating: 0,
                experience: '0 years'
            } : (userType === 'business' ? {
                totalEvents: 0,
                followers: 0,
                avgRating: '0.0'
            } : {
                eventsAttended: 0,
                friends: 0,
                buddyConnections: 0
            })
        };

        const success = await userService.saveUser(userData);
        if (success) {
            navigation.replace('Main');
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
                                {['Bar', 'Club', 'Cafe', 'Lounge'].map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.catChip, category === cat && styles.catChipActive]}
                                        onPress={() => setCategory(cat)}
                                    >
                                        <Typography
                                            variant="small"
                                            style={[
                                                styles.catText,
                                                category === cat && styles.catTextActive
                                            ]}
                                        >
                                            {cat}
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
                                {['DJ', 'Photo', 'Security', 'Barman', 'Decor'].map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.catChip, providerCategory === cat && styles.catChipActive]}
                                        onPress={() => setProviderCategory(cat)}
                                    >
                                        <Typography
                                            variant="small"
                                            style={[
                                                styles.catText,
                                                providerCategory === cat && styles.catTextActive
                                            ]}
                                        >
                                            {cat}
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

                    <NotionButton
                        title="Sign Up"
                        onPress={handleSignup}
                        style={styles.button}
                    />

                    <View style={styles.footer}>
                        <Typography variant="caption">Already have an account? </Typography>
                        <NotionButton
                            title="Log In"
                            variant="secondary"
                            style={styles.linkButton}
                            onPress={() => navigation.navigate('Login')}
                        />
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
    }
});

export default SignupScreen;
