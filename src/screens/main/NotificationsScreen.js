import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../../services/notificationService';
import { navigateFromNotification } from '../../utils/notificationNavigation';
import { approveJoinRequest, ignoreJoinRequest } from '../../services/buddyService';
import { showAlert } from '../../utils/showAlert';

const NotificationsScreen = ({ navigation }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState({});

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
        navigateFromNotification(navigation, notification.data || {});
    };

    const handleApprove = async (notification) => {
        const requestId = notification.data?.joinRequestId || notification.data?.requestId;
        if (!requestId) {
            showAlert("Error", "Missing request ID");
            return;
        }
        
        setActionLoading(prev => ({ ...prev, [notification.id]: 'approve' }));
        try {
            const result = await approveJoinRequest(requestId);
            if (result.success) {
                showAlert("Success", "Buddy request approved!");
                await notificationService.markAsRead(notification.id); // Mark as read on success
            } else {
                showAlert("Error", result.message || 'Could not approve request.');
            }
        } catch (error) {
            console.error("Approve error:", error);
            showAlert("Error", "Failed to approve request");
        } finally {
            setActionLoading(prev => ({ ...prev, [notification.id]: null }));
        }
    };

    const handleReject = async (notification) => {
        const requestId = notification.data?.joinRequestId || notification.data?.requestId;
        if (!requestId) {
            showAlert("Error", "Missing request ID");
            return;
        }

        setActionLoading(prev => ({ ...prev, [notification.id]: 'reject' }));
        try {
            const result = await ignoreJoinRequest(requestId);
            if (result.success) {
                showAlert("Success", "Request ignored");
                await notificationService.markAsRead(notification.id); // Mark as read on success
            } else {
                showAlert("Error", result.message || 'Could not reject request.');
            }
        } catch (error) {
            console.error("Ignore error:", error);
            showAlert("Error", "Failed to ignore request");
        } finally {
            setActionLoading(prev => ({ ...prev, [notification.id]: null }));
        }
    };

    const handleMarkAllRead = async () => {
        setLoading(true);
        await notificationService.markAllAsRead();
        setLoading(false);
    };

    const getIconDetails = (rawType) => {
        const type = (rawType || '').toLowerCase();
        switch (type) {
            case 'buddy_request_join':
                return { icon: 'person-add', color: COLORS.accent };
            case 'buddy_request_approved':
                return { icon: 'checkmark-circle', color: COLORS.success };
            case 'event_reminder':
                return { icon: 'time', color: COLORS.accents.blue };
            case 'new_event':
                return { icon: 'calendar-outline', color: COLORS.accents.blue };
            case 'friend_request':
                return { icon: 'person-add', color: COLORS.success };
            case 'friend_accepted':
                return { icon: 'people', color: COLORS.success };
            case 'review_prompt':
                return { icon: 'star', color: '#FFD700' };
            case 'chat_message':
            case 'chat':
                return { icon: 'chatbubble-ellipses', color: COLORS.accents.purple || '#9C27B0' };
            case 'new_booking':
            case 'booking_update':
                return { icon: 'bookmark', color: COLORS.accents.orange || '#FF9800' };
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
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.replace('Tabs');
                        }
                    }}
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
                    const type = (notification.type || '').toLowerCase();
                    const { icon, color } = getIconDetails(type);
                    const isBuddyJoin = type === 'buddy_request_join';
                    const isActioning = actionLoading[notification.id];

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

                                {/* Inline Approve / Reject for buddy join requests */}
                                {isBuddyJoin && (
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.approveBtn]}
                                            onPress={() => handleApprove(notification)}
                                            disabled={!!isActioning}
                                        >
                                            {isActioning === 'approve'
                                                ? <ActivityIndicator size="small" color="#fff" />
                                                : <Typography variant="small" style={styles.actionBtnText}>✅ Approve</Typography>
                                            }
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.rejectBtn]}
                                            onPress={() => handleReject(notification)}
                                            disabled={!!isActioning}
                                        >
                                            {isActioning === 'reject'
                                                ? <ActivityIndicator size="small" color="#fff" />
                                                : <Typography variant="small" style={styles.actionBtnText}>❌ Reject</Typography>
                                            }
                                        </TouchableOpacity>
                                    </View>
                                )}
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
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: SPACING.m,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.s,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 36,
    },
    approveBtn: {
        backgroundColor: COLORS.accent,
    },
    rejectBtn: {
        backgroundColor: COLORS.error || '#E53935',
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl,
    },
});

export default NotificationsScreen;
