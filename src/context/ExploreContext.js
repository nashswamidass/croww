import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LAUNCH_CITY_NAME, LAUNCH_VIEWPORT } from '../constants/explore';
import { CITY_COORDINATES } from '../constants/location';

/**
 * Shared Explore state. Query results stay in useExploreDiscovery, not here.
 *
 * USER LOCATION ≠ SEARCH LOCATION ≠ MAP VIEWPORT ≠ FILTERS ≠ SELECTED RESULT
 */
export const DEFAULT_EXPLORE_FILTERS = {
    transactionType: 'buy',
    category: null,
    subtype: null,
    bhk: null,
    minPrice: null,
    maxPrice: null,
};

const ExploreContext = createContext(null);

export const ExploreProvider = ({ children }) => {
    const [city, setCity] = useState(LAUNCH_CITY_NAME);
    const [localityId, setLocalityId] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [searchLocation, setSearchLocation] = useState(null);
    const [viewport, setViewport] = useState(LAUNCH_VIEWPORT);
    const [filters, setFiltersState] = useState(DEFAULT_EXPLORE_FILTERS);
    const [selectedListingId, setSelectedListingId] = useState(null);
    const [focusRegion, setFocusRegion] = useState(null);
    const [isIntelligenceMode, setIntelligenceMode] = useState(false);

    const setFilters = useCallback((patch) => {
        setFiltersState((prev) => {
            const next = { ...prev, ...patch };
            if (patch.category !== undefined && patch.category !== prev.category && patch.subtype === undefined) {
                next.subtype = null;
            }
            return next;
        });
    }, []);

    const clearExploreState = useCallback(() => {
        setCity(LAUNCH_CITY_NAME);
        setLocalityId(null);
        setUserLocation(null);
        setSearchLocation(null);
        setViewport(LAUNCH_VIEWPORT);
        setFiltersState(DEFAULT_EXPLORE_FILTERS);
        setSelectedListingId(null);
        setFocusRegion(null);
        setIntelligenceMode(false);
    }, []);

    const applySavedSearch = useCallback((search = {}) => {
        const loc = search.location || {};
        const nextFilters = { ...DEFAULT_EXPLORE_FILTERS, ...(search.filters || {}) };
        if (loc.city) setCity(loc.city);
        setLocalityId(loc.localityId || null);
        setFiltersState(nextFilters);
        if (loc.viewport && Number.isFinite(loc.viewport.latitude) && Number.isFinite(loc.viewport.longitude)) {
            const region = {
                latitude: loc.viewport.latitude,
                longitude: loc.viewport.longitude,
                latitudeDelta: loc.viewport.latitudeDelta || 0.045,
                longitudeDelta: loc.viewport.longitudeDelta || 0.045,
            };
            setViewport(region);
            setFocusRegion({ ...region, nonce: Date.now() });
            setSearchLocation({
                label: loc.searchLabel || search.name || 'Saved search',
                latitude: region.latitude,
                longitude: region.longitude,
            });
        } else {
            setSearchLocation(loc.searchLabel ? { label: loc.searchLabel } : null);
        }
        setSelectedListingId(null);
    }, []);

    const focusLocality = useCallback((input = {}) => {
        const viewport = input.viewport;
        if (input.id) setLocalityId(input.id);
        if (input.city) setCity(input.city);
        if (viewport && Number.isFinite(viewport.latitude) && Number.isFinite(viewport.longitude)) {
            const region = {
                latitude: viewport.latitude,
                longitude: viewport.longitude,
                latitudeDelta: viewport.latitudeDelta || 0.045,
                longitudeDelta: viewport.longitudeDelta || 0.045,
            };
            setViewport(region);
            setFocusRegion({ ...region, nonce: Date.now() });
            setSearchLocation({
                label: input.name || 'Area',
                latitude: region.latitude,
                longitude: region.longitude,
            });
        }
        setSelectedListingId(null);
    }, []);

    const selectCity = useCallback(async (newCity) => {
        if (!newCity) return;
        setCity(newCity);
        setLocalityId(null);
        setSearchLocation(null);
        try {
            await AsyncStorage.setItem('selectedCity', newCity);
        } catch (_) {}
        const coords = CITY_COORDINATES[newCity];
        if (coords) {
            const isBengaluru = newCity === 'Bengaluru' || newCity === 'Bangalore';
            const nextViewport = {
                latitude: coords.latitude,
                longitude: isBengaluru ? 77.6800 : coords.longitude,
                latitudeDelta: isBengaluru ? 0.22 : 0.12,
                longitudeDelta: isBengaluru ? 0.26 : 0.12,
            };
            setViewport(nextViewport);
            setFocusRegion({ ...nextViewport, nonce: Date.now() });
        }
        setSelectedListingId(null);
    }, []);

    const value = useMemo(() => ({
        city,
        localityId,
        userLocation,
        searchLocation,
        viewport,
        filters,
        selectedListingId,
        focusRegion,
        setCity,
        selectCity,
        setLocalityId,
        setUserLocation,
        setSearchLocation,
        setViewport,
        setFilters,
        setSelectedListingId,
        clearExploreState,
        focusLocality,
        applySavedSearch,
        isIntelligenceMode,
        setIntelligenceMode,
    }), [
        city,
        localityId,
        userLocation,
        searchLocation,
        viewport,
        filters,
        selectedListingId,
        focusRegion,
        selectCity,
        setFilters,
        clearExploreState,
        focusLocality,
        applySavedSearch,
        isIntelligenceMode,
        setIntelligenceMode,
    ]);

    return (
        <ExploreContext.Provider value={value}>
            {children}
        </ExploreContext.Provider>
    );
};

export const useExplore = () => {
    const ctx = useContext(ExploreContext);
    if (!ctx) {
        throw new Error('useExplore must be used within ExploreProvider');
    }
    return ctx;
};
