import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const NotificationsScreen = ({ navigation }) => {
    const notifications = [
        {
            id: 1,
            type: 'buddy_join',
            title: 'Sarah joined your buddy group',
            message: 'Sarah M. joined your group for Sunset Beach Party',
            time: '5 min ago',
            read: false,
            icon: 'people',
            color: COLORS.accent
        },
        {
            id: 2,
            type: 'event_reminder',
            title: 'Event starting soon',
            message: 'Tech Networking Mixer starts in 2 hours',
            time: '1 hour ago',
            read: false,
            icon: 'time',
            color: COLORS.accents.blue
        },
        {
            id: 3,
            type: 'friend_request',
            title: 'New friend request',
            message: 'Mike R. sent you a friend request',
            time: '3 hours ago',
            read: true,
            icon: 'person-add',
            color: COLORS.success
        },
        {
            id: 4,
            type: 'event_update',
            title: 'Event updated',
            message: 'Jazz in the Park venue has been changed',
            time: '1 day ago',
            read: true,
            icon: 'information-circle',
            color: COLORS.secondary
        },
    ];

    const handleNotificationPress = (notification) => {
        Alert.alert(notification.title, notification.message);
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
                <Typography variant="h2">Notifications</Typography>
                <TouchableOpacity style={styles.markAllButton}>
                    <Typography variant="small" style={{ color: COLORS.accent }}>
                        Mark all read
                    </Typography>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {notifications.map((notification) => (
                    <TouchableOpacity
                        key={notification.id}
                        style={[
                            styles.notificationCard,
                            !notification.read && styles.unreadCard
                        ]}
                        onPress={() => handleNotificationPress(notification)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: notification.color + '20' }]}>
                            <Ionicons name={notification.icon} size={24} color={notification.color} />
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
                                {notification.time}
                            </Typography>
                        </View>
                    </TouchableOpacity>
                ))}

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
        justifyContent: 'space-between',
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
