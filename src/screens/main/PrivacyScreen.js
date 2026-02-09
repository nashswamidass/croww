import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const PrivacyScreen = ({ navigation }) => {
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);
    const [showLastSeen, setShowLastSeen] = useState(false);
    const [allowTagging, setAllowTagging] = useState(true);
    const [showEventsAttended, setShowEventsAttended] = useState(true);
    const [allowBuddyRequests, setAllowBuddyRequests] = useState(true);
    const [showFriendsList, setShowFriendsList] = useState(true);

    const PrivacyItem = ({ icon, title, subtitle, value, onValueChange }) => (
        <View style={styles.privacyItem}>
            <View style={styles.privacyLeft}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={22} color={COLORS.accent} />
                </View>
                <View style={styles.privacyText}>
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
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: COLORS.border, true: COLORS.accent }}
                thumbColor={COLORS.primary}
            />
        </View>
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
                <Typography variant="h2">Privacy Settings</Typography>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Visibility */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Profile Visibility
                    </Typography>
                    <NotionCard style={styles.card}>
                        <PrivacyItem
                            icon="eye-outline"
                            title="Show Online Status"
                            subtitle="Let others see when you're online"
                            value={showOnlineStatus}
                            onValueChange={setShowOnlineStatus}
                        />
                        <View style={styles.divider} />
                        <PrivacyItem
                            icon="time-outline"
                            title="Show Last Seen"
                            subtitle="Display when you were last active"
                            value={showLastSeen}
                            onValueChange={setShowLastSeen}
                        />
                        <View style={styles.divider} />
                        <PrivacyItem
                            icon="people-outline"
                            title="Show Friends List"
                            subtitle="Allow others to see your friends"
                            value={showFriendsList}
                            onValueChange={setShowFriendsList}
                        />
                    </NotionCard>
                </View>

                {/* Activity Privacy */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Activity Privacy
                    </Typography>
                    <NotionCard style={styles.card}>
                        <PrivacyItem
                            icon="calendar-outline"
                            title="Show Events Attended"
                            subtitle="Display events you've attended on your profile"
                            value={showEventsAttended}
                            onValueChange={setShowEventsAttended}
                        />
                        <View style={styles.divider} />
                        <PrivacyItem
                            icon="pricetag-outline"
                            title="Allow Tagging"
                            subtitle="Let friends tag you in events"
                            value={allowTagging}
                            onValueChange={setAllowTagging}
                        />
                    </NotionCard>
                </View>

                {/* Interaction Privacy */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Interactions
                    </Typography>
                    <NotionCard style={styles.card}>
                        <PrivacyItem
                            icon="people-circle-outline"
                            title="Allow Buddy Requests"
                            subtitle="Let others invite you to join events"
                            value={allowBuddyRequests}
                            onValueChange={setAllowBuddyRequests}
                        />
                    </NotionCard>
                </View>

                {/* Info */}
                <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={24} color={COLORS.accent} />
                    <Typography variant="small" style={styles.infoText}>
                        These settings help you control what others can see about your activity and profile. Changes take effect immediately.
                    </Typography>
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
    privacyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
    },
    privacyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: SPACING.m,
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
    privacyText: {
        flex: 1,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginLeft: 68,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.accent + '10',
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        gap: SPACING.s,
    },
    infoText: {
        flex: 1,
        color: COLORS.accent,
        lineHeight: 20,
    },
});

export default PrivacyScreen;
