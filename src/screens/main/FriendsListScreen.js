import React, { useState, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, FlatList, Image,
    RefreshControl, TouchableOpacity, ActivityIndicator
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';
import { buddyService } from '../../services/buddyService';
import { getAvatarSource } from '../../utils/avatarHelper';
import { auth } from '../../services/firebaseConfig';
import { useAuth } from '../../context/AuthContext';

const TABS = [
    { id: 'followers', label: 'Followers' },
    { id: 'following', label: 'Following' },
    { id: 'buddies', label: 'Buddies' }
];

const FriendsListScreen = ({ navigation, route }) => {
    const { user: authUser } = useAuth();
    // Support viewing another user's profile's followers/following
    const targetUserId = route.params?.userId || authUser?.id || authUser?.uid || auth.currentUser?.uid;
    const isOwnProfile = targetUserId === (authUser?.id || authUser?.uid || auth.currentUser?.uid);

    const defaultTab = route.params?.activeTab || 'followers';
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        if (!targetUserId) return;
        setLoading(true);
        try {
            if (activeTab === 'followers') {
                const ids = await userService.getFollowerIds(targetUserId);
                const profiles = await Promise.all(
                    ids.map(id => userService.getUserById(id).catch(() => null))
                );
                setData(profiles.filter(Boolean));
            } else if (activeTab === 'following') {
                const ids = await userService.getFollowingIds(targetUserId);
                const profiles = await Promise.all(
                    ids.map(id => userService.getUserById(id).catch(() => null))
                );
                setData(profiles.filter(Boolean));
            } else {
                // Buddies = co-members of any buddy group
                const buddies = await buddyService.getMyBuddies(targetUserId);
                setData(buddies);
            }
        } catch (e) {
            console.error('FriendsListScreen load error:', e);
            setData([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, targetUserId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handlePress = (userId) => {
        navigation.push('ServiceDetail', { serviceId: userId });
    };

    const emptyMessages = {
        followers: 'No followers yet.',
        following: 'Not following anyone yet.',
        buddies: 'No buddies yet. Join a buddy group at an event!'
    };

    const renderItem = ({ item }) => {
        const userId = item.id || item.uid;
        const name = item.name || 'User';
        const avatar = item.avatar || item.userAvatar || null;

        return (
            <TouchableOpacity onPress={() => handlePress(userId)} activeOpacity={0.75}>
                <NotionCard style={styles.card}>
                    <Image
                        source={getAvatarSource(avatar, item.userType || 'individual')}
                        style={styles.avatar}
                    />
                    <View style={styles.info}>
                        <Typography variant="body" style={{ fontWeight: '600' }}>
                            {name}
                        </Typography>
                        {item.bio ? (
                            <Typography variant="caption" style={{ color: COLORS.secondary }} numberOfLines={1}>
                                {item.bio}
                            </Typography>
                        ) : activeTab === 'buddies' && item.eventId ? (
                            <Typography variant="caption" style={{ color: COLORS.accent }}>
                                Event buddy
                            </Typography>
                        ) : null}
                    </View>
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => navigation.navigate('Chat', {
                            recipientId: userId,
                            recipientName: name
                        })}
                    >
                        <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                </NotionCard>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3">
                    {isOwnProfile ? 'My Network' : 'Profile'}
                </Typography>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Typography
                            variant="body"
                            style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}
                        >
                            {tab.label}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item, i) => item?.id || item?.uid || String(i)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); loadData(); }}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons
                                name={activeTab === 'buddies' ? 'people-circle-outline' : 'person-outline'}
                                size={56}
                                color={COLORS.border}
                            />
                            <Typography variant="body" style={styles.emptyText}>
                                {emptyMessages[activeTab]}
                            </Typography>
                        </View>
                    }
                />
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: SPACING.m,
    },
    backBtn: {
        padding: 4,
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: SPACING.m,
        marginTop: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight + '40',
        borderRadius: BORDER_RADIUS.m,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.s,
    },
    activeTab: {
        backgroundColor: COLORS.surfaceHighlight,
    },
    tabLabel: {
        color: COLORS.secondary,
        fontWeight: '600',
        fontSize: 13,
    },
    activeTabLabel: {
        color: COLORS.accent,
    },
    list: {
        padding: SPACING.m,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    info: {
        flex: 1,
    },
    iconBtn: {
        padding: SPACING.s,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
    },
    empty: {
        alignItems: 'center',
        marginTop: 80,
        paddingHorizontal: SPACING.xl,
    },
    emptyText: {
        color: COLORS.secondary,
        marginTop: SPACING.m,
        textAlign: 'center',
    }
});

export default FriendsListScreen;
