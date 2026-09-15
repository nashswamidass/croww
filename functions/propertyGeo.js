/**
 * Public-pin derivation for Cloud Functions.
 * Must stay aligned with src/domain/property/geo.ts derivePublicCoordinate / encodeGeohash.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(latitude, longitude, precision = 9) {
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

function jitterCoordinate(seed, latitude, longitude, meters) {
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

function derivePublicCoordinate(seed, exact, precision, localityCoordinate) {
    if (precision === 'exact') {
        return { latitude: exact.latitude, longitude: exact.longitude };
    }
    if (
        precision === 'locality'
        && localityCoordinate
        && Number.isFinite(localityCoordinate.latitude)
        && Number.isFinite(localityCoordinate.longitude)
    ) {
        return {
            latitude: localityCoordinate.latitude,
            longitude: localityCoordinate.longitude,
        };
    }
    const meters = precision === 'locality' ? 750 : 220;
    return jitterCoordinate(seed || 'property', exact.latitude, exact.longitude, meters);
}

function buildPublicGeoFields(seed, exactLatitude, exactLongitude, precision, localityCoordinate) {
    const publicPin = derivePublicCoordinate(
        seed,
        { latitude: exactLatitude, longitude: exactLongitude },
        precision,
        localityCoordinate
    );
    return {
        latitude: publicPin.latitude,
        longitude: publicPin.longitude,
        geohash: encodeGeohash(publicPin.latitude, publicPin.longitude, 9),
    };
}

module.exports = {
    encodeGeohash,
    derivePublicCoordinate,
    buildPublicGeoFields,
};
