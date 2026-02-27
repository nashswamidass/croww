import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Platform, ActivityIndicator } from 'react-native';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { DARK_MAP_STYLE } from '../../constants/mapStyle';
import { CITY_COORDINATES } from '../../constants/location';
import EventSummaryCard from '../../components/EventSummaryCard';
import AntigravityButton from '../../components/AntigravityButton';

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const center = {
    lat: 19.0760,
    lng: 72.8777,
};

const MapScreenWeb = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [allEvents, setAllEvents] = useState([]);
    const [displayedEvents, setDisplayedEvents] = useState([]);
    const [timeFilter, setTimeFilter] = useState('ALL');
    const [currentPosition, setCurrentPosition] = useState(center);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchingPlace, setSearchingPlace] = useState(false);
    const [map, setMap] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    const goToUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const locationPromise = Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Location timeout')), 10000)
                );

                const location = await Promise.race([locationPromise, timeoutPromise]);
                const newPos = {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                };

                setCurrentPosition(newPos);
                await AsyncStorage.setItem('userLocation', JSON.stringify(location.coords));

                if (map) {
                    map.panTo(newPos);
                    map.setZoom(14);
                }
            } else {
                // Permission denied, just re-center on Mumbai or stay where we are
                if (map) {
                    map.panTo(center);
                    map.setZoom(12);
                }
            }
        } catch (error) {
            console.log("Map location detection failed:", error);
            // On error/timeout, center on default Mumbai
            if (map) {
                map.panTo(center);
                map.setZoom(12);
            }
        }
    };

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: API_KEY,
        libraries: ['places']
    });

    useEffect(() => {
        if (loadError) {
            console.error("Google Maps Load Error:", loadError);
            alert(`Google Maps failed to load: ${loadError.message || 'Check browser console for details'}`);
        }
    }, [loadError]);

    useEffect(() => {
        const checkManualCity = async () => {
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
            }
        };
        checkManualCity();
    }, [map]);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const events = await eventService.getEvents();
                setAllEvents(events);
                setDisplayedEvents(events);
            } catch (error) {
                console.log("Error fetching events for web:", error);
            }
        };
        fetchEvents();
    }, []);

    useEffect(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const filtered = allEvents.filter(event => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const titleMatch = event.title?.toLowerCase().includes(query);
                const categoryMatch = event.category?.toLowerCase().includes(query);
                if (!titleMatch && !categoryMatch) return false;
            }

            if (!event.timestamp) return true;
            const eventDate = new Date(event.timestamp);
            const diffDays = Math.ceil((eventDate - startOfToday) / (1000 * 60 * 60 * 24));

            if (timeFilter === '1D') return diffDays >= 0 && diffDays <= 1;
            if (timeFilter === '1W') return diffDays >= 0 && diffDays <= 7;
            if (timeFilter === '1M') return diffDays >= 0 && diffDays <= 30;

            return true;
        });

        setDisplayedEvents(filtered);
    }, [timeFilter, searchQuery, allEvents]);

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

        // 1. Try to find local event matches
        const firstMatch = displayedEvents[0];
        if (firstMatch) {
            map.panTo({
                lat: firstMatch.coordinate.latitude,
                lng: firstMatch.coordinate.longitude
            });
            map.setZoom(14);
            return;
        }

        // 2. If no event matches, try geocoding the query as a place
        if (window.google?.maps?.places) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address: searchQuery, componentRestrictions: { country: 'in' } }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const { lat, lng } = results[0].geometry.location;
                    map.panTo({ lat: lat(), lng: lng() });
                    map.setZoom(12);
                }
            });
        }
    };

    const handleDetails = (event) => navigation.navigate('EventDetail', { id: event.id, event });

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
                center={center}
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
                {displayedEvents.map(event => (
                    <Marker
                        key={event.id}
                        position={{
                            lat: event.coordinate.latitude,
                            lng: event.coordinate.longitude
                        }}
                        onClick={() => setSelectedEvent(event)}
                        icon={{
                            path: window.google && window.google.maps ? window.google.maps.SymbolPath.CIRCLE : 0,
                            fillColor: event.color || COLORS.accent,
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: '#FFFFFF',
                            scale: 8,
                        }}
                    />
                ))}
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
                            fetchSuggestions(text);
                        }}
                        onSubmitEditing={handleSearch}
                    />
                    {(searchQuery.length > 0 || searchingPlace) && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            setSuggestions([]);
                            setShowSuggestions(false);
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
            </View>

            {/* Event Summary Card Integration */}
            <EventSummaryCard
                event={selectedEvent}
                visible={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onDetails={handleDetails}
                isWeb={true}
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
    container: { flex: 1, backgroundColor: '#000' },
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

export default MapScreenWeb;
