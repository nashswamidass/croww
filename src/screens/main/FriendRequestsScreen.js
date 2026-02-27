import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, RefreshControl, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { friendService } from '../../services/friendService';
import { getAvatarSource } from '../../utils/avatarHelper';

const FriendRequestsScreen = ({ navigation }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            const data = await friendService.getFriendRequests();
            setRequests(data);
        } catch (error) {
            console.error("Error loading requests:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleAccept = async (request) => {
        try {
            const result = await friendService.acceptFriendRequest(
                request.id,
                request.fromUserId,
                request.fromUserName,
                request.fromUserAvatar
            );
            if (result.success) {
                // Remove from list
                setRequests(prev => prev.filter(r => r.id !== request.id));
                Alert.alert("Connected!", `You differ now friends with ${request.fromUserName}`);
            } else {
                Alert.alert("Error", result.message);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to accept request");
        }
    };

    const handleReject = async (requestId) => {
        try {
            const result = await friendService.rejectFriendRequest(requestId);
            if (result.success) {
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                Alert.alert("Error", result.message);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to reject request");
        }
    };

    const renderItem = ({ item }) => (
        <NotionCard style={styles.card}>
            <View style={styles.userInfo}>
                <Image
                    source={getAvatarSource(item.fromUserAvatar, 'individual')}
                    style={styles.avatar}
                />
                <View style={styles.textContainer}>
                    <Typography variant="body" style={{ fontWeight: '600' }}>
                        {item.fromUserName}
                    </Typography>
                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                        Sent you a friend request
                    </Typography>
                </View>
            </View>
            <View style={styles.actions}>
                <AntigravityButton
                    title="Confirm"
                    size="small"
                    style={{ flex: 1, marginRight: SPACING.s }}
                    onPress={() => handleAccept(item)}
                />
                <AntigravityButton
                    title="Delete"
                    variant="secondary"
                    size="small"
                    style={{ flex: 1 }}
                    onPress={() => handleReject(item.id)}
                />
            </View>
        </NotionCard>
    );

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Ionicons
                        name="arrow-back"
                        size={24}
                        color={COLORS.primary}
                        onPress={() => navigation.goBack()}
                    />
                    <Typography variant="h3" style={{ marginLeft: SPACING.m }}>Friend Requests</Typography>
                </View>
            </View>

            <FlatList
                data={requests}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} />
                }
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={64} color={COLORS.secondary + '80'} />
                            <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.m }}>
                                No pending friend requests
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
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
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
