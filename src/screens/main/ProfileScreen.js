import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import VerificationBadge from '../../components/VerificationBadge';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { eventService } from '../../services/eventService';
import { bookingService } from '../../services/bookingService';
import { ticketService } from '../../services/ticketService';
import { reviewService } from '../../services/reviewService';
import { buddyService } from '../../services/buddyService';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';
import { Share, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ProfileScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { user: authUser, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState('events');
    const [eventsFilter, setEventsFilter] = useState('active'); // active, completed, cancelled
    const [reviews, setReviews] = useState([]);
    const [fetchingReviews, setFetchingReviews] = useState(false);
    const [profileEvents, setProfileEvents] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    // Real follower/following/buddy counts from Firestore
    const [followerCount, setFollowerCount] = useState(null);
    const [followingCount, setFollowingCount] = useState(null);
    const [buddyCount, setBuddyCount] = useState(null);
    // Followers list for the tab
    const [followerProfiles, setFollowerProfiles] = useState([]);
    const [loadingFollowers, setLoadingFollowers] = useState(false);

    useFocusEffect(
        useCallback(() => {
            let unsubscribeTickets;

            const loadProfileData = async () => {
                if (!authUser?.id) return;

                setLoadingData(true);
                try {
                    // 1. Load Reviews if applicable
                    if (authUser.userType === 'provider' || authUser.userType === 'business') {
                        setFetchingReviews(true);
                        const reviewsData = await reviewService.getBusinessReviews(authUser.id);
                        setReviews(reviewsData);
                        setFetchingReviews(false);
                    }

                    // 2. Load Tab Specific Data
                    if (authUser.userType === 'provider') {
                        const bookings = await bookingService.getBookingsForProvider(authUser.id);
                        setProfileEvents(bookings);
                    } else {
                        // Standard users and businesses see Events they've organized
                        const events = await eventService.getEventsByOrganizer(authUser.id);
                        setProfileEvents(events);
                    }

                    // 3. Load real follower / following / buddy counts and profiles in parallel
                    const [followerIds, followingIds, buddies] = await Promise.all([
                        userService.getFollowerIds(authUser.id),
                        userService.getFollowingIds(authUser.id),
                        buddyService.getMyBuddies(authUser.id),
                    ]);

                    setLoadingFollowers(true);

                    // Ensure we only count valid (non-deleted) users for accurate counts
                    const [validFollowers, validFollowing] = await Promise.all([
                        Promise.all(followerIds.map(id => userService.getUserById(id).catch(() => null))),
                        Promise.all(followingIds.map(id => userService.getUserById(id).catch(() => null)))
                    ]);

                    const filteredFollowers = validFollowers.filter(Boolean);
                    const filteredFollowing = validFollowing.filter(Boolean);

                    setFollowerCount(filteredFollowers.length);
                    setFollowingCount(filteredFollowing.length);
                    setBuddyCount(buddies.length);

                    setFollowerProfiles(filteredFollowers);
                    setLoadingFollowers(false);

                } catch (error) {
                    console.error('Error loading profile data:', error);
                } finally {
                    setLoadingData(false);
                }
            };

            loadProfileData();

            return () => {
                if (unsubscribeTickets) unsubscribeTickets();
            };
        }, [authUser?.id])
    );

    const handleShare = async () => {
        try {
            if (!authUser?.id) return;
            const url = `https://croww.ai/provider/${authUser.id}`;
            await Share.share({
                message: `Check out ${authUser.name} on Croww! ${url}`,
                url: url, // iOS only
                title: authUser.name
            });
        } catch (error) {
            console.error('Error sharing profile:', error);
        }
    };

    // Use authUser as the source of truth
    const user = authUser || defaultUser;
    const loading = authLoading || loadingData;

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

    const isBusiness = user.userType === 'business';
    const isProvider = user.userType === 'provider';

    const renderEventsTab = () => (
        <View>
            <View style={styles.sectionHeader}>
                <Typography variant="h3">
                    {isProvider ? "Incoming Bookings" : "My Events"}
                </Typography>
                {isBusiness && (
                    <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')}>
                        <Typography variant="small" style={{ color: COLORS.accent }}>+ New Event</Typography>
                    </TouchableOpacity>
                )}
            </View>

            {/* Subtabs for Event Categories */}
            {!isProvider && profileEvents.length > 0 && (
                <View style={styles.segmentedControl}>
                    {['active', 'completed', 'cancelled'].map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[
                                styles.segmentButton,
                                eventsFilter === tab && styles.segmentButtonActive
                            ]}
                            onPress={() => setEventsFilter(tab)}
                        >
                            <Typography
                                variant="small"
                                style={{
                                    fontWeight: '600',
                                    color: eventsFilter === tab ? COLORS.primary : COLORS.secondary,
                                    textTransform: 'capitalize'
                                }}
                            >
                                {tab}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {(() => {
                const now = new Date();
                const filteredEvents = isProvider ? profileEvents : profileEvents.filter(item => {
                    if (!item.date) return true;
                    // Standardize status checks
                    const isCancelledObj = item.status === 'cancelled';
                    const eventDate = new Date(item.date);
                    const isPassed = eventDate < now;
                    
                    if (eventsFilter === 'cancelled') return isCancelledObj;
                    if (eventsFilter === 'completed') return !isCancelledObj && isPassed;
                    return !isCancelledObj && !isPassed; // active
                });

                if (filteredEvents.length === 0 && !loading) {
                    return (
                        <View style={styles.emptyState}>
                            <Ionicons name={isProvider ? "briefcase-outline" : "calendar-outline"} size={48} color={COLORS.border} />
                            <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.m, textAlign: 'center' }}>
                                {isProvider ? "No bookings found yet." : `No ${eventsFilter} events found.`}
                            </Typography>
                        </View>
                    );
                }

                return filteredEvents.map((item) => {
                // Normalize data structure for the card
                const title = item.title || item.serviceName || item.eventTitle || 'Untitled';
                const dateText = item.date || 'No date set';
                const imageUri = getValidImageUri(item.imageUri || item.image || item.providerImage) || DEFAULT_EVENT_IMAGE;

                return (
                    <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                            if (isProvider) navigation.navigate('BookingDetail', { booking: item });
                            else navigation.navigate('EventStats', { event: item });
                        }}
                    >
                        <NotionCard style={styles.eventCard}>
                            <Image source={{ uri: imageUri }} style={styles.eventImage} />
                            <View style={styles.eventInfo}>
                                <Typography variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                                    {title}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    {dateText}
                                </Typography>
                                {!isProvider && item.status === 'cancelled' && (
                                    <View style={[styles.statusBadgeInline, { backgroundColor: COLORS.error + '20' }]}>
                                        <Typography variant="small" style={{ color: COLORS.error, fontSize: 10, fontWeight: '700' }}>CANCELLED</Typography>
                                    </View>
                                )}
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
                        </NotionCard>
                    </TouchableOpacity>
                );
            });
            })()}
        </View>
    );

    const renderPortfolioTab = () => (
        <View>
            <View style={styles.sectionHeader}>
                <Typography variant="h3">Portfolio</Typography>
                <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                    <Typography variant="small" style={{ color: COLORS.accent }}>+ Add Work</Typography>
                </TouchableOpacity>
            </View>

            {/* Social & External Portfolio Links */}
            {user.socialLinks && Object.values(user.socialLinks).some(link => link) && (
                <View style={styles.socialLinksRow}>
                    {user.socialLinks.instagram ? (
                        <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(user.socialLinks.instagram)}>
                            <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                            <Typography variant="small" style={styles.socialLinkText}>Instagram</Typography>
                        </TouchableOpacity>
                    ) : null}
                    {user.socialLinks.soundcloud ? (
                        <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(user.socialLinks.soundcloud)}>
                            <Ionicons name="musical-notes" size={20} color="#FF5500" />
                            <Typography variant="small" style={styles.socialLinkText}>SoundCloud</Typography>
                        </TouchableOpacity>
                    ) : null}
                    {user.socialLinks.behance ? (
                        <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(user.socialLinks.behance)}>
                            <Ionicons name="color-palette" size={20} color="#1769FF" />
                            <Typography variant="small" style={styles.socialLinkText}>Behance</Typography>
                        </TouchableOpacity>
                    ) : null}
                    {user.socialLinks.youtube ? (
                        <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(user.socialLinks.youtube)}>
                            <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                            <Typography variant="small" style={styles.socialLinkText}>YouTube</Typography>
                        </TouchableOpacity>
                    ) : null}
                    {user.socialLinks.googleDrive ? (
                        <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(user.socialLinks.googleDrive)}>
                            <Ionicons name="cloud-outline" size={20} color="#4285F4" />
                            <Typography variant="small" style={styles.socialLinkText}>External Link</Typography>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}

            <View style={styles.portfolioGrid}>
                {user.profilePhotos && user.profilePhotos.length > 0 ? (
                    user.profilePhotos.map((photo, index) => (
                        <View key={index} style={styles.portfolioItem}>
                            <Image
                                source={{ uri: photo }}
                                style={styles.portfolioImage}
                            />
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyPortfolio}>
                        <Ionicons name="images-outline" size={48} color={COLORS.border} />
                        <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.m }}>
                            No work showcased yet.
                        </Typography>
                    </View>
                )}
            </View>
        </View>
    );

    const renderFriendsTab = () => (
        <View>
            <View style={styles.sectionHeader}>
                <Typography variant="h3">{isProvider ? "Reviews" : "Followers"}</Typography>
                <TouchableOpacity
                    onPress={() => isProvider
                        ? navigation.navigate('ReviewList', { businessId: user.id, businessName: user.name })
                        : navigation.navigate('FriendsList', { userId: user.id, activeTab: 'followers' })
                    }
                >
                    <Typography variant="small" style={{ color: COLORS.accent }}>
                        {isProvider ? "Read All" : `See All (${followerCount ?? 0})`}
                    </Typography>
                </TouchableOpacity>
            </View>
            {isProvider ? (
                reviews.length > 0 ? (
                    reviews.slice(0, 3).map((review) => (
                        <NotionCard key={review.id} style={styles.reviewWidget}>
                            <View style={styles.reviewHeader}>
                                <Typography variant="body" style={{ fontWeight: '600' }}>{review.userName}</Typography>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Ionicons
                                            key={s}
                                            name={s <= review.rating ? "star" : "star-outline"}
                                            size={12}
                                            color="#FFD700"
                                        />
                                    ))}
                                </View>
                            </View>
                            <Typography variant="caption" color={COLORS.secondary} numberOfLines={2}>
                                {review.comment || "No comment provided."}
                            </Typography>
                        </NotionCard>
                    ))
                ) : (
                    <Typography variant="body" style={{ color: COLORS.secondary, fontStyle: 'italic' }}>
                        No reviews yet.
                    </Typography>
                )
            ) : loadingFollowers ? (
                <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: SPACING.l }} />
            ) : followerProfiles.length > 0 ? (
                followerProfiles.slice(0, 5).map((follower) => (
                    <TouchableOpacity
                        key={follower.id}
                        onPress={() => navigation.push('ServiceDetail', { serviceId: follower.id })}
                        activeOpacity={0.75}
                    >
                        <NotionCard style={styles.friendCard}>
                            <Image
                                source={follower.avatar ? { uri: follower.avatar } : require('../../../assets/croww-logo.png')}
                                style={styles.friendAvatar}
                            />
                            <View style={styles.friendInfo}>
                                <Typography variant="body" style={{ fontWeight: '600' }}>
                                    {follower.name || 'User'}
                                </Typography>
                                {follower.bio ? (
                                    <Typography variant="caption" style={{ color: COLORS.secondary }} numberOfLines={1}>
                                        {follower.bio}
                                    </Typography>
                                ) : null}
                            </View>
                            <TouchableOpacity
                                style={styles.messageButton}
                                onPress={() => navigation.navigate('Chat', { recipientId: follower.id, recipientName: follower.name })}
                            >
                                <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
                            </TouchableOpacity>
                        </NotionCard>
                    </TouchableOpacity>
                ))
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="person-outline" size={48} color={COLORS.border} />
                    <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.m }}>
                        No followers yet.
                    </Typography>
                </View>
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
                            {/* Stat 1: Events / Bookings / Followers */}
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {
                                    if (!isBusiness && !isProvider)
                                        navigation.navigate('FriendsList', { userId: user.id, activeTab: 'followers' });
                                }}
                                activeOpacity={isBusiness || isProvider ? 1 : 0.7}
                            >
                                <Typography variant="h2" style={{ color: COLORS.accent }}>
                                    {isBusiness
                                        ? (user.stats?.totalEvents || 0)
                                        : isProvider
                                            ? (user.stats?.bookings || 0)
                                            : (followerCount ?? user.followersCount ?? 0)}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    {isBusiness ? 'Events' : (isProvider ? 'Bookings' : 'Followers')}
                                </Typography>
                            </TouchableOpacity>

                            <View style={styles.statDivider} />

                            {/* Stat 2: Followers / Rating / Following */}
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {
                                    if (isBusiness)
                                        navigation.navigate('FriendsList', { userId: user.id, activeTab: 'followers' });
                                    else if (!isProvider)
                                        navigation.navigate('FriendsList', { userId: user.id, activeTab: 'following' });
                                }}
                                activeOpacity={isProvider ? 1 : 0.7}
                            >
                                <Typography variant="h2" style={{ color: COLORS.accent }}>
                                    {isBusiness
                                        ? (followerCount ?? user.followersCount ?? user.stats?.followers ?? 0)
                                        : isProvider
                                            ? (user.rating ? Number(user.rating).toFixed(1) : 'New')
                                            : (followingCount ?? 0)}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    {isBusiness ? 'Followers' : (isProvider ? 'Rating' : 'Following')}
                                </Typography>
                            </TouchableOpacity>

                            <View style={styles.statDivider} />

                            {/* Stat 3: Rating / Exp / Buddies */}
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => {
                                    if (!isBusiness && !isProvider)
                                        navigation.navigate('FriendsList', { userId: user.id, activeTab: 'buddies' });
                                }}
                                activeOpacity={isBusiness || isProvider ? 1 : 0.7}
                            >
                                <Typography variant="h2" style={{ color: COLORS.accent }}>
                                    {isBusiness
                                        ? (user.rating ? Number(user.rating).toFixed(1) : 'New')
                                        : isProvider
                                            ? (user.stats?.experience || user.experience || '—')
                                            : (buddyCount ?? 0)}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    {isBusiness ? 'Rating' : (isProvider ? 'Exp' : 'Buddies')}
                                </Typography>
                            </TouchableOpacity>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                            {isBusiness ? (
                                <AntigravityButton
                                    title="Post Event"
                                    icon="add-circle-outline"
                                    style={{ flex: 1, marginRight: SPACING.s }}
                                    onPress={() => navigation.navigate('CreateEvent')}
                                />
                            ) : (
                                <AntigravityButton
                                    title={isProvider ? "Manage" : "Edit Profile"}
                                    icon={isProvider ? "briefcase-outline" : "create-outline"}
                                    style={{ flex: 1, marginRight: SPACING.s }}
                                    onPress={() => navigation.navigate('EditProfile')}
                                />
                            )}
                            <AntigravityButton
                                title={isBusiness ? "Analytics" : (isProvider ? "Share" : "Share")}
                                icon={isBusiness ? "analytics-outline" : "share-outline"}
                                variant="secondary"
                                style={{ flex: 1, marginLeft: SPACING.s }}
                                onPress={isBusiness ? () => navigation.navigate('Analytics') : handleShare}
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
                                {isProvider ? "Reviews" : "Followers"}
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
    emptyPortfolio: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
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
    reviewWidget: {
        padding: SPACING.m,
        marginBottom: SPACING.s,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        marginTop: SPACING.l,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: COLORS.surfaceHighlight + '40',
        borderRadius: BORDER_RADIUS.m,
        padding: 4,
        marginBottom: SPACING.m,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.s,
    },
    segmentButtonActive: {
        backgroundColor: COLORS.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    statusBadgeInline: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    socialLinksRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        marginBottom: SPACING.m,
        paddingHorizontal: SPACING.m,
    },
    socialLinkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    socialLinkText: {
        color: COLORS.primary,
        fontWeight: '500',
    },
});

export default ProfileScreen;
