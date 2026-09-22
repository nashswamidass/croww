/**
 * Locality Map Hierarchy & Density Engine
 *
 * Implements deterministic, zoom-aware visual presentation for the 188-area Chennai geography universe.
 * Strictly maintains canonical locality identities without creating synthetic polygons.
 */

import { formatAreaScore } from '../scoring/formatAreaScore';
import { hasLocalityBoundary } from './localityBoundaries';
import { computeLocalityRelevanceTier } from './localityVisualRelevance';

export type LocalityZoomTier = 'CITY' | 'MID' | 'LOCAL';

export interface ZoomTierConfig {
    tier: LocalityZoomTier;
    minDelta: number;
    maxDelta: number;
    gridSize: number; // degrees lat/lng for spatial clustering
}

export const ZOOM_THRESHOLDS = {
    CITY_MIN_DELTA: 0.12,  // latitudeDelta >= 0.12 (City-wide overview)
    MID_MIN_DELTA: 0.045,  // 0.045 < latitudeDelta < 0.12 (District / Corridor view)
    // latitudeDelta <= 0.045 (Locality / Neighborhood view)
};

export const GRID_SIZES = {
    CITY: 0.040, // ~4.4 km grid cells
    MID: 0.018,  // ~2.0 km grid cells
    LOCAL: 0,    // No clustering
};

/**
 * Derives the active zoom tier from current latitudeDelta.
 */
export function getLocalityZoomTier(latitudeDelta: number | null | undefined): LocalityZoomTier {
    const delta = typeof latitudeDelta === 'number' && !isNaN(latitudeDelta) ? latitudeDelta : 0.12;
    if (delta >= ZOOM_THRESHOLDS.CITY_MIN_DELTA) {
        return 'CITY';
    }
    if (delta > ZOOM_THRESHOLDS.MID_MIN_DELTA) {
        return 'MID';
    }
    return 'LOCAL';
}

/**
 * Checks if a locality has verified municipal polygon boundaries.
 */
export function isVerifiedBoundaryLocality(locality: any): boolean {
    if (!locality) return false;
    return hasLocalityBoundary(locality);
}

/**
 * Resolves the authoritative published Area Score.
 * Strictly adheres to: publishedScore.overallScore -> intelligence.areaScore.score -> matchResult.areaScore
 * NEVER overwrites with user-specific matchScore.
 */
export function getAuthoritativeAreaScore(item: any): number | null {
    if (!item) return null;
    const locality = item.locality || item;

    const publishedScore =
        locality.publishedScore?.overallScore ??
        locality.intelligence?.areaScore?.score ??
        locality.intelligence?.publishedScore ??
        item.areaScore ??
        (typeof item.score === 'number' ? item.score : null);

    if (typeof publishedScore === 'number' && !isNaN(publishedScore)) {
        return publishedScore;
    }
    return null;
}

export interface ClusteredMapLocality {
    isCluster: boolean;
    clusterId?: string;
    count: number;
    latitude: number;
    longitude: number;
    items: any[];
    dominantScore: number | null;
    formattedScore: number | null;
    relevanceTier: string;
    bounds?: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
    };
    locality?: any;
    isSelected?: boolean;
}

export interface LocalityMapHierarchyResult {
    zoomTier: LocalityZoomTier;
    polygonItems: any[];
    pointMarkers: ClusteredMapLocality[];
    selectedMarker: ClusteredMapLocality | null;
    stats: {
        totalLocalities: number;
        verifiedBoundariesCount: number;
        pointOnlyCount: number;
        renderedPolygonCount: number;
        renderedPointMarkerCount: number;
        clusterCount: number;
        clusteredAreasCount: number;
    };
}

/**
 * Computes deterministic map hierarchy and density clustering for 188 localities.
 */
export function computeLocalityMapHierarchy(options: {
    localityRegions: any[];
    latitudeDelta?: number | null;
    selectedId?: string | null;
}): LocalityMapHierarchyResult {
    const { localityRegions = [], latitudeDelta, selectedId } = options;

    const zoomTier = getLocalityZoomTier(latitudeDelta);
    const cleanSelectedId = selectedId ? String(selectedId).toLowerCase().trim() : null;

    // 1. Partition verified polygon areas from point-only areas
    const polygonItems: any[] = [];
    const pointOnlyItems: any[] = [];

    localityRegions.forEach((item) => {
        const locality = item.locality || item;
        if (isVerifiedBoundaryLocality(locality)) {
            polygonItems.push(item);
        } else {
            pointOnlyItems.push(item);
        }
    });

    const pointMarkers: ClusteredMapLocality[] = [];
    let selectedMarker: ClusteredMapLocality | null = null;
    let clusterCount = 0;
    let clusteredAreasCount = 0;

    // 2. Locate selected locality if it is in pointOnlyItems
    // Selected locality is NEVER clustered or suppressed!
    let isolatedPointItems = pointOnlyItems;
    if (cleanSelectedId) {
        const selectedIndex = pointOnlyItems.findIndex((it) => {
            const id = String(it.locality?.id || it.id || it.localityId || '').toLowerCase().trim();
            return id === cleanSelectedId;
        });

        if (selectedIndex !== -1) {
            const selItem = pointOnlyItems[selectedIndex];
            const selLocality = selItem.locality || selItem;
            const rawScore = getAuthoritativeAreaScore(selItem);
            selectedMarker = {
                isCluster: false,
                count: 1,
                latitude: selLocality.latitude,
                longitude: selLocality.longitude,
                items: [selItem],
                dominantScore: rawScore,
                formattedScore: formatAreaScore(rawScore),
                relevanceTier: computeLocalityRelevanceTier(selItem),
                locality: selLocality,
                isSelected: true,
            };
            isolatedPointItems = pointOnlyItems.filter((_, idx) => idx !== selectedIndex);
        }
    }

    // 3. Process POINT_ONLY localities according to zoom tier
    if (zoomTier === 'LOCAL') {
        // High zoom: Reveal all individual areas
        isolatedPointItems.forEach((item) => {
            const locality = item.locality || item;
            if (!locality.latitude || !locality.longitude) return;
            const rawScore = getAuthoritativeAreaScore(item);
            pointMarkers.push({
                isCluster: false,
                count: 1,
                latitude: locality.latitude,
                longitude: locality.longitude,
                items: [item],
                dominantScore: rawScore,
                formattedScore: formatAreaScore(rawScore),
                relevanceTier: computeLocalityRelevanceTier(item),
                locality,
                isSelected: false,
            });
        });
    } else {
        // City or Mid zoom: Spatial clustering using grid cells
        const gridSize = zoomTier === 'CITY' ? GRID_SIZES.CITY : GRID_SIZES.MID;
        const grid = new Map<string, any[]>();

        isolatedPointItems.forEach((item) => {
            const locality = item.locality || item;
            if (!locality.latitude || !locality.longitude) return;

            const gridKey = `${Math.floor(locality.latitude / gridSize)}_${Math.floor(locality.longitude / gridSize)}`;
            if (!grid.has(gridKey)) {
                grid.set(gridKey, []);
            }
            grid.get(gridKey)!.push(item);
        });

        grid.forEach((cellItems, cellKey) => {
            if (cellItems.length === 1) {
                // Single locality in this cell: render individual bubble
                const item = cellItems[0];
                const locality = item.locality || item;
                const rawScore = getAuthoritativeAreaScore(item);
                pointMarkers.push({
                    isCluster: false,
                    count: 1,
                    latitude: locality.latitude,
                    longitude: locality.longitude,
                    items: [item],
                    dominantScore: rawScore,
                    formattedScore: formatAreaScore(rawScore),
                    relevanceTier: computeLocalityRelevanceTier(item),
                    locality,
                    isSelected: false,
                });
            } else {
                // Multiple localities in this cell: group into geographic cluster
                clusterCount += 1;
                clusteredAreasCount += cellItems.length;

                let sumLat = 0;
                let sumLng = 0;
                let minLat = Infinity;
                let maxLat = -Infinity;
                let minLng = Infinity;
                let maxLng = -Infinity;
                let scoreSum = 0;
                let validScoreCount = 0;

                cellItems.forEach((it) => {
                    const loc = it.locality || it;
                    const lat = loc.latitude;
                    const lng = loc.longitude;
                    sumLat += lat;
                    sumLng += lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;

                    const sc = getAuthoritativeAreaScore(it);
                    if (sc != null) {
                        scoreSum += sc;
                        validScoreCount += 1;
                    }
                });

                const avgLat = sumLat / cellItems.length;
                const avgLng = sumLng / cellItems.length;
                const avgScore = validScoreCount > 0 ? scoreSum / validScoreCount : null;

                // Pick highest relevance tier among cluster items
                let bestRelevance = 'NEUTRAL';
                const relevanceRanks: Record<string, number> = {
                    STRONG_MATCH: 3,
                    GOOD_MATCH: 2,
                    POSSIBLE_MATCH: 1,
                    NEUTRAL: 0,
                };
                cellItems.forEach((it) => {
                    const tier = computeLocalityRelevanceTier(it);
                    if ((relevanceRanks[tier] ?? 0) > (relevanceRanks[bestRelevance] ?? 0)) {
                        bestRelevance = tier;
                    }
                });

                pointMarkers.push({
                    isCluster: true,
                    clusterId: `cluster_${cellKey}`,
                    count: cellItems.length,
                    latitude: avgLat,
                    longitude: avgLng,
                    bounds: { minLat, maxLat, minLng, maxLng },
                    items: cellItems,
                    dominantScore: avgScore,
                    formattedScore: formatAreaScore(avgScore),
                    relevanceTier: bestRelevance,
                    isSelected: false,
                });
            }
        });
    }

    // Always include selected marker at the top of pointMarkers if it was a point locality
    if (selectedMarker) {
        pointMarkers.unshift(selectedMarker);
    }

    return {
        zoomTier,
        polygonItems,
        pointMarkers,
        selectedMarker,
        stats: {
            totalLocalities: localityRegions.length,
            verifiedBoundariesCount: polygonItems.length,
            pointOnlyCount: pointOnlyItems.length,
            renderedPolygonCount: polygonItems.length,
            renderedPointMarkerCount: pointMarkers.length,
            clusterCount,
            clusteredAreasCount,
        },
    };
}

/**
 * Computes an animated target region to expand a tapped cluster.
 */
export function getClusterZoomRegion(cluster: ClusteredMapLocality, currentRegion?: any) {
    if (!cluster.bounds) {
        const curDelta = currentRegion?.latitudeDelta || 0.12;
        return {
            latitude: cluster.latitude,
            longitude: cluster.longitude,
            latitudeDelta: Math.max(0.02, curDelta / 2.5),
            longitudeDelta: Math.max(0.02, curDelta / 2.5),
        };
    }

    const latSpan = cluster.bounds.maxLat - cluster.bounds.minLat;
    const lngSpan = cluster.bounds.maxLng - cluster.bounds.minLng;

    // Provide generous padding so all contained areas expand comfortably
    const targetLatDelta = Math.max(0.025, latSpan * 1.8);
    const targetLngDelta = Math.max(0.025, lngSpan * 1.8);

    return {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: targetLatDelta,
        longitudeDelta: targetLngDelta,
    };
}
