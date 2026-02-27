import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { eventService } from '../../services/eventService';
import { DARK_MAP_STYLE } from '../../constants/mapStyle';
import { CITY_COORDINATES } from '../../constants/location';
import EventSummaryCard from '../../components/EventSummaryCard';

const MapScreen = ({ navigation }) => {
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
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    useEffect(() => {
        const initializeMap = async () => {
            try {
                // Fetch real events first
                const events = await eventService.getEvents();
                setAllEvents(events);

                const cachedLocation = await AsyncStorage.getItem('userLocation');
                if (cachedLocation) {
                    const coords = JSON.parse(cachedLocation);
                    setUserLocation(coords);
                }

                const manualCity = await AsyncStorage.getItem('manualCity');
                if (manualCity && CITY_COORDINATES[manualCity]) {
                    const coords = CITY_COORDINATES[manualCity];
                    setUserLocation(coords);

                    if (mapRef.current) {
                        mapRef.current.animateToRegion({
                            ...coords,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }, 1000);
                    }
                    setLoading(false);
                    return;
                }

                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (!cachedLocation) {
                        const fallback = { latitude: 19.0760, longitude: 72.8777 }; // Mumbai Fallback
                        setUserLocation(fallback);
                    }
                    setLoading(false);
                    return;
                }

                const lastKnown = await Location.getLastKnownPositionAsync({});
                if (lastKnown && !cachedLocation) {
                    setUserLocation(lastKnown.coords);
                }

                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setUserLocation(location.coords);
                await AsyncStorage.setItem('userLocation', JSON.stringify(location.coords));

                if (mapRef.current) {
                    mapRef.current.animateToRegion({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }, 1000);
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

    useEffect(() => {
        if (!userLocation) return;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const filtered = allEvents.filter(event => {
            if (searchQuery && !isLocationSearch) {
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
    }, [timeFilter, userLocation, searchQuery, allEvents]);

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

    const initialRegion = {
        latitude: userLocation?.latitude || 37.77825,
        longitude: userLocation?.longitude || -122.4424,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                provider={PROVIDER_GOOGLE}
                onPress={handleMapPress}
                customMapStyle={DARK_MAP_STYLE}
                userInterfaceStyle="dark"
            >
                {displayedEvents.map(event => (
                    <Marker
                        key={`dot-${event.id}`}
                        coordinate={event.coordinate}
                        onPress={() => handleMarkerPress(event)}
                        pinColor={event.color}
                    />
                ))}
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
            </View>

            <EventSummaryCard
                event={selectedEvent}
                visible={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onDetails={handleDetails}
                userLocation={userLocation}
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
        alignItems: 'center',
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
    }
});

export default MapScreen;
