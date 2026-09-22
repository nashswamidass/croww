import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapView, { PROVIDER_GOOGLE, Marker, Polygon } from 'react-native-maps';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { EXPLORE_MAX_MARKERS } from '../../constants/explore';
import PropertyMarker from './PropertyMarker';
import LocalityScoreBubble from '../intelligence/LocalityScoreBubble';
import LocalityClusterBubble from '../intelligence/LocalityClusterBubble';
import { getLocalityBoundaryRings } from '../../domain/intelligence/localityBoundaries';
import { getLocalityPolygonStyle, RELEVANCE_CONFIG } from '../../domain/intelligence/localityVisualRelevance';
import {
    computeLocalityMapHierarchy,
    getClusterZoomRegion,
} from '../../domain/intelligence/localityMapHierarchy';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const mapProvider = Platform.OS === 'android'
    ? PROVIDER_GOOGLE
    : (isExpoGo ? undefined : PROVIDER_GOOGLE);

const CLUSTER_ZOOM_THRESHOLD = 0.18;

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
    const currentRegionRef = useRef(initialRegion || null);

    useEffect(() => {
        if (followRegion && mapRef.current) {
            mapRef.current.animateToRegion(followRegion, 700);
            setCurrentRegion(followRegion);
            currentRegionRef.current = followRegion;
        }
    }, [followRegion]);

    const handleRegionChangeComplete = useCallback((region) => {
        currentRegionRef.current = region;
        setCurrentRegion(region);
        onRegionChangeComplete?.(region);
    }, [onRegionChangeComplete]);

    // Quantized delta prevents thrashing/recalculating on tiny sub-pixel panning micro-movements
    const activeLatitudeDelta = currentRegion?.latitudeDelta ?? initialRegion?.latitudeDelta ?? 0.12;
    const quantizedDelta = Math.round(activeLatitudeDelta * 100) / 100;

    // Deterministic zoom-aware locality hierarchy for the 188 canonical areas
    const localityHierarchy = useMemo(() => {
        if (!intelligenceMode || !localityRegions || localityRegions.length === 0) {
            return null;
        }
        return computeLocalityMapHierarchy({
            localityRegions,
            latitudeDelta: quantizedDelta,
            selectedId,
        });
    }, [intelligenceMode, localityRegions, quantizedDelta, selectedId]);

    // Handle cluster tap: smoothly zooms into cluster bounds, revealing underlying areas
    const handleLocalityClusterPress = useCallback((cluster) => {
        if (!cluster) return;
        const targetRegion = getClusterZoomRegion(cluster, currentRegionRef.current);
        if (mapRef.current && targetRegion) {
            mapRef.current.animateToRegion(targetRegion, 450);
        }
    }, []);

    // Lightweight spatial clustering for normal property listings when zoomed out
    const processedMarkers = useMemo(() => {
        if (intelligenceMode) return [];
        const rawMarkers = listings.slice(0, EXPLORE_MAX_MARKERS);
        if (selectedId && !rawMarkers.some((item) => item.listingId === selectedId)) {
            const extra = listings.find((item) => item.listingId === selectedId);
            if (extra) rawMarkers.push(extra);
        }

        const latDelta = currentRegion?.latitudeDelta ?? initialRegion?.latitudeDelta ?? 0.1;
        if (latDelta <= CLUSTER_ZOOM_THRESHOLD) {
            return rawMarkers;
        }

        const gridSize = latDelta * 0.12;
        const grid = new Map();

        rawMarkers.forEach((item) => {
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
        if (selectedId) {
            const selectedItem = rawMarkers.find((item) => item.listingId === selectedId);
            if (selectedItem) output.push(selectedItem);
        }

        grid.forEach((items, key) => {
            if (items.length === 1) {
                output.push(items[0]);
            } else {
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
    }, [intelligenceMode, listings, selectedId, currentRegion, initialRegion]);

    const handleMarkerPress = useCallback((item) => {
        if (item.isCluster) {
            const cur = currentRegionRef.current;
            if (mapRef.current && cur) {
                mapRef.current.animateToRegion({
                    latitude: item.latitude,
                    longitude: item.longitude,
                    latitudeDelta: Math.max(0.02, (cur.latitudeDelta || 0.1) / 2.5),
                    longitudeDelta: Math.max(0.02, (cur.longitudeDelta || 0.1) / 2.5),
                }, 350);
            }
        } else {
            onSelect?.(item);
        }
    }, [onSelect]);

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
            {/* Sleek user location dot */}
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

            {/* Locality Intelligence Mode: Authentic Municipal Polygons + Zoom-Aware Point Hierarchy */}
            {intelligenceMode && localityHierarchy ? (
                <>
                    {/* 1. Authentic Verified Municipal Polygons (7 areas, never clustered into points) */}
                    {localityHierarchy.polygonItems.map((item) => {
                        const locality = item.locality || item;
                        const isSelected = locality.id === selectedId;
                        const anySelected = Boolean(selectedId && localityRegions.some((r) => (r.locality?.id || r.id) === selectedId));
                        const rings = getLocalityBoundaryRings(locality);
                        const style = getLocalityPolygonStyle(item, isSelected, anySelected);

                        return (
                            <React.Fragment key={`region_${locality.id}`}>
                                {rings.map((ringCoords, ringIdx) => (
                                    <Polygon
                                        key={`poly_${locality.id}_${ringIdx}`}
                                        coordinates={ringCoords}
                                        fillColor={style.fillColor}
                                        strokeColor={style.strokeColor}
                                        strokeWidth={style.strokeWidth}
                                        tappable
                                        onPress={() => onSelect && onSelect(item)}
                                        zIndex={style.zIndex}
                                    />
                                ))}

                                <Marker
                                    coordinate={{ latitude: locality.latitude, longitude: locality.longitude }}
                                    onPress={() => onSelect && onSelect(item)}
                                    tracksViewChanges={isSelected}
                                    zIndex={isSelected ? 30 : 8}
                                >
                                    <LocalityScoreBubble
                                        name={locality.name}
                                        score={item.score}
                                        selected={isSelected}
                                        variant="marker"
                                        relevanceColor={style.dotColor}
                                    />
                                </Marker>
                            </React.Fragment>
                        );
                    })}

                    {/* 2. Zoom-Aware POINT_ONLY Locality Markers & Geographic Clusters */}
                    {localityHierarchy.pointMarkers.map((marker) => {
                        if (marker.isCluster) {
                            const relevanceDot = marker.relevanceTier !== 'NEUTRAL'
                                ? (RELEVANCE_CONFIG[marker.relevanceTier]?.dotColor || null)
                                : null;

                            return (
                                <Marker
                                    key={marker.clusterId}
                                    coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                                    onPress={() => handleLocalityClusterPress(marker)}
                                    tracksViewChanges={false}
                                    zIndex={10}
                                >
                                    <LocalityClusterBubble
                                        count={marker.count}
                                        relevanceColor={relevanceDot}
                                        onPress={() => handleLocalityClusterPress(marker)}
                                    />
                                </Marker>
                            );
                        }

                        const locality = marker.locality;
                        const isSelected = marker.isSelected || locality.id === selectedId;
                        const relevanceDot = marker.relevanceTier !== 'NEUTRAL'
                            ? (RELEVANCE_CONFIG[marker.relevanceTier]?.dotColor || null)
                            : null;

                        return (
                            <Marker
                                key={`pt_${locality.id}`}
                                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                                onPress={() => onSelect && onSelect(marker.items[0])}
                                tracksViewChanges={isSelected}
                                zIndex={isSelected ? 30 : 12}
                            >
                                <LocalityScoreBubble
                                    name={locality.name}
                                    score={marker.dominantScore}
                                    selected={isSelected}
                                    variant="marker"
                                    relevanceColor={relevanceDot}
                                />
                            </Marker>
                        );
                    })}
                </>
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
