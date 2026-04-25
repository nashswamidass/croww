import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatService } from '../../services/chatService';
import { userService } from '../../services/userService';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const ChatScreen = ({ route, navigation }) => {
    const { recipientId, recipientName, recipientRole } = route.params;
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [chatId, setChatId] = useState(null);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef();
    const insets = useSafeAreaInsets(); // Use insets for safe area

    useEffect(() => {
        const initChat = async () => {
            try {
                // Get current user
                let user = await userService.getUser();

                // Fallback for demo/testing if no user logged in
                if (!user) {
                    user = { id: 'test-user-' + Date.now(), name: 'Test User' };
                }

                setCurrentUser(user);

                if (route.params.chatId) {
                    // Use existing chat ID (e.g. from Buddy Request or List)
                    setChatId(route.params.chatId);
                    const unsubscribe = chatService.subscribeToChat(route.params.chatId, (newMessages) => {
                        setMessages(newMessages);
                        setLoading(false);
                        // Mark as read when messages load/update
                        if (user?.id) {
                            chatService.markChatAsRead(route.params.chatId, user.id);
                        }
                    });

                    // Fetch chat details if name is missing
                    if (!recipientName) {
                        try {
                            const chatDoc = await chatService.getChat(route.params.chatId);
                            if (chatDoc) {
                                const otherId = chatDoc.participantIds?.find(id => id !== user.id);
                                if (otherId) {
                                    const otherUser = await userService.getUserById(otherId);
                                    if (otherUser) {
                                        navigation.setParams({
                                            recipientName: otherUser.name,
                                            recipientRole: otherUser.role || otherUser.category || 'User'
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('Error fetching chat details:', e);
                        }
                    }

                    return () => unsubscribe();
                } else if (recipientId) {
                    // One-on-one: Find or create chat with recipient
                    // Build participant names map for display
                    const currentId = user?.id || user?.uid;
                    const participantNames = {};
                    if (currentId) {
                        participantNames[currentId] = user?.name || 'User';
                    }
                    if (recipientId && recipientName) {
                        participantNames[recipientId] = recipientName;
                    }

                    if (!currentId) {
                        console.error("ChatScreen Error: Current user has no id or uid!");
                        alert("Authentication error. Please re-login.");
                        setLoading(false);
                        return;
                    }

                    const id = await chatService.createChat([currentId, recipientId], participantNames);
                    setChatId(id);

                    if (id) {
                        // Subscribe to messages
                        const unsubscribe = chatService.subscribeToChat(id, (newMessages) => {
                            setMessages(newMessages);
                            setLoading(false);
                            // Mark as read
                            if (currentId) {
                                chatService.markChatAsRead(id, currentId);
                            }
                        });
                        return () => unsubscribe();
                    } else {
                        console.error("ChatScreen Error: createChat returned null!");
                        alert("Chat could not be created: Invalid participants.");
                        setLoading(false);
                    }
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error initializing chat:", error);
                alert("Failed to initialize chat: " + error.message);
                setLoading(false);
            }
        };

        initChat();
    }, [recipientId]);

    const sendMessage = async () => {
        if (!message.trim()) return;
        
        if (!chatId) {
            console.log("Send blocked: missing chatId. recipientId was:", recipientId);
            alert("Cannot send message: Chat history could not be established. Please re-open the chat.");
            return;
        }
        
        if (!currentUser) {
            alert("Cannot send message: User not logged in.");
            return;
        }

        const currentUserId = currentUser.id || currentUser.uid;
        const textToSend = message.trim();
        
        // Clear immediately for optimistic UI
        setMessage('');

        try {
            console.log("Sending to chat:", chatId);
            await chatService.sendMessage(chatId, textToSend, currentUserId, currentUser.name || 'User');
        } catch (error) {
            // Restore message on failure
            setMessage(textToSend);
            console.error("Error sending message:", error);
            alert("Failed to send: " + error.message);
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = currentUser && item.senderId === currentUser.id;
        // Format timestamp
        // Format timestamp safely
        let timeString = '';
        if (item.createdAt) {
            if (item.createdAt.toDate) {
                timeString = item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (item.createdAt instanceof Date) {
                timeString = item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        } else {
            timeString = 'Sending...';
        }

        return (
            <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    {!isMe && item.senderName ? (
                        <TouchableOpacity onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.senderId })}>
                            <Typography
                                variant="small"
                                style={{ fontWeight: '700', color: COLORS.accent, marginBottom: 2 }}
                            >
                                {item.senderName}
                            </Typography>
                        </TouchableOpacity>
                    ) : null}
                    <Typography
                        variant="body"
                        style={{ color: isMe ? COLORS.background : COLORS.primary }}
                    >
                        {item.text}
                    </Typography>
                    <Typography
                        variant="caption"
                        style={[styles.timestamp, { color: isMe ? COLORS.background + 'AA' : COLORS.secondary }]}
                    >
                        {timeString}
                    </Typography>
                </View>
            </View>
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
                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => {
                        if (recipientId && recipientId !== 'GROUP') {
                            navigation.navigate('ServiceDetail', { serviceId: recipientId });
                        }
                    }}
                    disabled={recipientId === 'GROUP'}
                >
                    {route.params.recipientId === 'GROUP' || (recipientId === 'GROUP' && route.params.chatId) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="people" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Typography variant="h3">{recipientName}</Typography>
                        </View>
                    ) : (
                        <>
                            <Typography variant="h3">{recipientName}</Typography>
                            <Typography variant="caption" color={COLORS.secondary}>{recipientRole}</Typography>
                        </>
                    )}
                </TouchableOpacity>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
            >
                <FlatList
                    ref={scrollRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.messageList}
                    inverted
                />

                <View style={[styles.inputContainer, { paddingBottom: Math.max(SPACING.m, insets.bottom + SPACING.s) }]}>
                    <TextInput
                        style={styles.input}
                        value={message}
                        onChangeText={setMessage}
                        placeholder="Type a message..."
                        placeholderTextColor={COLORS.secondary}
                        multiline
                        onKeyPress={(e) => {
                            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
                        onPress={sendMessage}
                        disabled={!message.trim()}
                    >
                        <Ionicons name="send" size={20} color={COLORS.background} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
        backgroundColor: COLORS.surface,
    },
    backButton: {
        padding: 4,
    },
    headerInfo: {
        flex: 1,
        alignItems: 'center',
    },
    messageList: {
        padding: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    keyboardView: {
        flex: 1,
    },
    messageWrapper: {
        marginBottom: SPACING.m,
        maxWidth: '80%',
    },
    myMessageWrapper: {
        alignSelf: 'flex-end',
    },
    theirMessageWrapper: {
        alignSelf: 'flex-start',
    },
    bubble: {
        padding: SPACING.m,
        borderRadius: 16,
    },
    myBubble: {
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: COLORS.surfaceHighlight,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: SPACING.m,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 20,
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        paddingTop: 10,
        color: COLORS.primary,
        fontSize: 14,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SPACING.s,
    },
    sendButtonDisabled: {
        backgroundColor: COLORS.secondary,
        opacity: 0.5,
    }
});

export default ChatScreen;
