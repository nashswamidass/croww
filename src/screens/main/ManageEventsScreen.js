import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { userService } from '../../services/userService';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';

const ManageEventsScreen = ({ navigation }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const user = await userService.getUser();
            if (user) {
                const data = await eventService.getEventsByOrganizer(user.id);
                setEvents(data);
            }
        } catch (error) {
            console.error("Error loading events:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSharePress = async (item) => {
        try {
            const shareUrl = `https://croww.ai/event/${item.id}`;
            await Share.share({
                message: `Check out my event "${item.title}" on Croww!\n\n${shareUrl}`,
                url: shareUrl,
                title: item.title,
            });
        } catch (error) {
            console.error("Error sharing event:", error.message);
        }
    };

    const handleDeletePress = (item) => {
        const hasAttendees = (item.attendeesCount || 0) > 1; // >1 because organizer counts as 1

        const options = [
            {
                text: 'Cancel Event',
                style: 'destructive',
                onPress: () => confirmAction(item, 'cancel'),
            },
        ];

        if (!hasAttendees) {
            options.push({
                text: 'Delete Event',
                style: 'destructive',
                onPress: () => confirmAction(item, 'delete'),
            });
        }

        options.push({ text: 'Dismiss', style: 'cancel' });

        Alert.alert(
            'Manage Event',
            hasAttendees
                ? 'This event has attendees. You can cancel it — they will be notified via push notification and email.'
                : 'Choose an action for this event.',
            options
        );
    };

    const confirmAction = (item, action) => {
        const isCancel = action === 'cancel';
        Alert.alert(
            isCancel ? 'Cancel Event?' : 'Delete Event?',
            isCancel
                ? `Are you sure you want to cancel "${item.title}"? All attendees will be notified.`
                : `Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`,
            [
                { text: 'No, Go Back', style: 'cancel' },
                {
                    text: isCancel ? 'Yes, Cancel Event' : 'Yes, Delete',
                    style: 'destructive',
                    onPress: () => isCancel ? doCancel(item) : doDelete(item),
                },
            ]
        );
    };

    const doCancel = async (item) => {
        try {
            await eventService.cancelEvent(item.id);
            Alert.alert('Event Cancelled', 'The event has been cancelled. All attendees have been notified.');
            loadEvents();
        } catch (error) {
            Alert.alert('Error', 'Failed to cancel the event. Please try again.');
        }
    };

    const doDelete = async (item) => {
        try {
            await eventService.deleteEvent(item.id);
            Alert.alert('Event Deleted', 'The event has been permanently deleted.');
            setEvents(prev => prev.filter(e => e.id !== item.id));
        } catch (error) {
            Alert.alert('Error', 'Failed to delete the event. Please try again.');
        }
    };

    const renderEventItem = ({ item }) => {
        const isCancelled = item.status === 'cancelled';
        return (
            <TouchableOpacity
                onPress={() => !isCancelled && navigation.navigate('EventStats', { event: item })}
                activeOpacity={isCancelled ? 1 : 0.7}
            >
                <NotionCard style={[styles.eventCard, isCancelled && styles.cancelledCard]}>
                    <View style={styles.cardContent}>
                        <Image
                            source={{ uri: getValidImageUri(item.imageUri) || DEFAULT_EVENT_IMAGE }}
                            style={[styles.eventImage, isCancelled && { opacity: 0.4 }]}
                        />
                        <View style={styles.info}>
                            <View style={styles.titleRow}>
                                <Typography variant="h3" numberOfLines={1} style={[styles.eventTitle, isCancelled && { color: COLORS.secondary }]}>
                                    {item.title}
                                </Typography>
                                {isCancelled && (
                                    <View style={styles.cancelledBadge}>
                                        <Typography variant="small" style={{ color: '#fff', fontWeight: '700', fontSize: 9 }}>CANCELLED</Typography>
                                    </View>
                                )}
                            </View>
                            <Typography variant="caption" color={COLORS.secondary}>
                                {item.date} • {item.locationName}
                            </Typography>
                            <View style={styles.statsRow}>
                                <View style={styles.stat}>
                                    <Typography variant="small" style={{ color: COLORS.secondary }}>Tickets Left</Typography>
                                    <Typography variant="body" style={{ fontWeight: '600' }}>
                                        {item.remainingTickets} / {item.maxTickets}
                                    </Typography>
                                </View>
                                <View style={styles.cardActions}>
                                    {!isCancelled && (
                                        <>
                                            <TouchableOpacity
                                                style={styles.editButton}
                                                onPress={() => handleSharePress(item)}
                                            >
                                                <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.editButton}
                                                onPress={() => navigation.navigate('CreateEvent', { event: item })}
                                            >
                                                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDeletePress(item)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={COLORS.error || '#e74c3c'} />
                                    </TouchableOpacity>
                                    {!isCancelled && <Ionicons name="chevron-forward" size={20} color={COLORS.border} />}
                                </View>
                            </View>
                        </View>
                    </View>
                </NotionCard>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">My Events</Typography>
                <View style={{ width: 40 }} />
            </View>

            {events.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="calendar-outline" size={64} color={COLORS.border} />
                    <Typography variant="body" color={COLORS.secondary} style={styles.emptyText}>
                        {"You haven't created any events yet."}
                    </Typography>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => navigation.navigate('CreateEvent')}
                    >
                        <Typography variant="body" style={{ color: 'white' }}>Create Event</Typography>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={events}
                    renderItem={renderEventItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    onRefresh={loadEvents}
                    refreshing={loading}
                />
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        padding: 4,
    },
    list: {
        padding: SPACING.m,
    },
    eventCard: {
        padding: 0,
        marginBottom: SPACING.m,
        overflow: 'hidden',
    },
    cancelledCard: {
        opacity: 0.8,
        borderColor: COLORS.error || '#e74c3c',
        borderWidth: 1,
    },
    cardContent: {
        flexDirection: 'row',
        padding: SPACING.m,
    },
    eventImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: SPACING.m,
    },
    info: {
        flex: 1,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    eventTitle: {
        fontWeight: '700',
        flex: 1,
    },
    cancelledBadge: {
        backgroundColor: COLORS.error || '#e74c3c',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.s,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    editButton: {
        padding: 8,
        marginRight: 4,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 8,
    },
    deleteButton: {
        padding: 8,
        marginRight: 4,
        backgroundColor: (COLORS.error || '#e74c3c') + '18',
        borderRadius: 8,
    },
    stat: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    emptyText: {
        marginTop: SPACING.m,
        textAlign: 'center',
        marginBottom: SPACING.l,
    },
    createButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default ManageEventsScreen;
