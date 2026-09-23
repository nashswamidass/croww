import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Dynamically load Google Maps JS SDK on web (avoids duplicate script tags if PropertyMap already loaded it)
const loadGoogleMapsScript = () => {
    if (Platform.OS !== 'web') return Promise.resolve(false);
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (window.google?.maps?.places) return Promise.resolve(true);

    if (document.getElementById('google-map-script') || document.querySelector('script[src*="maps.googleapis.com"]')) {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (window.google?.maps?.places) {
                    clearInterval(check);
                    resolve(true);
                }
            }, 100);
            setTimeout(() => {
                clearInterval(check);
                resolve(!!window.google?.maps?.places);
            }, 5000);
        });
    }

    // Check if script is already being loaded
    if (window.__googleMapsLoading) return window.__googleMapsLoading;

    window.__googleMapsLoading = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'google-places-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async&callback=__googleMapsCallback`;
        script.async = true;
        script.defer = true;
        
        window.__googleMapsCallback = () => {
            resolve(true);
        };
        script.onerror = () => {
            resolve(false);
        };
        document.head.appendChild(script);
    });

    return window.__googleMapsLoading;
};

function generateSessionToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function useGooglePlacesAutocomplete({
    initialValue = '',
    onSelect,
    country = 'in',
} = {}) {
    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mapsReady, setMapsReady] = useState(Platform.OS !== 'web' || !!(typeof window !== 'undefined' && window?.google?.maps?.places));

    // Google Places session token management
    const sessionTokenRef = React.useRef(generateSessionToken());
    const webSessionTokenRef = React.useRef(null);
    const activeRequestIdRef = React.useRef(0);
    const queryCacheRef = React.useRef(new Map());

    // Load Google Maps SDK on web mount
    useEffect(() => {
        if (Platform.OS === 'web' && !mapsReady) {
            loadGoogleMapsScript().then((loaded) => {
                setMapsReady(loaded);
            });
        }
    }, [mapsReady]);

    const fetchSuggestions = React.useCallback(async (text) => {
        const trimmed = (text || '').trim();
        if (!trimmed || trimmed.length < 3) {
            setSuggestions([]);
            setLoading(false);
            return;
        }

        // Return cached suggestions if already fetched in this session
        if (queryCacheRef.current.has(trimmed)) {
            setSuggestions(queryCacheRef.current.get(trimmed));
            setLoading(false);
            return;
        }

        const requestId = ++activeRequestIdRef.current;
        setLoading(true);

        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.google?.maps?.places) {
                // Web implementation using AutocompleteService with session token
                if (!webSessionTokenRef.current) {
                    webSessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
                }

                const autocompleteService = new window.google.maps.places.AutocompleteService();
                autocompleteService.getPlacePredictions({
                    input: trimmed,
                    componentRestrictions: { country },
                    sessionToken: webSessionTokenRef.current,
                }, (predictions, status) => {
                    if (requestId !== activeRequestIdRef.current) return; // Stale request
                    if (status === 'OK' && predictions) {
                        queryCacheRef.current.set(trimmed, predictions);
                        setSuggestions(predictions);
                    } else {
                        setSuggestions([]);
                    }
                    setLoading(false);
                });
                return;
            }

            // Native implementation with session token parameter
            if (API_KEY) {
                const token = sessionTokenRef.current;
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(trimmed)}&key=${API_KEY}&components=country:${country}&sessiontoken=${token}`;
                const response = await fetch(url);
                const data = await response.json();

                if (requestId !== activeRequestIdRef.current) return; // Stale response

                if (data.status === 'OK' && Array.isArray(data.predictions)) {
                    queryCacheRef.current.set(trimmed, data.predictions);
                    setSuggestions(data.predictions);
                } else {
                    setSuggestions([]);
                }
            } else {
                setSuggestions([]);
            }
        } catch (error) {
            if (requestId === activeRequestIdRef.current) {
                console.error('Autocomplete Error:', error);
                setSuggestions([]);
            }
        } finally {
            if (Platform.OS !== 'web' && requestId === activeRequestIdRef.current) {
                setLoading(false);
            }
        }
    }, [country]);

    // 400ms debounce
    useEffect(() => {
        if (!showSuggestions) return;

        const delayDebounceFn = setTimeout(() => {
            fetchSuggestions(query);
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [query, showSuggestions, fetchSuggestions]);

    const handleSelect = React.useCallback(async (placeId, description, extraCoords) => {
        setQuery(description);
        setSuggestions([]);
        setShowSuggestions(false);
        setLoading(true);

        const currentSessionToken = sessionTokenRef.current;
        const currentWebToken = webSessionTokenRef.current;

        // Reset session tokens for next interaction
        sessionTokenRef.current = generateSessionToken();
        webSessionTokenRef.current = null;
        queryCacheRef.current.clear();

        if (extraCoords?.latitude && extraCoords?.longitude) {
            onSelect?.({
                name: description,
                coordinate: {
                    latitude: extraCoords.latitude,
                    longitude: extraCoords.longitude,
                },
                latitude: extraCoords.latitude,
                longitude: extraCoords.longitude,
                place_id: placeId,
                placeId,
                formatted_address: description,
                formattedAddress: description,
                label: description,
            });
            setLoading(false);
            return;
        }

        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.google?.maps?.places) {
                const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
                placesService.getDetails({
                    placeId: placeId,
                    fields: ['geometry', 'name', 'formatted_address'],
                    sessionToken: currentWebToken,
                }, (place, status) => {
                    if (status === 'OK' && place?.geometry?.location) {
                        const lat = place.geometry.location.lat();
                        const lng = place.geometry.location.lng();
                        const formattedAddress = place.formatted_address || description;
                        onSelect?.({
                            name: place.name || description,
                            coordinate: {
                                latitude: lat,
                                longitude: lng,
                            },
                            latitude: lat,
                            longitude: lng,
                            place_id: placeId,
                            placeId,
                            formatted_address: formattedAddress,
                            formattedAddress,
                            label: formattedAddress,
                        });
                    }
                    setLoading(false);
                });
                return;
            }

            // Native/Fallback implementation with sessiontoken termination
            if (API_KEY) {
                const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${API_KEY}&sessiontoken=${currentSessionToken}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.result?.geometry?.location) {
                    const { lat, lng } = data.result.geometry.location;
                    const formattedAddress = data.result.formatted_address || description;
                    onSelect?.({
                        name: data.result.name || description,
                        coordinate: {
                            latitude: lat,
                            longitude: lng,
                        },
                        latitude: lat,
                        longitude: lng,
                        place_id: placeId,
                        placeId,
                        formatted_address: formattedAddress,
                        formattedAddress,
                        label: formattedAddress,
                    });
                }
            }
        } catch (error) {
            console.error('Place Details Error:', error);
        } finally {
            if (Platform.OS !== 'web') {
                setLoading(false);
            }
        }
    }, [onSelect]);

    const clearSearch = React.useCallback(() => {
        setQuery('');
        setSuggestions([]);
        setShowSuggestions(false);
    }, []);

    return {
        query,
        setQuery,
        suggestions,
        loading,
        showSuggestions,
        setShowSuggestions,
        handleSelect,
        clearSearch,
    };
}

const GooglePlacesInput = ({
    label,
    placeholder,
    onSelect,
    initialValue = '',
    style,
    inputStyle,
    suggestionsStyle,
}) => {
    const {
        query,
        setQuery,
        suggestions,
        loading,
        showSuggestions,
        setShowSuggestions,
        handleSelect,
    } = useGooglePlacesAutocomplete({
        initialValue,
        onSelect,
    });

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Typography variant="caption" style={styles.label}>
                    {label}
                </Typography>
            )}
            <View style={styles.inputWrapper}>
                <TextInput
                    style={[styles.input, inputStyle]}
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
                <View style={[styles.suggestionsContainer, !label && { top: 52 }, suggestionsStyle]}>
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
