import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCATION_CACHE_KEY = 'userLocation';
const CITY_CACHE_KEY = 'cityName';
const DEFAULT_CITY = 'Mumbai';
const DEFAULT_COORDS = { latitude: 19.0760, longitude: 72.8777 };

export const locationService = {
    /**
     * Get current location with platform-specific fallbacks.
     * On WEB: Skips expo-location entirely (it hangs on web) and uses:
     *   1. Browser Geolocation API (native browser, no expo wrapper)
     *   2. IP-based geolocation as fallback
     * On NATIVE: Uses expo-location with high-accuracy GPS.
     */
    getLocation: async () => {
        try {
            if (Platform.OS === 'web') {
                // --- WEB: Use browser Geolocation API directly (no expo-location) ---
                return await locationService._getWebLocation();
            }

            // --- NATIVE: Use expo-location ---
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                console.log('[LocationService] Native permission denied, using default');
                return locationService._defaultFallback();
            }

            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Location timeout')), 8000)
            );

            try {
                const location = await Promise.race([locationPromise, timeoutPromise]);
                const coords = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                };

                await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
                const cityName = await locationService.getCityFromCoords(coords);
                return { coords, cityName, method: 'gps' };

            } catch (err) {
                console.log('[LocationService] Native GPS failed:', err.message);
                return locationService._defaultFallback();
            }
        } catch (error) {
            console.error('[LocationService] Fatal error:', error);
            return await locationService.getFallbackLocation();
        }
    },

    /**
     * Web-specific location: browser Geolocation API → IP API
     */
    _getWebLocation: async () => {
        // 1. Try browser Geolocation API first (if permission already granted)
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            const coordsFromBrowser = await new Promise((resolve) => {
                // Only attempt if we can get a quick answer (500ms max)
                const timer = setTimeout(() => resolve(null), 1500);
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        clearTimeout(timer);
                        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                    },
                    () => {
                        clearTimeout(timer);
                        resolve(null); // Denied or error → go to IP
                    },
                    { timeout: 1000, enableHighAccuracy: false, maximumAge: 60000 }
                );
            });

            if (coordsFromBrowser) {
                console.log('[LocationService] Browser GPS success');
                await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(coordsFromBrowser));
                const cityName = await locationService.getCityFromCoords(coordsFromBrowser);
                return { coords: coordsFromBrowser, cityName, method: 'browser-gps' };
            }
        }

        // 2. Fallback to IP API (always works on web)
        return await locationService.getFallbackLocation();
    },


    /**
     * Reliable fallback: IP-based lookup for Web, Default for Mobile
     */
    getFallbackLocation: async () => {
        // If on web, IP lookup is much more reliable than permission-blocked GPS
        if (Platform.OS === 'web') {
            try {
                console.log('[LocationService] Attempting IP-based location fetch');
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();

                if (data.latitude && data.longitude) {
                    const coords = {
                        latitude: data.latitude,
                        longitude: data.longitude
                    };
                    const cityName = data.city || data.region || DEFAULT_CITY;

                    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
                    await AsyncStorage.setItem(CITY_CACHE_KEY, cityName);

                    return { coords, cityName, method: 'ip' };
                }
            } catch (err) {
                console.log('[LocationService] IP lookup failed:', err);
            }
        }

        // Final fallback (Mumbai)
        return {
            coords: DEFAULT_COORDS,
            cityName: DEFAULT_CITY,
            method: 'default'
        };
    },

    /**
     * Convert coordinates to City name
     * On web: uses reverse geocoding API (expo-location's reverseGeocodeAsync hangs on web)
     * On native: uses expo-location's reverseGeocodeAsync
     */
    getCityFromCoords: async (coords) => {
        try {
            if (Platform.OS === 'web') {
                // Use free reverse geocode API on web
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
                    { headers: { 'Accept-Language': 'en' } }
                );
                const data = await res.json();
                const city = data?.address?.city || data?.address?.town || data?.address?.suburb || data?.address?.state;
                if (city) {
                    await AsyncStorage.setItem(CITY_CACHE_KEY, city);
                    return city;
                }
                return DEFAULT_CITY;
            }

            // Native: use expo-location
            const reverseGeocode = await Location.reverseGeocodeAsync(coords);
            if (reverseGeocode && reverseGeocode.length > 0) {
                const city = reverseGeocode[0].city || reverseGeocode[0].region || reverseGeocode[0].name;
                if (city) {
                    await AsyncStorage.setItem(CITY_CACHE_KEY, city);
                    return city;
                }
            }
        } catch (error) {
            console.log('[LocationService] Reverse geocode failed:', error);
        }
        return DEFAULT_CITY;
    },

    /**
     * Hardcoded default (last resort, no API calls)
     */
    _defaultFallback: () => ({
        coords: DEFAULT_COORDS,
        cityName: DEFAULT_CITY,
        method: 'default'
    }),

    /**
     * Get only the cached location
     */
    getCachedLocation: async () => {
        try {
            const coordsStr = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
            const cityStr = await AsyncStorage.getItem(CITY_CACHE_KEY);
            return {
                coords: coordsStr ? JSON.parse(coordsStr) : null,
                cityName: cityStr || null
            };
        } catch (e) {
            return { coords: null, cityName: null };
        }
    }
};
