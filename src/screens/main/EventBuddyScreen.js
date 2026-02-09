import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import BuddyRequestCard from '../../components/BuddyRequestCard';
import NotionButton from '../../components/NotionButton';
import { SPACING, COLORS } from '../../constants/theme';
import { getBuddyRequests, joinBuddyRequest, leaveBuddyRequest } from '../../services/buddyService';
import { Ionicons } from '@expo/vector-icons';

const EventBuddyScreen = ({ route, navigation }) => {
    const { event } = route.params || {};
    const [buddyRequests, setBuddyRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [joinedRequests, setJoinedRequests] = useState([]);

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
        } catch (error) {
            console.error('Error loading buddy requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (requestId) => {
        const result = await joinBuddyRequest(requestId);

        if (result.success) {
            Alert.alert('Success!', result.message);
            setJoinedRequests([...joinedRequests, requestId]);
            loadBuddyRequests();
        } else {
            Alert.alert('Oops!', result.message);
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
                            setJoinedRequests(joinedRequests.filter(id => id !== requestId));
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
                            onJoin={() => handleJoin(request.id)}
                            onLeave={() => handleLeave(request.id)}
                            hasJoined={joinedRequests.includes(request.id)}
                            isOwn={request.userId === 'current-user'}
                        />
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Create Button */}
            <View style={styles.createButtonContainer}>
                <NotionButton
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
