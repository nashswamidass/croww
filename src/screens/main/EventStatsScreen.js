import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { ticketService } from '../../services/ticketService';
import { eventService } from '../../services/eventService';
import { useAuth } from '../../context/AuthContext';

const EventStatsScreen = ({ route, navigation }) => {
    const { event } = route.params;
    const { user } = useAuth();
    const isBusiness = user?.userType === 'business';
    const [stats, setStats] = useState({ sold: 0, scanned: 0, attendees: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await ticketService.getEventStats(event.id, event.organizerId);
            setStats(data);
        } catch (error) {
            console.error("Error loading stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            const shareUrl = `https://croww.ai/event/${event.id}`;
            await Share.share({
                message: `Check out my event "${event.title}" on Croww!\n\n${shareUrl}`,
                url: shareUrl,
                title: event.title,
            });
        } catch (error) {
            console.error("Error sharing event:", error.message);
        }
    };

    const handleDeletePress = () => {
        const hasAttendees = (stats.sold || 0) > 0;

        const options = [
            {
                text: 'Cancel Event',
                style: 'destructive',
                onPress: () => confirmAction('cancel'),
            },
        ];

        if (!hasAttendees) {
            options.push({
                text: 'Delete Event',
                style: 'destructive',
                onPress: () => confirmAction('delete'),
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

    const confirmAction = (action) => {
        const isCancel = action === 'cancel';
        Alert.alert(
            isCancel ? 'Cancel Event?' : 'Delete Event?',
            isCancel
                ? `Are you sure you want to cancel "${event.title}"? All attendees will be notified.`
                : `Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`,
            [
                { text: 'No, Go Back', style: 'cancel' },
                {
                    text: isCancel ? 'Yes, Cancel Event' : 'Yes, Delete',
                    style: 'destructive',
                    onPress: () => isCancel ? doCancel() : doDelete(),
                },
            ]
        );
    };

    const doCancel = async () => {
        try {
            await eventService.cancelEvent(event.id);
            Alert.alert('Event Cancelled', 'The event has been cancelled.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (error) {
            Alert.alert('Error', 'Failed to cancel the event. Please try again.');
        }
    };

    const doDelete = async () => {
        try {
            await eventService.deleteEvent(event.id);
            Alert.alert('Event Deleted', 'The event has been permanently deleted.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (error) {
            Alert.alert('Error', 'Failed to delete the event. Please try again.');
        }
    };

    const renderAttendee = ({ item }) => (
        <View style={styles.attendeeRow}>
            <View style={styles.attendeeInfo}>
                <Typography variant="body" style={{ fontWeight: '500' }}>
                    {item.userName || 'Attendee'}
                </Typography>
                <Typography variant="caption" color={COLORS.secondary}>
                    {item.id.substring(0, 8)}...
                </Typography>
            </View>
            <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'scanned' ? COLORS.success + '20' : COLORS.border + '40' }
            ]}>
                <Typography variant="small" style={{
                    color: item.status === 'scanned' ? COLORS.success : COLORS.secondary,
                    fontWeight: 'bold'
                }}>
                    {item.status === 'scanned' ? (isBusiness ? 'SCANNED' : 'CHECKED IN') : 'VALID'}
                </Typography>
            </View>
        </View>
    );

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    const scanRate = stats.sold > 0 ? Math.round((stats.scanned / stats.sold) * 100) : 0;

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Event Stats</Typography>
                <TouchableOpacity onPress={handleShare} style={styles.backButton}>
                    <Ionicons name="share-social-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h3" style={styles.eventTitle}>{event.title}</Typography>

                {event.status !== 'cancelled' && (
                    <View style={styles.manageActions}>
                        <TouchableOpacity style={[styles.manageBtn, styles.editBtn]} onPress={() => navigation.navigate('CreateEvent', { event })}>
                            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                            <Typography variant="small" style={{marginLeft: 4, fontWeight: '600'}}>Edit</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.manageBtn, styles.deleteBtn]} onPress={handleDeletePress}>
                            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                            <Typography variant="small" style={{marginLeft: 4, color: COLORS.error, fontWeight: '600'}}>Manage</Typography>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <NotionCard style={styles.statCard}>
                        <Typography variant="caption" color={COLORS.secondary}>{isBusiness ? 'Sold' : 'RSVPs'}</Typography>
                        <Typography variant="h2">{stats.sold}</Typography>
                        {!!event.maxTickets && (
                            <Typography variant="small" color={COLORS.secondary}>
                                of {event.maxTickets}
                            </Typography>
                        )}
                    </NotionCard>
                    <NotionCard style={styles.statCard}>
                        <Typography variant="caption" color={COLORS.secondary}>{isBusiness ? 'Scanned' : 'Checked In'}</Typography>
                        <Typography variant="h2">{stats.scanned}</Typography>
                        <Typography variant="small" color={COLORS.secondary}>
                            {scanRate}% rate
                        </Typography>
                    </NotionCard>
                </View>

                {/* Progress Bar */}
                <NotionCard style={styles.progressCard}>
                    <Typography variant="body" style={styles.cardLabel}>{isBusiness ? 'Attendance Progress' : 'Check-in Progress'}</Typography>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${scanRate}%` }]} />
                    </View>
                    <Typography variant="caption" color={COLORS.secondary} style={{ marginTop: 8 }}>
                        {stats.scanned} of {stats.sold} {isBusiness ? 'ticket holders' : 'attendees'} present
                    </Typography>
                </NotionCard>

                {/* Attendee List */}
                <Typography variant="h3" style={styles.sectionTitle}>Attendee List</Typography>
                <NotionCard style={styles.listCard}>
                    {stats.attendees.length === 0 ? (
                        <Typography variant="body" color={COLORS.secondary} style={{ textAlign: 'center', padding: 20 }}>
                            {isBusiness ? 'No tickets sold yet.' : 'No attendees yet.'}
                        </Typography>
                    ) : (
                        stats.attendees.map((item) => (
                            <React.Fragment key={item.id}>
                                {renderAttendee({ item })}
                                <View style={styles.divider} />
                            </React.Fragment>
                        ))
                    )}
                </NotionCard>
                <View style={{ height: 40 }} />
            </ScrollView>
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
    content: {
        padding: SPACING.m,
    },
    eventTitle: {
        marginBottom: SPACING.l,
        textAlign: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.l,
    },
    statCard: {
        flex: 0.48,
        alignItems: 'center',
        padding: SPACING.m,
    },
    progressCard: {
        padding: SPACING.m,
        marginBottom: SPACING.l,
    },
    cardLabel: {
        fontWeight: '600',
        marginBottom: SPACING.s,
    },
    progressBarBg: {
        height: 12,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.accent,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    listCard: {
        padding: 0,
    },
    attendeeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
    },
    attendeeInfo: {
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: 4,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.m,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    manageActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: SPACING.m,
        marginBottom: SPACING.l,
    },
    manageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
    },
    editBtn: {
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    deleteBtn: {
        borderColor: COLORS.error + '50',
        backgroundColor: COLORS.error + '10',
    }
});

export default EventStatsScreen;
