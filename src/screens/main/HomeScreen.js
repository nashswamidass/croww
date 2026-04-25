import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import VerificationBadge from '../../components/VerificationBadge';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getDistanceFromLatLonInKm, formatDistance } from '../../utils/distance';
import { eventService } from '../../services/eventService';
import { userService } from '../../services/userService';
import { chatService } from '../../services/chatService';
import { RefreshControl, Alert } from 'react-native';
import LocationSelectorModal from '../../components/LocationSelectorModal';
import { formatIndianDate } from '../../utils/localization';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';
import PolicyAcceptanceModal from '../../components/PolicyAcceptanceModal';
import {
    collection,
    getDocs,
    doc,
    query,
    orderBy,
    where
} from 'firebase/firestore';
import { locationService } from '../../services/locationService';

const HomeScreen = ({ navigation }) => {
    const { user: authUser } = useAuth(); // Use centralized auth state
    const [userLocation, setUserLocation] = useState(null);
    const [cityName, setCityName] = useState('Detecting...');
    const [events, setEvents] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
    const [manualCity, setManualCity] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPolicyModalVisible, setIsPolicyModalVisible] = useState(false);

    useEffect(() => {
        let unsubscribeChats;

        const init = async () => {
            try {
                // 1. Check for manual city choice first
                const savedCity = await AsyncStorage.getItem('manualCity');
                if (savedCity) {
                    setCityName(savedCity);
                    setManualCity(savedCity);
                }

                // 2. Check cache for coordinates
                const cached = await locationService.getCachedLocation();
                if (cached.coords) {
                    setUserLocation(cached.coords);
                }

                // 3. Trigger refreshing location if not manual
                if (!savedCity) {
                    const detect = async () => {
                        const { coords, cityName: detectedCity } = await locationService.getLocation();
                        if (coords) setUserLocation(coords);
                        if (detectedCity) setCityName(detectedCity);
                    };
                    detect();
                }

                // 4. Chat listener
                if (authUser) {
                    // Check if policy needs acceptance
                    const needsPolicy = (authUser.userType === 'business' || authUser.isBusiness || authUser.userType === 'provider' || authUser.isProvider) && !authUser.policyAccepted;
                    setIsPolicyModalVisible(needsPolicy);

                    unsubscribeChats = chatService.subscribeToUserChats(authUser.id, (chats) => {
                        let total = 0;
                        chats.forEach(chat => {
                            const count = chat.unreadCounts?.[authUser.id];
                            if (typeof count === 'number') {
                                total += count;
                            }
                        });
                        setUnreadCount(total);
                    });
                }
            } catch (err) {
                console.log("HomeScreen init error:", err);
            }
        };

        init();

        return () => {
            if (unsubscribeChats) unsubscribeChats();
        };
    }, [authUser?.id, authUser?.policyAccepted]); // Re-run when user or policy status changes

    useFocusEffect(
        useCallback(() => {
            fetchEvents();
        }, [])
    );

    const handleCitySelect = async (city) => {
        if (!city) {
            // Revert to auto detection
            setManualCity(null);
            await AsyncStorage.removeItem('manualCity');
            setCityName('Detecting...');
            const { coords, cityName: detectedCity } = await locationService.getLocation();
            if (coords) setUserLocation(coords);
            if (detectedCity) setCityName(detectedCity);
        } else {
            setCityName(city);
            setManualCity(city);
            await AsyncStorage.setItem('manualCity', city);
            Alert.alert("Location Updated", `Viewing events in ${city}`);
        }
    };

    const fetchEvents = async () => {
        // Hard timeout: 8s max — ensures HomeScreen never gets stuck loading
        const fetchTimeout = setTimeout(() => {
            console.warn('[HomeScreen] fetchEvents timed out — clearing loading state');
            setLoading(false);
            setRefreshing(false);
        }, 8000);

        try {
            const data = await eventService.getEvents();
            setEvents(data);
        } catch (error) {
            console.error("Failed to fetch events", error);
        } finally {
            clearTimeout(fetchTimeout);
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchEvents();
    }, []);

    const getDistanceText = (eventCoord) => {
        // Handle both 'coordinate' and 'coordinates' naming conventions
        const coords = eventCoord || null;
        if (!userLocation || !coords || !coords.latitude || !coords.longitude) return 'Location not set';

        const dist = getDistanceFromLatLonInKm(
            userLocation.latitude,
            userLocation.longitude,
            coords.latitude,
            coords.longitude
        );
        return `${formatDistance(dist)} away`;
    };

    // Get featured events (strictly those marked by admin AND posted by business)
    const featuredEvents = events.filter(event => {
        const isBusiness = event.isOfficial ||
            event.verificationType === 'business' ||
            (event.verificationStatus === 'verified' && event.verificationType === 'business');
        return event.isFeatured === true && isBusiness;
    });

    // Fallback: If no featured business events, show all upcoming public events
    const hasFeatured = featuredEvents.length > 0;
    const displayFeatured = hasFeatured
        ? featuredEvents
        : [...events]
            .filter(e => new Date(e.date) >= new Date().setHours(0, 0, 0, 0))
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 5);
    
    const featuredSectionTitle = hasFeatured ? "Featured Events" : "Upcoming Events";

    // Sort upcoming events by proximity if location is available
    const upcomingEvents = [...events]
        .sort((a, b) => {
            if (!userLocation) return 0;
            const coordA = a.coordinate || a.coordinates;
            const coordB = b.coordinate || b.coordinates;

            if (!coordA && !coordB) return 0;
            if (!coordA) return 1;
            if (!coordB) return -1;

            const distA = getDistanceFromLatLonInKm(
                userLocation.latitude, userLocation.longitude,
                coordA.latitude, coordA.longitude
            );
            const distB = getDistanceFromLatLonInKm(
                userLocation.latitude, userLocation.longitude,
                coordB.latitude, coordB.longitude
            );
            return distA - distB;
        })
        .slice(0, 10);

    const handleEventPress = (event) => {
        navigation.navigate('EventDetail', { id: event.id, event });
    };

    return (
        <ScreenWrapper edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Image
                            source={require('../../../assets/croww-logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={styles.locationContainer}
                            onPress={() => setIsLocationModalVisible(true)}
                        >
                            <Ionicons name="location" size={14} color={COLORS.accent} />
                            <Typography variant="small" style={styles.locationText}>
                                {cityName}
                            </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.headerIconButton, { marginLeft: SPACING.s }]}
                            onPress={() => navigation.navigate('Notifications')}
                        >
                            <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.headerIconButton, { marginLeft: SPACING.s }]}
                            onPress={() => navigation.navigate('EventSearch')}
                        >
                            <Ionicons name="search-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.headerIconButton, { marginLeft: SPACING.s }]}
                            onPress={() => navigation.navigate('ChatList')}
                        >
                            <Ionicons name="chatbubbles-outline" size={24} color={COLORS.primary} />
                            {unreadCount > 0 && (
                                <View style={{
                                    position: 'absolute',
                                    top: -5,
                                    right: -5,
                                    backgroundColor: 'red',
                                    borderRadius: 10,
                                    minWidth: 16,
                                    height: 16,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    paddingHorizontal: 2
                                }}>
                                    <Typography variant="small" style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Typography>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <LocationSelectorModal
                    visible={isLocationModalVisible}
                    onClose={() => setIsLocationModalVisible(false)}
                    onSelect={handleCitySelect}
                    currentCity={manualCity}
                />

                <PolicyAcceptanceModal
                    visible={isPolicyModalVisible}
                    user={authUser}
                    onAccept={() => setIsPolicyModalVisible(false)}
                />

                {/* Featured Events - Large Image Cards */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h3">{featuredSectionTitle}</Typography>
                        <TouchableOpacity onPress={() => navigation.navigate('EventList', { 
                            title: featuredSectionTitle, 
                            filter: hasFeatured ? 'featured' : 'upcoming' 
                        })}>
                            <Typography variant="small" style={{ color: COLORS.accent }}>
                                See All
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.horizontalScroll}
                        contentContainerStyle={styles.horizontalContent}
                    >
                        {displayFeatured.length === 0 && !loading && (
                            <Typography variant="body" style={{ marginLeft: SPACING.m, color: COLORS.secondary }}>
                                No events found. Be the first to create one!
                            </Typography>
                        )}
                        {displayFeatured.map((event) => (
                            <TouchableOpacity
                                key={event.id}
                                style={styles.featuredCard}
                                onPress={() => handleEventPress(event)}
                                activeOpacity={0.9}
                            >
                                <ImageBackground
                                    source={{ uri: getValidImageUri(event.imageUri) || DEFAULT_EVENT_IMAGE }}
                                    style={styles.featuredImage}
                                    imageStyle={{ borderRadius: BORDER_RADIUS.l }}
                                    resizeMode="cover"
                                >
                                    <View style={styles.categoryBadge}>
                                        <Typography variant="caption" style={{ color: COLORS.primary, fontWeight: '700', fontSize: 10 }}>
                                            {event.category.toUpperCase()}
                                        </Typography>
                                    </View>

                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                                        style={styles.gradient}
                                    >
                                        <View style={styles.featuredContent}>
                                            <Typography variant="h2" style={{ marginTop: 2 }}>
                                                {event.title}
                                            </Typography>

                                            <View style={styles.featuredFooter}>
                                                <View style={styles.eventMeta}>
                                                    <View style={styles.metaItem}>
                                                        <Ionicons name="time-outline" size={14} color={COLORS.secondary} />
                                                        <Typography variant="caption" style={styles.metaText}>
                                                            {formatIndianDate(event.date)}
                                                        </Typography>
                                                    </View>
                                                    <View style={styles.metaItem}>
                                                        <Ionicons name="location-outline" size={14} color={COLORS.secondary} />
                                                        <Typography variant="caption" style={styles.metaText}>
                                                            {getDistanceText(event.coordinate || event.coordinates)}
                                                        </Typography>
                                                    </View>
                                                </View>

                                                <View style={styles.featuredCtaBadge}>
                                                    <Typography variant="small" style={{ color: COLORS.background, fontWeight: '800', fontSize: 10 }}>
                                                        JOIN
                                                    </Typography>
                                                </View>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </ImageBackground>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                {/* Upcoming Events - Compact List */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h3">Happening Soon</Typography>
                        <TouchableOpacity onPress={() => navigation.navigate('EventList', { title: 'Upcoming Events', filter: 'upcoming' })}>
                            <Typography variant="small" style={{ color: COLORS.accent }}>
                                See All
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {upcomingEvents.map((event) => (
                        <TouchableOpacity
                            key={event.id}
                            style={styles.compactCard}
                            onPress={() => handleEventPress(event)}
                            activeOpacity={0.8}
                        >
                            <NotionCard style={styles.compactCardInner}>
                                {getValidImageUri(event.imageUri) ? (
                                    <Image
                                        source={{ uri: getValidImageUri(event.imageUri) }}
                                        style={styles.compactImage}
                                    />
                                ) : (
                                    <View style={[styles.compactImage, styles.imagePlaceholder]}>
                                        <Ionicons name="image-outline" size={32} color={COLORS.secondary} />
                                    </View>
                                )}

                                <View style={styles.compactContent}>
                                    <Typography variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
                                        {event.title}
                                    </Typography>
                                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                        {formatIndianDate(event.date)} • {event.category}
                                    </Typography>

                                    <View style={styles.compactFooter}>
                                        <View style={styles.compactMeta}>
                                            <Ionicons name="location-outline" size={12} color={COLORS.secondary} />
                                            <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: 4 }}>
                                                {getDistanceText(event.coordinate || event.coordinates)}
                                            </Typography>
                                        </View>

                                        <View style={styles.compactCta}>
                                            <Typography variant="small" style={{ color: COLORS.accent, fontWeight: '800', marginRight: 2 }}>
                                                VIEW
                                            </Typography>
                                            <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
                                        </View>
                                    </View>
                                </View>
                            </NotionCard>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Bottom Spacing for Tab Bar */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Floating Action Button - Moved outside ScrollView */}
            <View style={styles.fabContainer}>
                <AntigravityButton
                    title="+"
                    style={styles.fab}
                    onPress={() => navigation.navigate('CreateEvent')}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: SPACING.m, // Reduced top padding
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.l,
        height: 50, // slightly more compact
    },
    headerLeft: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconButton: {
        width: 36, // Smaller buttons
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceHighlight, // Subtle background
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    logo: {
        width: 80, // Smaller logo
        height: 24,
        marginLeft: 0,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 20,
        marginRight: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    locationText: {
        color: COLORS.primary,
        textTransform: 'none',
        fontSize: 13, // Slightly larger font
        marginLeft: 4,
        fontWeight: '600',
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end', // Align text to baseline
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
    },
    horizontalScroll: {
        paddingLeft: SPACING.m,
    },
    horizontalContent: {
        paddingRight: SPACING.m,
    },
    featuredCard: {
        width: 250, // Reduced width
        height: 320, // Reduced height
        marginRight: SPACING.m,
        borderRadius: BORDER_RADIUS.l,
        overflow: 'hidden', // Ensure image respects border radius
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    featuredImage: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: SPACING.m,
    },
    featuredContent: {
        // Removed padding here as it's handled by gradient
    },
    featuredCtaBadge: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: 20,
    },
    categoryBadge: {
        position: 'absolute',
        top: SPACING.m,
        right: SPACING.m,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        zIndex: 1,
    },
    compactCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    featuredFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: SPACING.s,
    },
    eventMeta: {
        flex: 1,
        gap: 4,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        color: COLORS.secondary,
        fontSize: 11,
        marginLeft: 4,
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
    },
    actionCard: {
        alignItems: 'center',
        width: 75, // Slightly wider
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderWidth: 1,
        borderColor: 'transparent', // Placeholder for potential border
    },
    fabContainer: {
        position: 'absolute',
        bottom: 60, // Adjusted for tab bar clearance
        right: 20,
        zIndex: 100,
    },
    fab: {
        width: 48,
        minWidth: 48,
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 0,
        ...SHADOWS.medium,
    },
    compactCard: {
        marginHorizontal: SPACING.m, // Use margin instead of padding on parent
        marginBottom: SPACING.s,
    },
    compactCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.s, // Tighter padding
        gap: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    compactImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    imagePlaceholder: {
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactContent: {
        flex: 1,
        justifyContent: 'center',
    },
    compactFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 4,
    },
    compactMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default HomeScreen;
