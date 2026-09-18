import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationService } from '../services/locationService';
import { LAUNCH_CITY_NAME, LAUNCH_COORDINATES, LAUNCH_VIEWPORT } from '../constants/explore';
import { CITY_COORDINATES } from '../constants/location';
import { useExplore } from '../context/ExploreContext';

const MUMBAI_DEFAULT = { latitude: 19.076, longitude: 72.8777 };

function isLegacyMumbaiDefault(coords) {
    if (!coords) return false;
    return Math.abs(coords.latitude - MUMBAI_DEFAULT.latitude) < 0.0002
        && Math.abs(coords.longitude - MUMBAI_DEFAULT.longitude) < 0.0002;
}

function isWithinIndia(coords) {
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') return false;
    return coords.latitude >= 6.5 && coords.latitude <= 37.5
        && coords.longitude >= 68.0 && coords.longitude <= 97.5;
}

function toViewport(coords, delta = 0.08) {
    return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
    };
}

/**
 * Acquire GPS for Explore without using locationService's Mumbai default.
 * Location resolution hierarchy:
 * 1. Selected / search locality when one exists
 * 2. User's selected city (from preferences, route, or AsyncStorage)
 * 3. Product's intended default city (Chennai)
 */
export function useExploreLocation() {
    const { userLocation, setUserLocation, setCity, setViewport, city, searchLocation } = useExplore();
    const [status, setStatus] = useState('idle');
    const [usingLaunchCity, setUsingLaunchCity] = useState(false);
    const centeredRef = useRef(false);

    const applyDefaultLocation = useCallback(async (permission) => {
        // 1. If searchLocation already exists with valid coords, preserve it
        if (searchLocation?.latitude && searchLocation?.longitude) {
            setUsingLaunchCity(false);
            return;
        }

        // 2. Check for user's selected city
        let candidateCity = null;
        if (city && city !== LAUNCH_CITY_NAME) {
            candidateCity = city;
        } else {
            try {
                candidateCity = (await AsyncStorage.getItem('selectedCity'))
                    || (await AsyncStorage.getItem('manualCity'))
                    || (await AsyncStorage.getItem('cityName'));
            } catch (_) {}
        }

        if (candidateCity && CITY_COORDINATES[candidateCity]) {
            const coords = CITY_COORDINATES[candidateCity];
            const isBengaluru = candidateCity === 'Bengaluru' || candidateCity === 'Bangalore';
            setUsingLaunchCity(false);
            setCity(candidateCity);
            setUserLocation({
                latitude: coords.latitude,
                longitude: coords.longitude,
                cityName: candidateCity,
                method: 'selected-city',
                permission,
            });
            if (!centeredRef.current) {
                setViewport({
                    latitude: coords.latitude,
                    longitude: isBengaluru ? 77.6800 : coords.longitude,
                    latitudeDelta: isBengaluru ? 0.22 : 0.12,
                    longitudeDelta: isBengaluru ? 0.26 : 0.12,
                });
                centeredRef.current = true;
            }
            return;
        }

        // 3. Fall back to product's intended launch city (Chennai)
        setUsingLaunchCity(true);
        setCity(LAUNCH_CITY_NAME);
        setUserLocation({
            latitude: LAUNCH_COORDINATES.latitude,
            longitude: LAUNCH_COORDINATES.longitude,
            cityName: LAUNCH_CITY_NAME,
            method: 'launch-city',
            permission,
        });
        if (!centeredRef.current) {
            setViewport(LAUNCH_VIEWPORT);
            centeredRef.current = true;
        }
    }, [city, searchLocation, setCity, setUserLocation, setViewport]);

    const applyCoords = useCallback(async (coords, method, permission) => {
        if (!isWithinIndia(coords)) {
            await applyDefaultLocation(permission);
            return;
        }
        setUsingLaunchCity(false);
        let cityName = null;
        try {
            cityName = await locationService.getCityFromCoords(coords);
        } catch (_e) {
            cityName = null;
        }
        if (cityName && cityName !== 'Mumbai') {
            setCity(cityName);
        } else if (cityName === 'Mumbai' && (method === 'gps' || method === 'browser-gps' || method === 'last-known-gps')) {
            setCity(cityName);
        }
        setUserLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            cityName: cityName || null,
            method,
            permission,
        });
        if (!centeredRef.current) {
            setViewport(toViewport(coords, 0.08));
            centeredRef.current = true;
        }
    }, [applyDefaultLocation, setCity, setUserLocation, setViewport]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setStatus('loading');
            try {
                const cached = await locationService.getCachedLocation();
                if (!cancelled && cached.coords && !isLegacyMumbaiDefault(cached.coords) && isWithinIndia(cached.coords)) {
                    await applyCoords(cached.coords, 'cache', 'unknown');
                    setStatus('ready');
                }

                const result = await locationService.getLocation();
                if (cancelled) return;

                if (!result || result.method === 'default' || !isWithinIndia(result?.coords)) {
                    await applyDefaultLocation(cached?.coords && isWithinIndia(cached.coords) ? 'unknown' : 'denied');
                    setStatus('ready');
                    return;
                }

                if (result.coords) {
                    const permission = (result.method === 'gps' || result.method === 'browser-gps')
                        ? 'granted'
                        : 'unknown';
                    await applyCoords(result.coords, result.method, permission);
                } else {
                    await applyDefaultLocation('denied');
                }
                setStatus('ready');
            } catch (err) {
                console.warn('[Explore] location failed', err?.message);
                if (!cancelled) {
                    await applyDefaultLocation('denied');
                    setStatus('ready');
                }
            }
        };
        run();
        return () => { cancelled = true; };
    }, [applyCoords, applyDefaultLocation]);

    const requestLocation = useCallback(async () => {
        setStatus('loading');
        try {
            const granted = await locationService.requestPermissionExplicitly();
            if (!granted) {
                await applyDefaultLocation('denied');
                setStatus('ready');
                return null;
            }
            const result = await locationService.getLocation();
            if (result?.coords && result.method !== 'default' && isWithinIndia(result.coords)) {
                centeredRef.current = false;
                await applyCoords(result.coords, result.method || 'gps', 'granted');
                setStatus('ready');
                return result.coords;
            }
            await applyDefaultLocation('denied');
            setStatus('ready');
            return null;
        } catch (_e) {
            await applyDefaultLocation('denied');
            setStatus('ready');
            return null;
        }
    }, [applyCoords, applyDefaultLocation]);

    return {
        userLocation,
        status,
        usingLaunchCity,
        requestLocation,
    };
}
