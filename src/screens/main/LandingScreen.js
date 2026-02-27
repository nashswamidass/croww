import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';
import SEO from '../../components/SEO';
import { formatIndianDate } from '../../utils/localization';
import { getSEOContent } from '../../constants/seoContent';

const LandingScreen = ({ route, navigation }) => {
    const { type, id } = route.params || {}; // type: 'city' or 'category', id: e.g., 'chennai' or 'festivals'
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Get tailored content from seoContent constant
    const seoMatch = getSEOContent(type, id);

    // Clean up IDs for display fallback if no tailored content exists
    const displayName = id ? (id.split('-')[0].charAt(0).toUpperCase() + id.split('-')[0].slice(1)) : 'Events';

    // Dynamic metadata and content fallback
    const pageTitle = seoMatch?.title || (type === 'city'
        ? `Events in ${displayName} – Concerts, Festivals & Tickets | Croww`
        : `${displayName} Events – Music, Arts & Culture | Croww`);

    const pageDescription = seoMatch?.description || (type === 'city'
        ? `Find the best events in ${displayName}. Browse concerts, festivals, parties and more. Book tickets and find event buddies on Croww.`
        : `Explore the best ${displayName} events. Discover top-rated festivals, shows, and gatherings. Join the community on Croww.`);

    const pageHeading = seoMatch?.heading || (type === 'city'
        ? `Events in ${displayName}`
        : `${displayName} Events`);

    const pageSummary = seoMatch?.summary || (type === 'city'
        ? `Discover what's happening in ${displayName}. From high-energy concerts to cultural festivals, stay updated with the most exciting local events.`
        : `Showing the best ${displayName} events. Explore curated listings and find your next favorite experience.`);

    useEffect(() => {
        const fetchAndFilterEvents = async () => {
            setLoading(true);
            try {
                const allEvents = await eventService.getEvents();
                let filtered = allEvents;

                if (type === 'city') {
                    filtered = allEvents.filter(e =>
                        e.location?.toLowerCase().includes(id.split('-')[0].toLowerCase())
                    );
                } else if (type === 'category') {
                    filtered = allEvents.filter(e =>
                        e.category?.toLowerCase() === id.toLowerCase()
                    );
                }

                setEvents(filtered);
            } catch (error) {
                console.error("Error fetching events for landing page:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAndFilterEvents();
    }, [type, id]);

    return (
        <ScreenWrapper edges={['top']}>
            <SEO
                title={pageTitle}
                description={pageDescription}
                url={type === 'city' ? `/cities/${id}` : `/categories/${id}`}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h1" style={styles.title}>{pageHeading}</Typography>
                <Typography variant="body" color={COLORS.secondary} style={styles.summary}>
                    {pageSummary}
                </Typography>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
                ) : events.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={COLORS.border} />
                        <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.m }}>
                            No events found for this {type}.
                        </Typography>
                    </View>
                ) : (
                    events.map((event) => (
                        <TouchableOpacity
                            key={event.id}
                            style={styles.eventCard}
                            onPress={() => navigation.navigate('EventDetail', { id: event.id, event })}
                        >
                            <NotionCard style={styles.cardInner}>
                                <Image
                                    source={{ uri: getValidImageUri(event.imageUri) || DEFAULT_EVENT_IMAGE }}
                                    style={styles.eventImage}
                                    accessibilityLabel={`Event: ${event.title}`}
                                />
                                <View style={styles.eventInfo}>
                                    <View style={styles.tagRow}>
                                        <Typography variant="caption" style={styles.categoryTag}>{event.category}</Typography>
                                    </View>
                                    <Typography variant="h3" numberOfLines={1}>{event.title}</Typography>
                                    <Typography variant="caption" color={COLORS.secondary} style={{ marginTop: 2 }}>
                                        {formatIndianDate(event.date)}
                                    </Typography>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-outline" size={14} color={COLORS.accent} />
                                        <Typography variant="caption" color={COLORS.accent} style={{ marginLeft: 4 }}>
                                            {event.locationName || event.location || 'Venue'}
                                        </Typography>
                                    </View>
                                </View>
                                <View style={styles.priceMeta}>
                                    <Typography variant="h3" style={{ color: COLORS.primary }}>
                                        {event.isPaid ? `₹${event.price}` : 'FREE'}
                                    </Typography>
                                    <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
                                </View>
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
        backgroundColor: COLORS.background,
    },
    backButton: {
        marginBottom: SPACING.m,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.primary,
        marginBottom: SPACING.s,
    },
    summary: {
        fontSize: 16,
        lineHeight: 24,
    },
    content: {
        paddingHorizontal: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
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
        width: 80,
        height: 80,
        borderRadius: BORDER_RADIUS.m,
        marginRight: SPACING.m,
    },
    eventInfo: {
        flex: 1,
    },
    tagRow: {
        marginBottom: 4,
    },
    categoryTag: {
        color: COLORS.accent,
        fontWeight: '700',
        textTransform: 'uppercase',
        fontSize: 10,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    priceMeta: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 8,
    }
});

export default LandingScreen;
