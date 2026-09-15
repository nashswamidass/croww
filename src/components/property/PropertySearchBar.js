import React, { useEffect, useState } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
    ScrollView,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS, TOUCH_TARGETS, SHADOWS } from '../../constants/theme';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const POPULAR_LOCALITIES = {
    Chennai: [
        { name: 'Adyar', subtitle: 'South Chennai · Premium residential', latitude: 13.0012, longitude: 80.2565 },
        { name: 'Anna Nagar', subtitle: 'North-West Chennai · Bustling neighborhood', latitude: 13.0850, longitude: 80.2100 },
        { name: 'OMR', subtitle: 'Old Mahabalipuram Rd · IT Corridor', latitude: 12.8950, longitude: 80.2280 },
        { name: 'Velachery', subtitle: 'South Chennai · Prime connectivity', latitude: 12.9750, longitude: 80.2200 },
        { name: 'Mylapore', subtitle: 'Central Chennai · Cultural hub', latitude: 13.0330, longitude: 80.2670 },
        { name: 'Besant Nagar', subtitle: 'Coastal South Chennai · Beachfront', latitude: 12.9980, longitude: 80.2670 },
    ],
    Bengaluru: [
        { name: 'Indiranagar', subtitle: 'East Bengaluru · Cafes & shopping', latitude: 12.9784, longitude: 77.6408 },
        { name: 'Koramangala', subtitle: 'South-East Bengaluru · Startup hub', latitude: 12.9352, longitude: 77.6245 },
        { name: 'Whitefield', subtitle: 'East Bengaluru · Tech parks & gated communities', latitude: 12.9698, longitude: 77.7500 },
        { name: 'HSR Layout', subtitle: 'South Bengaluru · Tree-lined sectors', latitude: 12.9121, longitude: 77.6446 },
        { name: 'Jayanagar', subtitle: 'South Bengaluru · Heritage residential', latitude: 12.9308, longitude: 77.5838 },
    ],
};

const loadGoogleMapsScript = () => {
    if (Platform.OS !== 'web') return Promise.resolve(false);
    if (typeof window !== 'undefined' && window.google?.maps?.places) return Promise.resolve(true);
    if (typeof window !== 'undefined' && window.__googleMapsLoading) return window.__googleMapsLoading;
    if (typeof window === 'undefined' || !API_KEY) return Promise.resolve(false);

    window.__googleMapsLoading = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async&callback=__googleMapsCallback`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        window.__googleMapsCallback = () => resolve(true);
        script.onerror = () => {
            console.warn('[PropertySearchBar] Google Maps JS script failed to load; using local fallback');
            resolve(false);
        };
        document.head.appendChild(script);
    });
    return window.__googleMapsLoading;
};

const PropertySearchBar = ({ value, onChangeText, onSelectPlace, placeholder, city = 'Chennai', onCityPress }) => {
    const [sheetVisible, setSheetVisible] = useState(false);
    const [searchText, setSearchText] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (Platform.OS === 'web') loadGoogleMapsScript();
    }, []);

    useEffect(() => {
        setSearchText(value || '');
    }, [value]);

    useEffect(() => {
        if (!sheetVisible) return undefined;
        const text = searchText.trim();
        if (text.length < 2) {
            setSuggestions([]);
            return undefined;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.google?.maps?.places) {
                    const autocompleteService = new window.google.maps.places.AutocompleteService();
                    autocompleteService.getPlacePredictions({
                        input: text,
                        componentRestrictions: { country: 'in' },
                    }, (predictions, status) => {
                        if (status === 'OK' && predictions && predictions.length > 0) {
                            setSuggestions(predictions);
                        } else {
                            const popular = (POPULAR_LOCALITIES[city] || POPULAR_LOCALITIES.Chennai).filter((p) =>
                                p.name.toLowerCase().includes(text.toLowerCase())
                            );
                            setSuggestions(popular.map((p) => ({
                                place_id: `pop_${p.name}`,
                                description: `${p.name}, ${city}`,
                                latitude: p.latitude,
                                longitude: p.longitude,
                            })));
                        }
                        setLoading(false);
                    });
                    return;
                }

                const popular = (POPULAR_LOCALITIES[city] || POPULAR_LOCALITIES.Chennai).filter((p) =>
                    p.name.toLowerCase().includes(text.toLowerCase())
                );
                setSuggestions(popular.map((p) => ({
                    place_id: `pop_${p.name}`,
                    description: `${p.name}, ${city}`,
                    latitude: p.latitude,
                    longitude: p.longitude,
                })));
                setLoading(false);
            } catch (e) {
                console.warn('[Explore] Autocomplete fetch failed', e?.message);
                setLoading(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [searchText, sheetVisible, city]);

    const handleSelectPrediction = async (prediction) => {
        const description = prediction.description || prediction.name;
        onChangeText(description.split(',')[0]);
        setSheetVisible(false);

        if (prediction.latitude && prediction.longitude) {
            onSelectPlace({
                label: description,
                latitude: prediction.latitude,
                longitude: prediction.longitude,
            });
            return;
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.google?.maps?.places) {
            const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
            placesService.getDetails({ placeId: prediction.place_id, fields: ['geometry'] }, (place, status) => {
                if (status === 'OK' && place?.geometry?.location) {
                    onSelectPlace({
                        label: description,
                        latitude: place.geometry.location.lat(),
                        longitude: place.geometry.location.lng(),
                    });
                }
            });
        }
    };

    const popularList = POPULAR_LOCALITIES[city] || POPULAR_LOCALITIES.Chennai;

    return (
        <View style={styles.container}>
            {/* Primary Floating Search Field */}
            <TouchableOpacity
                style={styles.searchCard}
                onPress={() => setSheetVisible(true)}
                activeOpacity={0.92}
                accessibilityRole="search"
                accessibilityLabel="Search localities in Chennai or Bengaluru"
            >
                <Ionicons name="search" size={20} color={COLORS.secondary} style={styles.searchIcon} />
                <Typography
                    variant="bodyLarge"
                    style={[styles.displayText, !value && styles.placeholderText]}
                    numberOfLines={1}
                >
                    {value ? value : (placeholder || 'Where do you want to live?')}
                </Typography>

                {value ? (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation?.();
                            onChangeText('');
                        }}
                        style={styles.clearBtn}
                        hitSlop={TOUCH_TARGETS.hitSlop}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                    >
                        <Ionicons name="close-circle" size={20} color={COLORS.secondary} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.micIconWrap}>
                        <Ionicons name="options-outline" size={18} color={COLORS.secondary} />
                    </View>
                )}
            </TouchableOpacity>

            {/* Consumer Search Sheet Modal */}
            <Modal
                visible={sheetVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setSheetVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.sheetContainer}>
                        {/* Sheet Header */}
                        <View style={styles.sheetHeader}>
                            <View style={styles.sheetInputRow}>
                                <Ionicons name="search" size={22} color={COLORS.secondary} style={{ marginRight: SPACING.s }} />
                                <TextInput
                                    autoFocus
                                    style={styles.sheetInput}
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    placeholder="Search locality or area..."
                                    placeholderTextColor={COLORS.tertiary}
                                    returnKeyType="search"
                                />
                                {searchText ? (
                                    <TouchableOpacity
                                        onPress={() => setSearchText('')}
                                        style={{ padding: 4 }}
                                        hitSlop={TOUCH_TARGETS.hitSlop}
                                    >
                                        <Ionicons name="close-circle" size={20} color={COLORS.secondary} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <TouchableOpacity
                                onPress={() => setSheetVisible(false)}
                                style={styles.closeBtn}
                                hitSlop={TOUCH_TARGETS.hitSlop}
                                accessibilityLabel="Close search"
                            >
                                <Typography variant="bodyMedium" style={styles.cancelText}>Cancel</Typography>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.sheetBody}
                        >
                            {/* Autocomplete Results */}
                            {loading ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator size="small" color={COLORS.accent} />
                                    <Typography variant="body" style={{ color: COLORS.secondary, marginLeft: SPACING.s }}>
                                        Finding areas...
                                    </Typography>
                                </View>
                            ) : suggestions.length > 0 ? (
                                <View style={styles.sectionWrap}>
                                    <Typography variant="caption" style={styles.sectionTitle}>MATCHING PLACES</Typography>
                                    {suggestions.map((item) => (
                                        <TouchableOpacity
                                            key={item.place_id}
                                            style={styles.localityCard}
                                            onPress={() => handleSelectPrediction(item)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.localityIconWrap}>
                                                <Ionicons name="location-outline" size={20} color={COLORS.accent} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Typography variant="bodyLarge" style={styles.localityName}>
                                                    {item.description}
                                                </Typography>
                                            </View>
                                            <Ionicons name="arrow-forward" size={18} color={COLORS.borderLight} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}

                            {/* Popular Localities Section */}
                            <View style={styles.sectionWrap}>
                                <Typography variant="caption" style={styles.sectionTitle}>
                                    POPULAR IN {city.toUpperCase()}
                                </Typography>
                                {popularList.map((locality) => (
                                    <TouchableOpacity
                                        key={locality.name}
                                        style={styles.localityCard}
                                        onPress={() => handleSelectPrediction(locality)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.localityIconWrap}>
                                            <Ionicons name="navigate-outline" size={20} color={COLORS.accent} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="bodyLarge" style={styles.localityName}>
                                                {locality.name}
                                            </Typography>
                                            <Typography variant="caption" style={styles.localitySubtitle}>
                                                {locality.subtitle}
                                            </Typography>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={COLORS.tertiary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    searchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.l,
        height: 56,
        ...SHADOWS.medium,
    },
    searchIcon: {
        marginRight: SPACING.m,
    },
    displayText: {
        flex: 1,
        color: COLORS.primary,
        fontWeight: '500',
    },
    placeholderText: {
        color: COLORS.secondary,
        fontWeight: '400',
    },
    clearBtn: {
        padding: 4,
        marginLeft: SPACING.xs,
    },
    micIconWrap: {
        padding: 4,
        marginLeft: SPACING.xs,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.sheet,
        borderTopRightRadius: BORDER_RADIUS.sheet,
        maxHeight: '85%',
        paddingTop: SPACING.l,
        ...SHADOWS.floating,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: SPACING.m,
    },
    sheetInputRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        height: 48,
    },
    sheetInput: {
        flex: 1,
        fontSize: 16,
        color: COLORS.primary,
        height: '100%',
    },
    closeBtn: {
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    cancelText: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    sheetBody: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        paddingBottom: SPACING.xxxl,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.l,
    },
    sectionWrap: {
        marginBottom: SPACING.l,
    },
    sectionTitle: {
        letterSpacing: 0.8,
        fontWeight: '700',
        color: COLORS.secondary,
        marginBottom: SPACING.m,
    },
    localityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
        gap: SPACING.m,
    },
    localityIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    localityName: {
        fontWeight: '700',
        color: COLORS.primary,
    },
    localitySubtitle: {
        color: COLORS.secondary,
        marginTop: 2,
    },
});

export default PropertySearchBar;
