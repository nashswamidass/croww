import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { formatIndianDate } from '../../utils/localization';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';

const EventListScreen = ({ route, navigation }) => {
    const { title = 'All Events', filter = 'all' } = route.params || {};
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const data = await eventService.getEvents();
                let filteredData = data;

                if (filter === 'featured') {
                    filteredData = data.filter(e => e.isFeatured);
                    if (filteredData.length === 0) filteredData = data.slice(0, 10);
                } else if (filter === 'upcoming') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Reset time part for accurate date comparison

                    filteredData = data
                        .filter(e => {
                            const eventDate = new Date(e.date);
                            return eventDate >= today;
                        })
                        .sort((a, b) => new Date(a.date) - new Date(b.date));
                }

                setEvents(filteredData);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, [filter]);

    const renderEventCard = ({ item: event }) => (
        <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('EventDetail', { id: event.id, event })}
            activeOpacity={0.9}
        >
            <View style={styles.cardContainer}>
                {getValidImageUri(event.imageUri) ? (
                    <Image source={{ uri: getValidImageUri(event.imageUri) }} style={styles.cardImage} />
                ) : (
                    <Image source={{ uri: DEFAULT_EVENT_IMAGE }} style={styles.cardImage} />
                )}

                <View style={styles.cardContent}>
                    <Typography variant="body" numberOfLines={1} style={styles.eventTitle}>
                        {event.title}
                    </Typography>

                    <View style={styles.metaRow}>
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>
                            {formatIndianDate(event.date)}
                        </Typography>
                    </View>

                    <View style={styles.footer}>
                        <Typography variant="small" style={{ color: COLORS.accent, fontWeight: '800' }}>
                            VIEW
                        </Typography>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">{title}</Typography>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={events}
                    renderItem={renderEventCard}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Typography variant="body" style={{ color: COLORS.secondary }}>
                                No events found.
                            </Typography>
                        </View>
                    }
                />
            )}
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
        marginRight: SPACING.s,
    },
    listContent: {
        padding: SPACING.s,
    },
    gridCard: {
        flex: 1,
        margin: SPACING.s,
        maxWidth: '46%', // Ensure 2 per row
    },
    cardContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.soft,
    },
    cardImage: {
        width: '100%',
        height: 120,
        backgroundColor: COLORS.surfaceHighlight,
    },
    imagePlaceholder: {
        width: '100%',
        height: 120,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContent: {
        padding: SPACING.m,
    },
    eventTitle: {
        fontWeight: '700',
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        marginTop: 100,
        alignItems: 'center',
    },
});

export default EventListScreen;
