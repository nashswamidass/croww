import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Image,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { useExplore } from '../../context/ExploreContext';
import { useAuth } from '../../context/AuthContext';
import { useGooglePlacesAutocomplete } from '../GooglePlacesInput';

export default function DesktopTopBar({ style }) {
    const navigation = useNavigation();
    const {
        city,
        selectCity,
        searchLocation,
        setSearchLocation,
        setViewport,
        setFocusRegion,
        setSelectedListingId,
    } = useExplore();
    const { user } = useAuth();

    const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

    const handlePlaceSelected = useCallback((place) => {
        const label = place.formatted_address || place.name || place.label || place.description;
        const placeData = {
            label,
            name: place.name || label,
            placeId: place.place_id || place.placeId,
            place_id: place.place_id || place.placeId,
            latitude: place.latitude ?? place.coordinate?.latitude,
            longitude: place.longitude ?? place.coordinate?.longitude,
            formatted_address: place.formatted_address || label,
            formattedAddress: place.formatted_address || label,
        };
        setSearchLocation(placeData);

        if (placeData.latitude && placeData.longitude) {
            const nextRegion = {
                latitude: placeData.latitude,
                longitude: placeData.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            };
            setViewport(nextRegion);
            setFocusRegion({ ...nextRegion, nonce: Date.now() });
        }
        if (setSelectedListingId) {
            setSelectedListingId(null);
        }

        navigation.navigate('Tabs', { screen: 'Explore' });
    }, [navigation, setFocusRegion, setSearchLocation, setSelectedListingId, setViewport]);

    const {
        query: searchQuery,
        setQuery: setSearchQuery,
        suggestions,
        loading: searchLoading,
        showSuggestions,
        setShowSuggestions,
        handleSelect,
        clearSearch,
    } = useGooglePlacesAutocomplete({
        initialValue: searchLocation?.label || '',
        onSelect: handlePlaceSelected,
    });

    useEffect(() => {
        if (searchLocation?.label && searchLocation.label !== searchQuery) {
            setSearchQuery(searchLocation.label);
        } else if (!searchLocation && searchQuery) {
            setSearchQuery('');
        }
    }, [searchLocation]);

    const handleSelectCity = useCallback((targetCity) => {
        selectCity(targetCity);
        setCityDropdownOpen(false);
    }, [selectCity]);

    const handleSearchSubmit = useCallback(() => {
        if (suggestions.length > 0) {
            handleSelect(suggestions[0].place_id, suggestions[0].description);
            return;
        }
        const q = searchQuery.trim();
        if (!q) {
            setSearchLocation(null);
            return;
        }
        setSearchLocation({ label: q });
        setShowSuggestions(false);
    }, [suggestions, handleSelect, searchQuery, setSearchLocation, setShowSuggestions]);

    const handleClearSearch = useCallback(() => {
        clearSearch();
        setSearchLocation(null);
    }, [clearSearch, setSearchLocation]);

    const userInitial = (user?.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

    return (
        <header style={{ width: '100%' }}>
            <View style={[styles.container, style]}>
                {/* 1. Left: Brand Logo & City Selector */}
                <View style={styles.leftSection}>
                    <TouchableOpacity
                        style={styles.brandContainer}
                        onPress={() => navigation.navigate('Tabs', { screen: 'Explore' })}
                        accessibilityRole="link"
                        accessibilityLabel="Croww Home"
                        activeOpacity={0.85}
                    >
                        <Image
                            source={require('../../../assets/croww-logo.png')}
                            style={styles.brandLogo}
                            resizeMode="contain"
                            accessibilityLabel="Croww"
                        />
                        <View style={styles.brandDot} />
                    </TouchableOpacity>

                    {/* City Selector Pill with Dropdown */}
                    <View style={styles.cityWrapper}>
                        <TouchableOpacity
                            style={styles.cityPill}
                            onPress={() => setCityDropdownOpen(!cityDropdownOpen)}
                            accessibilityRole="button"
                            accessibilityLabel={`Selected city: ${city || 'Chennai'}`}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="location-sharp" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
                            <Text style={styles.cityText}>{city || 'Chennai'}</Text>
                            <Ionicons
                                name={cityDropdownOpen ? "chevron-up" : "chevron-down"}
                                size={13}
                                color={COLORS.secondary}
                                style={{ marginLeft: 5 }}
                            />
                        </TouchableOpacity>

                        {cityDropdownOpen && (
                            <View style={styles.cityDropdown}>
                                <TouchableOpacity
                                    style={[styles.cityDropdownItem, city === 'Chennai' && styles.cityDropdownItemActive]}
                                    onPress={() => handleSelectCity('Chennai')}
                                >
                                    <Text style={[styles.cityDropdownText, city === 'Chennai' && styles.cityDropdownTextActive]}>
                                        Chennai
                                    </Text>
                                    {city === 'Chennai' && (
                                        <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.cityDropdownItem, (city === 'Bengaluru' || city === 'Bangalore') && styles.cityDropdownItemActive]}
                                    onPress={() => handleSelectCity('Bengaluru')}
                                >
                                    <Text style={[styles.cityDropdownText, (city === 'Bengaluru' || city === 'Bangalore') && styles.cityDropdownTextActive]}>
                                        Bengaluru
                                    </Text>
                                    {(city === 'Bengaluru' || city === 'Bangalore') && (
                                        <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* 2. Center: Global Search Bar with Autocomplete Suggestions */}
                <View style={styles.centerSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={`Search localities, landmarks, stays in ${city || 'Chennai'}...`}
                            placeholderTextColor={COLORS.tertiary}
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                setShowSuggestions(true);
                            }}
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
                        />
                        {searchLoading && (
                            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
                        )}
                        {searchQuery.length > 0 ? (
                            <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close-circle" size={16} color={COLORS.secondary} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {showSuggestions && suggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            {suggestions.slice(0, 6).map((item) => (
                                <TouchableOpacity
                                    key={item.place_id}
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelect(item.place_id, item.description)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="location-outline" size={15} color={COLORS.secondary} style={{ marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                                            {item.description.split(',')[0]}
                                        </Text>
                                        <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                                            {item.description}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* 3. Right: Notifications & Profile/Settings */}
                <View style={styles.rightSection}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.navigate('Notifications')}
                        accessibilityRole="button"
                        accessibilityLabel="Notifications"
                        activeOpacity={0.8}
                    >
                        <Ionicons name="notifications-outline" size={19} color={COLORS.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => navigation.navigate('Settings')}
                        accessibilityRole="button"
                        accessibilityLabel="Profile and Settings"
                        activeOpacity={0.85}
                    >
                        {user?.photoURL || user?.profileImage || user?.avatar ? (
                            <Image
                                source={{ uri: user.photoURL || user.profileImage || user.avatar }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitial}>{userInitial}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </header>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 60,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        zIndex: 100,
        ...SHADOWS.subtle,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.l,
        minWidth: 260,
    },
    brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandLogo: {
        width: 82,
        height: 26,
    },
    brandDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
        marginLeft: 5,
        marginTop: 2,
    },
    cityWrapper: {
        position: 'relative',
        zIndex: 110,
    },
    cityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cityText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primary,
    },
    cityDropdown: {
        position: 'absolute',
        top: 38,
        left: 0,
        width: 140,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 4,
        ...SHADOWS.card,
        zIndex: 120,
    },
    cityDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    cityDropdownItemActive: {
        backgroundColor: COLORS.surfaceHighlight,
    },
    cityDropdownText: {
        fontSize: 13,
        color: COLORS.secondary,
        fontWeight: '500',
    },
    cityDropdownTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    centerSection: {
        flex: 1,
        maxWidth: 580,
        marginHorizontal: SPACING.l,
        position: 'relative',
        zIndex: 1000,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.pill,
        paddingHorizontal: 14,
        height: 38,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: COLORS.primary,
        paddingVertical: 0,
        outlineStyle: 'none',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: 44,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.card,
        zIndex: 2000,
        elevation: 8,
        overflow: 'hidden',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    suggestionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
    suggestionSubtitle: {
        fontSize: 11,
        color: COLORS.secondary,
        marginTop: 1,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.m,
        minWidth: 120,
        justifyContent: 'flex-end',
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    profileButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
