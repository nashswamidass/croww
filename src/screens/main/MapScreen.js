import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Alert, Text, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { locationService } from '../../services/locationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { buddyService } from '../../services/buddyService';
import { DARK_MAP_STYLE } from '../../constants/mapStyle';
import { CITY_COORDINATES } from '../../constants/location';
import EventSummaryCard from '../../components/EventSummaryCard';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

const MapScreen = ({ navigation }) => {
    const { user: currentUser } = useAuth();
    const insets = useSafeAreaInsets();
    const mapRef = useRef(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allEvents, setAllEvents] = useState([]);
    const [displayedEvents, setDisplayedEvents] = useState([]);
    const [timeFilter, setTimeFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [searchingCity, setSearchingCity] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLocationSearch, setIsLocationSearch] = useState(false);
    const [showBuddyRequests, setShowBuddyRequests] = useState(false);
    const [activeBuddyEventIds, setActiveBuddyEventIds] = useState(new Set());
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    useEffect(() => {
        const initializeMap = async () => {
            try {
                // Fetch public events first
                const publicEvents = await eventService.getEvents();
                
                // Fetch user's own events (which includes private ones)
                let userEvents = [];
                if (currentUser) {
                    const userId = currentUser.uid || currentUser.id;
                    userEvents = await eventService.getEventsByOrganizer(userId);
                }

                // Merge and deduplicate events
                const eventMap = new Map();
                publicEvents.forEach(e => eventMap.set(e.id, e));
                userEvents.forEach(e => eventMap.set(e.id, e));
                
                setAllEvents(Array.from(eventMap.values()));

                // 1. Check for manual city choice or last known location first
                const cached = await locationService.getCachedLocation();
                
                if (cached.coords) {
                    setUserLocation(cached.coords);
                    if (mapRef.current) {
                        mapRef.current.animateToRegion({
                            ...cached.coords,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }, 500);
                    }
                    setLoading(false);
                    // Continue to refresh in background
                }

                // 2. Refresh location via service
                const { coords } = await locationService.getLocation();
                if (coords) {
                    setUserLocation(coords);
                    if (mapRef.current) {
                        mapRef.current.animateToRegion({
                            ...coords,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }, 1000);
                    }
                } else if (!cached.coords) {
                    const fallback = { latitude: 19.0760, longitude: 72.8777 }; // Mumbai Final Fallback
                    setUserLocation(fallback);
                }

            } catch (error) {
                console.log("Map initialization error:", error);
                const fallback = { latitude: 19.0760, longitude: 72.8777 };
                if (!userLocation) setUserLocation(fallback);
            } finally {
                setLoading(false);
            }
        };

        initializeMap();
    }, []);

    // Refresh events when the screen comes into focus (e.g., returning from CreateEvent)
    useFocusEffect(
        useCallback(() => {
            const fetchEvents = async () => {
                try {
                    console.log("[Map] Fetching events and buddy requests on focus");
                    const [publicEvents, buddyRequests] = await Promise.all([
                        eventService.getEvents(),
                        buddyService.getAllBuddyRequestsGlobally()
                    ]);
                    
                    // Fetch user's own events (which includes private ones)
                    let userEvents = [];
                    if (currentUser) {
                        const userId = currentUser.uid || currentUser.id;
                        userEvents = await eventService.getEventsByOrganizer(userId);
                    }

                    // Merge and deduplicate events
                    const eventMap = new Map();
                    publicEvents.forEach(e => eventMap.set(e.id, e));
                    userEvents.forEach(e => eventMap.set(e.id, e));
                    
                    setAllEvents(Array.from(eventMap.values()));

                    // Extract unique event IDs that have active buddy requests
                    // SECURE: Only show events with buddy requests that HAVE REMAINING SPOTS
                    const buddyIds = new Set(
                        buddyRequests
                            .filter(req => (req.spotsRemaining || 0) > 0)
                            .map(req => req.eventId)
                    );
                    setActiveBuddyEventIds(buddyIds);
                } catch (error) {
                    console.error("[Map] Focus fetch error:", error);
                }
            };
            fetchEvents();
        }, [])
    );

    useEffect(() => {
        if (!userLocation) return;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const filtered = allEvents.filter(event => {
            // Apply Buddy Request Filter
            if (showBuddyRequests) {
                // Must have an active buddy request
                if (!activeBuddyEventIds.has(event.id)) return false;
            } else {
                // If NOT in Buddy mode, we apply general visibility rules:
                // 1. Business events are ALWAYS visible on the map.
                // 2. Private events (isPublic: false) are HIDDEN unless they are business events.
                const isBusiness = event.isOfficial ||
                    event.verificationType === 'business' ||
                    (event.verificationStatus === 'verified' && event.verificationType === 'business');
                // Check for BOTH id and uid for robustness
                const currentUserId = currentUser?.id || currentUser?.uid;
                const isOrganizer = currentUserId && (event.organizerId === currentUserId);
                const isPublic = event.isPublic !== false; // Default to true if missing

                // Show if it's public, or a business event, OR if the current user is the owner
                if (!isPublic && !isBusiness && !isOrganizer) return false;
            }

            if (searchQuery && !showSuggestions && !isLocationSearch) {
                const query = searchQuery.toLowerCase();
                const titleMatch = event.title?.toLowerCase().includes(query);
                const categoryMatch = event.category?.toLowerCase().includes(query);
                if (!titleMatch && !categoryMatch) return false;
            }

            if (!event.date) return timeFilter === 'ALL';

            try {
                // Safely handle both standard JS Dates and Firebase string/timestamp formats
                const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
                if (isNaN(eventDate.getTime())) return timeFilter === 'ALL';

                const diffDays = Math.ceil((eventDate - startOfToday) / (1000 * 60 * 60 * 24));

                if (timeFilter === '1D') return diffDays >= 0 && diffDays <= 1;
                if (timeFilter === '1W') return diffDays >= 0 && diffDays <= 7;
                if (timeFilter === '1M') return diffDays >= 0 && diffDays <= 30;

                return true;
            } catch (err) {
                console.warn(`[Map] Invalid date on event ${event.id}:`, event.date);
                return timeFilter === 'ALL';
            }
        });

        // Refresh map markers
        setDisplayedEvents(filtered);
    }, [timeFilter, searchQuery, allEvents, showBuddyRequests, activeBuddyEventIds, currentUser, isLocationSearch, showSuggestions, userLocation, selectedEvent]);

    const fetchSuggestions = async (text) => {
        if (!text || text.length < 3) {
            setSuggestions([]);
            return;
        }

        setSearchingCity(true);
        try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${API_KEY}&components=country:in`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK') {
                setSuggestions(data.predictions);
            }
        } catch (error) {
            console.error('Map Autocomplete Error:', error);
        } finally {
            setSearchingCity(false);
        }
    };

    const handleSelectSuggestion = async (placeId, description) => {
        setSearchQuery(description);
        setIsLocationSearch(true); // Mark as location search so we don't filter events by string
        setSuggestions([]);
        setShowSuggestions(false);
        setLoading(true);

        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK') {
                const { lat, lng } = data.result.geometry.location;
                // Update userLocation state to focus on this new center (optional, but helps with distance calculations)
                setUserLocation({ latitude: lat, longitude: lng });

                const newRegion = {
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.1, // Zoom out slightly to see the city
                    longitudeDelta: 0.1,
                };
                if (mapRef.current) {
                    mapRef.current.animateToRegion(newRegion, 1000);
                }
            }
        } catch (error) {
            console.error('Map Place Details Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        try {
            setLoading(true);
            const results = await Location.geocodeAsync(searchQuery);

            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                const newRegion = {
                    latitude,
                    longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                };

                if (mapRef.current) {
                    mapRef.current.animateToRegion(newRegion, 1000);
                }
            } else {
                Alert.alert("Location Not Found", "We couldn't find that place on the map.");
            }
        } catch (error) {
            console.error("Search error:", error);
            Alert.alert("Search Error", "Something went wrong while searching for that location.");
        } finally {
            setLoading(false);
        }
    };

    const goToUserLocation = async () => {
        if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }, 800);
        }

        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced
            });
            setUserLocation(location.coords);
            await AsyncStorage.setItem('userLocation', JSON.stringify(location.coords));

            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }, 800);
            }
        } catch (error) {
            console.log("Error refining location:", error);
        }
    };

    const handleMarkerPress = (event) => setSelectedEvent(event);
    const handleMapPress = () => setSelectedEvent(null);
    const handleDetails = (event) => navigation.navigate('EventDetail', { id: event.id, event });

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h3">Locating you...</Typography>
                </View>
            </ScreenWrapper>
        );
    }

    // Use emoji icons (system text, always available without font loading)
    // which prevents the Android marker snapshotting race condition from Ionicons async font loading.
    const getCategoryEmoji = (category, hasActiveBuddyRequest) => {
        if (hasActiveBuddyRequest) return '👥';
        const cat = category?.toLowerCase();
        switch (cat) {
            case 'party':       return '🎉';
            case 'dinner':      return '🍽️';
            case 'movie':       return '🎬';
            case 'concert':     return '🎵';
            case 'workshop':    return '🔧';
            case 'sports':      return '⚽';
            case 'networking':  return '💼';
            case 'art':         return '🎨';
            case 'nightlife':   return '🌙';
            default:            return '📍';
        }
    };

    const getCategoryColor = (category, hasActiveBuddyRequest, isBusinessEvent) => {
        if (hasActiveBuddyRequest) return '#9C27B0';
        if (isBusinessEvent) return COLORS.accent || '#FF9800';
        const cat = category?.toLowerCase();
        switch (cat) {
            case 'party':       return COLORS.accents?.pink || '#FF4081';
            case 'dinner':      return COLORS.accents?.orange || '#FF9800';
            case 'movie':       return COLORS.accents?.blue || '#2196F3';
            case 'concert':     return COLORS.accents?.purple || '#9C27B0';
            case 'workshop':    return COLORS.accents?.yellow || '#FFC107';
            case 'sports':      return COLORS.accents?.blue || '#2196F3';
            case 'networking':  return COLORS.accents?.purple || '#9C27B0';
            case 'art':         return COLORS.accents?.pink || '#FF4081';
            case 'nightlife':   return COLORS.accents?.purple || '#9C27B0';
            default:            return COLORS.accents?.blue || '#2196F3';
        }
    };

    const initialRegion = {
        latitude: userLocation?.latitude || 19.0760,
        longitude: userLocation?.longitude || 72.8777,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    };

    const BUSINESS_COLOR = COLORS.accent;
    const USER_COLOR = COLORS.accents.blue;

    // Default to Google Maps on Android and iOS. 
    // Fallback to Apple Maps (undefined) on iOS ONLY if running in Expo Go.
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const mapProvider = Platform.OS === 'android' 
        ? PROVIDER_GOOGLE 
        : (isExpoGo ? undefined : PROVIDER_GOOGLE);

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                provider={mapProvider}
                onPress={handleMapPress}
                customMapStyle={DARK_MAP_STYLE}
                userInterfaceStyle="dark"
            >
                {displayedEvents.map(event => {
                    const hasActiveBuddyRequest = activeBuddyEventIds.has(event.id);
                    const isBusinessEvent = event.isOfficial || event.verificationStatus === 'business' || event.verificationType === 'business';
                    const isSelected = selectedEvent?.id === event.id;
                    const emoji = getCategoryEmoji(event.category, hasActiveBuddyRequest);
                    const bgColor = getCategoryColor(event.category, hasActiveBuddyRequest, isBusinessEvent);
                    const markerSize = isSelected ? 56 : 44;

                    return (
                        <Marker
                            key={`marker-${event.id}-${isSelected}`}
                            coordinate={event.coordinate}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleMarkerPress(event);
                            }}
                            zIndex={isSelected ? 100 : (hasActiveBuddyRequest ? 75 : (isBusinessEvent ? 50 : 10))}
                            tracksViewChanges={false}
                            anchor={{ x: 0.5, y: 1.0 }}
                        >
                            {/*
                              * Android custom marker clipping fix:
                              * - collapsable={false} prevents New Architecture from collapsing this layout-only View
                              * - padding: 4 gives Android's view measurer breathing room around the content,
                              *   preventing the "only a quarter visible" clipping bug
                              * - anchor y=1.0 points the triangle tip exactly at the coordinate
                              * - tracksViewChanges=false stops continuous re-measurement that causes clipping
                              */}
                            <View
                                collapsable={false}
                                style={{
                                    padding: 4,
                                    alignItems: 'center',
                                }}
                            >
                                <View style={{
                                    width: markerSize,
                                    height: markerSize,
                                    borderRadius: markerSize / 2,
                                    backgroundColor: '#FFFFFF',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: isSelected ? 4 : 3,
                                    borderColor: bgColor,
                                    elevation: 6,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 3 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 4,
                                }}>
                                    <Text style={{ fontSize: isSelected ? 24 : 18 }}>{emoji}</Text>
                                </View>
                                {/* Triangle tip */}
                                <View style={{
                                    width: 0,
                                    height: 0,
                                    borderLeftWidth: 7,
                                    borderRightWidth: 7,
                                    borderTopWidth: 10,
                                    borderLeftColor: 'transparent',
                                    borderRightColor: 'transparent',
                                    borderTopColor: bgColor,
                                    marginTop: -2,
                                }} />
                            </View>
                        </Marker>

                    );
                })}
            </MapView>

            <View style={[styles.overlay, { top: insets.top + SPACING.s }]}>
                <View style={styles.searchContainer}>
                    <TouchableOpacity onPress={handleSearch}>
                        <Ionicons name="search" size={20} color={COLORS.secondary} style={{ marginRight: SPACING.s }} />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search events, cities, or places..."
                        placeholderTextColor={COLORS.secondary}
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            setIsLocationSearch(false); // Reset to interactive filter mode
                            setShowSuggestions(true);
                            fetchSuggestions(text);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    {(searchQuery.length > 0 || searchingCity) && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            setIsLocationSearch(false);
                            setSuggestions([]);
                            setShowSuggestions(false);
                        }}>
                            {searchingCity ? (
                                <View style={{ padding: 4 }}>
                                    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.accent, borderTopColor: 'transparent' }} />
                                </View>
                            ) : (
                                <Ionicons name="close-circle" size={20} color={COLORS.secondary} />
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {showSuggestions && suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        {suggestions.map((item) => (
                            <TouchableOpacity
                                key={item.place_id}
                                style={styles.suggestionItem}
                                onPress={() => handleSelectSuggestion(item.place_id, item.description)}
                            >
                                <Ionicons name="location-outline" size={18} color={COLORS.secondary} style={{ marginRight: SPACING.s }} />
                                <Typography variant="body" numberOfLines={1} style={{ flex: 1 }}>
                                    {item.description}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.filterContainer}>
                {['1D', '1W', '1M', 'ALL'].map((filter) => (
                    <TouchableOpacity
                        key={filter}
                        style={[
                            styles.filterButton,
                            timeFilter === filter && styles.filterButtonActive
                        ]}
                        onPress={() => setTimeFilter(filter)}
                    >
                        <Typography
                            variant="caption"
                            style={{
                                color: timeFilter === filter ? COLORS.primary : COLORS.secondary,
                                fontWeight: 'bold'
                            }}
                        >
                            {filter}
                        </Typography>
                    </TouchableOpacity>
                ))}

                {/* Buddy Request Filter Toggle */}
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        { width: 'auto', paddingHorizontal: 12, marginLeft: 4 },
                        showBuddyRequests && { borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.1)' }
                    ]}
                    onPress={() => setShowBuddyRequests(!showBuddyRequests)}
                >
                    <Ionicons
                        name="people"
                        size={18}
                        color={showBuddyRequests ? '#9C27B0' : COLORS.secondary}
                        style={{ marginRight: 4 }}
                    />
                    <Typography
                        variant="caption"
                        style={{
                            color: showBuddyRequests ? '#9C27B0' : COLORS.secondary,
                            fontWeight: 'bold'
                        }}
                    >
                        Buddies
                    </Typography>
                </TouchableOpacity>
            </View>

            <EventSummaryCard
                event={selectedEvent}
                visible={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onDetails={handleDetails}
                isWeb={true}
                userLocation={userLocation}
                hasActiveBuddyRequest={selectedEvent && activeBuddyEventIds.has(selectedEvent.id)}
            />

            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={goToUserLocation}
                    activeOpacity={0.8}
                >
                    <Ionicons name="locate" size={24} color={COLORS.primary} />
                </TouchableOpacity>

                <AntigravityButton
                    title="+"
                    style={styles.fab}
                    onPress={() => navigation.navigate('CreateEvent')}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { width: '100%', height: '100%' },
    overlay: { position: 'absolute', left: 20, right: 20 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.m,
        height: 50,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchInput: {
        flex: 1,
        color: COLORS.primary,
        fontSize: 16,
        paddingVertical: 0,
    },
    suggestionsContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        marginTop: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
        maxHeight: 250,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    filterContainer: {
        position: 'absolute',
        bottom: 280,
        right: 20,
        alignItems: 'flex-end',
        gap: 8,
    },
    filterButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    filterButtonActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surfaceHighlight,
    },
    actionsContainer: {
        position: 'absolute',
        bottom: 60,
        right: 20,
        gap: 16,
        alignItems: 'center',
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    fab: {
        width: 48,
        minWidth: 48,
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 0,
    },
    customMarkerContainer: {
        width: 44, // Increased size
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 }, // Stronger shadow for floating effect
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    privateMarkerContainer: {
        backgroundColor: COLORS.primary,
    },
    businessMarkerContainer: {
        backgroundColor: COLORS.accent,
    },
    selectedMarkerContainer: {
        // NOTE: Do NOT use transform scale here - it does not expand layout bounds on Android
        // causing the Google Maps SDK to clip the marker. Use explicit larger dimensions instead (set inline).
        borderColor: COLORS.surfaceHighlight,
    },
    markerTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        alignSelf: 'center',
        marginTop: -2, // Overlap slightly to look connected
    },
    privateMarkerTriangle: {
        borderTopColor: COLORS.primary,
    },
    businessMarkerTriangle: {
        borderTopColor: COLORS.accent,
    },
    buddyMarkerContainer: {
        backgroundColor: '#9C27B0', // Distinct Purple for Buddy Requests
    },
    buddyMarkerTriangle: {
        borderTopColor: '#9C27B0',
    },
    selectedMarkerTriangle: {
        transform: [{ scale: 1.2 }],
        marginTop: -1,
    }
});

export default MapScreen;
