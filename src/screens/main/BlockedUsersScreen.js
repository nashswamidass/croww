import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const BlockedUsersScreen = ({ navigation }) => {
    const [blockedUsers, setBlockedUsers] = useState([
        { id: 1, name: 'John Smith', avatar: 'https://i.pravatar.cc/150?img=33', blockedDate: 'Jan 15, 2026' },
        { id: 2, name: 'Jane Doe', avatar: 'https://i.pravatar.cc/150?img=44', blockedDate: 'Jan 10, 2026' },
    ]);

    const handleUnblock = (user) => {
        Alert.alert(
            'Unblock User',
            `Are you sure you want to unblock ${user.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    onPress: () => {
                        setBlockedUsers(blockedUsers.filter(u => u.id !== user.id));
                        Alert.alert('Success', `${user.name} has been unblocked`);
                    }
                }
            ]
        );
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
                <Typography variant="h2">Blocked Users</Typography>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Info */}
                <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={24} color={COLORS.accent} />
                    <Typography variant="small" style={styles.infoText}>
                        Blocked users cannot see your profile, send you messages, or invite you to events.
                    </Typography>
                </View>

                {/* Blocked Users List */}
                {blockedUsers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="ban-outline" size={64} color={COLORS.secondary} />
                        <Typography variant="h3" style={{ marginTop: SPACING.m }}>
                            No Blocked Users
                        </Typography>
                        <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                            You haven't blocked anyone yet
                        </Typography>
                    </View>
                ) : (
                    blockedUsers.map((user) => (
                        <NotionCard key={user.id} style={styles.userCard}>
                            <Image source={{ uri: user.avatar }} style={styles.avatar} />
                            <View style={styles.userInfo}>
                                <Typography variant="body" style={{ fontWeight: '600' }}>
                                    {user.name}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                    Blocked on {user.blockedDate}
                                </Typography>
                            </View>
                            <TouchableOpacity
                                style={styles.unblockButton}
                                onPress={() => handleUnblock(user)}
                            >
                                <Typography variant="small" style={{ color: COLORS.accent }}>
                                    Unblock
                                </Typography>
                            </TouchableOpacity>
                        </NotionCard>
                    ))
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
    content: {
        padding: SPACING.m,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.accent + '10',
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        gap: SPACING.s,
        marginBottom: SPACING.l,
    },
    infoText: {
        flex: 1,
        color: COLORS.accent,
        lineHeight: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: SPACING.m,
    },
    userInfo: {
        flex: 1,
    },
    unblockButton: {
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
});

export default BlockedUsersScreen;
