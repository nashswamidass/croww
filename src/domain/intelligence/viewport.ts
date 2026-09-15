import { isValidLatitude, isValidLongitude, type MapViewport } from '../property/geo.ts';
import { LOCALITY_CAMERA_DELTA } from './constants.ts';

export type LocalityViewportInput = {
    latitude?: unknown;
    longitude?: unknown;
    bounds?: {
        north?: unknown;
        south?: unknown;
        east?: unknown;
        west?: unknown;
    } | null;
};

export type LocalityCameraViewport = MapViewport & {
    geometrySource: 'bounds' | 'centroid-camera';
};

/**
 * Map camera for Explore. A centroid span is a framing hint, not an official boundary.
 */
export function viewportFromLocality(locality: LocalityViewportInput | null | undefined): LocalityCameraViewport | null {
    if (!locality || !isValidLatitude(locality.latitude) || !isValidLongitude(locality.longitude)) {
        return null;
    }
    const bounds = locality.bounds;
    const north = Number(bounds?.north);
    const south = Number(bounds?.south);
    const east = Number(bounds?.east);
    const west = Number(bounds?.west);
    if (
        bounds
        && Number.isFinite(north) && Number.isFinite(south)
        && Number.isFinite(east) && Number.isFinite(west)
        && north > south && east !== west
    ) {
        return {
            latitude: locality.latitude,
            longitude: locality.longitude,
            latitudeDelta: Math.max(Math.abs(north - south) * 1.15, 0.02),
            longitudeDelta: Math.max(Math.abs(east - west) * 1.15, 0.02),
            geometrySource: 'bounds',
        };
    }
    return {
        latitude: locality.latitude,
        longitude: locality.longitude,
        latitudeDelta: LOCALITY_CAMERA_DELTA,
        longitudeDelta: LOCALITY_CAMERA_DELTA,
        geometrySource: 'centroid-camera',
    };
}
