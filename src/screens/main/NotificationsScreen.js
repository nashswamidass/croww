import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../../services/notificationService';

const NotificationsScreen = ({ navigation }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = notificationService.getNotifications((data) => {
            setNotifications(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleNotificationPress = async (notification) => {
        if (!notification.read) {
            await notificationService.markAsRead(notification.id);
        }

        // Logic to navigate based on notification type
        if (notification.data?.requestId) {
            // Find the event ID for this request if possible, 
            // or just navigate to EventBuddyScreen with a "search for request" logic
            // For now, simpler: Alert with info
            Alert.alert(notification.title, notification.message);
        } else {
            Alert.alert(notification.title, notification.message);
        }
    };

    const handleMarkAllRead = async () => {
        setLoading(true);
        await notificationService.markAllAsRead();
        setLoading(false);
    };

    const getIconDetails = (type) => {
        switch (type) {
            case 'buddy_request_join':
                return { icon: 'person-add', color: COLORS.accent };
            case 'buddy_request_approved':
                return { icon: 'checkmark-circle', color: COLORS.success };
            case 'event_reminder':
                return { icon: 'time', color: COLORS.accents.blue };
            case 'friend_request':
                return { icon: 'person-add', color: COLORS.success };
            default:
                return { icon: 'notifications', color: COLORS.secondary };
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2" style={{ flex: 1, marginLeft: SPACING.s }}>Notifications</Typography>
                <TouchableOpacity
                    style={styles.markAllButton}
                    onPress={handleMarkAllRead}
                    disabled={notifications.every(n => n.read)}
                >
                    <Typography variant="small" style={{ color: COLORS.accent }}>
                        Mark all read
                    </Typography>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {loading && notifications.length === 0 ? (
                    <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
                ) : notifications.map((notification) => {
                    const { icon, color } = getIconDetails(notification.type);
                    return (
                        <TouchableOpacity
                            key={notification.id}
                            style={[
                                styles.notificationCard,
                                !notification.read && styles.unreadCard
                            ]}
                            onPress={() => handleNotificationPress(notification)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                                <Ionicons name={icon} size={24} color={color} />
                            </View>
                            <View style={styles.notificationContent}>
                                <View style={styles.notificationHeader}>
                                    <Typography variant="body" style={{ fontWeight: '600', flex: 1 }}>
                                        {notification.title}
                                    </Typography>
                                    {!notification.read && <View style={styles.unreadDot} />}
                                </View>
                                <Typography variant="small" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                    {notification.message}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                    {formatTime(notification.createdAt)}
                                </Typography>
                            </View>
                        </TouchableOpacity>
                    );
                })}

                {notifications.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={64} color={COLORS.secondary} />
                        <Typography variant="h3" style={{ marginTop: SPACING.m }}>
                            No Notifications
                        </Typography>
                        <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                            You're all caught up!
                        </Typography>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
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
    },
    backButton: {
        padding: 4,
    },
    markAllButton: {
        padding: 4,
    },
    content: {
        padding: SPACING.m,
    },
    notificationCard: {
        flexDirection: 'row',
        padding: SPACING.m,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    unreadCard: {
        backgroundColor: COLORS.accent + '08',
        borderColor: COLORS.accent + '30',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    notificationContent: {
        flex: 1,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        marginLeft: SPACING.s,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl,
    },
});

export default NotificationsScreen;
