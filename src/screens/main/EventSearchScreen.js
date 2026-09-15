import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { userService } from '../../services/userService';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';

const EventSearchScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch both Events and Providers/Businesses at the same time
                const [eventsData, providersData] = await Promise.all([
                    eventService.getEvents(),
                    userService.getServiceProviders()
                ]);

                // Tag them so we know which is which in the mixed list
                const formattedEvents = eventsData.map(e => ({ ...e, resultType: 'event' }));
                const formattedProviders = providersData.map(p => ({ ...p, resultType: 'provider' }));

                const combined = [...formattedEvents, ...formattedProviders];
                setAllData(combined);
                setFilteredData(combined);
            } catch (error) {
                console.error("Error fetching data for search:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredData(allData);
            return;
        }

        const lowerQuery = searchQuery.toLowerCase();
        const results = allData.filter(item => {
            if (item.resultType === 'event') {
                return item.title?.toLowerCase().includes(lowerQuery) ||
                    item.category?.toLowerCase().includes(lowerQuery) ||
                    item.location?.toLowerCase().includes(lowerQuery);
            } else {
                return item.name?.toLowerCase().includes(lowerQuery) ||
                    item.category?.toLowerCase().includes(lowerQuery) ||
                    item.location?.toLowerCase().includes(lowerQuery) ||
                    item.role?.toLowerCase().includes(lowerQuery);
            }
        });
        setFilteredData(results);
    }, [searchQuery, allData]);

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Typography variant="h2">Global Search</Typography>
                </View>
                <NotionInput
                    placeholder="Search events, venues, providers..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {filteredData.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={48} color={COLORS.border} />
                            <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.m }}>
                                {`No results found matching "${searchQuery}"`}
                            </Typography>
                        </View>
                    ) : (
                        filteredData.map((item) => (
                            <TouchableOpacity
                                key={item.id + item.resultType}
                                style={styles.resultCard}
                                onPress={() => {
                                    if (item.resultType === 'event') {
                                        navigation.navigate('EventDetail', { id: item.id, event: item });
                                    } else {
                                        navigation.navigate('ServiceDetail', { serviceId: item.id });
                                    }
                                }}
                            >
                                <NotionCard style={styles.cardInner}>
                                    {item.resultType === 'event' ? (
                                        <>
                                            {/* Event Listing Image */}
                                            {getValidImageUri(item.imageUri) ? (
                                                <Image source={{ uri: getValidImageUri(item.imageUri) }} style={styles.resultImage} />
                                            ) : (
                                                <Image source={{ uri: DEFAULT_EVENT_IMAGE }} style={styles.resultImage} />
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {/* Circular DP feature for Providers/Businesses */}
                                            <View style={styles.avatarContainer}>
                                                {(item.photoURL || item.avatar) ? (
                                                    <Image source={{ uri: item.photoURL || item.avatar }} style={styles.avatarImage} />
                                                ) : (
                                                    <Ionicons name={item.userType === 'business' ? "business" : "person"} size={24} color={COLORS.secondary} />
                                                )}
                                            </View>
                                        </>
                                    )}

                                    <View style={styles.resultInfo}>
                                        <View style={styles.nameRow}>
                                            <Typography variant="body" numberOfLines={1} style={{ fontWeight: '600', flex: 1 }}>
                                                {item.resultType === 'event' ? item.title : item.name}
                                            </Typography>

                                            {/* Type Badge */}
                                            <View style={[styles.badge, item.resultType !== 'event' && styles.providerBadge]}>
                                                <Typography variant="small" style={[styles.badgeText, item.resultType !== 'event' && styles.providerBadgeText]}>
                                                    {item.resultType === 'event' ? 'EVENT' : (item.userType === 'business' ? 'VENUE' : 'SERVICE')}
                                                </Typography>
                                            </View>
                                        </View>

                                        <Typography variant="caption" color={COLORS.secondary}>
                                            {item.resultType === 'event'
                                                ? `${item.date} • ${item.category}`
                                                : (item.role || item.category || 'Professional')}
                                        </Typography>

                                        <View style={styles.locationRow}>
                                            <Ionicons name="location-outline" size={14} color={COLORS.accent} />
                                            <Typography variant="caption" color={COLORS.accent} style={{ marginLeft: 4 }}>
                                                {item.location || 'Online'}
                                            </Typography>
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
                                </NotionCard>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingHorizontal: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    resultCard: {
        marginBottom: SPACING.m,
    },
    cardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
    },
    resultImage: {
        width: 60,
        height: 60,
        borderRadius: BORDER_RADIUS.m,
        marginRight: SPACING.m,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30, // Make DP circular for providers/businesses
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    resultInfo: {
        flex: 1,
        marginRight: SPACING.s,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    badge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.s,
        marginLeft: SPACING.xs,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    providerBadge: {
        backgroundColor: COLORS.accent + '20', // Transparent accent
    },
    providerBadgeText: {
        color: COLORS.accent,
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
