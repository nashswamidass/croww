import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Linking, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { pushNotificationService } from '../../services/pushNotificationService';
import { userService } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../utils/showAlert';

export const NOTIFICATION_SETTINGS_KEY = '@croww_notification_preferences';
export const USER_SETTINGS_KEY = '@croww_user_settings';

const DEFAULT_PREFERENCES = {
    pushNotifications: true,
    messages: true,
    listingActivity: true,
    savedSearchAlerts: true,
    verificationUpdates: true,
    systemUpdates: true,
    emailNotifications: false,
};

const NotificationSettingsScreen = ({ navigation }) => {
    const { user: currentUser } = useAuth();
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [osPermissionStatus, setOsPermissionStatus] = useState('undetermined');
    const [testingNotification, setTestingNotification] = useState(false);

    // Load persisted preferences and check OS permission status
    const loadPreferences = useCallback(async () => {
        try {
            setLoading(true);
            const [storedPrefs, storedLegacy, osStatus] = await Promise.all([
                AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY),
                AsyncStorage.getItem(USER_SETTINGS_KEY),
                pushNotificationService.getPermissionStatus(),
            ]);

            setOsPermissionStatus(osStatus.status);

            let initialPrefs = { ...DEFAULT_PREFERENCES };

            if (storedPrefs) {
                try {
                    initialPrefs = { ...initialPrefs, ...JSON.parse(storedPrefs) };
                } catch (e) {
                    console.warn('[NotificationSettings] Failed to parse storedPrefs', e);
                }
            } else if (storedLegacy) {
                try {
                    const legacy = JSON.parse(storedLegacy);
                    if (legacy.pushNotifications !== undefined) {
                        initialPrefs.pushNotifications = Boolean(legacy.pushNotifications);
                    }
                    if (legacy.emailNotifications !== undefined) {
                        initialPrefs.emailNotifications = Boolean(legacy.emailNotifications);
                    }
                } catch (e) {
                    console.warn('[NotificationSettings] Failed to parse storedLegacy', e);
                }
            }

            // If OS permission is denied, push cannot be active
            if (osStatus.status === 'denied') {
                initialPrefs.pushNotifications = false;
            }

            setPreferences(initialPrefs);
        } catch (err) {
            console.error('[NotificationSettings] Error loading preferences:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    // Persist preferences immediately to AsyncStorage and user profile
    const updatePreference = async (key, value) => {
        const updated = { ...preferences, [key]: value };
        setPreferences(updated);

        try {
            await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));

            // Keep legacy SETTINGS_KEY in sync for backwards compatibility
            const legacyStored = await AsyncStorage.getItem(USER_SETTINGS_KEY);
            const legacy = legacyStored ? JSON.parse(legacyStored) : {};
            await AsyncStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({
                ...legacy,
                pushNotifications: updated.pushNotifications,
                emailNotifications: updated.emailNotifications,
            }));

            // Sync to user profile on server if authenticated
            if (currentUser?.id || currentUser?.uid) {
                const uid = currentUser.id || currentUser.uid;
                userService.saveUser({
                    id: uid,
                    notificationPreferences: updated,
                }).catch(err => console.warn('[NotificationSettings] Profile sync warning:', err.message));
            }
        } catch (e) {
            console.error('[NotificationSettings] Failed to save preference:', e);
        }
    };

    // Handle master push notification toggle
    const handleTogglePushMaster = async (value) => {
        if (value) {
            // Check OS permissions
            const perm = await pushNotificationService.requestPermissions();
            setOsPermissionStatus(perm.status);

            if (perm.granted) {
                await updatePreference('pushNotifications', true);
                pushNotificationService.registerForPushNotificationsAsync().catch(() => {});
            } else {
                await updatePreference('pushNotifications', false);
                if (Platform.OS !== 'web') {
                    showAlert(
                        'Permissions Disabled',
                        'Notification permissions are currently disabled in your device settings. Please allow notifications in system settings to receive updates.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) }
                        ]
                    );
                }
            }
        } else {
            await updatePreference('pushNotifications', false);
        }
    };

    // Send a safe test notification to verify end-to-end delivery & tapping
    const handleSendTestNotification = async () => {
        try {
            setTestingNotification(true);
            const notifId = await pushNotificationService.sendLocalNotification({
                title: 'Croww Test Alert',
                body: 'Your notification pipeline is fully operational. Tap to view.',
                data: {
                    type: 'saved_search_match',
                    listingId: 'preview-1',
                },
            });

            if (notifId) {
                showAlert('Notification Sent', 'A test alert has been dispatched to your notification bar.');
            } else {
                showAlert('Notice', 'Could not display notification. Please verify OS permissions.');
            }
        } catch (e) {
            showAlert('Error', 'Failed to dispatch test notification.');
        } finally {
            setTestingNotification(false);
        }
    };

    const SettingRow = ({ icon, title, subtitle, value, onValueChange, disabled }) => (
        <View style={[styles.settingRow, disabled && { opacity: 0.45 }]}>
            <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                    <Ionicons name={icon} size={20} color={COLORS.accent} />
                </View>
                <View style={styles.textContainer}>
                    <Typography variant="body" style={styles.rowTitle}>{title}</Typography>
                    {subtitle ? (
                        <Typography variant="caption" style={styles.rowSubtitle}>{subtitle}</Typography>
                    ) : null}
                </View>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                trackColor={{ false: COLORS.border, true: COLORS.accent }}
                thumbColor="#FFFFFF"
            />
        </View>
    );

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    hitSlop={TOUCH_TARGETS.hitSlop}
                    accessibilityLabel="Back to Settings"
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="titleLarge" style={styles.headerTitle}>
                    Notification Settings
                </Typography>
                <View style={{ width: 32 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Master Push Toggle */}
                    <View style={styles.section}>
                        <Typography variant="titleSmall" style={styles.sectionHeader}>
                            MASTER PUSH NOTIFICATIONS
                        </Typography>
                        <NotionCard style={styles.card}>
                            <SettingRow
                                icon="notifications"
                                title="Push Notifications"
                                subtitle={
                                    osPermissionStatus === 'granted'
                                        ? 'Permissions allowed by system'
                                        : osPermissionStatus === 'denied'
                                            ? 'Blocked in system settings (Tap switch to enable)'
                                            : 'Receive real-time updates on this device'
                                }
                                value={preferences.pushNotifications}
                                onValueChange={handleTogglePushMaster}
                            />
                        </NotionCard>
                    </View>

                    {/* Notification Categories */}
                    <View style={styles.section}>
                        <Typography variant="titleSmall" style={styles.sectionHeader}>
                            ALERT CATEGORIES
                        </Typography>
                        <NotionCard style={styles.card}>
                            <SettingRow
                                icon="chatbubble-ellipses-outline"
                                title="Messages & Chat"
                                subtitle="New inquiries, tenant conversations, and direct replies"
                                value={preferences.messages}
                                onValueChange={(val) => updatePreference('messages', val)}
                                disabled={!preferences.pushNotifications}
                            />
                            <View style={styles.divider} />
                            <SettingRow
                                icon="home-outline"
                                title="Listing Activity"
                                subtitle="Status changes, ingestion review, and price updates"
                                value={preferences.listingActivity}
                                onValueChange={(val) => updatePreference('listingActivity', val)}
                                disabled={!preferences.pushNotifications}
                            />
                            <View style={styles.divider} />
                            <SettingRow
                                icon="search-outline"
                                title="Saved Search Alerts"
                                subtitle="Instant matches for your saved filters and localities"
                                value={preferences.savedSearchAlerts}
                                onValueChange={(val) => updatePreference('savedSearchAlerts', val)}
                                disabled={!preferences.pushNotifications}
                            />
                            <View style={styles.divider} />
                            <SettingRow
                                icon="shield-checkmark-outline"
                                title="Trust & Verification"
                                subtitle="KYC validation, document review, and badge statuses"
                                value={preferences.verificationUpdates}
                                onValueChange={(val) => updatePreference('verificationUpdates', val)}
                                disabled={!preferences.pushNotifications}
                            />
                            <View style={styles.divider} />
                            <SettingRow
                                icon="information-circle-outline"
                                title="System & Platform Status"
                                subtitle="Maintenance announcements and important account notices"
                                value={preferences.systemUpdates}
                                onValueChange={(val) => updatePreference('systemUpdates', val)}
                                disabled={!preferences.pushNotifications}
                            />
                        </NotionCard>
                    </View>

                    {/* Email Communications */}
                    <View style={styles.section}>
                        <Typography variant="titleSmall" style={styles.sectionHeader}>
                            EMAIL NOTIFICATIONS
                        </Typography>
                        <NotionCard style={styles.card}>
                            <SettingRow
                                icon="mail-outline"
                                title="Email Updates"
                                subtitle="Weekly discovery summaries and essential receipts"
                                value={preferences.emailNotifications}
                                onValueChange={(val) => updatePreference('emailNotifications', val)}
                            />
                        </NotionCard>
                    </View>

                    {/* Test Notification Action */}
                    <View style={styles.section}>
                        <AntigravityButton
                            title={testingNotification ? "Sending Alert..." : "Send Test Notification"}
                            variant="secondary"
                            icon="paper-plane-outline"
                            onPress={handleSendTestNotification}
                            disabled={testingNotification || !preferences.pushNotifications}
                        />
                    </View>
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontWeight: '700',
        color: COLORS.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: SPACING.m,
        paddingBottom: 40,
    },
    section: {
        marginBottom: SPACING.l,
    },
    sectionHeader: {
        color: COLORS.secondary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: SPACING.s,
        marginLeft: SPACING.xs,
    },
    card: {
        padding: 0,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: SPACING.m,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.accent + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    textContainer: {
        flex: 1,
    },
    rowTitle: {
        fontWeight: '600',
        color: COLORS.primary,
    },
    rowSubtitle: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginLeft: 56,
    },
});

export default NotificationSettingsScreen;
