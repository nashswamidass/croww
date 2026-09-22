import React from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import FloatingCard from '../../components/FloatingCard';
import AntigravityButton from '../../components/AntigravityButton';
import CrowwScreenHeader from '../../components/CrowwScreenHeader';
import { SPACING, COLORS, BORDER_RADIUS, TOUCH_TARGETS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getPropertyRoles, getShellCapabilities } from '../../navigation/propertyCapabilities';
import { dashboardCopy } from '../../domain/property';

const ProfileCard = ({ icon, iconColor, title, subtitle, onPress, badge }) => (
    <TouchableOpacity
        onPress={onPress}
        style={styles.card}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
    >
        <View style={[styles.iconWrap, { backgroundColor: (iconColor || COLORS.accent) + '15' }]}>
            <Ionicons name={icon} size={24} color={iconColor || COLORS.accent} />
        </View>
        <View style={styles.cardContent}>
            <Typography variant="titleSmall" style={styles.cardTitle}>{title}</Typography>
            <Typography variant="caption" style={styles.cardSubtitle}>{subtitle}</Typography>
        </View>
        {badge ? (
            <View style={styles.badge}>
                <Typography variant="micro" style={styles.badgeText}>{badge}</Typography>
            </View>
        ) : null}
        <Ionicons name="chevron-forward" size={20} color={COLORS.borderLight} />
    </TouchableOpacity>
);

const ProfileScreen = ({ navigation }) => {
    const { user, logout } = useAuth();
    const roles = getPropertyRoles(user);
    const { isLegacyOrganizer } = getShellCapabilities(user);
    const copy = dashboardCopy(roles);

    if (!user) {
        return (
            <ScreenWrapper edges={['top']}>
                <CrowwScreenHeader navigation={navigation} withTopInset={false} />
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <Typography variant="display" style={styles.pageTitle}>Profile</Typography>
                        <Typography variant="bodyLarge" style={styles.pageSubtitle}>
                            Sign in to manage your account, saved homes, and property listings.
                        </Typography>
                    </View>

                    <FloatingCard style={styles.unauthCard}>
                        <View style={styles.unauthAvatar}>
                            <Ionicons name="person" size={38} color={COLORS.accent} />
                        </View>
                        <Typography variant="titleLarge" style={styles.unauthTitle}>
                            Welcome to Croww
                        </Typography>
                        <Typography variant="bodyMedium" style={styles.unauthDesc}>
                            Sign in to access your profile, track property verification, and manage your inventory.
                        </Typography>

                        <View style={styles.unauthActions}>
                            <AntigravityButton
                                title="Sign in to Croww"
                                onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
                                size="large"
                            />
                            <AntigravityButton
                                title="Create account"
                                variant="secondary"
                                onPress={() => navigation.navigate('Auth', { screen: 'Signup' })}
                                size="large"
                            />
                        </View>
                    </FloatingCard>

                    <View style={styles.cardsSection}>
                        <ProfileCard
                            icon="settings-outline"
                            iconColor="#4B5563"
                            title="Settings"
                            subtitle="Preferences, security & notifications"
                            onPress={() => navigation.navigate('Settings')}
                        />
                        <ProfileCard
                            icon="help-circle-outline"
                            iconColor="#0284C7"
                            title="Help Center"
                            subtitle="Support, FAQs & contact"
                            onPress={() => navigation.navigate('HelpCenter')}
                        />
                    </View>
                </ScrollView>
            </ScreenWrapper>
        );
    }

    const userName = user.displayName || user.name || 'Croww Member';
    const userEmail = user.email || 'Signed in';
    const avatarUri = user.avatar || user.photoURL || null;

    return (
        <ScreenWrapper edges={['top']}>
            <CrowwScreenHeader navigation={navigation} withTopInset={false} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header User Card */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarWrap}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="person" size={36} color={COLORS.accent} />
                            </View>
                        )}
                    </View>
                    <View style={styles.headerInfo}>
                        <Typography variant="titleLarge" style={styles.userName}>
                            {userName}
                        </Typography>
                        <Typography variant="bodyMedium" style={styles.userEmail}>
                            {userEmail}
                        </Typography>
                    </View>
                </View>

                {/* Primary Large Consumer Cards */}
                <View style={styles.cardsSection}>
                    <ProfileCard
                        icon="business-outline"
                        iconColor={COLORS.accent}
                        title="My listings"
                        subtitle={copy.profileEntry || "Manage active and draft properties"}
                        onPress={() => navigation.navigate('InventoryDashboard')}
                    />

                    <ProfileCard
                        icon="bookmark-outline"
                        iconColor="#2563EB"
                        title="Saved"
                        subtitle="Properties, listings, and alert monitors"
                        onPress={() => navigation.navigate('Tabs', { screen: 'Saved' })}
                    />

                    <ProfileCard
                        icon="chatbubbles-outline"
                        iconColor="#0D9488"
                        title="Messages"
                        subtitle="Chats, inquiries, and location requests"
                        onPress={() => navigation.navigate('ChatList')}
                    />

                    <ProfileCard
                        icon="shield-checkmark-outline"
                        iconColor="#059669"
                        title="Verification"
                        subtitle="Identity, KYC & representation status"
                        onPress={() => navigation.navigate('TrustOverview')}
                    />

                    <ProfileCard
                        icon="settings-outline"
                        iconColor="#4B5563"
                        title="Settings"
                        subtitle="Preferences, security & notifications"
                        onPress={() => navigation.navigate('Settings')}
                    />
                </View>

                {/* Sign Out Button */}
                <TouchableOpacity
                    onPress={logout}
                    style={styles.logoutBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Sign out of Croww"
                    hitSlop={TOUCH_TARGETS.hitSlop}
                >
                    <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
                    <Typography variant="bodyMedium" style={styles.logoutText}>Sign out</Typography>
                </TouchableOpacity>

                {/* Legacy tools preserved unobtrusively at bottom */}
                {isLegacyOrganizer ? (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('BusinessDashboard')}
                        style={styles.legacyLink}
                    >
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>
                            Looking for legacy event organizer tools? Event dashboard ↗
                        </Typography>
                    </TouchableOpacity>
                ) : null}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        paddingBottom: 96,
    },
    header: {
        marginBottom: SPACING.l,
    },
    pageTitle: {
        fontWeight: '900',
        color: COLORS.primary,
        letterSpacing: -0.8,
    },
    pageSubtitle: {
        color: COLORS.secondary,
        marginTop: 4,
        lineHeight: 22,
    },
    unauthCard: {
        padding: SPACING.xl,
        alignItems: 'center',
        marginTop: SPACING.m,
    },
    unauthAvatar: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.l,
    },
    unauthTitle: {
        fontWeight: '800',
        textAlign: 'center',
        color: COLORS.primary,
        marginBottom: 8,
    },
    unauthDesc: {
        textAlign: 'center',
        color: COLORS.secondary,
        lineHeight: 22,
        marginBottom: SPACING.xl,
        maxWidth: 360,
    },
    unauthActions: {
        width: '100%',
        maxWidth: 320,
        gap: 12,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.l,
        marginBottom: SPACING.m,
        gap: SPACING.m,
    },
    avatarWrap: {
        width: 68,
        height: 68,
        borderRadius: 34,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerInfo: {
        flex: 1,
    },
    userName: {
        fontWeight: '800',
        color: COLORS.primary,
    },
    userEmail: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    cardsSection: {
        gap: SPACING.m,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.l,
        ...SHADOWS.subtle,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.m,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontWeight: '700',
        color: COLORS.primary,
    },
    cardSubtitle: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    badge: {
        backgroundColor: COLORS.accentMuted,
        paddingHorizontal: SPACING.s,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.round,
        marginRight: SPACING.s,
    },
    badgeText: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: SPACING.l,
        marginTop: SPACING.l,
    },
    logoutText: {
        color: COLORS.error,
        fontWeight: '600',
    },
    legacyLink: {
        alignItems: 'center',
        paddingVertical: SPACING.m,
    },
});

export default ProfileScreen;
