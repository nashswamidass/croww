import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GoogleMap, OverlayViewF, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { EXPLORE_MAX_MARKERS } from '../../constants/explore';
import { formatMarkerPrice } from '../../utils/propertyFormat';
import { COLORS } from '../../constants/theme';
import Typography from '../Typography';
import { getLocalityBoundaryRings } from '../../domain/intelligence/localityBoundaries';

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
    const polygonsRef = useRef([]);
    const [currentZoom, setCurrentZoom] = useState(13);
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
        setCurrentZoom(map.getZoom() || 13);
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

    // Manage translucent purple intelligence polygons on the web map
    useEffect(() => {
        polygonsRef.current.forEach((p) => {
            try { p.setMap(null); } catch (_) {}
        });
        polygonsRef.current = [];

        if (!mapRef.current || typeof window === 'undefined' || !window.google?.maps || !intelligenceMode) {
            return;
        }

        if (localityRegions && localityRegions.length > 0) {
            localityRegions.forEach((item) => {
                const rings = getLocalityBoundaryRings(item.locality);
                if (!rings || rings.length === 0) return;
                const isSelected = item.locality?.id === selectedId;

                try {
                    const paths = rings.map((ring) =>
                        ring.map((pt) => ({ lat: pt.latitude, lng: pt.longitude }))
                    );
                    const polygon = new window.google.maps.Polygon({
                        map: mapRef.current,
                        paths: paths.length === 1 ? paths[0] : paths,
                        fillColor: '#7C3AED',
                        fillOpacity: isSelected ? 0.22 : 0.08,
                        strokeColor: '#7C3AED',
                        strokeOpacity: isSelected ? 0.9 : 0.55,
                        strokeWeight: isSelected ? 2.5 : 1.5,
                        clickable: true,
                        zIndex: isSelected ? 10 : 2,
                    });
                    polygon.addListener('click', () => {
                        onSelect && onSelect(item);
                    });
                    polygonsRef.current.push(polygon);
                } catch (err) {
                    console.warn('[PropertyMap.web] Failed to add polygon', err);
                }
            });
        }

        return () => {
            polygonsRef.current.forEach((p) => {
                try { p.setMap(null); } catch (_) {}
            });
            polygonsRef.current = [];
        };
    }, [intelligenceMode, localityRegions, selectedId, onSelect]);

    const handleIdle = () => {
        const map = mapRef.current;
        if (!map) return;
        setCurrentZoom(map.getZoom() || 13);
        if (!onRegionChangeComplete) return;
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

    // Lightweight spatial clustering for Web when zoomed out (zoom < 13)
    const processedMarkers = useMemo(() => {
        const rawMarkers = listings.slice(0, EXPLORE_MAX_MARKERS);
        if (selectedId && !rawMarkers.some((item) => item.listingId === selectedId)) {
            const extra = listings.find((item) => item.listingId === selectedId);
            if (extra) rawMarkers.push(extra);
        }

        if (currentZoom >= 13) {
            return rawMarkers;
        }

        // Simple grid cluster
        const gridDeg = 0.035;
        const grid = new Map();

        rawMarkers.forEach((item) => {
            if (item.listingId === selectedId) return;
            const coord = item.mapCoordinate || (item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null);
            if (!coord) return;

            const gridKey = `${Math.floor(coord.latitude / gridDeg)}_${Math.floor(coord.longitude / gridDeg)}`;
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
                    listingId: `cluster_web_${key}`,
                    count: items.length,
                    mapCoordinate: { latitude: avgLat, longitude: avgLng },
                    latitude: avgLat,
                    longitude: avgLng,
                    items,
                });
            }
        });

        return output;
    }, [listings, selectedId, currentZoom]);

    const handleItemClick = (item) => {
        if (item.isCluster) {
            if (mapRef.current) {
                mapRef.current.panTo({ lat: item.latitude, lng: item.longitude });
                mapRef.current.setZoom((mapRef.current.getZoom() || 12) + 2);
            }
        } else {
            onSelect && onSelect(item);
        }
    };

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
            {/* Custom User Location Dot (clean pulsing blue dot, ZERO red pins) */}
            {userCoordinate ? (
                <OverlayViewF
                    position={{ lat: userCoordinate.latitude, lng: userCoordinate.longitude }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={() => ({ x: -11, y: -11 })}
                >
                    <div
                        style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(37, 99, 235, 0.22)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1.5px solid #FFFFFF',
                            boxSizing: 'border-box',
                            pointerEvents: 'none',
                        }}
                    >
                        <div
                            style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: '#2563EB',
                            }}
                        />
                    </div>
                </OverlayViewF>
            ) : null}

            {/* Locality Intelligence Centroid Scores via OverlayViewF */}
            {intelligenceMode && localityRegions && localityRegions.length > 0 ? (
                localityRegions.map((item) => {
                    const lat = item.locality?.latitude;
                    const lng = item.locality?.longitude;
                    if (!lat || !lng) return null;
                    const isSelected = item.locality?.id === selectedId;
                    const score = Math.round(item.score || 75);

                    return (
                        <OverlayViewF
                            key={`loc_${item.locality.id}`}
                            position={{ lat, lng }}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            getPixelPositionOffset={(width, height) => ({
                                x: -(width / 2),
                                y: -(height / 2),
                            })}
                        >
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect && onSelect(item);
                                }}
                                style={{
                                    backgroundColor: isSelected ? '#7C3AED' : '#FFFFFF',
                                    color: isSelected ? '#FFFFFF' : '#111827',
                                    border: `1.5px solid ${isSelected ? '#7C3AED' : '#E5E7EB'}`,
                                    borderRadius: '16px',
                                    padding: '5px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    whiteSpace: 'nowrap',
                                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                                    transition: 'transform 150ms ease, background-color 150ms ease',
                                    zIndex: isSelected ? 100 : 20,
                                }}
                            >
                                <span style={{ color: isSelected ? '#FFFFFF' : '#7C3AED', fontWeight: 800 }}>{score}</span>
                                <span>{item.locality.name}</span>
                            </div>
                        </OverlayViewF>
                    );
                })
            ) : (
                /* Normal Mode: Compact Airbnb-style price pills via OverlayViewF */
                processedMarkers.map((item) => {
                    const selected = item.listingId === selectedId;
                    const pos = item.mapCoordinate || (item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null);
                    if (!pos) return null;

                    const isCluster = item.isCluster === true;
                    const label = isCluster ? String(item.count) : formatMarkerPrice(item);

                    return (
                        <OverlayViewF
                            key={item.listingId}
                            position={{ lat: pos.latitude, lng: pos.longitude }}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            getPixelPositionOffset={(width, height) => ({
                                x: -(width / 2),
                                y: -(height / 2),
                            })}
                        >
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleItemClick(item);
                                }}
                                style={isCluster ? {
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    backgroundColor: '#FFFFFF',
                                    border: '2px solid #7C3AED',
                                    color: '#7C3AED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    transition: 'transform 150ms ease',
                                    zIndex: 40,
                                } : {
                                    backgroundColor: selected ? '#7C3AED' : '#FFFFFF',
                                    color: selected ? '#FFFFFF' : '#111827',
                                    border: `1.5px solid ${selected ? '#7C3AED' : '#E5E7EB'}`,
                                    borderRadius: '18px',
                                    padding: '5px 12px',
                                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    boxShadow: selected
                                        ? '0 4px 12px rgba(124, 58, 237, 0.3)'
                                        : '0 2px 6px rgba(0, 0, 0, 0.08)',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    whiteSpace: 'nowrap',
                                    transform: selected ? 'scale(1.08)' : 'scale(1)',
                                    transition: 'transform 150ms ease, background-color 150ms ease',
                                    zIndex: selected ? 100 : 10,
                                }}
                            >
                                {label}
                            </div>
                        </OverlayViewF>
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
