import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Dynamically load Google Maps JS SDK on web (avoids needing a manual script tag in index.html)
const loadGoogleMapsScript = () => {
    if (Platform.OS !== 'web') return Promise.resolve(false);
    if (window.google?.maps?.places) return Promise.resolve(true);

    // Check if script is already being loaded
    if (window.__googleMapsLoading) return window.__googleMapsLoading;

    window.__googleMapsLoading = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async&callback=__googleMapsCallback`;
        script.async = true;
        script.defer = true;
        
        window.__googleMapsCallback = () => {
            console.log('Google Maps JS SDK loaded');
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load Google Maps JS SDK');
            resolve(false);
        };
        document.head.appendChild(script);
    });

    return window.__googleMapsLoading;
};

const GooglePlacesInput = ({ label, placeholder, onSelect, initialValue = '' }) => {
    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mapsReady, setMapsReady] = useState(Platform.OS !== 'web' || !!window?.google?.maps?.places);

    // Load Google Maps SDK on web mount
    useEffect(() => {
        if (Platform.OS === 'web' && !mapsReady) {
            loadGoogleMapsScript().then((loaded) => {
                setMapsReady(loaded);
            });
        }
    }, []);

    const fetchSuggestions = async (text) => {
        if (!text || text.length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            if (Platform.OS === 'web' && window.google?.maps?.places) {
                // Web specific implementation using Google Maps JS SDK (Avoids CORS)
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
                    setLoading(false);
                });
                return; // Exit early as the callback handles state
            }

            // Native/Fallback implementation using direct fetch
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${API_KEY}&components=country:in`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK') {
                setSuggestions(data.predictions);
            } else {
                setSuggestions([]);
            }
        } catch (error) {
            console.error('Autocomplete Error:', error);
            setSuggestions([]);
        } finally {
            if (Platform.OS !== 'web') {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        if (!showSuggestions) return;

        const delayDebounceFn = setTimeout(() => {
            fetchSuggestions(query);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSelect = async (placeId, description) => {
        setQuery(description);
        setSuggestions([]);
        setShowSuggestions(false);
        setLoading(true);

        try {
            if (Platform.OS === 'web' && window.google?.maps?.places) {
                // Web specific implementation using Google Maps JS SDK (Details)
                const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
                placesService.getDetails({
                    placeId: placeId,
                    fields: ['geometry', 'name', 'formatted_address']
                }, (place, status) => {
                    if (status === 'OK' && place.geometry && place.geometry.location) {
                        onSelect({
                            name: description,
                            coordinate: {
                                latitude: place.geometry.location.lat(),
                                longitude: place.geometry.location.lng(),
                            }
                        });
                    }
                    setLoading(false);
                });
                return; // Exit early
            }

            // Native/Fallback implementation
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK') {
                const { lat, lng } = data.result.geometry.location;
                onSelect({
                    name: description,
                    coordinate: {
                        latitude: lat,
                        longitude: lng,
                    }
                });
            }
        } catch (error) {
            console.error('Place Details Error:', error);
        } finally {
            if (Platform.OS !== 'web') {
                setLoading(false);
            }
        }
    };

    return (
        <View style={styles.container}>
            {label && (
                <Typography variant="caption" style={styles.label}>
                    {label}
                </Typography>
            )}
            <View style={styles.inputWrapper}>
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={(text) => {
                        setQuery(text);
                        setShowSuggestions(true);
                    }}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.secondary}
                />
                {loading && (
                    <View style={styles.loader}>
                        <ActivityIndicator size="small" color={COLORS.accent} />
                    </View>
                )}
            </View>

            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    {suggestions.map((item) => (
                        <TouchableOpacity
                            key={item.place_id}
                            style={styles.suggestionItem}
                            onPress={() => handleSelect(item.place_id, item.description)}
                        >
                            <Ionicons name="location-outline" size={16} color={COLORS.secondary} style={styles.suggestionIcon} />
                            <Typography variant="small" style={styles.suggestionText} numberOfLines={1}>
                                {item.description}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.m,
        zIndex: 100, // Ensure suggestions appear above other elements
    },
    label: {
        marginBottom: SPACING.s,
        marginLeft: SPACING.xs,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    inputWrapper: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        fontSize: FONT_SIZES.m,
        color: COLORS.primary,
        backgroundColor: COLORS.surfaceHighlight,
    },
    loader: {
        position: 'absolute',
        right: SPACING.m,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: 75,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        zIndex: 1000,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    suggestionIcon: {
        marginRight: SPACING.s,
    },
    suggestionText: {
        flex: 1,
        color: COLORS.primary,
    },
});

export default GooglePlacesInput;
