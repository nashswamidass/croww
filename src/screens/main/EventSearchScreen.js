import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { ActivityIndicator } from 'react-native';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';

const EventSearchScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [events, setEvents] = useState([]);
    const [filteredEvents, setFilteredEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const data = await eventService.getEvents();
                setEvents(data);
                setFilteredEvents(data);
            } catch (error) {
                console.error("Error fetching events for search:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    useEffect(() => {
        const results = events.filter(event =>
            event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.location?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredEvents(results);
    }, [searchQuery, events]);

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Typography variant="h2">Search Events</Typography>
                </View>
                <NotionInput
                    placeholder="Search titles, categories, locations..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {filteredEvents.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="search-outline" size={48} color={COLORS.border} />
                        <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.m }}>
                            No events found matching "{searchQuery}"
                        </Typography>
                    </View>
                ) : (
                    filteredEvents.map((event) => (
                        <TouchableOpacity
                            key={event.id}
                            style={styles.eventCard}
                            onPress={() => navigation.navigate('EventDetail', { id: event.id, event })}
                        >
                            <NotionCard style={styles.cardInner}>
                                {getValidImageUri(event.imageUri) ? (
                                    <Image source={{ uri: getValidImageUri(event.imageUri) }} style={styles.eventImage} />
                                ) : (
                                    <Image source={{ uri: DEFAULT_EVENT_IMAGE }} style={styles.eventImage} />
                                )}
                                <View style={styles.eventInfo}>
                                    <Typography variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
                                        {event.title}
                                    </Typography>
                                    <Typography variant="caption" color={COLORS.secondary}>
                                        {event.date} • {event.category}
                                    </Typography>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-outline" size={14} color={COLORS.accent} />
                                        <Typography variant="caption" color={COLORS.accent} style={{ marginLeft: 4 }}>
                                            {event.location || 'Online'}
                                        </Typography>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
                            </NotionCard>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        padding: SPACING.m,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    backButton: {
        marginRight: SPACING.s,
    },
    content: {
        paddingHorizontal: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    eventCard: {
        marginBottom: SPACING.m,
    },
    cardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
    },
    eventImage: {
        width: 60,
        height: 60,
        borderRadius: BORDER_RADIUS.m,
        marginRight: SPACING.m,
    },
    imagePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    eventInfo: {
        flex: 1,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    }
});

export default EventSearchScreen;
