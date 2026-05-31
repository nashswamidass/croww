import React, { useState, useEffect, useCallback, Component } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Platform, ActivityIndicator } from 'react-native';

class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <View style={{flex:1, padding: 50, backgroundColor: 'red'}}><Typography variant="body" style={{color:'white'}}>{this.state.error?.toString()}\n\n{this.state.error?.stack}</Typography></View>;
    return this.props.children;
  }
}
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Ionicons } from '@expo/vector-icons';
import { locationService } from '../../services/locationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { buddyService } from '../../services/buddyService';
import { DARK_MAP_STYLE } from '../../constants/mapStyle';
import { CITY_COORDINATES } from '../../constants/location';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import EventSummaryCard from '../../components/EventSummaryCard';
import AntigravityButton from '../../components/AntigravityButton';

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const defaultCenter = {
    lat: 19.0760,
    lng: 72.8777,
};

const libraries = ['places'];

const MapScreenWeb = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [allEvents, setAllEvents] = useState([]);
    const [displayedEvents, setDisplayedEvents] = useState([]);
    const [timeFilter, setTimeFilter] = useState('ALL');
    const [currentPosition, setCurrentPosition] = useState(defaultCenter);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchingPlace, setSearchingPlace] = useState(false);
    const [map, setMap] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showBuddyRequests, setShowBuddyRequests] = useState(false);
    const [activeBuddyEventIds, setActiveBuddyEventIds] = useState(new Set());
    const [isLocationSearch, setIsLocationSearch] = useState(false);
    const { user: authUser, loading: authLoading } = useAuth();
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    const goToUserLocation = async () => {
        try {
            const { coords } = await locationService.getLocation();
            if (coords) {
                const newPos = {
                    lat: coords.latitude,
                    lng: coords.longitude
                };

                setCurrentPosition(newPos);
                if (map) {
                    map.panTo(newPos);
                    map.setZoom(14);
                }
            } else if (map) {
                map.panTo(defaultCenter);
                map.setZoom(12);
            }
        } catch (error) {
            console.log("Map location detection failed:", error);
            if (map) {
                map.panTo(defaultCenter);
                map.setZoom(12);
            }
        }
    };

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: API_KEY,
        libraries,
    });

    useEffect(() => {
        if (loadError) {
            console.error("Google Maps Load Error:", loadError);
            alert(`Google Maps failed to load: ${loadError.message || 'Check browser console for details'}`);
        }
    }, [loadError]);

    useEffect(() => {
        const initLocation = async () => {
            // 1. Try cached location first
            const cached = await locationService.getCachedLocation();
            if (cached.coords) {
                const pos = { lat: cached.coords.latitude, lng: cached.coords.longitude };
                setCurrentPosition(pos);
                if (map) {
                    map.panTo(pos);
                    map.setZoom(12);
                }
            }

            // 2. Check for manual city choice
            const manualCity = await AsyncStorage.getItem('manualCity');
            if (manualCity && CITY_COORDINATES[manualCity]) {
                const coords = {
                    lat: CITY_COORDINATES[manualCity].latitude,
                    lng: CITY_COORDINATES[manualCity].longitude
                };
                setCurrentPosition(coords);
                if (map) {
                    map.panTo(coords);
                    map.setZoom(12);
                }
            } else {
                // 3. Try real location refresh
                goToUserLocation();
            }
        };
        initLocation();
    }, [map]);

    const fetchData = useCallback(async () => {
        try {
            const [events, buddyRequests] = await Promise.all([
                eventService.getEvents(),
                buddyService.getAllBuddyRequestsGlobally()
            ]);

            console.log(`[Map.web] Fetched ${events.length} events and ${buddyRequests.length} buddy requests`);
            setAllEvents(events);

            // Extract unique event IDs that have active buddy requests
            const buddyIds = new Set(
                buddyRequests
                    .filter(req => (req.spotsRemaining || 0) > 0)
                    .map(req => req.eventId)
            );
            setActiveBuddyEventIds(buddyIds);
        } catch (error) {
            console.error("[Map.web] Fetch error:", error, error.stack);
        }
    }, []);

    // Fetch on focus
    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    // Fetch on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const filtered = allEvents.filter(event => {
            // Apply Buddy Request Filter
            if (showBuddyRequests) {
                // Must have an active buddy request
                if (!activeBuddyEventIds.has(event.id)) return false;
            } else {
                // Broadened isBusiness check to capture 'verified' status too
                const isBusiness = event.isOfficial ||
                    event.verificationType === 'business' ||
                    (event.verificationStatus === 'verified' && event.verificationType === 'business');

                // Check for BOTH id and uid for robustness
                const currentUserId = authUser?.id || authUser?.uid;
                const isOrganizer = currentUserId && (event.organizerId === currentUserId);
                const isPublic = event.isPublic !== false; // Default to true if missing


                // Show if it's public, or a business event, OR if the current user is the owner
                if (!isPublic && !isBusiness && !isOrganizer) {
                    return false;
                }
            }

            if (searchQuery && !showSuggestions && !isLocationSearch) {
                const query = searchQuery.toLowerCase();
                const titleMatch = event.title?.toLowerCase().includes(query);
                const categoryMatch = event.category?.toLowerCase().includes(query);
                if (!titleMatch && !categoryMatch) return false;
            }

            if (!event.date) return timeFilter === 'ALL';

            try {
                const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
                if (isNaN(eventDate.getTime())) return timeFilter === 'ALL';

                const diffDays = Math.ceil((eventDate - startOfToday) / (1000 * 60 * 60 * 24));

                if (timeFilter === '1D') return diffDays >= 0 && diffDays <= 1;
                if (timeFilter === '1W') return diffDays >= 0 && diffDays <= 7;
                if (timeFilter === '1M') return diffDays >= 0 && diffDays <= 30;

                return true;
            } catch (e) {
                console.warn(`[Map.web] Invalid date on event ${event.id}:`, event.date);
                return timeFilter === 'ALL';
            }
        });

        setDisplayedEvents(filtered);
    }, [timeFilter, searchQuery, allEvents, showBuddyRequests, activeBuddyEventIds, authLoading, authUser, isLocationSearch, showSuggestions]);

    const onLoad = useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMap(null);
    }, []);

    const fetchSuggestions = async (text) => {
        if (!text || text.length < 3 || !window.google?.maps?.places) {
            setSuggestions([]);
            return;
        }

        setSearchingPlace(true);
        try {
            const autocompleteService = new window.google.maps.places.AutocompleteService();
            const sessionToken = new window.google.maps.places.AutocompleteSessionToken();

            autocompleteService.getPlacePredictions({
                input: text,
                componentRestrictions: { country: 'in' },
                sessionToken: sessionToken
            }, (predictions, status) => {
                if (status === 'OK' && predictions) {
                    setSuggestions(predictions);
                } else {
                    setSuggestions([]);
                }
                setSearchingPlace(false);
            });
        } catch (error) {
            console.error('Web Map Autocomplete Error:', error);
            setSearchingPlace(false);
        }
    };

    const handleSelectSuggestion = async (placeId, description) => {
        setSearchQuery(description);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsLocationSearch(true);

        if (!map || !window.google?.maps?.places) return;

        try {
            const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
            placesService.getDetails({
                placeId: placeId,
                fields: ['geometry']
            }, (place, status) => {
                if (status === 'OK' && place.geometry && place.geometry.location) {
                    const newPos = {
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                    };
                    setCurrentPosition(newPos); // SYNC STATE
                    map.panTo(newPos);
                    map.setZoom(14);
                }
            });
        } catch (error) {
            console.error('Web Map Place Details Error:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !map) return;
        setIsLocationSearch(true);

        // 1. Try to find local event matches
        const firstMatch = displayedEvents[0];
        if (firstMatch) {
            const newPos = {
                lat: firstMatch.coordinate.latitude,
                lng: firstMatch.coordinate.longitude
            };
            setCurrentPosition(newPos); // SYNC STATE
            map.panTo(newPos);
            map.setZoom(14);
            return;
        }

        // 2. If no event matches, try geocoding the query as a place
        if (window.google?.maps?.places) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address: searchQuery, componentRestrictions: { country: 'in' } }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const { lat, lng } = results[0].geometry.location;
                    const newPos = { lat: lat(), lng: lng() };
                    setCurrentPosition(newPos); // SYNC STATE
                    map.panTo(newPos);
                    map.setZoom(12);
                }
            });
        }
    };

    const handleDetails = (event) => {
        if (event && event.id) {
            navigation.navigate('EventDetail', { id: event.id, event });
        }
    };

    const getCategoryLabel = (category) => {
        const cat = category?.toLowerCase();
        switch (cat) {
            case 'party': return '🍷';
            case 'dinner': return '🍽️';
            case 'movie': return '🎬';
            case 'concert': return '🎵';
            case 'workshop': return '🛠️';
            case 'sports': return '⚽';
            case 'networking': return '💼';
            case 'art': return '🎨';
            case 'nightlife': return '🌙';
            default: return '✨'; // Star instead of pin to avoid confusion
        }
    };

    const getCategoryColor = (category) => {
        const cat = category?.toLowerCase();
        switch (cat) {
            case 'party': return COLORS.accents.pink;
            case 'dinner': return COLORS.accents.orange;
            case 'movie': return COLORS.accents.blue;
            case 'concert': return COLORS.accents.purple;
            case 'workshop': return COLORS.accents.yellow;
            case 'sports': return COLORS.accents.blue;
            case 'networking': return COLORS.accents.purple;
            case 'art': return COLORS.accents.pink;
            case 'nightlife': return COLORS.accents.purple;
            default: return COLORS.accent; // Brand Green for others
        }
    };

    const createMarkerIcon = (emoji, color, isBuddy) => {
        const mainColor = isBuddy ? '#9C27B0' : color;
        const isDark = isBuddy;
        const glowOpacity = isBuddy ? '0.4' : '0.2';
        const svgString = `
            <svg xmlns="http://www.w3.org/2000/svg" width="52" height="62" viewBox="0 0 52 62">
                <defs>
                    <radialGradient id="pinGrad" cx="35%" cy="30%">
                        <stop offset="0%" stop-color="${isBuddy ? '#CE93D8' : lightenColor(mainColor)}" stop-opacity="1"/>
                        <stop offset="100%" stop-color="${mainColor}" stop-opacity="1"/>
                    </radialGradient>
                    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${mainColor}" flood-opacity="${glowOpacity}"/>
                    </filter>
                </defs>
                <!-- Pin body -->
                <path d="M26 2 C14 2, 4 12, 4 24 C4 38, 26 58, 26 58 C26 58, 48 38, 48 24 C48 12, 38 2, 26 2 Z"
                    fill="url(#pinGrad)" filter="url(#shadow)"/>
                <!-- Inner white circle -->
                <circle cx="26" cy="24" r="14" fill="white" opacity="0.95"/>
                <!-- Emoji text -->
                <text x="26" y="30" text-anchor="middle" font-size="16" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${emoji}</text>
            </svg>
        `;
        const encoded = encodeURIComponent(svgString.trim());
        return {
            url: `data:image/svg+xml,${encoded}`,
            scaledSize: new window.google.maps.Size(52, 62),
            anchor: new window.google.maps.Point(26, 58),
        };
    };

    // Simple color lightener for gradient
    const lightenColor = (hex) => {
        try {
            const num = parseInt(hex.replace('#', ''), 16);
            const r = Math.min(255, ((num >> 16) & 0xff) + 60);
            const g = Math.min(255, ((num >> 8) & 0xff) + 60);
            const b = Math.min(255, (num & 0xff) + 60);
            return `rgb(${r},${g},${b})`;
        } catch { return hex; }
    };

    if (!isLoaded) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <View style={{ marginTop: 20 }}>
                    <Typography variant="body">Loading Explorer...</Typography>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={currentPosition}
                zoom={12}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                    styles: DARK_MAP_STYLE,
                    disableDefaultUI: true,
                    zoomControl: false,
                }}
                onClick={() => setSelectedEvent(null)}
            >
                {displayedEvents.map(event => {
                    const hasActiveBuddyRequest = activeBuddyEventIds.has(event.id);
                    const isBusinessEvent = event.isOfficial || event.verificationStatus === 'business' || event.verificationType === 'business';

                    // Resolve coordinates — use event coords, fallback to Mumbai for official events
                    // Ensure they are strictly Numbers
                    let lat = parseFloat(event.coordinate?.latitude || event.latitude || event.lat);
                    let lng = parseFloat(event.coordinate?.longitude || event.longitude || event.lng);

                    if (isNaN(lat) || isNaN(lng)) {
                        if (isBusinessEvent) {
                            // Fallback to Bengaluru instead of Mumbai for better relevance
                            lat = 12.9716;
                            lng = 77.5946;
                        } else {
                            if (event.title?.toLowerCase().includes('tu')) {
                                console.log(`[Render DEBUG] Skipping 'Tu' - No Coords:`, {
                                    id: event.id,
                                    coordField: event.coordinate,
                                    latField: event.latitude,
                                    topLatField: event.lat
                                });
                            }
                            return null;
                        }
                    }                    let labelText = getCategoryLabel(event.category);
                    let categoryColor = getCategoryColor(event.category);

                    return (
                        <MarkerF
                            key={event.id}
                            position={{ lat, lng }}
                            onClick={() => setSelectedEvent(event)}
                            icon={createMarkerIcon(
                                hasActiveBuddyRequest ? '👥' : labelText,
                                categoryColor,
                                hasActiveBuddyRequest
                            )}
                            zIndex={hasActiveBuddyRequest ? 1000 : (isBusinessEvent ? 500 : 1)}
                            title={event.title}
                        />
                    );
                })}
            </GoogleMap>

            {/* Floating UI Overlays - Matching Android Layout */}
            <View style={[styles.overlayContainer, { top: insets.top + SPACING.s }]}>
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
                            setShowSuggestions(true);
                            if (isLocationSearch) setIsLocationSearch(false);
                            fetchSuggestions(text);
                        }}
                        onSubmitEditing={handleSearch}
                    />
                    {(searchQuery.length > 0 || searchingPlace) && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            setSuggestions([]);
                            setShowSuggestions(false);
                            setIsLocationSearch(false);
                        }}>
                            {searchingPlace ? (
                                <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 4 }} />
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
                        { width: 'auto', paddingHorizontal: 10 },
                        showBuddyRequests && { borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.1)' }
                    ]}
                    onPress={() => setShowBuddyRequests(!showBuddyRequests)}
                >
                    <Ionicons
                        name="people"
                        size={16}
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

            {/* Event Summary Card Integration */}
            <EventSummaryCard
                event={selectedEvent}
                visible={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onDetails={handleDetails}
                isWeb={true}
                hasActiveBuddyRequest={selectedEvent && activeBuddyEventIds.has(selectedEvent.id)}
            />

            {/* FAB and Action Buttons */}
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
    container: { flex: 1, backgroundColor: '#000', height: '100vh' },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    overlayContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        zIndex: 10,
    },
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
    },
    searchInput: {
        flex: 1,
        color: COLORS.primary,
        fontSize: 16,
        outlineStyle: 'none',
    },
    suggestionsContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        marginTop: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
        maxHeight: 300,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        cursor: 'pointer',
    },
    filterContainer: {
        position: 'absolute',
        bottom: 280,
        right: 20,
        alignItems: 'center',
        gap: 8,
        zIndex: 10,
    },
    filterButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
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
        zIndex: 10,
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
    }
});

export default function MapScreenWebWrapper(props) {
  return (
    <MapErrorBoundary>
      <MapScreenWeb {...props} />
    </MapErrorBoundary>
  );
}
