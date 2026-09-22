import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GoogleMap, OverlayViewF, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { EXPLORE_MAX_MARKERS } from '../../constants/explore';
import { formatMarkerPrice } from '../../utils/propertyFormat';
import { COLORS } from '../../constants/theme';
import Typography from '../Typography';
import { getLocalityBoundaryRings } from '../../domain/intelligence/localityBoundaries';
import { getLocalityPolygonStyle, RELEVANCE_CONFIG } from '../../domain/intelligence/localityVisualRelevance';
import { computeLocalityMapHierarchy } from '../../domain/intelligence/localityMapHierarchy';
import { formatAreaScore } from '../../domain/scoring/formatAreaScore';

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
    const polygonsMapRef = useRef(new Map());
    const [currentZoom, setCurrentZoom] = useState(13);
    const [currentDelta, setCurrentDelta] = useState(initialRegion?.latitudeDelta || 0.12);
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

    // Manage data-driven dynamic intelligence polygons on the web map
    useEffect(() => {
        if (!mapRef.current || typeof window === 'undefined' || !window.google?.maps || !intelligenceMode) {
            polygonsMapRef.current.forEach((p) => {
                try { p.setMap(null); } catch (_) {}
            });
            polygonsMapRef.current.clear();
            return;
        }

        const activeIds = new Set();
        const anySelected = Boolean(selectedId && localityRegions.some((r) => r.locality?.id === selectedId));

        if (localityRegions && localityRegions.length > 0) {
            localityRegions.forEach((item) => {
                const locId = item.locality?.id;
                if (!locId) return;
                activeIds.add(locId);

                const isSelected = locId === selectedId;
                const style = getLocalityPolygonStyle(item, isSelected, anySelected);
                const rings = getLocalityBoundaryRings(item.locality);
                if (!rings || rings.length === 0) return;

                const paths = rings.map((ring) =>
                    ring.map((pt) => ({ lat: pt.latitude, lng: pt.longitude }))
                );

                const existingPolygon = polygonsMapRef.current.get(locId);
                if (existingPolygon) {
                    // Smoothly update visual options without destroying the polygon layer
                    existingPolygon.setOptions({
                        paths: paths.length === 1 ? paths[0] : paths,
                        fillColor: style.fillColor || 'transparent',
                        fillOpacity: style.fillOpacity,
                        strokeColor: style.strokeColor,
                        strokeOpacity: style.strokeOpacity,
                        strokeWeight: style.strokeWidth,
                        zIndex: style.zIndex,
                    });
                } else {
                    try {
                        const polygon = new window.google.maps.Polygon({
                            map: mapRef.current,
                            paths: paths.length === 1 ? paths[0] : paths,
                            fillColor: style.fillColor || 'transparent',
                            fillOpacity: style.fillOpacity,
                            strokeColor: style.strokeColor,
                            strokeOpacity: style.strokeOpacity,
                            strokeWeight: style.strokeWidth,
                            clickable: true,
                            zIndex: style.zIndex,
                        });
                        polygon.addListener('click', () => {
                            onSelect && onSelect(item);
                        });
                        polygonsMapRef.current.set(locId, polygon);
                    } catch (err) {
                        console.warn('[PropertyMap.web] Failed to add polygon', err);
                    }
                }
            });
        }

        // Clean up polygons for localities no longer in view
        polygonsMapRef.current.forEach((p, id) => {
            if (!activeIds.has(id)) {
                try { p.setMap(null); } catch (_) {}
                polygonsMapRef.current.delete(id);
            }
        });
    }, [intelligenceMode, localityRegions, selectedId, onSelect]);

    useEffect(() => {
        const polyMap = polygonsMapRef.current;
        return () => {
            polyMap.forEach((p) => {
                try { p.setMap(null); } catch (_) {}
            });
            polyMap.clear();
        };
    }, []);

    const handleIdle = () => {
        const map = mapRef.current;
        if (!map) return;
        setCurrentZoom(map.getZoom() || 13);
        const center = map.getCenter();
        const bounds = map.getBounds();
        if (!center || !bounds) return;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const latDelta = Math.abs(ne.lat() - sw.lat());
        const lngDelta = Math.abs(ne.lng() - sw.lng());
        setCurrentDelta(latDelta);
        onRegionChangeComplete?.({
            latitude: center.lat(),
            longitude: center.lng(),
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
        });
    };

    const quantizedDelta = Math.round((currentDelta || 0.12) * 100) / 100;
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

    const handleClusterClick = useCallback((cluster) => {
        if (!mapRef.current) return;
        if (cluster.bounds && typeof window !== 'undefined' && window.google?.maps?.LatLngBounds) {
            const bounds = new window.google.maps.LatLngBounds(
                { lat: cluster.bounds.minLat, lng: cluster.bounds.minLng },
                { lat: cluster.bounds.maxLat, lng: cluster.bounds.maxLng }
            );
            mapRef.current.fitBounds(bounds, { top: 70, bottom: 70, left: 70, right: 70 });
        } else {
            mapRef.current.panTo({ lat: cluster.latitude, lng: cluster.longitude });
            mapRef.current.setZoom((mapRef.current.getZoom() || 12) + 2);
        }
    }, []);

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

            {/* Locality Intelligence: Verified Municipal Polygons + Zoom-Aware Point Hierarchy */}
            {intelligenceMode && localityHierarchy ? (
                <>
                    {/* 1. Centroid Scores for the 7 Verified Municipal Polygons */}
                    {localityHierarchy.polygonItems.map((item) => {
                        const locality = item.locality || item;
                        const lat = locality.latitude;
                        const lng = locality.longitude;
                        if (!lat || !lng) return null;
                        const isSelected = locality.id === selectedId;
                        const anySelected = Boolean(selectedId && localityRegions.some((r) => (r.locality?.id || r.id) === selectedId));
                        const style = getLocalityPolygonStyle(item, isSelected, anySelected);
                        const score = formatAreaScore(item.score);

                        return (
                            <OverlayViewF
                                key={`poly_marker_${locality.id}`}
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
                                        backgroundColor: '#FFFFFF',
                                        color: '#111827',
                                        border: isSelected ? '2px solid #111827' : '1.2px solid #1F1F1F',
                                        borderRadius: '16px',
                                        padding: '4px 9px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                        fontSize: '11px',
                                        fontWeight: isSelected ? 800 : 700,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        whiteSpace: 'nowrap',
                                        boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
                                        zIndex: isSelected ? 120 : 20,
                                    }}
                                >
                                    {style.dotColor ? (
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: style.dotColor }} />
                                    ) : null}
                                    <span style={{ letterSpacing: '0.4px' }}>{locality.name?.toUpperCase()}</span>
                                    {score != null ? (
                                        <>
                                            <span style={{ color: '#9CA3AF' }}>·</span>
                                            <span style={{ fontWeight: 800 }}>{score}</span>
                                        </>
                                    ) : null}
                                </div>
                            </OverlayViewF>
                        );
                    })}

                    {/* 2. Zoom-Aware POINT_ONLY Locality Markers & Clusters */}
                    {localityHierarchy.pointMarkers.map((marker) => {
                        const lat = marker.latitude;
                        const lng = marker.longitude;
                        if (!lat || !lng) return null;

                        if (marker.isCluster) {
                            const relevanceDot = marker.relevanceTier !== 'NEUTRAL'
                                ? (RELEVANCE_CONFIG[marker.relevanceTier]?.dotColor || null)
                                : null;

                            return (
                                <OverlayViewF
                                    key={marker.clusterId}
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
                                            handleClusterClick(marker);
                                        }}
                                        style={{
                                            backgroundColor: '#FFFFFF',
                                            color: '#111827',
                                            border: '1.2px solid #1F1F1F',
                                            borderRadius: '16px',
                                            padding: '4px 8.5px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            whiteSpace: 'nowrap',
                                            zIndex: 25,
                                        }}
                                    >
                                        {relevanceDot ? (
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: relevanceDot }} />
                                        ) : null}
                                        <span style={{ fontSize: '11px', fontWeight: 800 }}>{marker.count}</span>
                                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px' }}>AREAS</span>
                                    </div>
                                </OverlayViewF>
                            );
                        }

                        const locality = marker.locality;
                        const isSelected = marker.isSelected || locality.id === selectedId;
                        const relevanceDot = marker.relevanceTier !== 'NEUTRAL'
                            ? (RELEVANCE_CONFIG[marker.relevanceTier]?.dotColor || null)
                            : null;
                        const score = formatAreaScore(marker.dominantScore);

                        return (
                            <OverlayViewF
                                key={`pt_${locality.id}`}
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
                                        onSelect && onSelect(marker.items[0]);
                                    }}
                                    style={{
                                        backgroundColor: '#FFFFFF',
                                        color: '#111827',
                                        border: isSelected ? '2px solid #111827' : '1.2px solid #1F1F1F',
                                        borderRadius: '16px',
                                        padding: '4px 9px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                        fontSize: '11px',
                                        fontWeight: isSelected ? 800 : 700,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        whiteSpace: 'nowrap',
                                        boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
                                        zIndex: isSelected ? 120 : 30,
                                    }}
                                >
                                    {relevanceDot ? (
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: relevanceDot }} />
                                    ) : null}
                                    <span style={{ letterSpacing: '0.4px' }}>{locality.name?.toUpperCase()}</span>
                                    {score != null ? (
                                        <>
                                            <span style={{ color: '#9CA3AF' }}>·</span>
                                            <span style={{ fontWeight: 800 }}>{score}</span>
                                        </>
                                    ) : null}
                                </div>
                            </OverlayViewF>
                        );
                    })}
                </>
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
                                    border: '2px solid #111827',
                                    color: '#111827',
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
                                    backgroundColor: selected ? '#111827' : '#FFFFFF',
                                    color: selected ? '#FFFFFF' : '#111827',
                                    border: `1.5px solid ${selected ? '#111827' : '#E5E7EB'}`,
                                    borderRadius: '18px',
                                    padding: '5px 12px',
                                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    boxShadow: selected
                                        ? '0 4px 12px rgba(0, 0, 0, 0.25)'
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
