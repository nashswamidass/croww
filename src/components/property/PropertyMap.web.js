import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { EXPLORE_MAX_MARKERS } from '../../constants/explore';
import { formatListingPrice } from '../../utils/propertyFormat';
import { COLORS } from '../../constants/theme';
import Typography from '../Typography';

const libraries = ['places'];
const containerStyle = { width: '100%', height: '100%' };

const PropertyMap = ({
    initialRegion = { latitude: 13.0827, longitude: 80.2707, latitudeDelta: 0.1, longitudeDelta: 0.1 },
    followRegion,
    listings = [],
    selectedId,
    userCoordinate,
    onSelect,
    onRegionChangeComplete,
    onMapPress,
    intelligenceMode = false,
    localityRegions = [],
}) => {
    const mapRef = useRef(null);
    const circlesRef = useRef([]);
    const defaultCenter = useRef({
        lat: initialRegion?.latitude || 13.0827,
        lng: initialRegion?.longitude || 80.2707,
    });
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: API_KEY || '',
        libraries,
    });

    const onLoad = useCallback((map) => {
        mapRef.current = map;
    }, []);

    useEffect(() => {
        if (followRegion && mapRef.current) {
            mapRef.current.panTo({ lat: followRegion.latitude, lng: followRegion.longitude });
            mapRef.current.setZoom(14);
            if (typeof window !== 'undefined' && window.google?.maps?.event) {
                setTimeout(() => {
                    if (mapRef.current) {
                        window.google.maps.event.trigger(mapRef.current, 'resize');
                    }
                }, 80);
            }
        }
    }, [followRegion]);

    // Manage translucent purple intelligence circles on the map
    useEffect(() => {
        // Clear previous circles
        circlesRef.current.forEach((c) => {
            try { c.setMap(null); } catch (_) {}
        });
        circlesRef.current = [];

        if (!mapRef.current || typeof window === 'undefined' || !window.google?.maps || !intelligenceMode) {
            return;
        }

        if (localityRegions && localityRegions.length > 0) {
            localityRegions.forEach((item) => {
                const lat = item.locality?.latitude;
                const lng = item.locality?.longitude;
                if (!lat || !lng) return;
                const isSelected = item.locality?.id === selectedId;

                try {
                    const circle = new window.google.maps.Circle({
                        map: mapRef.current,
                        center: { lat, lng },
                        radius: 1700,
                        fillColor: '#7C3AED',
                        fillOpacity: isSelected ? 0.28 : 0.16,
                        strokeColor: '#7C3AED',
                        strokeOpacity: isSelected ? 0.85 : 0.5,
                        strokeWeight: isSelected ? 2.5 : 1.5,
                        clickable: true,
                    });
                    circle.addListener('click', () => {
                        onSelect && onSelect(item);
                    });
                    circlesRef.current.push(circle);
                } catch (err) {
                    console.warn('[PropertyMap.web] Failed to add circle', err);
                }
            });
        }

        return () => {
            circlesRef.current.forEach((c) => {
                try { c.setMap(null); } catch (_) {}
            });
            circlesRef.current = [];
        };
    }, [intelligenceMode, localityRegions, selectedId, onSelect]);

    const handleIdle = () => {
        const map = mapRef.current;
        if (!map || !onRegionChangeComplete) return;
        const center = map.getCenter();
        const bounds = map.getBounds();
        if (!center || !bounds) return;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        onRegionChangeComplete({
            latitude: center.lat(),
            longitude: center.lng(),
            latitudeDelta: Math.abs(ne.lat() - sw.lat()),
            longitudeDelta: Math.abs(ne.lng() - sw.lng()),
        });
    };

    const markers = listings.slice(0, EXPLORE_MAX_MARKERS);

    if (loadError) {
        return (
            <View style={styles.fallback}>
                <Typography variant="body">Map failed to load. Check your connection.</Typography>
            </View>
        );
    }

    if (!isLoaded) {
        return <View style={styles.fallback} />;
    }

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={defaultCenter.current}
            zoom={13}
            onLoad={onLoad}
            onIdle={handleIdle}
            onClick={onMapPress}
            options={{
                styles: LIGHT_MAP_STYLE,
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: 'greedy',
            }}
        >
            {userCoordinate ? (
                <MarkerF
                    position={{ lat: userCoordinate.latitude, lng: userCoordinate.longitude }}
                    title="You"
                />
            ) : null}

            {intelligenceMode && localityRegions && localityRegions.length > 0 ? (
                localityRegions.map((item) => {
                    const lat = item.locality?.latitude;
                    const lng = item.locality?.longitude;
                    if (!lat || !lng) return null;
                    const isSelected = item.locality?.id === selectedId;
                    const score = Math.round(item.score || 75);
                    return (
                        <MarkerF
                            key={`loc_${item.locality.id}`}
                            position={{ lat, lng }}
                            label={{
                                text: `${item.locality.name}  ${score}`,
                                color: isSelected ? '#7C3AED' : '#0F0F0F',
                                fontSize: '13px',
                                fontWeight: '800',
                            }}
                            onClick={() => onSelect && onSelect(item)}
                        />
                    );
                })
            ) : (
                markers.map((item) => {
                    const selected = item.listingId === selectedId;
                    const pos = item.mapCoordinate;
                    if (!pos) return null;
                    return (
                        <MarkerF
                            key={item.listingId}
                            position={{ lat: pos.latitude, lng: pos.longitude }}
                            label={{
                                text: formatListingPrice(item),
                                color: selected ? '#FFFFFF' : '#111827',
                                fontSize: '12px',
                                fontWeight: '700',
                            }}
                            onClick={() => onSelect && onSelect(item)}
                        />
                    );
                })
            )}
        </GoogleMap>
    );
};

const styles = StyleSheet.create({
    fallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
});

export default PropertyMap;
