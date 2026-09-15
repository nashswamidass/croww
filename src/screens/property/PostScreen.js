import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import FloatingCard from '../../components/FloatingCard';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getPropertyRoles, getShellCapabilities } from '../../navigation/propertyCapabilities';
import { dashboardCopy, postingHubCopy } from '../../domain/property';

const GuaranteeItem = ({ icon, title, description }) => (
    <View style={styles.guaranteeRow}>
        <View style={styles.guaranteeIcon}>
            <Ionicons name={icon} size={20} color={COLORS.accent} />
        </View>
        <View style={styles.guaranteeContent}>
            <Typography variant="bodyLarge" style={styles.guaranteeTitle}>{title}</Typography>
            <Typography variant="caption" style={styles.guaranteeDesc}>{description}</Typography>
        </View>
    </View>
);

const PostScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [authContext, setAuthContext] = useState('post');
    const roles = getPropertyRoles(user);
    const { isLegacyOrganizer } = getShellCapabilities(user);
    const copy = postingHubCopy(roles);
    const inventoryCopy = dashboardCopy(roles);

    return (
        <ScreenWrapper edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="display" style={styles.title}>{copy.title}</Typography>
                    <Typography variant="bodyLarge" style={styles.subtitle}>{copy.subtitle}</Typography>
                </View>

                {/* Main Action Card */}
                <FloatingCard style={styles.actionCard}>
                    <View style={styles.cardHeader}>
                        <View style={styles.badge}>
                            <Ionicons name="sparkles" size={14} color={COLORS.accent} />
                            <Typography variant="micro" style={styles.badgeText}>FAST & SIMPLE</Typography>
                        </View>
                        <Typography variant="titleLarge" style={styles.cardTitle}>List your property</Typography>
                        <Typography variant="bodyMedium" style={styles.cardSubtitle}>
                            Publish to verified home seekers with automated geohash discovery and privacy-first location control.
                        </Typography>
                    </View>

                    <View style={styles.ctaGroup}>
                        <AntigravityButton
                            title="Start New Listing"
                            icon="add-circle-outline"
                            size="large"
                            onPress={() => {
                                if (!user) {
                                    setAuthContext('post');
                                    setAuthModalVisible(true);
                                    return;
                                }
                                navigation.navigate('PostListing');
                            }}
                            accessibilityLabel="Start a new listing"
                        />
                        <AntigravityButton
                            title="My Property Inventory"
                            icon="briefcase-outline"
                            variant="secondary"
                            size="large"
                            onPress={() => {
                                if (!user) {
                                    setAuthContext('inventory');
                                    setAuthModalVisible(true);
                                    return;
                                }
                                navigation.navigate('InventoryDashboard');
                            }}
                            accessibilityLabel="Open your listings inventory"
                        />
                    </View>
                </FloatingCard>

                {/* Owner Privacy & Control Pillars */}
                <View style={styles.pillarsSection}>
                    <Typography variant="titleMedium" style={styles.sectionHeading}>OWNER ADVANTAGE</Typography>

                    <FloatingCard style={styles.pillarCard}>
                        <GuaranteeItem
                            icon="shield-checkmark"
                            title="Location Privacy by Default"
                            description="Keep your exact pin hidden. Viewers see an approximate locality circle until you approve their request."
                        />
                        <View style={styles.divider} />
                        <GuaranteeItem
                            icon="locate"
                            title="Map-First Discovery"
                            description="Your listing instantly appears on high-intent buyer searches with geohash-indexed map boundaries."
                        />
                        <View style={styles.divider} />
                        <GuaranteeItem
                            icon="cube-outline"
                            title="3D Tour Ready"
                            description="Add interactive 3D spatial walkthroughs to let prospective buyers explore remotely before site visits."
                        />
                    </FloatingCard>
                </View>

                <Typography variant="caption" style={styles.hint}>
                    {inventoryCopy.subtitle}
                </Typography>
            </ScrollView>

            <AuthPromptModal
                visible={authModalVisible}
                onClose={() => setAuthModalVisible(false)}
                navigation={navigation}
                title="Post your property"
                subtitle="Sign in to publish listings to verified buyers and tenants, and manage your property inventory."
                icon="home-outline"
                actionContext={authContext}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: SPACING.xxl,
    },
    header: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        paddingBottom: SPACING.m,
    },
    title: {
        color: COLORS.primary,
        fontWeight: '900',
        letterSpacing: -1,
    },
    subtitle: {
        color: COLORS.secondary,
        marginTop: SPACING.xs,
        lineHeight: 22,
    },
    actionCard: {
        marginHorizontal: SPACING.l,
        marginBottom: SPACING.l,
        padding: SPACING.l,
    },
    cardHeader: {
        marginBottom: SPACING.l,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: COLORS.accentMuted,
        paddingHorizontal: SPACING.s,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.round,
        gap: 4,
        marginBottom: SPACING.s,
    },
    badgeText: {
        color: COLORS.accent,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cardTitle: {
        color: COLORS.primary,
        fontWeight: '800',
        marginBottom: 4,
    },
    cardSubtitle: {
        color: COLORS.secondary,
        lineHeight: 20,
    },
    ctaGroup: {
        gap: SPACING.m,
    },
    pillarsSection: {
        paddingHorizontal: SPACING.l,
        marginBottom: SPACING.l,
    },
    sectionHeading: {
        color: COLORS.secondary,
        fontSize: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: SPACING.s,
    },
    pillarCard: {
        padding: SPACING.l,
    },
    guaranteeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.m,
    },
    guaranteeIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    guaranteeContent: {
        flex: 1,
    },
    guaranteeTitle: {
        color: COLORS.primary,
        fontWeight: '700',
        marginBottom: 2,
    },
    guaranteeDesc: {
        color: COLORS.secondary,
        lineHeight: 18,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.m,
    },
    hint: {
        color: COLORS.secondary,
        paddingHorizontal: SPACING.l,
        textAlign: 'center',
    },
});

export default PostScreen;
