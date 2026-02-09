import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = ({ navigation }) => {
    const [pushNotifications, setPushNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(false);
    const [locationServices, setLocationServices] = useState(true);
    const [privateProfile, setPrivateProfile] = useState(false);

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: () => navigation.replace('Auth')
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert('Account Deleted', 'Your account has been deleted');
                        navigation.replace('Auth');
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
        <ScreenWrapper edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
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
                contentContainerStyle={styles.content}
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
                            subtitle="Verify your account"
                            onPress={() => navigation.navigate('AadhaarVerification')}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="lock-closed-outline"
                            title="Privacy"
                            subtitle="Manage your privacy settings"
                            onPress={() => navigation.navigate('Privacy')}
                        />
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
                            title="Push Notifications"
                            subtitle="Get notified about events and updates"
                            rightElement={
                                <Switch
                                    value={pushNotifications}
                                    onValueChange={setPushNotifications}
                                    trackColor={{ false: COLORS.border, true: COLORS.accent }}
                                    thumbColor={COLORS.primary}
                                />
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="mail-outline"
                            title="Email Notifications"
                            subtitle="Receive updates via email"
                            rightElement={
                                <Switch
                                    value={emailNotifications}
                                    onValueChange={setEmailNotifications}
                                    trackColor={{ false: COLORS.border, true: COLORS.accent }}
                                    thumbColor={COLORS.primary}
                                />
                            }
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
                                    onValueChange={setLocationServices}
                                    trackColor={{ false: COLORS.border, true: COLORS.accent }}
                                    thumbColor={COLORS.primary}
                                />
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="eye-off-outline"
                            title="Private Profile"
                            subtitle="Only friends can see your profile"
                            rightElement={
                                <Switch
                                    value={privateProfile}
                                    onValueChange={setPrivateProfile}
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
                            onPress={() => { }}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="shield-outline"
                            title="Privacy Policy"
                            onPress={() => { }}
                        />
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
                    <NotionButton
                        title="Log Out"
                        variant="secondary"
                        icon="log-out-outline"
                        onPress={handleLogout}
                        style={{ marginBottom: SPACING.m }}
                    />
                    <NotionButton
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
});

export default SettingsScreen;
