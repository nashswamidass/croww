import React, { useState, useEffect } from 'react';
import {
    View, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import BuddyRequestCard from '../../components/BuddyRequestCard';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import {
    getBuddyRequests, leaveBuddyRequest, getJoinRequests,
    requestToJoinBuddy, approveJoinRequest, ignoreJoinRequest
} from '../../services/buddyService';
import { eventService } from '../../services/eventService';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../services/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../utils/showAlert';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'available', label: 'Spots Open' },
    { id: 'mine', label: 'My Groups' },
];

const EventBuddyScreen = ({ route, navigation }) => {
    // Support both: event object (from map) and eventId string (from notification deep link)
    const { event: eventParam, eventId: eventIdParam, highlightRequestId } = route.params || {};
    const { user: authUser } = useAuth();
    const isBusiness = authUser?.userType === 'business';
    const currentUser = auth.currentUser;

    const [event, setEvent] = useState(eventParam || null);
    const [buddyRequests, setBuddyRequests] = useState([]);
    const [joinRequests, setJoinRequests] = useState([]);
    const [pendingApprovals, setPendingApprovals] = useState({});
    const [loading, setLoading] = useState(true);
    // When coming from a notification, default to 'mine' to show relevant groups
    const [filter, setFilter] = useState(highlightRequestId ? 'mine' : 'all');
    const [search, setSearch] = useState('');

    // If only eventId was provided (e.g. from a push notification), fetch the event
    useEffect(() => {
        if (!eventParam && eventIdParam) {
            eventService.getEventById(eventIdParam).then(fetchedEvent => {
                if (fetchedEvent) setEvent(fetchedEvent);
            }).catch(console.error);
        }
    }, [eventIdParam, eventParam]);

    useEffect(() => {
        loadBuddyRequests();
    }, [filter, event]);

    const loadBuddyRequests = async () => {
        setLoading(true);
        try {
            const filters = {};
            if (filter === 'available') filters.hasSpots = true;

            const requests = await getBuddyRequests(event?.id, filters);
            setBuddyRequests(requests);

            const mySentRequests = await getJoinRequests();
            setJoinRequests(mySentRequests);

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
            showAlert('Requested! 🙌', result.message);
            loadBuddyRequests();
        } else {
            showAlert('Oops!', result.message);
        }
    };

    const handleApprove = async (joinRequestId) => {
        const result = await approveJoinRequest(joinRequestId);
        if (result.success) {
            showAlert('✅ Added!', 'Member added to your group!');
            loadBuddyRequests();
        } else {
            showAlert('Error', result.message);
        }
    };

    const handleIgnore = async (joinRequestId) => {
        const result = await ignoreJoinRequest(joinRequestId);
        if (result.success) loadBuddyRequests();
    };

    const handleLeave = async (requestId) => {
        showAlert('Leave Group', 'Are you sure you want to leave this group?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Leave',
                style: 'destructive',
                onPress: async () => {
                    const result = await leaveBuddyRequest(requestId);
                    if (result.success) loadBuddyRequests();
                }
            }
        ]);
    };

    // Apply local search + mine filter
    const displayed = buddyRequests.filter(r => {
        if (filter === 'mine' && r.userId !== currentUser?.uid) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            r.userName?.toLowerCase().includes(q) ||
            r.message?.toLowerCase().includes(q)
        );
    });

    const renderCard = ({ item: request }) => (
        <BuddyRequestCard
            key={request.id}
            request={request}
            onJoin={() => handleJoin(request.id, request.userId)}
            onLeave={() => handleLeave(request.id)}
            onChat={() => navigation.navigate('Chat', {
                recipientId: 'GROUP',
                recipientName: `${request.userName}'s Group`,
                chatId: request.chatId,
            })}
            hasJoined={request.joinedUsers?.includes(currentUser?.uid)}
            isOwn={request.userId === currentUser?.uid}
            pendingJoin={joinRequests.find(jr => jr.buddyRequestId === request.id)}
            pendingApprovals={pendingApprovals[request.id] || []}
            onApprove={handleApprove}
            onIgnore={handleIgnore}
            onPress={() => navigation.navigate('BuddyRequestDetail', {
                requestId: request.id,
                event,
            })}
            onProfilePress={(userId) => navigation.navigate('ServiceDetail', { serviceId: userId })}
        />
    );

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Typography variant="h2" style={styles.headerTitle}>Event Buddies</Typography>
                    {event?.title ? (
                        <Typography variant="caption" style={styles.headerSub} numberOfLines={1}>
                            {event.title}
                        </Typography>
                    ) : null}
                </View>
                <View style={styles.countBadge}>
                    <Typography variant="small" style={styles.countText}>{displayed.length}</Typography>
                </View>
            </View>

            {/* ── Search ── */}
            <View style={styles.searchWrapper}>
                <Ionicons name="search" size={18} color={COLORS.secondary} style={{ marginRight: SPACING.s }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or message..."
                    placeholderTextColor={COLORS.secondary}
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Filter Pills ── */}
            <View style={styles.filterRow}>
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.id}
                        style={[styles.pill, filter === f.id && styles.pillActive]}
                        onPress={() => setFilter(f.id)}
                        activeOpacity={0.8}
                    >
                        <Typography
                            variant="small"
                            style={filter === f.id ? styles.pillTextActive : styles.pillText}
                        >
                            {f.label}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── List ── */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={displayed}
                    keyExtractor={item => item.id}
                    renderItem={renderCard}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <Ionicons name="people-outline" size={40} color={COLORS.secondary} />
                            </View>
                            <Typography variant="h3" style={styles.emptyTitle}>No groups yet</Typography>
                            <Typography variant="body" style={styles.emptySubtitle}>
                                {filter === 'mine'
                                    ? "You haven't created a group yet."
                                    : 'Be the first to create a buddy group!'}
                            </Typography>
                        </View>
                    }
                />
            )}

            {/* ── FAB — Create Buddy Request ── */}
            {!isBusiness && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate('CreateBuddyRequest', { event })}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add" size={24} color={COLORS.background} />
                    <Typography variant="body" style={styles.fabLabel}>Create Group</Typography>
                </TouchableOpacity>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        marginRight: SPACING.m,
        padding: 4,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    headerSub: {
        color: COLORS.secondary,
        marginTop: 1,
    },
    countBadge: {
        backgroundColor: COLORS.accent + '20',
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: COLORS.accent + '40',
    },
    countText: {
        color: COLORS.accent,
        fontWeight: '800',
        fontSize: 12,
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        marginHorizontal: SPACING.m,
        marginTop: SPACING.m,
        paddingHorizontal: SPACING.m,
        height: 46,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.soft,
    },
    searchInput: {
        flex: 1,
        color: COLORS.primary,
        fontSize: 14,
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        gap: SPACING.s,
    },
    pill: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pillActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    pillText: {
        color: COLORS.secondary,
        fontWeight: '600',
        fontSize: 12,
    },
    pillTextActive: {
        color: COLORS.background,
        fontWeight: '700',
        fontSize: 12,
    },
    listContent: {
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.s,
        paddingBottom: 120,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    emptyTitle: {
        fontWeight: '700',
        marginBottom: SPACING.s,
    },
    emptySubtitle: {
        color: COLORS.secondary,
        textAlign: 'center',
        paddingHorizontal: SPACING.xl,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingVertical: 13,
        paddingHorizontal: SPACING.xl,
        borderRadius: BORDER_RADIUS.round,
        gap: SPACING.s,
        ...SHADOWS.medium,
    },
    fabLabel: {
        color: COLORS.background,
        fontWeight: '800',
        fontSize: 14,
    },
});

export default EventBuddyScreen;
