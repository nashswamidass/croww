import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
    COLLECTIONS,
    geohashEndExclusive,
    geohashPrefixesForViewport,
    isCoordinateInBounds,
    toPublicMapCoordinate,
    viewportToBounds,
} from '../../domain/property';
import {
    EXPLORE_MAX_RESULTS,
    EXPLORE_PREFIX_LIMIT,
} from '../../constants/explore';

const withTimeout = (promise, ms = 12000, label = 'discoveryService') =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms)
        ),
    ]);

function toRecord(snapshot) {
    return { id: snapshot.id, ...snapshot.data() };
}

function listingPrice(row) {
    if (row.transactionType === 'rent') return row.rentMonthly ?? null;
    return row.askingPrice ?? null;
}

function toDiscoveryItem(row) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const mapCoordinate = toPublicMapCoordinate(
        row.id,
        latitude,
        longitude,
        row.locationPrecision
    );
    return {
        listingId: row.id,
        propertyId: row.propertyId,
        title: row.title || '',
        transactionType: row.transactionType,
        price: listingPrice(row),
        askingPrice: row.askingPrice ?? null,
        rentMonthly: row.rentMonthly ?? null,
        category: row.category,
        subtype: row.subtype,
        bedrooms: row.bedrooms ?? null,
        bathrooms: row.bathrooms ?? null,
        builtUpAreaSqft: row.builtUpAreaSqft ?? null,
        plotAreaSqft: row.plotAreaSqft ?? null,
        city: row.city || null,
        localityId: row.localityId || null,
        locationPrecision: row.locationPrecision || 'exact',
        mapCoordinate,
        coverThumbnailUrl: row.coverThumbnailUrl || row.thumbnailUrl || null,
        publishedAt: row.publishedAt || null,
        updatedAt: row.updatedAt || null,
        lastVerifiedAt: row.lastVerifiedAt || null,
        listingTypeId: row.listingTypeId || row.taxonomyId || row.subtype || null,
        representationStatus: row.representationStatus || 'unverified',
        verification: row.verification || null,
        spatialTourAvailable: row.spatialTourAvailable === true,
    };
}

async function queryPrefix(prefix, transactionType) {
    const constraints = [
        where('status', '==', 'PUBLISHED'),
        where('geohash', '>=', prefix),
        where('geohash', '<', geohashEndExclusive(prefix)),
        orderBy('geohash'),
        limit(EXPLORE_PREFIX_LIMIT),
    ];
    if (transactionType === 'buy' || transactionType === 'rent') {
        constraints.splice(1, 0, where('transactionType', '==', transactionType));
    }
    const q = query(collection(db, COLLECTIONS.listings), ...constraints);
    const snap = await withTimeout(getDocs(q), 12000, `discover:${prefix}`);
    return snap.docs.map(toRecord);
}

function applyClientFilters(items, filters = {}) {
    return items.filter((item) => {
        if (filters.category && item.category !== filters.category) return false;
        if (filters.listingTypeId) {
            const itemTypeId = item.listingTypeId || item.subtype;
            const target = filters.listingTypeId;
            const targetClean = target.replace('stay_', '').replace('res_', '').replace('com_', '');
            if (itemTypeId !== target && !item.subtype?.includes(targetClean)) {
                return false;
            }
        }
        if (filters.subtype) {
            const itemTypeId = item.listingTypeId || item.subtype;
            const target = filters.subtype;
            const targetClean = target.replace('stay_', '').replace('res_', '').replace('com_', '');
            if (item.subtype !== target && itemTypeId !== target && !item.subtype?.includes(targetClean)) {
                return false;
            }
        }
        if (filters.bhk != null) {
            const beds = item.bedrooms;
            if (beds == null) return false;
            if (filters.bhk >= 5) {
                if (beds < 5) return false;
            } else if (beds !== filters.bhk) {
                return false;
            }
        }
        if (filters.minPrice != null && (item.price == null || item.price < filters.minPrice)) return false;
        if (filters.maxPrice != null && (item.price == null || item.price > filters.maxPrice)) return false;
        return true;
    });
}

export const discoveryService = {
    /**
     * Published listings in a map viewport via geohash prefixes.
     * Does not N+1 into properties. Client filters category/BHK/price.
     */
    async discoverPublishedInViewport({ viewport, transactionType } = {}) {
        if (!viewport || typeof viewport.latitude !== 'number') {
            return [];
        }
        const { prefixes } = geohashPrefixesForViewport(viewport);
        const bounds = viewportToBounds(viewport);
        const chunks = await Promise.all(
            prefixes.map((prefix) => queryPrefix(prefix, transactionType).catch((err) => {
                console.warn('[discoveryService] prefix query failed', prefix, err?.message);
                return [];
            }))
        );
        const byId = new Map();
        chunks.flat().forEach((row) => {
            if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
        });
        const inBounds = [...byId.values()].filter((row) => {
            const lat = Number(row.latitude);
            const lng = Number(row.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
            if (row.expiresAt) {
                const expires = row.expiresAt.toDate
                    ? row.expiresAt.toDate().getTime()
                    : (row.expiresAt.seconds ? row.expiresAt.seconds * 1000 : Date.parse(row.expiresAt));
                if (Number.isFinite(expires) && expires < Date.now()) return false;
            }
            return isCoordinateInBounds(lat, lng, bounds);
        });
        return inBounds.map(toDiscoveryItem).slice(0, EXPLORE_MAX_RESULTS);
    },
};

export function filterDiscoveryResults(items, filters = {}) {
    return applyClientFilters(items, filters);
}
