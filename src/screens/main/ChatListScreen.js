import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { chatService } from '../../services/chatService';
import { userService } from '../../services/userService';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

const ChatListScreen = ({ navigation }) => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const isFocused = useIsFocused();

    useEffect(() => {
        let unsubscribe;

        const init = async () => {
            try {
                const user = await userService.getUser();
                setCurrentUser(user);

                if (user) {
                    unsubscribe = chatService.subscribeToUserChats(user.id, async (chatData) => {
                        // Enhance chats with recipient info
                        const enhancedChats = [];
                        for (const chat of chatData) {
                            let recipient = { name: 'Chat', avatar: null };
                            try {
                                if (chat.type === 'group') {
                                    recipient = {
                                        name: chat.name || 'Group Chat',
                                        avatar: chat.image || null,
                                        isGroup: true
                                    };
                                } else {
                                    const participantIds = chat.participantIds || [];
                                    const myId = user?.id || user?.uid;
                                    const recipientId = participantIds.find(id => id && id !== myId);

                                    if (recipientId && typeof recipientId === 'string') {
                                        // First try stored names (fast, no network call)
                                        const storedNames = chat.participantNames || {};
                                        const storedName = storedNames[recipientId];

                                        if (storedName) {
                                            recipient = {
                                                name: storedName,
                                                avatar: null
                                            };
                                        }

                                        // Then try full user lookup for avatar and updated name
                                        const userData = await userService.getUserById(recipientId);
                                        if (userData) {
                                            recipient = {
                                                name: userData.name || storedName || 'User',
                                                avatar: userData.avatar || userData.profileImage || null
                                            };
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error('Error enhancing chat:', err);
                            }
                            enhancedChats.push({ ...chat, recipient });
                        }
                        setChats(enhancedChats);
                        setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error loading chats:", error);
                setLoading(false);
            }
        };

        if (isFocused) {
            init();
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isFocused]);

    const renderItem = ({ item }) => {
        const lastMessageTime = item.lastMessageTimestamp && typeof item.lastMessageTimestamp.toDate === 'function'
            ? formatDistanceToNow(item.lastMessageTimestamp.toDate(), { addSuffix: true })
            : '';

        return (
            <View style={styles.chatItem}>
                <TouchableOpacity
                    onPress={() => {
                        const recipientId = item.participantIds.find(id => id !== currentUser?.id);
                        if (recipientId && !item.recipient?.isGroup) {
                            navigation.navigate('ServiceDetail', { serviceId: recipientId });
                        }
                    }}
                >
                    {item.recipient?.isGroup ? (
                        <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary }]}>
                            <Ionicons name="people" size={24} color={COLORS.background} />
                        </View>
                    ) : (
                        <Image
                            source={item.recipient?.avatar ? { uri: item.recipient.avatar } : require('../../../assets/croww-logo.png')}
                            style={styles.avatar}
                        />
                    )}
                </TouchableOpacity>

                <View style={styles.chatInfo}>
                    <TouchableOpacity
                        style={styles.chatHeader}
                        onPress={() => navigation.navigate('Chat', {
                            recipientId: item.recipient?.isGroup ? 'GROUP' : item.participantIds.find(id => id !== currentUser?.id),
                            recipientName: item.recipient?.name,
                            chatId: item.id
                        })}
                    >
                        <Typography variant="body" style={styles.name}>{item.recipient?.name}</Typography>
                        <Typography variant="caption" style={styles.time}>{lastMessageTime}</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Chat', {
                            recipientId: item.recipient?.isGroup ? 'GROUP' : item.participantIds.find(id => id !== currentUser?.id),
                            recipientName: item.recipient?.name,
                            chatId: item.id
                        })}
                    >
                        <Typography variant="caption" numberOfLines={1} style={styles.lastMessage}>
                            {item.lastMessage || 'Start a conversation'}
                        </Typography>
                    </TouchableOpacity>
                </View>
            </View>
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
                    contentContainerStyle={styles.list}
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
    list: {
        padding: SPACING.m,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
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
    chatInfo: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    name: {
        fontWeight: '600',
    },
    time: {
        color: COLORS.secondary,
    },
    lastMessage: {
        color: COLORS.secondary,
        marginRight: SPACING.xl,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.xxl * 2,
    },
});

export default ChatListScreen;
