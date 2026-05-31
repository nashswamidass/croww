import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { chatService } from '../../services/chatService';
import { userService } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

const ChatListScreen = ({ navigation }) => {
    const { user: authUser } = useAuth();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Cache avatars/names so we don't re-fetch on every snapshot
    const profileCache = useRef({});

    useEffect(() => {
        const currentUserId = authUser?.id || authUser?.uid;
        if (!currentUserId) {
            setLoading(false);
            return;
        }

        const unsubscribe = chatService.subscribeToUserChats(currentUserId, async (chatData) => {
            // STEP 1: Render immediately with whatever names we already know
            // (stored in participantNames field on the chat doc, or cache)
            const quickChats = chatData.map(chat => {
                let recipient;
                if (chat.type === 'group') {
                    recipient = { name: chat.name || 'Group Chat', avatar: chat.image || null, isGroup: true };
                } else {
                    const recipientId = (chat.participantIds || []).find(id => id && id !== currentUserId);
                    const cached = profileCache.current[recipientId];
                    const storedName = chat.participantNames?.[recipientId];
                    recipient = {
                        id: recipientId,
                        name: cached?.name || storedName || 'Loading...',
                        avatar: cached?.avatar || null,
                    };
                }
                return { ...chat, recipient };
            });
            setChats(quickChats);
            setLoading(false);

            // STEP 2: Hydrate missing avatars & names in parallel (background)
            const missingIds = chatData
                .filter(c => c.type !== 'group')
                .map(c => (c.participantIds || []).find(id => id && id !== currentUserId))
                .filter(id => id && !profileCache.current[id]);

            if (missingIds.length === 0) return;

            const uniqueIds = [...new Set(missingIds)];
            const profiles = await Promise.all(
                uniqueIds.map(id =>
                    userService.getUserById(id)
                        .then(u => ({ id, name: u?.name || 'User', avatar: u?.avatar || u?.profileImage || null }))
                        .catch(() => ({ id, name: 'User', avatar: null }))
                )
            );

            // Store in cache
            profiles.forEach(p => { profileCache.current[p.id] = p; });

            // Re-apply with full data
            setChats(prev => prev.map(chat => {
                if (chat.type === 'group' || !chat.recipient?.id) return chat;
                const fresh = profileCache.current[chat.recipient.id];
                if (!fresh) return chat;
                return { ...chat, recipient: { ...chat.recipient, name: fresh.name, avatar: fresh.avatar } };
            }));
        });

        return () => unsubscribe();
    }, [authUser?.id, authUser?.uid]);

    const currentUserId = authUser?.id || authUser?.uid;

    const renderItem = ({ item }) => {
        const lastMessageTime = item.lastMessageTimestamp?.toDate
            ? formatDistanceToNow(item.lastMessageTimestamp.toDate(), { addSuffix: true })
            : '';

        const unreadCount = item.unreadCounts?.[currentUserId] || 0;

        return (
            <TouchableOpacity
                style={styles.chatItem}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('Chat', {
                    recipientId: item.recipient?.isGroup ? 'GROUP' : item.recipient?.id,
                    recipientName: item.recipient?.name,
                    chatId: item.id
                })}
            >
                {/* Avatar */}
                {item.recipient?.isGroup ? (
                    <View style={[styles.avatar, styles.groupAvatar]}>
                        <Ionicons name="people" size={22} color="#fff" />
                    </View>
                ) : (
                    <Image
                        source={
                            item.recipient?.avatar
                                ? { uri: item.recipient.avatar }
                                : require('../../../assets/croww-logo.png')
                        }
                        style={styles.avatar}
                    />
                )}

                {/* Info */}
                <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                        <Typography variant="body" style={styles.name} numberOfLines={1}>
                            {item.recipient?.name}
                        </Typography>
                        <Typography variant="caption" style={styles.time}>{lastMessageTime}</Typography>
                    </View>
                    <View style={styles.chatFooter}>
                        <Typography variant="caption" numberOfLines={1} style={[styles.lastMessage, unreadCount > 0 && styles.unreadMessage]}>
                            {item.lastMessage?.startsWith('__GIPHY__:') || item.lastMessage?.startsWith('__STICKER__') 
                                ? '🎁 Sent a sticker' 
                                : (item.lastMessage || 'Start a conversation')}
                        </Typography>
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Typography variant="caption" style={styles.badgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Typography>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Messages</Typography>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
            ) : (
                <FlatList
                    data={chats}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={chats.length === 0 ? styles.emptyContainer : styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.secondary} />
                            <Typography variant="body" style={{ marginTop: SPACING.m, color: COLORS.secondary }}>
                                No messages yet.
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
        justifyContent: 'space-between',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        width: 40,
    },
    list: {
        paddingVertical: SPACING.s,
    },
    emptyContainer: {
        flex: 1,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surfaceHighlight,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    groupAvatar: {
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatInfo: {
        flex: 1,
        minWidth: 0,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
    name: {
        fontWeight: '600',
        flex: 1,
        marginRight: SPACING.s,
    },
    time: {
        color: COLORS.secondary,
        flexShrink: 0,
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastMessage: {
        color: COLORS.secondary,
        flex: 1,
        marginRight: SPACING.s,
    },
    unreadMessage: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    badge: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    badgeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 11,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.xxl * 2,
    },
});

export default ChatListScreen;
