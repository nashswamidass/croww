import { CITY_COORDINATES } from './location';

/**
 * Launch context for Explore when GPS is unavailable.
 * Chennai is the initial commercial city. This is not a Firestore query restriction
 * and is not the legacy Mumbai default from locationService.
 */
export const LAUNCH_CITY_NAME = 'Chennai';
export const LAUNCH_COORDINATES = CITY_COORDINATES.Chennai;
export const LAUNCH_VIEWPORT = {
    latitude: LAUNCH_COORDINATES.latitude,
    longitude: LAUNCH_COORDINATES.longitude,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
};

export const EXPLORE_DEBOUNCE_MS = 450;
export const EXPLORE_MAX_MARKERS = 40;
export const EXPLORE_MAX_RESULTS = 50;
export const EXPLORE_PREFIX_LIMIT = 40;

/** Clustering is not implemented. Cap markers; document if inventory exceeds this in a viewport. */
export const EXPLORE_CLUSTER_THRESHOLD = 40;
