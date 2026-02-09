import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { EVENTS } from '../../data/mockEvents';
import EventSummaryCard from '../../components/EventSummaryCard';
import NotionButton from '../../components/NotionButton';
import { DARK_MAP_STYLE } from '../../constants/mapStyle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MapScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const mapRef = useRef(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [displayedEvents, setDisplayedEvents] = useState(EVENTS);
    const [timeFilter, setTimeFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const getLocalEvents = (lat, long) => {
        return Array.from({ length: 3 }).map((_, i) => ({
            id: `local-${i}`,
            coordinate: {
                latitude: lat + (Math.random() - 0.5) * 0.01,
                longitude: long + (Math.random() - 0.5) * 0.01,
            },
            title: `Nearby Event #${i + 1}`,
            category: "Party",
            color: i % 2 === 0 ? COLORS.accents.pink : COLORS.accents.blue,
            timestamp: new Date().toISOString()
        }));
    };

    const [localEvents, setLocalEvents] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const cachedLocation = await AsyncStorage.getItem('userLocation');
                if (cachedLocation) {
                    const coords = JSON.parse(cachedLocation);
                    setUserLocation(coords);
                    setLocalEvents(getLocalEvents(coords.latitude, coords.longitude));
                }

                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (!cachedLocation) {
                        const fallback = { latitude: 37.77825, longitude: -122.4424 };
                        setUserLocation(fallback);
                        setLocalEvents(getLocalEvents(fallback.latitude, fallback.longitude));
                    }
                    setLoading(false);
                    return;
                }

                const lastKnown = await Location.getLastKnownPositionAsync({});
                if (lastKnown && !cachedLocation) {
                    setUserLocation(lastKnown.coords);
                    setLocalEvents(getLocalEvents(lastKnown.coords.latitude, lastKnown.coords.longitude));
                }

                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                    .then(async (location) => {
                        setUserLocation(location.coords);
                        setLocalEvents(getLocalEvents(location.coords.latitude, location.coords.longitude));
                        await AsyncStorage.setItem('userLocation', JSON.stringify(location.coords));

                        if (mapRef.current) {
                            mapRef.current.animateToRegion({
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }, 1000);
                        }
                    })
                    .catch(err => console.log("Background location refine failed:", err));

            } catch (error) {
                console.log("Location initialization error:", error);
                const fallback = { latitude: 37.77825, longitude: -122.4424 };
                if (!userLocation) {
                    setUserLocation(fallback);
                    setLocalEvents(getLocalEvents(fallback.latitude, fallback.longitude));
                }
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!userLocation) return;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const allPotentialEvents = [...EVENTS, ...localEvents];

        const filtered = allPotentialEvents.filter(event => {
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
    }, [timeFilter, userLocation, searchQuery, localEvents]);

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

                // Update markers for the new location
                setLocalEvents(getLocalEvents(latitude, longitude));

                if (mapRef.current) {
                    mapRef.current.animateToRegion(newRegion, 1000);
                }

                // Trigger a refresh of displayedEvents
                setDisplayedEvents(prev => [...prev]);
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
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 800);
        }

        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced
            });
            setUserLocation(location.coords);
            await AsyncStorage.setItem('userLocation', JSON.stringify(location.coords));

            // Refresh local events for current location
            setLocalEvents(getLocalEvents(location.coords.latitude, location.coords.longitude));

            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 800);
            }
        } catch (error) {
            console.log("Error refining location:", error);
        }
    };

    const handleMarkerPress = (event) => setSelectedEvent(event);
    const handleMapPress = () => setSelectedEvent(null);
    const handleDetails = (event) => navigation.navigate('EventDetail', { event });

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
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            // Optional: restore current location pins when clearing search
                        }}>
                            <Ionicons name="close-circle" size={20} color={COLORS.secondary} />
                        </TouchableOpacity>
                    )}
                </View>
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

                <NotionButton
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
        bottom: 110,
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
        width: 60,
        minWidth: 60,
        height: 60,
        borderRadius: 30,
        paddingHorizontal: 0,
    }
});

export default MapScreen;
