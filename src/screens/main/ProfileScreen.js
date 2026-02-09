import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import NotionButton from '../../components/NotionButton';
import VerificationBadge from '../../components/VerificationBadge';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ProfileScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState('events');
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            const loadUser = async () => {
                const data = await userService.getUser();
                setUserData(data);
                setLoading(false);
            };
            loadUser();
        }, [])
    );

    // Fallback/Mock for display if storage is empty
    const defaultUser = {
        name: 'Alex Johnson',
        username: '@alexj',
        avatar: 'https://i.pravatar.cc/150?img=20',
        coverImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
        bio: 'Event enthusiast | Music lover | Always down for good vibes 🎉',
        location: 'San Francisco, CA',
        verificationStatus: 'verified',
        verificationType: 'aadhaar',
        userType: 'individual',
        stats: {
            eventsAttended: 24,
            friends: 156,
            buddyConnections: 12
        },
        interests: ['Music', 'Nightlife', 'Networking', 'Art', 'Food'],
        recentEvents: [
            {
                id: 1,
                title: 'Sunset Beach Party',
                date: 'Jan 28, 2026',
                image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400'
            },
            {
                id: 2,
                title: 'Tech Networking Mixer',
                date: 'Jan 25, 2026',
                image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400'
            }
        ],
        friends: [
            { id: 1, name: 'Sarah M.', avatar: 'https://i.pravatar.cc/150?img=1', mutualFriends: 12 },
            { id: 2, name: 'Mike R.', avatar: 'https://i.pravatar.cc/150?img=12', mutualFriends: 8 }
        ]
    };

    const user = userData || defaultUser;
    const isBusiness = user.userType === 'business';
    const isProvider = user.userType === 'provider';

    const renderEventsTab = () => (
        <View>
            <View style={styles.sectionHeader}>
                <Typography variant="h3">
                    {isBusiness ? "Posted Events" : (isProvider ? "Upcoming Bookings" : "Recent Events")}
                </Typography>
                {isBusiness && (
                    <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')}>
                        <Typography variant="small" style={{ color: COLORS.accent }}>+ New Event</Typography>
                    </TouchableOpacity>
                )}
            </View>
            {(user.recentEvents || []).map((event) => (
                <NotionCard key={event.id} style={styles.eventCard}>
                    <Image source={{ uri: event.image }} style={styles.eventImage} />
                    <View style={styles.eventInfo}>
                        <Typography variant="body" style={{ fontWeight: '600' }}>
                            {event.title}
                        </Typography>
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>
                            {event.date}
                        </Typography>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
                </NotionCard>
            ))}
            {(isBusiness || isProvider) && (user.recentEvents || []).length === 0 && (
                <View style={styles.emptyState}>
                    <Ionicons name={isBusiness ? "calendar-outline" : "briefcase-outline"} size={48} color={COLORS.border} />
                    <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.m }}>
                        {isBusiness ? "You haven't posted any events yet." : "No bookings found yet."}
                    </Typography>
                </View>
            )}
        </View>
    );

    const renderPortfolioTab = () => (
        <View>
            <View style={styles.sectionHeader}>
                <Typography variant="h3">Portfolio</Typography>
                <TouchableOpacity>
                    <Typography variant="small" style={{ color: COLORS.accent }}>+ Add Work</Typography>
                </TouchableOpacity>
            </View>
            <View style={styles.portfolioGrid}>
                {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.portfolioItem}>
                        <Image
                            source={{ uri: `https://images.unsplash.com/photo-${1500000000000 + i}?w=200` }}
                            style={styles.portfolioImage}
                        />
                    </View>
                ))}
            </View>
        </View>
    );

    const renderFriendsTab = () => (
        <View>
            <View style={styles.sectionHeader}>
                <Typography variant="h3">{isProvider ? "Reviews" : "Friends"}</Typography>
                <TouchableOpacity>
                    <Typography variant="small" style={{ color: COLORS.accent }}>
                        {isProvider ? "Read All" : `See All (${user.stats?.friends || 0})`}
                    </Typography>
                </TouchableOpacity>
            </View>
            {isProvider ? (
                <Typography variant="body" style={{ color: COLORS.secondary, fontStyle: 'italic' }}>
                    "Top notch mixer! DJ Pulse kept the crowd moving all night." - Alex J.
                </Typography>
            ) : (
                (user.friends || []).map((friend) => (
                    <NotionCard key={friend.id} style={styles.friendCard}>
                        <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                        <View style={styles.friendInfo}>
                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                {friend.name}
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                {friend.mutualFriends} mutual friends
                            </Typography>
                        </View>
                        <TouchableOpacity style={styles.messageButton}>
                            <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
                        </TouchableOpacity>
                    </NotionCard>
                ))
            )}
        </View>
    );

    const renderAboutTab = () => (
        <View>
            <Typography variant="h3" style={{ marginBottom: SPACING.m }}>
                About
            </Typography>

            {/* Interests / Specialties */}
            <View style={styles.section}>
                <Typography variant="body" style={styles.sectionLabel}>
                    {isProvider ? "Specialties" : "Interests"}
                </Typography>
                <View style={styles.interestsContainer}>
                    {(user.interests || []).map((interest, index) => (
                        <View key={index} style={styles.interestTag}>
                            <Typography variant="small" style={{ color: COLORS.accent }}>
                                {interest}
                            </Typography>
                        </View>
                    ))}
                    {isProvider && (user.interests || []).length === 0 && (
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>No specialties listed.</Typography>
                    )}
                </View>
            </View>

            {/* Location */}
            <View style={styles.section}>
                <Typography variant="body" style={styles.sectionLabel}>
                    Location
                </Typography>
                <View style={styles.infoRow}>
                    <Ionicons name="location" size={20} color={COLORS.accent} />
                    <Typography variant="body" style={{ marginLeft: SPACING.s }}>
                        {user.location || 'Not specified'}
                    </Typography>
                </View>
            </View>

            {/* Verification */}
            <View style={styles.section}>
                <Typography variant="body" style={styles.sectionLabel}>
                    Verification
                </Typography>
                <VerificationBadge
                    status={user.verificationStatus || 'unverified'}
                    type={user.verificationType}
                />
            </View>
        </View>
    );

    return (
        <ScreenWrapper edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Cover Image */}
                <View style={styles.coverContainer}>
                    <Image
                        source={{ uri: user.coverImage || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800' }}
                        style={styles.coverImage}
                    />
                    <LinearGradient
                        colors={['transparent', COLORS.background]}
                        style={styles.coverGradient}
                    />

                    {/* Settings Button */}
                    <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => navigation.navigate('Settings')}
                    >
                        <Ionicons name="settings-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {/* Profile Header */}
                    <View style={styles.profileHeader}>
                        <Image source={{ uri: user.avatar || 'https://i.pravatar.cc/150?img=20' }} style={styles.avatar} />

                        <View style={styles.nameContainer}>
                            <View style={styles.nameRow}>
                                <Typography variant="h1">{user.name}</Typography>
                                {user.verificationStatus === 'verified' && (
                                    <Ionicons name="checkmark-circle" size={24} color={COLORS.success} style={{ marginLeft: SPACING.xs }} />
                                )}
                                {(isBusiness || isProvider) && (
                                    <View style={styles.businessBadge}>
                                        <Typography variant="small" style={{ color: COLORS.accent, fontWeight: 'bold' }}>{user.category || (isProvider ? 'Provider' : 'Business')}</Typography>
                                    </View>
                                )}
                            </View>
                            <Typography variant="body" style={{ color: COLORS.secondary }}>
                                {user.username || `@${user.name.toLowerCase().replace(/\s/g, '')}`}
                            </Typography>
                        </View>

                        <Typography variant="body" style={styles.bio}>
                            {user.bio || (isBusiness ? `Leading ${user.category} in ${user.location || 'your area'}. Join us for the best events!` : (isProvider ? `Professional ${user.category}. Available for bookings.` : 'Bio not set.'))}
                        </Typography>

                        {/* Stats */}
                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Typography variant="h2" style={{ color: COLORS.accent }}>
                                    {isBusiness ? (user.stats?.totalEvents || 0) : (isProvider ? (user.stats?.bookings || 0) : user.stats?.eventsAttended)}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    {isBusiness ? 'Events' : (isProvider ? 'Bookings' : 'Attended')}
                                </Typography>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Typography variant="h2" style={{ color: COLORS.accent }}>
                                    {isBusiness ? (user.stats?.followers || 0) : (isProvider ? (user.stats?.rating || '5.0') : user.stats?.friends)}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    {isBusiness ? 'Followers' : (isProvider ? 'Rating' : 'Friends')}
                                </Typography>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Typography variant="h2" style={{ color: COLORS.accent }}>
                                    {isBusiness ? (user.stats?.avgRating || '4.8') : (isProvider ? (user.stats?.experience || '2y') : user.stats?.buddyConnections)}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    {isBusiness ? 'Rating' : (isProvider ? 'Exp' : 'Buddies')}
                                </Typography>
                            </View>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                            {isBusiness ? (
                                <NotionButton
                                    title="Post Event"
                                    icon="add-circle-outline"
                                    style={{ flex: 1, marginRight: SPACING.s }}
                                    onPress={() => navigation.navigate('CreateEvent')}
                                />
                            ) : (
                                <NotionButton
                                    title={isProvider ? "Manage" : "Edit Profile"}
                                    icon={isProvider ? "briefcase-outline" : "create-outline"}
                                    style={{ flex: 1, marginRight: SPACING.s }}
                                    onPress={() => navigation.navigate('EditProfile')}
                                />
                            )}
                            <NotionButton
                                title={isBusiness ? "Analytics" : (isProvider ? "Share" : "Share")}
                                icon={isBusiness ? "analytics-outline" : "share-outline"}
                                variant="secondary"
                                style={{ flex: 1, marginLeft: SPACING.s }}
                            />
                        </View>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'events' && styles.tabActive]}
                            onPress={() => setActiveTab('events')}
                        >
                            <Typography
                                variant="body"
                                style={[
                                    styles.tabText,
                                    activeTab === 'events' && styles.tabTextActive
                                ]}
                            >
                                {isProvider ? "Bookings" : "Events"}
                            </Typography>
                        </TouchableOpacity>
                        {isProvider && (
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'portfolio' && styles.tabActive]}
                                onPress={() => setActiveTab('portfolio')}
                            >
                                <Typography
                                    variant="body"
                                    style={[
                                        styles.tabText,
                                        activeTab === 'portfolio' && styles.tabTextActive
                                    ]}
                                >
                                    Work
                                </Typography>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
                            onPress={() => setActiveTab('friends')}
                        >
                            <Typography
                                variant="body"
                                style={[
                                    styles.tabText,
                                    activeTab === 'friends' && styles.tabTextActive
                                ]}
                            >
                                {isProvider ? "Reviews" : "Friends"}
                            </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
                            onPress={() => setActiveTab('about')}
                        >
                            <Typography
                                variant="body"
                                style={[
                                    styles.tabText,
                                    activeTab === 'about' && styles.tabTextActive
                                ]}
                            >
                                About
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Content */}
                    <View style={styles.tabContent}>
                        {activeTab === 'events' && renderEventsTab()}
                        {activeTab === 'portfolio' && isProvider && renderPortfolioTab()}
                        {activeTab === 'friends' && renderFriendsTab()}
                        {activeTab === 'about' && renderAboutTab()}
                    </View>

                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    portfolioGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    portfolioItem: {
        width: '48%',
        aspectRatio: 1,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
    },
    portfolioImage: {
        width: '100%',
        height: '100%',
    },
    coverContainer: {
        height: 160,
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    coverGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    settingsButton: {
        position: 'absolute',
        top: SPACING.m,
        right: SPACING.m,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surface + 'CC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: SPACING.m,
    },
    profileHeader: {
        alignItems: 'center',
        marginTop: -40,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: COLORS.background,
    },
    nameContainer: {
        alignItems: 'center',
        marginTop: SPACING.m,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bio: {
        textAlign: 'center',
        color: COLORS.secondary,
        marginTop: SPACING.s,
        paddingHorizontal: SPACING.l,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: SPACING.l,
        paddingVertical: SPACING.m,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statDivider: {
        width: 1,
        backgroundColor: COLORS.border,
    },
    actionButtons: {
        flexDirection: 'row',
        width: '100%',
        marginTop: SPACING.l,
    },
    tabs: {
        flexDirection: 'row',
        marginTop: SPACING.xl,
        marginBottom: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    tab: {
        flex: 1,
        paddingVertical: SPACING.m,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: COLORS.accent,
    },
    tabText: {
        color: COLORS.secondary,
    },
    tabTextActive: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    tabContent: {
        marginTop: SPACING.m,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    eventCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    eventImage: {
        width: 60,
        height: 60,
        borderRadius: BORDER_RADIUS.m,
        marginRight: SPACING.m,
    },
    eventInfo: {
        flex: 1,
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    friendAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: SPACING.m,
    },
    friendInfo: {
        flex: 1,
    },
    messageButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginBottom: SPACING.l,
    },
    sectionLabel: {
        fontWeight: '600',
        marginBottom: SPACING.s,
    },
    interestsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    interestTag: {
        backgroundColor: COLORS.accent + '20',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.m,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    businessBadge: {
        backgroundColor: COLORS.accent + '20',
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.accent + '40',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        marginTop: SPACING.l,
    },
});

export default ProfileScreen;
