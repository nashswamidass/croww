import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Keyboard, Animated } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatService } from '../../services/chatService';
import { userService } from '../../services/userService';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import StickerPicker from '../../components/StickerPicker';

// ─── Emoji Data ───────────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
    {
        label: '🎉 Party',
        emojis: ['🎉','🎊','🥳','🎈','🎆','🎇','✨','🪄','🎠','🎡','🎢','🎪','🎭','🎬','🎤','🎵','🎶','🕺','💃','🥂'],
    },
    {
        label: '❤️ Love',
        emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💗','💓','💞','💕','💟','❣️','💔','🫶','🤗','😍','🥰','😘'],
    },
    {
        label: '✨ Vibes',
        emojis: ['😎','🤩','🥶','🔥','💯','⚡','🌈','🌟','💫','⭐','🌙','☀️','🌊','🍀','🦋','🦄','🐉','🌸','🌺','🏆'],
    },
    {
        label: '🍕 Food',
        emojis: ['🍕','🍔','🍟','🌮','🌯','🥗','🍣','🍜','🍩','🎂','🍰','🧁','🍭','🍫','🍿','🥤','🧃','☕','🍵','🥂'],
    },
    {
        label: '⚽ Sports',
        emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🤸','🏋️','🤾','🏌️','🧗','🚴','🏊','🤽','🧘'],
    },
    {
        label: '😂 React',
        emojis: ['😂','🤣','😭','😅','🥹','😤','😡','🤯','😱','🤔','🙄','😏','🥴','🤢','👀','🫠','💀','🫡','🤌','👏'],
    },
];

// Giphy sticker prefix — messages starting with this render as animated GIFs
const STICKER_INDICATOR = '__STICKER__';
const GIPHY_INDICATOR   = '__GIPHY__:';

const ChatScreen = ({ route, navigation }) => {
    const { recipientId, recipientName, recipientRole, listingId, propertyId } = route.params || {};
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [chatId, setChatId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEmojiPanel, setShowEmojiPanel] = useState(false);
    const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
    const scrollRef = useRef();
    const inputRef = useRef();
    const insets = useSafeAreaInsets();

    const toggleEmojiPanel = () => {
        if (!showEmojiPanel) {
            Keyboard.dismiss();
        } else {
            inputRef.current?.focus();
        }
        setShowEmojiPanel(prev => !prev);
    };

    const appendEmoji = (emoji) => {
        setMessage(prev => prev + emoji);
    };

    const sendSticker = async (gifUrl) => {
        setShowEmojiPanel(false);
        if (!chatId || !currentUser) return;
        const currentUserId = currentUser.id || currentUser.uid;
        const text = GIPHY_INDICATOR + gifUrl;
        try {
            await chatService.sendMessage(chatId, text, currentUserId, currentUser.name || 'User');
        } catch (e) {
            console.error('Sticker send error:', e);
        }
    };

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

                    const id = await chatService.createChat(
                        [currentId, recipientId],
                        participantNames,
                        { listingId, propertyId }
                    );
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
    }, [recipientId, listingId, propertyId]);

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
        const isGiphy   = item.text?.startsWith(GIPHY_INDICATOR);
        const isSticker = !isGiphy && item.text?.startsWith(STICKER_INDICATOR);
        const displayText = isGiphy
            ? item.text.slice(GIPHY_INDICATOR.length)
            : isSticker
                ? item.text.slice(STICKER_INDICATOR.length)
                : item.text;

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

        // ── Animated GIF sticker (Giphy) ──
        if (isGiphy) {
            return (
                <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                    <View style={styles.gifBubble}>
                        {!isMe && item.senderName ? (
                            <Typography variant="small" style={{ fontWeight: '700', color: COLORS.accent, marginBottom: 4 }}>
                                {item.senderName}
                            </Typography>
                        ) : null}
                        <Image
                            source={{ uri: displayText }}
                            style={styles.gifImage}
                            contentFit="contain"
                            autoplay
                            cachePolicy="memory-disk"
                        />
                        <Typography
                            variant="caption"
                            style={[styles.timestamp, { color: COLORS.secondary, marginTop: 4, alignSelf: 'flex-end' }]}
                        >
                            {timeString}
                        </Typography>
                    </View>
                </View>
            );
        }

        // ── Legacy emoji sticker ──
        if (isSticker) {
            return (
                <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                    <View style={[styles.stickerBubble, isMe ? styles.myStickerBubble : styles.theirStickerBubble]}>
                        {!isMe && item.senderName ? (
                            <Typography variant="small" style={{ fontWeight: '700', color: COLORS.accent, marginBottom: 4 }}>
                                {item.senderName}
                            </Typography>
                        ) : null}
                        <Typography style={styles.stickerText}>{displayText}</Typography>
                        <Typography
                            variant="caption"
                            style={[styles.timestamp, { color: isMe ? COLORS.accent : COLORS.secondary, marginTop: 6 }]}
                        >
                            {timeString}
                        </Typography>
                    </View>
                </View>
            );
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
                        {displayText}
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
                <TouchableOpacity 
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.navigate('ChatList');
                        }
                    }} 
                    style={styles.backButton}
                >
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

            {listingId ? (
                <View style={styles.propertyBanner}>
                    <Ionicons name="home" size={16} color={COLORS.accent} />
                    <Typography variant="caption" style={styles.propertyBannerText} numberOfLines={1}>
                        Inquiring about listing
                    </Typography>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Listing', { listingId })}
                        style={styles.propertyBannerBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Typography variant="micro" style={styles.propertyBannerBtnText}>View</Typography>
                        <Ionicons name="chevron-forward" size={12} color={COLORS.accent} />
                    </TouchableOpacity>
                </View>
            ) : null}

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

                <View style={[styles.inputContainer, { paddingBottom: showEmojiPanel ? SPACING.s : Math.max(SPACING.m, insets.bottom + SPACING.s) }]}>
                    <View style={styles.inputWrapper}>
                        {/* Emoji toggle button */}
                        <TouchableOpacity style={styles.emojiToggleBtn} onPress={toggleEmojiPanel}>
                            <Typography style={styles.emojiToggleIcon}>
                                {showEmojiPanel ? '⌨️' : '😊'}
                            </Typography>
                        </TouchableOpacity>

                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Type a message..."
                            placeholderTextColor={COLORS.secondary}
                            multiline
                            onFocus={() => setShowEmojiPanel(false)}
                            onKeyPress={(e) => {
                                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
                        onPress={() => { sendMessage(); setShowEmojiPanel(false); }}
                        disabled={!message.trim()}
                    >
                        <Ionicons name="send" size={20} color={COLORS.background} />
                    </TouchableOpacity>
                </View>

                {/* ── Emoji / Sticker Panel ── */}
                {showEmojiPanel && (
                    <View style={[styles.emojiPanel, { paddingBottom: Math.max(SPACING.m, insets.bottom) }]}>
                        {/* Category tabs */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.categoryTabsRow}
                            contentContainerStyle={{ paddingHorizontal: SPACING.s }}
                        >
                            {/* Sticker tab */}
                            <TouchableOpacity
                                style={[styles.categoryTab, activeCategoryIdx === -1 && styles.categoryTabActive]}
                                onPress={() => setActiveCategoryIdx(-1)}
                            >
                                <Typography style={[styles.categoryTabText, activeCategoryIdx === -1 && styles.categoryTabTextActive]}>
                                    🎁 Stickers
                                </Typography>
                            </TouchableOpacity>
                            {EMOJI_CATEGORIES.map((cat, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.categoryTab, activeCategoryIdx === idx && styles.categoryTabActive]}
                                    onPress={() => setActiveCategoryIdx(idx)}
                                >
                                    <Typography style={[styles.categoryTabText, activeCategoryIdx === idx && styles.categoryTabTextActive]}>
                                        {cat.label}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Giphy Sticker Picker */}
                        {activeCategoryIdx === -1 ? (
                            <StickerPicker
                                style={{ flex: 1, borderTopWidth: 0 }}
                                onSend={(gifUrl) => sendSticker(gifUrl)}
                            />
                        ) : (
                            /* Emoji grid */
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                style={styles.emojiGrid}
                            >
                                <View style={styles.emojiGridContent}>
                                    {EMOJI_CATEGORIES[activeCategoryIdx].emojis.map((emoji, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={styles.emojiBtn}
                                            onPress={() => appendEmoji(emoji)}
                                            activeOpacity={0.6}
                                        >
                                            <Typography style={styles.emojiBtnText}>{emoji}</Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                )}
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
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    input: {
        flex: 1,
        paddingHorizontal: SPACING.s,
        paddingVertical: 10,
        paddingTop: 10,
        color: COLORS.primary,
        fontSize: 14,
        maxHeight: 100,
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
    },
    emojiToggleBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
        marginBottom: 2,
    },
    emojiToggleIcon: {
        fontSize: 24,
    },
    // ── Sticker message bubbles ──
    stickerBubble: {
        padding: SPACING.m,
        borderRadius: 18,
        alignItems: 'center',
        minWidth: 120,
    },
    myStickerBubble: {
        backgroundColor: COLORS.accent + '18',
        borderWidth: 1.5,
        borderColor: COLORS.accent + '60',
        borderBottomRightRadius: 4,
    },
    theirStickerBubble: {
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderBottomLeftRadius: 4,
    },
    stickerText: {
        fontSize: 28,
        textAlign: 'center',
        lineHeight: 36,
    },
    // ── Emoji panel ──
    emojiPanel: {
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        height: 360,
    },
    categoryTabsRow: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        maxHeight: 44,
    },
    categoryTab: {
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        marginRight: 2,
    },
    categoryTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: COLORS.accent,
    },
    categoryTabText: {
        fontSize: 12,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    categoryTabTextActive: {
        color: COLORS.primary,
    },
    emojiGrid: {
        flex: 1,
    },
    emojiGridContent: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: SPACING.s,
    },
    emojiBtn: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiBtnText: {
        fontSize: 26,
    },
    // ── Animated GIF bubble (Giphy) ──
    gifBubble: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 16,
        borderBottomRightRadius: 4,
        padding: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
        maxWidth: 200,
    },
    gifImage: {
        width: 180,
        height: 160,
        borderRadius: 12,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    propertyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceElevated || COLORS.surface,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: 8,
    },
    propertyBannerText: {
        flex: 1,
        color: COLORS.primary,
        fontWeight: '600',
    },
    propertyBannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(235, 94, 40, 0.12)',
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.round,
        gap: 2,
    },
    propertyBannerBtnText: {
        color: COLORS.accent,
        fontWeight: '700',
    },
});

export default ChatScreen;
