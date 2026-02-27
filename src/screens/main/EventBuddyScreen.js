import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import BuddyRequestCard from '../../components/BuddyRequestCard';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS } from '../../constants/theme';
import { getBuddyRequests, leaveBuddyRequest, getJoinRequests, requestToJoinBuddy, approveJoinRequest, ignoreJoinRequest } from '../../services/buddyService';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../services/firebaseConfig';

const EventBuddyScreen = ({ route, navigation }) => {
    const { event } = route.params || {};
    const [buddyRequests, setBuddyRequests] = useState([]);
    const [joinRequests, setJoinRequests] = useState([]); // Requests I've sent
    const [pendingApprovals, setPendingApprovals] = useState({}); // Requests others sent for my groups
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');


    // We don't need separate joinedRequests state if we read from request.joinedUsers
    // But to force re-render or keep track of local changes, we can just reload requests.
    const currentUser = auth.currentUser;

    useEffect(() => {
        loadBuddyRequests();
    }, [filter]);

    const loadBuddyRequests = async () => {
        setLoading(true);
        try {
            const filters = {};
            if (filter === 'available') {
                filters.hasSpots = true;
            }

            const requests = await getBuddyRequests(event?.id, filters);
            setBuddyRequests(requests);

            // Fetch requests I've sent
            const mySentRequests = await getJoinRequests();
            setJoinRequests(mySentRequests);

            // For my own groups, fetch pending approvals
            const myGroups = requests.filter(r => r.userId === currentUser?.uid);
            const approvals = {};
            for (const group of myGroups) {
                const groupApprovals = await getJoinRequests(group.id, 'pending', group.userId);
                approvals[group.id] = groupApprovals;
            }
            setPendingApprovals(approvals);

        } catch (error) {
            console.error('Error loading buddy requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (requestId, ownerId) => {
        const result = await requestToJoinBuddy(requestId, ownerId);

        if (result.success) {
            Alert.alert('Requested!', result.message);
            loadBuddyRequests();
        } else {
            Alert.alert('Oops!', result.message);
        }
    };

    const handleApprove = async (joinRequestId) => {
        const result = await approveJoinRequest(joinRequestId);
        if (result.success) {
            Alert.alert('Success', 'Member added to group!');
            loadBuddyRequests();
        } else {
            Alert.alert('Error', result.message);
        }
    };

    const handleIgnore = async (joinRequestId) => {
        const result = await ignoreJoinRequest(joinRequestId);
        if (result.success) {
            loadBuddyRequests();
        }
    };

    const handleLeave = async (requestId) => {
        Alert.alert(
            'Leave Group',
            'Are you sure you want to leave this group?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await leaveBuddyRequest(requestId);
                        if (result.success) {
                            loadBuddyRequests();
                        }
                    }
                }
            ]
        );
    };

    const handleCreateRequest = () => {
        navigation.navigate('CreateBuddyRequest', { event });
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
                <View style={styles.headerContent}>
                    <Typography variant="h2">Find Event Buddies</Typography>
                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                        {event?.title}
                    </Typography>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.filters}>
                <TouchableOpacity
                    style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                    onPress={() => setFilter('all')}
                >
                    <Typography
                        variant="small"
                        style={filter === 'all' ? styles.filterTextActive : styles.filterText}
                    >
                        All
                    </Typography>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, filter === 'available' && styles.filterChipActive]}
                    onPress={() => setFilter('available')}
                >
                    <Typography
                        variant="small"
                        style={filter === 'available' ? styles.filterTextActive : styles.filterText}
                    >
                        Available
                    </Typography>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={24} color={COLORS.accent} />
                    <Typography variant="small" style={styles.infoText}>
                        Connect with people attending this event. Join a group or create your own!
                    </Typography>
                </View>

                {/* Buddy Requests List */}
                {loading ? (
                    <Typography variant="body" style={{ textAlign: 'center', marginTop: SPACING.xl }}>
                        Loading...
                    </Typography>
                ) : buddyRequests.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={64} color={COLORS.secondary} />
                        <Typography variant="h3" style={{ marginTop: SPACING.m }}>
                            No buddy requests yet
                        </Typography>
                        <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                            Be the first to create one!
                        </Typography>
                    </View>
                ) : (
                    buddyRequests.map((request) => (
                        <BuddyRequestCard
                            key={request.id}
                            request={request}
                            onJoin={() => handleJoin(request.id, request.userId)}
                            onLeave={() => handleLeave(request.id)}
                            onChat={() => navigation.navigate('Chat', {
                                recipientId: 'GROUP',
                                recipientName: request.userName + "'s Group",
                                chatId: request.chatId
                            })}
                            hasJoined={request.joinedUsers && request.joinedUsers.includes(currentUser?.uid)}
                            isOwn={request.userId === currentUser?.uid}
                            pendingJoin={joinRequests.find(jr => jr.buddyRequestId === request.id)}
                            pendingApprovals={pendingApprovals[request.id] || []}
                            onApprove={handleApprove}
                            onIgnore={handleIgnore}
                            onPress={() => navigation.navigate('BuddyRequestDetail', {
                                requestId: request.id,
                                event: event
                            })}
                            onProfilePress={(userId) => navigation.navigate('ServiceDetail', { serviceId: userId })}
                        />
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Create Button */}
            <View style={styles.createButtonContainer}>
                <AntigravityButton
                    title="Create Buddy Request"
                    onPress={handleCreateRequest}
                    icon="add-circle"
                />
            </View>
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
        marginRight: SPACING.m,
    },
    headerContent: {
        flex: 1,
    },
    filters: {
        flexDirection: 'row',
        padding: SPACING.m,
        gap: SPACING.s,
    },
    filterChip: {
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    filterChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    filterText: {
        color: COLORS.secondary,
    },
    filterTextActive: {
        color: COLORS.background,
        fontWeight: '600',
    },
    content: {
        padding: SPACING.m,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.accent + '10',
        padding: SPACING.m,
        borderRadius: 12,
        marginBottom: SPACING.l,
        gap: SPACING.s,
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
    createButtonContainer: {
        position: 'absolute',
        bottom: 20,
        left: SPACING.m,
        right: SPACING.m,
    },
});

export default EventBuddyScreen;
