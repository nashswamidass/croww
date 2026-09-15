/**
 * Canonical geolocation for the property domain.
 *
 * Legacy event/map code mixes `coordinate`, `latitude`/`longitude`, and `lat`/`lng`,
 * and falls back to Mumbai / Bangalore / Bengaluru inconsistently.
 * Property records MUST use this module only.
 *
 * Canonical client shape: { latitude, longitude }
 * Firestore also stores `geo` as a GeoPoint (same numbers) for native queries.
 * `geohash` is stored for future prefix / radius queries. No map SDK is added here.
 */

export type GeoCoordinate = {
    latitude: number;
    longitude: number;
};

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function isValidLatitude(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function encodeGeohash(latitude: number, longitude: number, precision = 9): string {
    let idx = 0;
    let bit = 0;
    let evenBit = true;
    let geohash = '';

    let latMin = -90;
    let latMax = 90;
    let lonMin = -180;
    let lonMax = 180;

    while (geohash.length < precision) {
        if (evenBit) {
            const lonMid = (lonMin + lonMax) / 2;
            if (longitude > lonMid) {
                idx = idx * 2 + 1;
                lonMin = lonMid;
            } else {
                idx = idx * 2;
                lonMax = lonMid;
            }
        } else {
            const latMid = (latMin + latMax) / 2;
            if (latitude > latMid) {
                idx = idx * 2 + 1;
                latMin = latMid;
            } else {
                idx = idx * 2;
                latMax = latMid;
            }
        }
        evenBit = !evenBit;
        bit += 1;
        if (bit === 5) {
            geohash += BASE32.charAt(idx);
            bit = 0;
            idx = 0;
        }
    }
    return geohash;
}

export function toGeoCoordinate(input: {
    latitude?: unknown;
    longitude?: unknown;
    lat?: unknown;
    lng?: unknown;
} | null | undefined): GeoCoordinate | null {
    if (!input) return null;
    const latitude = typeof input.latitude === 'number' ? input.latitude : input.lat;
    const longitude = typeof input.longitude === 'number' ? input.longitude : input.lng;
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
    return { latitude, longitude };
}

export function buildGeoFields(latitude: number, longitude: number): GeoCoordinate & { geohash: string } {
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        throw new Error('Invalid coordinates');
    }
    return {
        latitude,
        longitude,
        geohash: encodeGeohash(latitude, longitude, 9),
    };
}

export type MapViewport = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
};

export type GeoBounds = {
    north: number;
    south: number;
    east: number;
    west: number;
};

export function viewportToBounds(viewport: MapViewport): GeoBounds {
    const latDelta = Math.abs(viewport.latitudeDelta) || 0.08;
    const lngDelta = Math.abs(viewport.longitudeDelta) || 0.08;
    return {
        north: Math.min(90, viewport.latitude + latDelta / 2),
        south: Math.max(-90, viewport.latitude - latDelta / 2),
        east: Math.min(180, viewport.longitude + lngDelta / 2),
        west: Math.max(-180, viewport.longitude - lngDelta / 2),
    };
}

export function isCoordinateInBounds(latitude: number, longitude: number, bounds: GeoBounds): boolean {
    return latitude >= bounds.south
        && latitude <= bounds.north
        && longitude >= bounds.west
        && longitude <= bounds.east;
}

/** Prefix length for viewport queries. Stored geohash is precision 9; queries use a prefix. */
export function geohashPrecisionForDelta(latitudeDelta: number): number {
    const km = Math.abs(latitudeDelta) * 111;
    if (km > 80) return 3;
    if (km > 25) return 4;
    if (km > 8) return 5;
    return 6;
}

export function geohashEndExclusive(prefix: string): string {
    return `${prefix}\uf8ff`;
}

/**
 * Cover a viewport with a small set of geohash prefixes.
 * Samples a grid so we do not use a single incorrect lat/lng equality filter.
 */
export function geohashPrefixesForViewport(viewport: MapViewport, maxPrefixes = 9): {
    prefixes: string[];
    precision: number;
} {
    const bounds = viewportToBounds(viewport);
    let precision = geohashPrecisionForDelta(Math.max(viewport.latitudeDelta, viewport.longitudeDelta));
    let prefixes = samplePrefixes(bounds, precision);
    while (prefixes.length > maxPrefixes && precision > 3) {
        precision -= 1;
        prefixes = samplePrefixes(bounds, precision);
    }
    if (!prefixes.length) {
        prefixes = [encodeGeohash(viewport.latitude, viewport.longitude, precision)];
    }
    return { prefixes, precision };
}

function samplePrefixes(bounds: GeoBounds, precision: number): string[] {
    const set = new Set<string>();
    const steps = 4;
    for (let i = 0; i <= steps; i += 1) {
        const latitude = bounds.south + ((bounds.north - bounds.south) * i) / steps;
        for (let j = 0; j <= steps; j += 1) {
            const longitude = bounds.west + ((bounds.east - bounds.west) * j) / steps;
            if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
                set.add(encodeGeohash(latitude, longitude, precision));
            }
        }
    }
    return [...set];
}

/**
 * Public pin stored on properties/listings.
 * Exact precision: public == exact.
 * Approximate: stable offset from exact (seeded by property id).
 * Locality: locality centroid when provided, otherwise a larger stable offset.
 *
 * Call this at WRITE time. Public documents must store the result, not the exact coordinate.
 */
export function derivePublicCoordinate(
    seed: string,
    exact: GeoCoordinate,
    precision: string | null | undefined,
    localityCoordinate?: GeoCoordinate | null
): GeoCoordinate {
    if (precision === 'exact') {
        return { latitude: exact.latitude, longitude: exact.longitude };
    }
    if (precision === 'locality' && localityCoordinate
        && isValidLatitude(localityCoordinate.latitude)
        && isValidLongitude(localityCoordinate.longitude)
    ) {
        return {
            latitude: localityCoordinate.latitude,
            longitude: localityCoordinate.longitude,
        };
    }
    const meters = precision === 'locality' ? 750 : 220;
    return jitterCoordinate(seed || 'property', exact.latitude, exact.longitude, meters);
}

export function buildPublicGeoFields(
    seed: string,
    exactLatitude: number,
    exactLongitude: number,
    precision: string | null | undefined,
    localityCoordinate?: GeoCoordinate | null
): GeoCoordinate & { geohash: string } {
    const exact = buildGeoFields(exactLatitude, exactLongitude);
    const publicPin = derivePublicCoordinate(
        seed,
        exact,
        precision,
        localityCoordinate
    );
    return buildGeoFields(publicPin.latitude, publicPin.longitude);
}

/**
 * Map display helper. After public/private split, stored listing/property
 * latitude/longitude ARE the public pin — do not jitter again.
 */
export function toPublicMapCoordinate(
    _listingId: string,
    latitude: number,
    longitude: number,
    _precision?: string | null
): GeoCoordinate {
    return { latitude, longitude };
}

/** Rough India mainland bbox. Used as a consistency check, never as a default pin. */
export function isLikelyInIndia(latitude: number, longitude: number): boolean {
    return latitude >= 6.5 && latitude <= 37.2 && longitude >= 68.0 && longitude <= 97.5;
}

export function haversineMeters(a: GeoCoordinate, b: GeoCoordinate): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function jitterCoordinate(seed: string, latitude: number, longitude: number, meters: number): GeoCoordinate {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    const angle = ((hash % 360) / 360) * Math.PI * 2;
    const dist = meters * (0.55 + (Math.abs(hash) % 45) / 100);
    const dLat = (dist * Math.cos(angle)) / 111320;
    const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos((latitude * Math.PI) / 180) || 1);
    return {
        latitude: Math.max(-90, Math.min(90, latitude + dLat)),
        longitude: Math.max(-180, Math.min(180, longitude + dLng)),
    };
}
