import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapView, { PROVIDER_GOOGLE, Marker, Polygon } from 'react-native-maps';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { EXPLORE_MAX_MARKERS } from '../../constants/explore';
import PropertyMarker from './PropertyMarker';
import LocalityScoreBubble from '../intelligence/LocalityScoreBubble';
import { getLocalityBoundaryRings } from '../../domain/intelligence/localityBoundaries';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const mapProvider = Platform.OS === 'android'
    ? PROVIDER_GOOGLE
    : (isExpoGo ? undefined : PROVIDER_GOOGLE);

const CLUSTER_ZOOM_THRESHOLD = 0.09;

const PropertyMap = ({
    initialRegion,
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
    const [currentRegion, setCurrentRegion] = useState(initialRegion || null);

    useEffect(() => {
        if (followRegion && mapRef.current) {
            mapRef.current.animateToRegion(followRegion, 700);
            setCurrentRegion(followRegion);
        }
    }, [followRegion]);

    const handleRegionChangeComplete = useCallback((region) => {
        setCurrentRegion(region);
        onRegionChangeComplete?.(region);
    }, [onRegionChangeComplete]);

    // Lightweight spatial clustering: groups nearby listings into a cluster when zoomed out
    const processedMarkers = useMemo(() => {
        const rawMarkers = listings.slice(0, EXPLORE_MAX_MARKERS);
        if (selectedId && !rawMarkers.some((item) => item.listingId === selectedId)) {
            const extra = listings.find((item) => item.listingId === selectedId);
            if (extra) rawMarkers.push(extra);
        }

        const latDelta = currentRegion?.latitudeDelta ?? initialRegion?.latitudeDelta ?? 0.1;
        // If zoomed in close, render all markers as individual price pills
        if (latDelta <= CLUSTER_ZOOM_THRESHOLD) {
            return rawMarkers;
        }

        // When zoomed out, cluster listings by grid cells
        const gridSize = latDelta * 0.12;
        const grid = new Map();

        rawMarkers.forEach((item) => {
            // Never cluster the currently selected listing
            if (item.listingId === selectedId) {
                return;
            }
            const coord = item.mapCoordinate || (item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null);
            if (!coord) return;

            const gridKey = `${Math.floor(coord.latitude / gridSize)}_${Math.floor(coord.longitude / gridSize)}`;
            if (!grid.has(gridKey)) {
                grid.set(gridKey, []);
            }
            grid.get(gridKey).push(item);
        });

        const output = [];

        // Always include selected item as individual
        if (selectedId) {
            const selectedItem = rawMarkers.find((item) => item.listingId === selectedId);
            if (selectedItem) output.push(selectedItem);
        }

        grid.forEach((items, key) => {
            if (items.length === 1) {
                output.push(items[0]);
            } else {
                // Compute cluster centroid
                const avgLat = items.reduce((sum, it) => sum + (it.mapCoordinate?.latitude ?? it.latitude), 0) / items.length;
                const avgLng = items.reduce((sum, it) => sum + (it.mapCoordinate?.longitude ?? it.longitude), 0) / items.length;

                output.push({
                    isCluster: true,
                    listingId: `cluster_${key}`,
                    count: items.length,
                    mapCoordinate: { latitude: avgLat, longitude: avgLng },
                    latitude: avgLat,
                    longitude: avgLng,
                    items,
                });
            }
        });

        return output;
    }, [listings, selectedId, currentRegion, initialRegion]);

    const handleMarkerPress = useCallback((item) => {
        if (item.isCluster) {
            // Zoom into the cluster
            if (mapRef.current && currentRegion) {
                mapRef.current.animateToRegion({
                    latitude: item.latitude,
                    longitude: item.longitude,
                    latitudeDelta: Math.max(0.02, (currentRegion.latitudeDelta || 0.1) / 2.5),
                    longitudeDelta: Math.max(0.02, (currentRegion.longitudeDelta || 0.1) / 2.5),
                }, 350);
            }
        } else {
            onSelect?.(item);
        }
    }, [currentRegion, onSelect]);

    return (
        <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            provider={mapProvider}
            customMapStyle={LIGHT_MAP_STYLE}
            userInterfaceStyle="light"
            onPress={onMapPress}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={false}
            showsMyLocationButton={false}
            rotateEnabled={false}
            accessibilityLabel="Property map"
        >
            {/* Sleek pulsing user location dot (universal modern map pattern, no red/teal pins) */}
            {userCoordinate ? (
                <Marker
                    coordinate={userCoordinate}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    zIndex={5}
                >
                    <View style={styles.userLocationHalo}>
                        <View style={styles.userLocationCenter} />
                    </View>
                </Marker>
            ) : null}

            {/* Locality Intelligence Mode: Authentic Municipal Polygons + Centroid Scores */}
            {intelligenceMode && localityRegions && localityRegions.length > 0 ? (
                localityRegions.map((item) => {
                    const isSelected = item.locality.id === selectedId;
                    const rings = getLocalityBoundaryRings(item.locality);

                    return (
                        <React.Fragment key={`region_${item.locality.id}`}>
                            {rings.map((ringCoords, ringIdx) => (
                                <Polygon
                                    key={`poly_${item.locality.id}_${ringIdx}`}
                                    coordinates={ringCoords}
                                    fillColor={isSelected ? 'rgba(124, 58, 237, 0.22)' : 'rgba(124, 58, 237, 0.08)'}
                                    strokeColor={isSelected ? '#7C3AED' : 'rgba(124, 58, 237, 0.65)'}
                                    strokeWidth={isSelected ? 2.5 : 1.5}
                                    tappable
                                    onPress={() => onSelect && onSelect(item)}
                                    zIndex={isSelected ? 10 : 2}
                                />
                            ))}

                            <Marker
                                coordinate={{ latitude: item.locality.latitude, longitude: item.locality.longitude }}
                                onPress={() => onSelect && onSelect(item)}
                                zIndex={isSelected ? 25 : 8}
                            >
                                <LocalityScoreBubble
                                    name={item.locality.name}
                                    score={item.score}
                                    selected={isSelected}
                                    variant="marker"
                                />
                            </Marker>
                        </React.Fragment>
                    );
                })
            ) : (
                /* Normal Mode: Compact Airbnb-style price pills */
                processedMarkers.map((item) => (
                    <PropertyMarker
                        key={item.listingId}
                        item={item}
                        selected={item.listingId === selectedId}
                        onPress={handleMarkerPress}
                    />
                ))
            )}
        </MapView>
    );
};

const styles = StyleSheet.create({
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    userLocationHalo: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(37, 99, 235, 0.22)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    userLocationCenter: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#2563EB',
    },
});

export default PropertyMap;
