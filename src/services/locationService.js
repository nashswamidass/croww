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

            // --- NATIVE: Check existing permission status ONLY (no dialog) ---
            // CRITICAL: Never call requestForegroundPermissionsAsync() in the background
            // init flow on iPadOS — the system permission sheet blocks ALL app touches
            // even after a JS-side timeout. We check existing permission silently and
            // fall back to defaults if not already granted.
            let status;
            try {
                const permCheckTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Permission check timeout')), 3000)
                );
                const result = await Promise.race([
                    Location.getForegroundPermissionsAsync(),
                    permCheckTimeout
                ]);
                status = result.status;
            } catch (err) {
                console.log('[LocationService] Permission check timed out:', err.message);
                return locationService._defaultFallback();
            }

            if (status !== 'granted') {
                // Not granted — return default immediately, no dialog shown
                console.log('[LocationService] Permission not yet granted, using default');
                return locationService._defaultFallback();
            }

            // Permission already granted — safe to get GPS (no dialog needed)
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Location timeout')), 5000)
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
                console.log('[LocationService] Native GPS failed or timed out:', err.message);
                try {
                    const lastKnownTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Last known location timeout')), 3000)
                    );
                    const lastKnown = await Promise.race([
                        Location.getLastKnownPositionAsync(),
                        lastKnownTimeout
                    ]);
                    if (lastKnown) {
                        const coords = {
                            latitude: lastKnown.coords.latitude,
                            longitude: lastKnown.coords.longitude
                        };
                        await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
                        const cityName = await locationService.getCityFromCoords(coords);
                        return { coords, cityName, method: 'last-known-gps' };
                    }
                } catch (fallbackErr) {
                    console.log('[LocationService] Last known position also failed:', fallbackErr.message);
                }

                return locationService._defaultFallback();
            }
        } catch (error) {
            console.error('[LocationService] Fatal error:', error);
            return locationService._defaultFallback();
        }
    },

    /**
     * Explicitly request location permission (call this only from a user-initiated action,
     * e.g. a button press — NEVER from an automatic background init flow on iOS).
     */
    requestPermissionExplicitly: async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            return status === 'granted';
        } catch (e) {
            console.log('[LocationService] Permission request failed:', e.message);
            return false;
        }
    },

    /**
     * Web-specific location: browser Geolocation API → IP API
     */
    _getWebLocation: async () => {
        // 1. Try browser Geolocation API first (if permission already granted)
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            const coordsFromBrowser = await new Promise((resolve) => {
                // Give the user up to 15 seconds to accept permissions before falling back
                const timer = setTimeout(() => resolve(null), 15000);
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        clearTimeout(timer);
                        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                    },
                    () => {
                        clearTimeout(timer);
                        resolve(null); // Denied or error → go to IP
                    },
                    { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
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
                const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || window?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
                if (apiKey) {
                    const res = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${apiKey}`
                    );
                    const data = await res.json();
                    if (data.status === 'OK' && data.results && data.results.length > 0) {
                        const addressComponents = data.results[0].address_components;
                        const cityComponent = addressComponents.find(c => c.types.includes('locality')) ||
                                              addressComponents.find(c => c.types.includes('administrative_area_level_2'));
                        if (cityComponent) {
                            const city = cityComponent.long_name;
                            await AsyncStorage.setItem(CITY_CACHE_KEY, city);
                            return city;
                        }
                    }
                }
                
                // Fallback if Google Maps fails or no key (BigDataCloud is free client-side reverse geocoding with CORS)
                try {
                    const res = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
                    );
                    const data = await res.json();
                    const city = data.city || data.locality;
                    if (city) {
                        await AsyncStorage.setItem(CITY_CACHE_KEY, city);
                        return city;
                    }
                } catch (e) {
                    console.log('Fallback geocoding failed', e);
                }
                
                return DEFAULT_CITY;
            }

            // Native: use expo-location
            const reverseTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Reverse geocode timeout')), 5000)
            );
            const reverseGeocode = await Promise.race([
                Location.reverseGeocodeAsync(coords),
                reverseTimeout
            ]);
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
