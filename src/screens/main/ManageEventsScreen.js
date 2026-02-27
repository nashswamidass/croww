import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
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

    const renderEventItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate('EventStats', { event: item })}
        >
            <NotionCard style={styles.eventCard}>
                <View style={styles.cardContent}>
                    <Image
                        source={{ uri: getValidImageUri(item.imageUri) || DEFAULT_EVENT_IMAGE }}
                        style={styles.eventImage}
                    />
                    <View style={styles.info}>
                        <Typography variant="h3" numberOfLines={1}>{item.title}</Typography>
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
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => navigation.navigate('CreateEvent', { event: item })}
                                >
                                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                                <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
                            </View>
                        </View>
                    </View>
                </View>
            </NotionCard>
        </TouchableOpacity>
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
                        You haven't created any events yet.
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
