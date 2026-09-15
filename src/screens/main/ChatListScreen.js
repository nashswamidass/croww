import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import FloatingCard from '../../components/FloatingCard';
import { SPACING, COLORS, TOUCH_TARGETS } from '../../constants/theme';
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

            profiles.forEach(p => { profileCache.current[p.id] = p; });

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
                        <Typography variant="bodyLarge" style={styles.name} numberOfLines={1}>
                            {item.recipient?.name}
                        </Typography>
                        <Typography variant="caption" style={styles.time}>{lastMessageTime}</Typography>
                    </View>
                    <View style={styles.chatFooter}>
                        <Typography variant="bodyMedium" numberOfLines={1} style={[styles.lastMessage, unreadCount > 0 && styles.unreadMessage]}>
                            {item.lastMessage?.startsWith('__GIPHY__:') || item.lastMessage?.startsWith('__STICKER__') 
                                ? '🎁 Sent a sticker' 
                                : (item.lastMessage || 'Start a conversation')}
                        </Typography>
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Typography variant="micro" style={styles.badgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Typography>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (!authUser) {
        return (
            <ScreenWrapper edges={['top']}>
                <View style={styles.header}>
                    {navigation.canGoBack() ? (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                            hitSlop={TOUCH_TARGETS.hitSlop}
                        >
                            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    ) : <View style={{ width: 16 }} />}
                    <Typography variant="titleLarge" style={styles.headerTitle}>Messages</Typography>
                    <View style={{ width: 40 }} />
                </View>

                <View style={{ flex: 1, padding: SPACING.l, justifyContent: 'center', alignItems: 'center' }}>
                    <FloatingCard style={{ padding: SPACING.xl, alignItems: 'center', width: '100%', maxWidth: 440 }}>
                        <View style={{
                            width: 72,
                            height: 72,
                            borderRadius: 36,
                            backgroundColor: (COLORS.accent || '#E05A47') + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: SPACING.m,
                        }}>
                            <Ionicons name="chatbubbles-outline" size={36} color={COLORS.accent} />
                        </View>
                        <Typography variant="titleLarge" style={{ fontWeight: '800', textAlign: 'center', color: COLORS.text, marginBottom: 6 }}>
                            Sign in to view messages
                        </Typography>
                        <Typography variant="bodyMedium" style={{ textAlign: 'center', color: COLORS.textSecondary, lineHeight: 22, marginBottom: SPACING.xl, maxWidth: 360 }}>
                            Connect with property owners, agents, and track location access requests in one place.
                        </Typography>

                        <AntigravityButton
                            title="Sign in to Croww"
                            onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
                            size="large"
                            style={{ width: '100%', maxWidth: 300, height: 52, borderRadius: 14 }}
                        />
                    </FloatingCard>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                {navigation.canGoBack() ? (
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                        hitSlop={TOUCH_TARGETS.hitSlop}
                    >
                        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                ) : <View style={{ width: 16 }} />}
                <Typography variant="titleLarge" style={styles.headerTitle}>Messages</Typography>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: SPACING.xl }} />
            ) : (
                <FlatList
                    data={chats}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={chats.length === 0 ? styles.emptyContainer : styles.list}
                    ListEmptyComponent={
                        <FloatingCard style={styles.emptyCard}>
                            <Ionicons name="chatbubbles-outline" size={40} color={COLORS.textSecondary} style={{ marginBottom: SPACING.s }} />
                            <Typography variant="titleLarge" style={styles.emptyTitle}>No messages yet</Typography>
                            <Typography variant="bodyMedium" style={styles.emptySubtitle}>
                                Inquire about properties or request exact location details from owners directly.
                            </Typography>
                            <AntigravityButton
                                title="Explore Properties"
                                icon="compass-outline"
                                onPress={() => navigation.navigate('Tabs', { screen: 'Explore' })}
                                accessibilityLabel="Explore properties"
                                style={{ marginTop: SPACING.m }}
                            />
                        </FloatingCard>
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
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontWeight: '800',
        color: COLORS.primary,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        paddingVertical: SPACING.s,
    },
    emptyContainer: {
        flex: 1,
        paddingHorizontal: SPACING.l,
        justifyContent: 'center',
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
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
        marginBottom: 4,
    },
    name: {
        fontWeight: '700',
        color: COLORS.primary,
        flex: 1,
        marginRight: SPACING.s,
    },
    time: {
        color: COLORS.textSecondary,
        flexShrink: 0,
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastMessage: {
        color: COLORS.textSecondary,
        flex: 1,
        marginRight: SPACING.s,
    },
    unreadMessage: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    badge: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    emptyCard: {
        padding: SPACING.xl,
        alignItems: 'center',
        textAlign: 'center',
        marginHorizontal: SPACING.l,
    },
    emptyTitle: {
        color: COLORS.primary,
        fontWeight: '800',
        textAlign: 'center',
    },
    emptySubtitle: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 20,
    },
});

export default ChatListScreen;

