import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const ChatScreen = ({ route, navigation }) => {
    const { recipientName, recipientRole } = route.params;
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([
        { id: '1', text: `Hi! I'm interested in your ${recipientRole} services.`, sender: 'me', timestamp: '10:00 AM' },
        { id: '2', text: `Hi there! I'd be happy to help. What kind of event are you planning?`, sender: 'them', timestamp: '10:05 AM' },
    ]);
    const scrollRef = useRef();

    const sendMessage = () => {
        if (!message.trim()) return;

        const newMessage = {
            id: Date.now().toString(),
            text: message,
            sender: 'me',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages([...messages, newMessage]);
        setMessage('');

        // Mock reply
        setTimeout(() => {
            const reply = {
                id: (Date.now() + 1).toString(),
                text: "Thanks for the message! I'll check my availability and get back to you with a quote soon.",
                sender: 'them',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, reply]);
        }, 1500);
    };

    const renderMessage = ({ item }) => {
        const isMe = item.sender === 'me';
        return (
            <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
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
                        {item.timestamp}
                    </Typography>
                </View>
            </View>
        );
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Typography variant="h3">{recipientName}</Typography>
                    <Typography variant="caption" color={COLORS.secondary}>{recipientRole}</Typography>
                </View>
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
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={message}
                        onChangeText={setMessage}
                        placeholder="Type a message..."
                        placeholderTextColor={COLORS.secondary}
                        multiline
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
