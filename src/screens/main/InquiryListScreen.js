import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { chatService } from '../../services/chatService';
import { userService } from '../../services/userService';

const InquiryListScreen = ({ navigation }) => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        let unsubscribe;
        const init = async () => {
            const user = await userService.getUser();
            if (user) {
                setCurrentUser(user);
                unsubscribe = chatService.subscribeToUserChats(user.id, async (userChats) => {
                    // Enhance chats with recipient info
                    const enhancedChats = [];
                    for (const chat of userChats) {
                        let recipient = { name: 'User', avatar: null };
                        try {
                            const participantIds = chat.participantIds || [];
                            const myId = user.id;
                            const recipientId = participantIds.find(id => id && id !== myId);

                            if (recipientId) {
                                // First try stored names
                                const storedNames = chat.participantNames || {};
                                if (storedNames[recipientId]) {
                                    recipient.name = storedNames[recipientId];
                                }

                                // fetch user details
                                const userData = await userService.getUserById(recipientId);
                                if (userData) {
                                    recipient = {
                                        name: userData.name || userData.firstName || 'User',
                                        avatar: userData.avatar || userData.photoURL || null,
                                        role: userData.role || userData.userType
                                    };
                                }
                            }
                        } catch (err) {
                            console.error('Error enhancing inquiry:', err);
                        }
                        enhancedChats.push({ ...chat, recipient });
                    }
                    setChats(enhancedChats);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        };

        init();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const renderChatItem = ({ item }) => {
        const lastMessageTime = item.lastMessageTimestamp
            ? new Date(item.lastMessageTimestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

        const recipientId = item.participantIds?.find(id => id !== currentUser?.id);

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('Chat', {
                    chatId: item.id,
                    recipientName: item.recipient?.name || 'User',
                    recipientId: recipientId,
                    recipientRole: item.recipient?.role
                })}
            >
                <NotionCard style={styles.chatCard}>
                    <View style={styles.chatHeader}>
                        <TouchableOpacity
                            style={styles.avatar}
                            onPress={() => navigation.navigate('ServiceDetail', { serviceId: recipientId })}
                        >
                            {item.recipient?.avatar ? (
                                <Image
                                    source={{ uri: item.recipient.avatar }}
                                    style={{ width: 40, height: 40, borderRadius: 20 }}
                                />
                            ) : (
                                <Ionicons name="person" size={20} color={COLORS.secondary} />
                            )}
                        </TouchableOpacity>
                        <View style={styles.chatInfo}>
                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                {item.recipient?.name || 'User'}
                            </Typography>
                            <Typography variant="caption" color={COLORS.secondary} numberOfLines={1}>
                                {item.lastMessage || 'No messages yet'}
                            </Typography>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Typography variant="caption" color={COLORS.secondary}>
                                {lastMessageTime}
                            </Typography>
                            {item.unreadCounts?.[currentUser?.id] > 0 && (
                                <View style={{
                                    backgroundColor: COLORS.accent,
                                    borderRadius: 10,
                                    minWidth: 20,
                                    height: 20,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginTop: 4
                                }}>
                                    <Typography variant="small" style={{ color: COLORS.background, fontSize: 10, fontWeight: 'bold' }}>
                                        {item.unreadCounts[currentUser.id]}
                                    </Typography>
                                </View>
                            )}
                        </View>
                    </View>
                </NotionCard>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Inquiries</Typography>
                <View style={{ width: 40 }} />
            </View>

            {chats.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={64} color={COLORS.border} />
                    <Typography variant="body" color={COLORS.secondary} style={styles.emptyText}>
                        No inquiries yet.
                    </Typography>
                </View>
            ) : (
                <FlatList
                    data={chats}
                    renderItem={renderChatItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
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
        padding: 4,
    },
    list: {
        padding: SPACING.m,
    },
    chatCard: {
        padding: SPACING.m,
        marginBottom: SPACING.s,
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    chatInfo: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    emptyText: {
        marginTop: SPACING.m,
        textAlign: 'center',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default InquiryListScreen;
