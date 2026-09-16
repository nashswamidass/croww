import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import PropertyMap from '../../components/property/PropertyMap';
import PropertySearchBar from '../../components/property/PropertySearchBar';
import PropertyFilters from '../../components/property/PropertyFilters';
import PropertyResultCard from '../../components/property/PropertyResultCard';
import SaveSearchModal from '../../components/property/saved/SaveSearchModal';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import { useAuth } from '../../context/AuthContext';
import { useExplore } from '../../context/ExploreContext';
import { useExploreLocation } from '../../hooks/useExploreLocation';
import { useExploreDiscovery } from '../../hooks/useExploreDiscovery';
import { savedSearchService } from '../../services/property';
import { showAlert } from '../../utils/showAlert';
import { LAUNCH_VIEWPORT } from '../../constants/explore';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import CrowwRive from '../../components/rive/CrowwRive';
import { EMPTY_STATES_RIVE_SPEC } from '../../components/rive/specs/emptyStates.spec';

const ExploreScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const {
        viewport,
        setViewport,
        filters,
        setFilters,
        selectedListingId,
        setSelectedListingId,
        setSearchLocation,
        searchLocation,
        city,
        selectCity,
        localityId,
        focusLocality,
        focusRegion,
    } = useExplore();
    const { userLocation, requestLocation, status: locationStatus } = useExploreLocation();
    const { results, error, loading, refreshing } = useExploreDiscovery();
    const [query, setQuery] = useState('');
    const [followRegion, setFollowRegion] = useState(null);
    const { user } = useAuth();
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const canSaveSearch = savedSearchService.isMeaningful({
        city,
        localityId,
        searchLocation,
        viewport,
        filters,
    });
    const draftSearch = savedSearchService.canonicalizeFromExplore({
        city,
        localityId,
        searchLocation,
        viewport,
        filters,
    });

    useEffect(() => {
        if (route.params?.city && route.params.city !== city) {
            selectCity(route.params.city);
        }
        if (route.params?.localityId) {
            focusLocality({
                id: route.params.localityId,
                name: route.params.localityName,
                viewport: route.params.viewport,
                city: route.params.city,
            });
        }
    }, [route.params, selectCity, focusLocality, city]);

    useEffect(() => {
        if (!focusRegion) return;
        setFollowRegion({
            latitude: focusRegion.latitude,
            longitude: focusRegion.longitude,
            latitudeDelta: focusRegion.latitudeDelta,
            longitudeDelta: focusRegion.longitudeDelta,
        });
    }, [focusRegion]);

    const initialRegion = viewport || LAUNCH_VIEWPORT;

    const displayedResults = useMemo(() => {
        if (!query || !query.trim()) return results;
        const q = query.trim().toLowerCase();
        return results.filter((r) =>
            (r.title && r.title.toLowerCase().includes(q))
            || (r.localityName && r.localityName.toLowerCase().includes(q))
            || (r.cityName && r.cityName.toLowerCase().includes(q))
            || (r.address && r.address.toLowerCase().includes(q))
        );
    }, [results, query]);

    const userCoordinate = useMemo(() => {
        if (!userLocation || userLocation.method === 'launch-city') return null;
        return { latitude: userLocation.latitude, longitude: userLocation.longitude };
    }, [userLocation]);

    const onRegionChangeComplete = useCallback((region) => {
        if (!region) return;
        setViewport((prev) => {
            if (prev
                && Math.abs(prev.latitude - region.latitude) < 0.0004
                && Math.abs(prev.longitude - region.longitude) < 0.0004
                && Math.abs(prev.latitudeDelta - region.latitudeDelta) < 0.004
                && Math.abs(prev.longitudeDelta - region.longitudeDelta) < 0.004
            ) {
                return prev;
            }
            return {
                latitude: region.latitude,
                longitude: region.longitude,
                latitudeDelta: region.latitudeDelta,
                longitudeDelta: region.longitudeDelta,
            };
        });
    }, [setViewport]);

    const openListing = useCallback((item) => {
        setSelectedListingId(item.listingId);
        navigation.navigate('Listing', { listingId: item.listingId });
    }, [navigation, setSelectedListingId]);

    const onSelectMarker = useCallback((item) => {
        setSelectedListingId(item.listingId);
    }, [setSelectedListingId]);

    const onSelectCard = useCallback((item) => {
        setSelectedListingId(item.listingId);
        if (item.mapCoordinate) {
            setFollowRegion({
                ...item.mapCoordinate,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            });
        }
    }, [setSelectedListingId]);

    const onSearchPlace = useCallback((place) => {
        setSearchLocation(place);
        const next = {
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
        };
        setViewport(next);
        setFollowRegion(next);
        setSelectedListingId(null);
    }, [setSearchLocation, setViewport, setSelectedListingId]);

    const goToMe = useCallback(async () => {
        const coords = await requestLocation();
        if (coords?.latitude) {
            const next = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
            };
            setViewport(next);
            setFollowRegion(next);
        }
    }, [requestLocation, setViewport]);

    const onSaveSearch = useCallback(async ({ name, alertEnabled }) => {
        setSaveBusy(true);
        setSaveError(null);
        try {
            const result = await savedSearchService.createFromExplore({
                city,
                localityId,
                searchLocation,
                viewport,
                filters,
                name,
                alertEnabled,
            });
            if (result.status === 'duplicate') {
                setSaveOpen(false);
                showAlert('Search already saved', 'You already saved these filters.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Open',
                        onPress: () => navigation.navigate('SavedSearch', {
                            searchId: result.search.id,
                            search: result.search,
                        }),
                    },
                ]);
                return;
            }
            setSaveOpen(false);
            showAlert('Search saved', alertEnabled
                ? 'Alerts are on for newly published matches.'
                : 'Saved. You can turn on alerts later.');
        } catch (err) {
            setSaveError(err?.message || 'Could not save search.');
        } finally {
            setSaveBusy(false);
        }
    }, [city, localityId, searchLocation, viewport, filters, navigation]);

    const emptyMessage = error
        ? error
        : loading
            ? null
            : displayedResults.length === 0
                ? (filters.category || filters.bhk || filters.minPrice || query.trim()
                    ? 'No properties match these filters in view.'
                    : `No published properties in this part of ${city || 'the city'} yet.`)
                : null;

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.root}>
                {/* 1. Map Canvas occupying 75-80% viewport */}
                <View style={styles.mapCanvas}>
                    <PropertyMap
                        initialRegion={initialRegion}
                        followRegion={followRegion}
                        listings={displayedResults}
                        selectedId={selectedListingId}
                        userCoordinate={userCoordinate}
                        onSelect={onSelectMarker}
                        onRegionChangeComplete={onRegionChangeComplete}
                        onMapPress={() => setSelectedListingId(null)}
                    />
                </View>

                {/* 2. Floating Top Search & Refinement Island */}
                <View style={styles.floatingTop} pointerEvents="box-none">
                    <View style={styles.searchRow}>
                        <View style={{ flex: 1 }}>
                            <PropertySearchBar
                                value={query}
                                onChangeText={setQuery}
                                onSelectPlace={onSearchPlace}
                                city={city || 'Chennai'}
                            />
                        </View>
                        {/* City Switcher Pill */}
                        <TouchableOpacity
                            onPress={() => {
                                const nextCity = (city === 'Chennai') ? 'Bengaluru' : 'Chennai';
                                selectCity(nextCity);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Current city: ${city}. Tap to switch.`}
                            style={styles.cityPill}
                            hitSlop={TOUCH_TARGETS.hitSlop}
                        >
                            <Typography variant="caption" style={styles.cityPillText}>
                                {city === 'Chennai' ? 'CHN' : 'BLR'} ▾
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {/* Quick Filters: Buy / Rent / Commercial + BHK & Budget */}
                    <PropertyFilters
                        filters={filters}
                        onChange={setFilters}
                        resultCount={displayedResults.length}
                    />
                </View>

                {/* 3. Floating Map Controls (Locate Me & Save Alert) */}
                <View style={styles.floatingControls} pointerEvents="box-none">
                    {refreshing ? (
                        <View style={styles.refreshBadge}>
                            <ActivityIndicator size="small" color={COLORS.accent} />
                            <Typography variant="micro" style={styles.refreshText}>Updating</Typography>
                        </View>
                    ) : null}

                    {canSaveSearch ? (
                        <TouchableOpacity
                            onPress={() => {
                                if (!user) {
                                    setAuthModalVisible(true);
                                    return;
                                }
                                setSaveError(null);
                                setSaveOpen(true);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Save search"
                            style={styles.floatingSaveBtn}
                            hitSlop={TOUCH_TARGETS.hitSlop}
                        >
                            <Ionicons name="bookmark-outline" size={18} color={COLORS.accent} />
                            <Typography variant="caption" style={styles.floatingSaveText}>Save</Typography>
                        </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                        style={styles.recenterBtn}
                        onPress={goToMe}
                        accessibilityRole="button"
                        accessibilityLabel="Center on my location"
                        hitSlop={TOUCH_TARGETS.hitSlop}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="locate" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                {/* 4. Floating Bottom Property Card Carousel */}
                <View style={styles.floatingBottom} pointerEvents="box-none">
                    {emptyMessage ? (
                        <View style={styles.emptyCard} pointerEvents="auto">
                            <CrowwRive
                                artboard={EMPTY_STATES_RIVE_SPEC.artboards.discovery}
                                artboardName={EMPTY_STATES_RIVE_SPEC.artboards.discovery}
                                stateMachineName={EMPTY_STATES_RIVE_SPEC.stateMachine}
                                inputs={{ isActive: true }}
                                fallbackType="empty-discovery"
                                fallbackSize={48}
                                style={{ width: 48, height: 48, marginBottom: 6 }}
                            />
                            <Typography variant="titleSmall" style={styles.emptyTitle}>
                                {emptyMessage}
                            </Typography>
                            <Typography variant="caption" style={styles.emptySubtitle}>
                                Pan the map or switch city to discover verified homes.
                            </Typography>
                            <View style={styles.emptyActionRow}>
                                <TouchableOpacity
                                    onPress={() => {
                                        const nextCity = (city === 'Chennai') ? 'Bengaluru' : 'Chennai';
                                        selectCity(nextCity);
                                    }}
                                    style={styles.switchCityBtn}
                                    hitSlop={TOUCH_TARGETS.hitSlop}
                                >
                                    <Typography variant="bodyMedium" style={styles.switchCityText}>
                                        Explore {city === 'Chennai' ? 'Bengaluru' : 'Chennai'}
                                    </Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.carouselContainer} pointerEvents="box-none">
                            <FlatList
                                horizontal
                                data={displayedResults}
                                keyExtractor={(item) => item.listingId}
                                renderItem={({ item }) => (
                                    <PropertyResultCard
                                        item={item}
                                        selected={item.listingId === selectedListingId}
                                        onPress={() => {
                                            onSelectCard(item);
                                            openListing(item);
                                        }}
                                    />
                                )}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.cardsList}
                                extraData={selectedListingId}
                                snapToAlignment="center"
                                decelerationRate="fast"
                            />
                        </View>
                    )}
                </View>
            </View>

            <SaveSearchModal
                visible={saveOpen}
                defaultName={draftSearch.name}
                busy={saveBusy}
                error={saveError}
                onClose={() => setSaveOpen(false)}
                onSave={onSaveSearch}
            />

            <AuthPromptModal
                visible={authModalVisible}
                onClose={() => setAuthModalVisible(false)}
                navigation={navigation}
                title="Save this search"
                subtitle="Sign in to save your search filters and receive instant alerts for new listings."
                icon="bookmark-outline"
                actionContext="save_search"
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        position: 'relative',
        backgroundColor: COLORS.background,
    },
    mapCanvas: {
        ...StyleSheet.absoluteFillObject,
    },
    floatingTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        paddingTop: SPACING.s,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        gap: SPACING.s,
    },
    cityPill: {
        backgroundColor: COLORS.surface,
        height: 56,
        paddingHorizontal: SPACING.m,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.medium,
    },
    cityPillText: {
        color: COLORS.primary,
        fontWeight: '800',
    },
    floatingControls: {
        position: 'absolute',
        right: SPACING.l,
        bottom: 270,
        zIndex: 20,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: SPACING.s,
    },
    recenterBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.floating,
    },
    floatingSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.round,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 6,
        ...SHADOWS.soft,
    },
    floatingSaveText: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    refreshBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.round,
        gap: 6,
        ...SHADOWS.subtle,
    },
    refreshText: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    floatingBottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: SPACING.m,
        zIndex: 25,
    },
    carouselContainer: {
        paddingVertical: SPACING.xs,
    },
    cardsList: {
        paddingHorizontal: SPACING.l,
        gap: SPACING.m,
    },
    emptyCard: {
        marginHorizontal: SPACING.l,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.l,
        alignItems: 'center',
        textAlign: 'center',
        ...SHADOWS.floating,
    },
    emptyTitle: {
        color: COLORS.primary,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: SPACING.xs,
        marginBottom: 2,
    },
    emptySubtitle: {
        color: COLORS.secondary,
        textAlign: 'center',
        marginBottom: SPACING.m,
    },
    emptyActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    switchCityBtn: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.round,
        minHeight: 44,
        justifyContent: 'center',
    },
    switchCityText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default ExploreScreen;
