import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { friendService } from '../../services/friendService';
import { getAvatarSource } from '../../utils/avatarHelper';
import { auth } from '../../services/firebaseConfig';

const FriendsListScreen = ({ navigation, route }) => {
    // If userId is passed, we view that user's friends (if public - for now assume yes or own)
    // Default to current user
    const targetUserId = route.params?.userId || auth.currentUser?.uid;

    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const isOwnProfile = targetUserId === auth.currentUser?.uid;

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        try {
            const data = await friendService.getFriends(targetUserId);
            setFriends(data);
        } catch (error) {
            console.error("Error loading friends:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleUnfriend = (friend) => {
        Alert.alert(
            "Unfriend",
            `Are you sure you want to remove ${friend.name} as a friend?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unfriend",
                    style: 'destructive',
                    onPress: async () => {
                        const result = await friendService.removeFriend(friend.friendId);
                        if (result.success) {
                            setFriends(prev => prev.filter(f => f.id !== friend.id));
                        }
                    }
                }
            ]
        );
    };

    const handlePressFriend = (friendId) => {
        navigation.push('Profile', { userId: friendId });
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={() => handlePressFriend(item.friendId)} activeOpacity={0.7}>
            <NotionCard style={styles.card}>
                <Image
                    source={getAvatarSource(item.avatar, 'individual')}
                    style={styles.avatar}
                />
                <View style={styles.info}>
                    <Typography variant="body" style={{ fontWeight: '600' }}>
                        {item.name}
                    </Typography>
                    {/* Could show mutual friends count here if we calculate it */}
                </View>

                {isOwnProfile && (
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleUnfriend(item)}>
                        <Ionicons name="person-remove-outline" size={20} color={COLORS.secondary} />
                    </TouchableOpacity>
                )}

                {/* Message Button - always useful */}
                <TouchableOpacity
                    style={[styles.iconBtn, { marginRight: isOwnProfile ? SPACING.s : 0 }]}
                    onPress={() => navigation.navigate('Chat', { recipientId: item.friendId, recipientName: item.name })}
                >
                    <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
                </TouchableOpacity>

            </NotionCard>
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Ionicons
                        name="arrow-back"
                        size={24}
                        color={COLORS.primary}
                        onPress={() => navigation.goBack()}
                    />
                    <Typography variant="h3" style={{ marginLeft: SPACING.m }}>
                        {isOwnProfile ? "My Friends" : "Friends"}
                    </Typography>
                </View>
                {isOwnProfile && (
                    <TouchableOpacity onPress={() => navigation.navigate('FriendRequests')}>
                        <Typography variant="body" style={{ color: COLORS.accent, fontWeight: '600' }}>
                            Requests
                        </Typography>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={friends}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFriends(); }} />
                }
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyState}>
                            <Typography variant="body" style={{ color: COLORS.secondary }}>
                                No friends yet. Go verify out some events!
                            </Typography>
                        </View>
                    )
                }
            />
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
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    content: {
        padding: SPACING.m,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    info: {
        flex: 1,
    },
    iconBtn: {
        padding: SPACING.s,
    },
    emptyState: {
        alignItems: 'center',
        padding: SPACING.xl,
    }
});

export default FriendsListScreen;
