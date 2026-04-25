/**
 * BuddyRequestsScreen (formerly FriendRequestsScreen)
 *
 * Shows pending buddy-join requests that need the current user's approval.
 * "Buddies" in Croww = people you've been in the same accepted buddy group with.
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, RefreshControl, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { approveJoinRequest, getJoinRequests, ignoreJoinRequest } from '../../services/buddyService';
import { getAvatarSource } from '../../utils/avatarHelper';
import { showAlert } from '../../utils/showAlert';

const FriendRequestsScreen = ({ navigation }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            // getJoinRequests with no args returns pending requests I need to approve (as owner)
            // We pass null for buddyRequestId to get all join requests for the current user as owner
            const data = await getJoinRequests(null, 'pending', null);
            setRequests(data);
        } catch (error) {
            console.error('Error loading buddy join requests:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleApprove = async (item) => {
        const result = await approveJoinRequest(item.id);
        if (result.success) {
            setRequests(prev => prev.filter(r => r.id !== item.id));
            showAlert('Approved! 🎉', `${item.requesterName} has joined your buddy group.`);
        } else {
            showAlert('Error', result.message || 'Failed to approve');
        }
    };

    const handleIgnore = async (item) => {
        const result = await ignoreJoinRequest(item.id);
        if (result.success) {
            setRequests(prev => prev.filter(r => r.id !== item.id));
        } else {
            showAlert('Error', result.message || 'Failed to ignore');
        }
    };

    const renderItem = ({ item }) => (
        <NotionCard style={styles.card}>
            <View style={styles.userInfo}>
                <Image
                    source={getAvatarSource(item.requesterAvatar, 'individual')}
                    style={styles.avatar}
                />
                <View style={styles.textContainer}>
                    <Typography variant="body" style={{ fontWeight: '600' }}>
                        {item.requesterName}
                    </Typography>
                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                        Wants to join your buddy group
                    </Typography>
                </View>
            </View>
            <View style={styles.actions}>
                <AntigravityButton
                    title="Approve"
                    size="small"
                    style={{ flex: 1, marginRight: SPACING.s }}
                    onPress={() => handleApprove(item)}
                />
                <AntigravityButton
                    title="Ignore"
                    variant="secondary"
                    size="small"
                    style={{ flex: 1 }}
                    onPress={() => handleIgnore(item)}
                />
            </View>
        </NotionCard>
    );

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={{ marginLeft: SPACING.m }}>
                    Buddy Requests
                </Typography>
            </View>

            <FlatList
                data={requests}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); loadRequests(); }}
                    />
                }
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={64} color={COLORS.border} />
                            <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.m }}>
                                No pending buddy requests
                            </Typography>
                        </View>
                    )
                }
            />
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
    content: {
        padding: SPACING.m,
    },
    card: {
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    textContainer: {
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    }
});

export default FriendRequestsScreen;
