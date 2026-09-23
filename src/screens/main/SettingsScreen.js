import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showAlert } from '../../utils/showAlert';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

const SETTINGS_KEY = '@croww_user_settings';

const SettingsScreen = ({ navigation }) => {
    const { user: currentUser } = useAuth();
    const { isDesktop } = useResponsiveLayout();
    const [locationServices, setLocationServices] = useState(true);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Load saved settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    // Persist settings whenever they change (after initial load)
    useEffect(() => {
        if (settingsLoaded) {
            saveSettings();
        }
    }, [locationServices, settingsLoaded]);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem(SETTINGS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setLocationServices(parsed.locationServices ?? true);
            }
        } catch (err) {
            console.error('Error loading settings:', err);
        } finally {
            setSettingsLoaded(true);
        }
    };

    const saveSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem(SETTINGS_KEY);
            const parsed = stored ? JSON.parse(stored) : {};
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
                ...parsed,
                locationServices,
            }));
        } catch (err) {
            console.error('Error saving settings:', err);
        }
    };



    const handleToggleLocationServices = (value) => {
        setLocationServices(value);
        if (value) {
            showAlert('Location Services', 'Location access enabled. You can now discover events near you.');
        } else {
            showAlert(
                'Location Disabled',
                'Location services have been turned off. Event distances and nearby recommendations won\'t be available.\n\nTo manage system-level location permissions, go to your device Settings.',
            );
        }
    };

    const handleLogout = () => {
        showAlert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await authService.logout();
                        } catch (e) {
                            console.error('Logout error:', e);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        showAlert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted. You will be logged out and your data will be removed from our servers.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await authService.deleteAccount();
                            showAlert('Account Deleted', 'Your account and data have been permanently removed.');
                        } catch (e) {
                            console.error('Delete account error:', e);
                            showAlert('Error', 'Failed to delete account. Please try again or contact support.');
                        }
                    }
                }
            ]
        );
    };

    const SettingItem = ({ icon, title, subtitle, onPress, rightElement }) => (
        <TouchableOpacity
            style={styles.settingItem}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={22} color={COLORS.accent} />
                </View>
                <View style={styles.settingText}>
                    <Typography variant="body" style={{ fontWeight: '600' }}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>
                            {subtitle}
                        </Typography>
                    )}
                </View>
            </View>
            {rightElement || (
                onPress && <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
            )}
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper edges={isDesktop ? ['bottom'] : ['top', 'bottom']}>
            {/* Header */}
            <View style={[styles.header, isDesktop && styles.desktopHeader]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Settings</Typography>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, isDesktop && styles.desktopContent]}
                showsVerticalScrollIndicator={false}
            >
                {/* Account Section */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Account
                    </Typography>
                    <NotionCard style={styles.card}>
                        <SettingItem
                            icon="person-outline"
                            title="Edit Profile"
                            subtitle="Update your profile information"
                            onPress={() => navigation.navigate('EditProfile')}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="shield-checkmark-outline"
                            title="Verification"
                            subtitle="Identity, owner, agent, and builder trust"
                            onPress={() => navigation.navigate('TrustOverview')}
                        />
                        {(currentUser?.userType === 'business' || currentUser?.userType === 'provider'
                            || currentUser?.isBusiness || currentUser?.isProvider) && (
                            <>
                                <View style={styles.divider} />
                                <SettingItem
                                    icon="grid-outline"
                                    title="Event dashboard"
                                    subtitle="Legacy organizer and booking tools"
                                    onPress={() => navigation.navigate('BusinessDashboard')}
                                />
                            </>
                        )}
                    </NotionCard>
                </View>

                {/* Notifications Section */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Notifications
                    </Typography>
                    <NotionCard style={styles.card}>
                        <SettingItem
                            icon="notifications-outline"
                            title="Notification Preferences"
                            subtitle="Push alerts, messages, listings & searches"
                            onPress={() => navigation.navigate('NotificationSettings')}
                        />
                    </NotionCard>
                </View>

                {/* Privacy & Security */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Privacy & Security
                    </Typography>
                    <NotionCard style={styles.card}>
                        <SettingItem
                            icon="location-outline"
                            title="Location Services"
                            subtitle="Allow app to access your location"
                            rightElement={
                                <Switch
                                    value={locationServices}
                                    onValueChange={handleToggleLocationServices}
                                    trackColor={{ false: COLORS.border, true: COLORS.accent }}
                                    thumbColor={COLORS.primary}
                                />
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="ban-outline"
                            title="Blocked Users"
                            subtitle="Manage blocked accounts"
                            onPress={() => navigation.navigate('BlockedUsers')}
                        />
                    </NotionCard>
                </View>

                {/* Support */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Support
                    </Typography>
                    <NotionCard style={styles.card}>
                        <SettingItem
                            icon="help-circle-outline"
                            title="Help Center"
                            subtitle="Get help and support"
                            onPress={() => navigation.navigate('HelpCenter')}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="document-text-outline"
                            title="Terms of Service"
                            subtitle="Our terms and conditions"
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'terms' })}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="shield-outline"
                            title="Privacy Policy"
                            subtitle="How we handle your data"
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'privacy' })}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="lock-closed-outline"
                            title="Security Policy"
                            subtitle="How we protect your information"
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'security' })}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="card-outline"
                            title="Refund Policy"
                            subtitle="Our refund terms"
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'refund' })}
                        />
                        {(currentUser?.userType === 'business' || currentUser?.isBusiness || currentUser?.userType === 'provider' || currentUser?.isProvider) && (
                            <>
                                <View style={styles.divider} />
                                <SettingItem
                                    icon="calculator-outline"
                                    title="Commission Policy"
                                    subtitle="Our commission and payout terms"
                                    onPress={() => {
                                        const type = (currentUser?.userType === 'business' || currentUser?.isBusiness)
                                            ? 'business_commission'
                                            : 'provider_commission';
                                        navigation.navigate('LegalPolicy', { type });
                                    }}
                                />
                            </>
                        )}
                    </NotionCard>
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        About
                    </Typography>
                    <NotionCard style={styles.card}>
                        <SettingItem
                            icon="information-circle-outline"
                            title="App Version"
                            rightElement={
                                <Typography variant="body" style={{ color: COLORS.secondary }}>
                                    1.0.0
                                </Typography>
                            }
                        />
                    </NotionCard>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <AntigravityButton
                        title="Log Out"
                        variant="secondary"
                        icon="log-out-outline"
                        onPress={handleLogout}
                        style={{ marginBottom: SPACING.m }}
                    />
                    <AntigravityButton
                        title="Delete Account"
                        variant="secondary"
                        icon="trash-outline"
                        onPress={handleDeleteAccount}
                        style={{ borderColor: '#FF4D4D' }}
                    />
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: SPACING.m,
    },
    section: {
        marginBottom: SPACING.l,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    card: {
        padding: 0,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    settingText: {
        flex: 1,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginLeft: 68, // Icon width + margin
    },
    desktopHeader: {
        maxWidth: 680,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.l,
    },
    desktopContent: {
        maxWidth: 680,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: SPACING.m,
    },
});

export default SettingsScreen;
