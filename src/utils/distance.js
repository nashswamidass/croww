// Haversine formula to calculate distance directly given lat/long
export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};

export const formatDistance = (distanceKm) => {
    if (!distanceKm) return '';
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
};

// Rough estimate: 30km/h average city driving speed
const AVERAGE_SPEED_KMH = 30;

export const estimateTravelTime = (distanceKm) => {
    if (!distanceKm) return '';
    const timeHours = distanceKm / AVERAGE_SPEED_KMH;
    const timeMinutes = Math.round(timeHours * 60);

    if (timeMinutes < 60) {
        return `${timeMinutes} min`;
    }
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    return `${hours}h ${mins}m`;
};
