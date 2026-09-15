import { haversineMeters } from '../property/geo.ts';
import {
    DISTANCE_UNIT_M,
    HOSPITAL_RADIUS_M,
    METRO_RADIUS_M,
    PROXIMITY_METHODOLOGY_VERSION,
    ROAD_RADIUS_M,
    SCHOOL_RADIUS_M,
} from './constants.ts';
import { normalizeMetric, unavailableMetric } from './metric.ts';
import type { DomainSection, GeoPointInput, IntelligenceMetric } from './types.ts';

function validPoint(point: GeoPointInput | null | undefined): point is GeoPointInput {
    return !!point
        && Number.isFinite(point.latitude)
        && Number.isFinite(point.longitude)
        && point.latitude >= -90 && point.latitude <= 90
        && point.longitude >= -180 && point.longitude <= 180;
}

export function nearestDistance(
    origin: GeoPointInput | null | undefined,
    points: GeoPointInput[] | null | undefined
): { point: GeoPointInput; meters: number } | null {
    if (!validPoint(origin) || !points?.length) return null;
    let best: { point: GeoPointInput; meters: number } | null = null;
    points.forEach((point) => {
        if (!validPoint(point)) return;
        const meters = haversineMeters(origin, point);
        if (!best || meters < best.meters) best = { point, meters };
    });
    return best;
}

export function countWithinRadius(
    origin: GeoPointInput | null | undefined,
    points: GeoPointInput[] | null | undefined,
    radiusMeters: number
): number {
    if (!validPoint(origin) || !points?.length || !(radiusMeters > 0)) return 0;
    return points.filter((point) => validPoint(point) && haversineMeters(origin, point) <= radiusMeters).length;
}

function emptyDomain(): DomainSection {
    return { status: 'UNAVAILABLE', confidence: 'UNKNOWN', metrics: {} };
}

function proximityMetrics(options: {
    origin?: GeoPointInput | null;
    points?: GeoPointInput[] | null;
    radiusMeters: number;
    nearestKey: string;
    countKey: string;
    nameKey: string;
    sourceClass?: IntelligenceMetric['sourceClass'];
    sourceLabel?: string | null;
    computedAt?: number;
}): Record<string, IntelligenceMetric> {
    const computedAt = options.computedAt ?? Date.now();
    const nearest = nearestDistance(options.origin, options.points);
    if (!nearest) {
        return {
            [options.nearestKey]: unavailableMetric(options.nearestKey, { unit: DISTANCE_UNIT_M }),
            [options.countKey]: unavailableMetric(options.countKey, { unit: 'count' }),
            [options.nameKey]: unavailableMetric(options.nameKey),
        };
    }
    const count = countWithinRadius(options.origin, options.points, options.radiusMeters);
    const shared = {
        sourceClass: options.sourceClass ?? null,
        sourceLabel: options.sourceLabel ?? null,
        computedAt,
        methodology: `Straight-line haversine from locality centroid. Radius ${options.radiusMeters} m. Not travel time.`,
        methodologyVersion: PROXIMITY_METHODOLOGY_VERSION,
        confidence: options.sourceClass ? 'MEDIUM' as const : 'UNKNOWN' as const,
        coverage: {
            sampleSize: (options.points || []).length,
            geographic: `Within ${options.radiusMeters} m of locality centroid`,
        },
        status: 'AVAILABLE' as const,
    };
    return {
        [options.nearestKey]: normalizeMetric({
            key: options.nearestKey,
            value: Math.round(nearest.meters),
            unit: DISTANCE_UNIT_M,
            ...shared,
        }),
        [options.countKey]: normalizeMetric({
            key: options.countKey,
            value: count,
            unit: 'count',
            ...shared,
        }),
        [options.nameKey]: normalizeMetric({
            key: options.nameKey,
            value: nearest.point.name || nearest.point.id || null,
            unit: null,
            ...shared,
            status: nearest.point.name || nearest.point.id ? 'AVAILABLE' : 'PARTIAL',
        }),
    };
}

export function computeTransportDomain(
    origin: GeoPointInput | null | undefined,
    stations: GeoPointInput[] | null | undefined,
    extras: { sourceClass?: IntelligenceMetric['sourceClass']; sourceLabel?: string | null } = {}
): DomainSection {
    if (!validPoint(origin) || !stations?.length) return emptyDomain();
    const metrics = proximityMetrics({
        origin,
        points: stations,
        radiusMeters: METRO_RADIUS_M,
        nearestKey: 'nearestMetroDistanceM',
        countKey: 'metroStationsWithinRadius',
        nameKey: 'nearestMetroName',
        ...extras,
    });
    return { status: 'AVAILABLE', confidence: extras.sourceClass ? 'MEDIUM' : 'UNKNOWN', metrics };
}

export function computeSchoolsDomain(
    origin: GeoPointInput | null | undefined,
    schools: GeoPointInput[] | null | undefined,
    extras: { sourceClass?: IntelligenceMetric['sourceClass']; sourceLabel?: string | null } = {}
): DomainSection {
    if (!validPoint(origin) || !schools?.length) return emptyDomain();
    const metrics = proximityMetrics({
        origin,
        points: schools,
        radiusMeters: SCHOOL_RADIUS_M,
        nearestKey: 'nearestSchoolDistanceM',
        countKey: 'schoolsWithinRadius',
        nameKey: 'nearestSchoolName',
        ...extras,
    });
    return { status: 'AVAILABLE', confidence: extras.sourceClass ? 'MEDIUM' : 'UNKNOWN', metrics };
}

export function computeHealthcareDomain(
    origin: GeoPointInput | null | undefined,
    hospitals: GeoPointInput[] | null | undefined,
    extras: { sourceClass?: IntelligenceMetric['sourceClass']; sourceLabel?: string | null } = {}
): DomainSection {
    if (!validPoint(origin) || !hospitals?.length) return emptyDomain();
    const metrics = proximityMetrics({
        origin,
        points: hospitals,
        radiusMeters: HOSPITAL_RADIUS_M,
        nearestKey: 'nearestHospitalDistanceM',
        countKey: 'hospitalsWithinRadius',
        nameKey: 'nearestHospitalName',
        ...extras,
    });
    return { status: 'AVAILABLE', confidence: extras.sourceClass ? 'MEDIUM' : 'UNKNOWN', metrics };
}

export function computeAirportDomain(
    origin: GeoPointInput | null | undefined,
    airports: GeoPointInput[] | null | undefined,
    extras: { sourceClass?: IntelligenceMetric['sourceClass']; sourceLabel?: string | null } = {}
): DomainSection {
    if (!validPoint(origin) || !airports?.length) return emptyDomain();
    const nearest = nearestDistance(origin, airports);
    if (!nearest) return emptyDomain();
    const computedAt = Date.now();
    const metrics = {
        nearestAirportDistanceM: normalizeMetric({
            key: 'nearestAirportDistanceM',
            value: Math.round(nearest.meters),
            unit: DISTANCE_UNIT_M,
            status: 'AVAILABLE',
            sourceClass: extras.sourceClass ?? 'INTERNAL',
            sourceLabel: extras.sourceLabel ?? 'Documented airport coordinates (straight-line)',
            computedAt,
            methodology: 'Haversine from locality centroid to airport point. Not travel time or traffic.',
            methodologyVersion: PROXIMITY_METHODOLOGY_VERSION,
            confidence: 'MEDIUM',
        }),
        nearestAirportName: normalizeMetric({
            key: 'nearestAirportName',
            value: nearest.point.name || nearest.point.id || null,
            status: nearest.point.name || nearest.point.id ? 'AVAILABLE' : 'PARTIAL',
            sourceClass: extras.sourceClass ?? 'INTERNAL',
            sourceLabel: extras.sourceLabel ?? 'Documented airport coordinates (straight-line)',
            computedAt,
            methodologyVersion: PROXIMITY_METHODOLOGY_VERSION,
            confidence: 'MEDIUM',
        }),
        calculationMethod: normalizeMetric({
            key: 'calculationMethod',
            value: 'haversine',
            status: 'AVAILABLE',
            sourceClass: extras.sourceClass ?? 'INTERNAL',
            computedAt,
            methodologyVersion: PROXIMITY_METHODOLOGY_VERSION,
            confidence: 'HIGH',
        }),
    };
    return { status: 'AVAILABLE', confidence: 'MEDIUM', metrics };
}

export function computeConnectivityDomain(
    origin: GeoPointInput | null | undefined,
    roads: GeoPointInput[] | null | undefined,
    extras: { sourceClass?: IntelligenceMetric['sourceClass']; sourceLabel?: string | null } = {}
): DomainSection {
    if (!validPoint(origin) || !roads?.length) return emptyDomain();
    const metrics = proximityMetrics({
        origin,
        points: roads,
        radiusMeters: ROAD_RADIUS_M,
        nearestKey: 'nearestMajorRoadDistanceM',
        countKey: 'majorRoadsWithinRadius',
        nameKey: 'nearestMajorRoadName',
        ...extras,
    });
    return { status: 'AVAILABLE', confidence: extras.sourceClass ? 'MEDIUM' : 'UNKNOWN', metrics };
}
