import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    where,
    GeoPoint,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    COLLECTIONS,
    DEFAULT_COUNTRY,
    assertNoIssues,
    buildGeoFields,
    validateLocalityInput,
} from '../../domain/property';

const withTimeout = (promise, ms = 10000, label = 'localityService') =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms)
        ),
    ]);

function toRecord(snapshot) {
    return { id: snapshot.id, ...snapshot.data() };
}

function isPermissionDenied(error) {
    const code = error?.code || '';
    return code === 'permission-denied' || code === 'firestore/permission-denied';
}

const ASYNC_STORAGE_PREFIX = '@croww_locality_cache:';
const LOCALITY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

// In-memory cache: city -> { timestamp, data }
const inMemoryLocalityCache = new Map();
// In-flight request deduplication: city -> Promise
const inFlightLocalityRequests = new Map();

async function getCachedLocalities(city) {
    const inMem = inMemoryLocalityCache.get(city);
    if (inMem && Array.isArray(inMem.data)) {
        const isStale = Date.now() - inMem.timestamp > LOCALITY_CACHE_TTL_MS;
        return { data: inMem.data, isStale };
    }

    try {
        const stored = await AsyncStorage.getItem(ASYNC_STORAGE_PREFIX + city);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && Array.isArray(parsed.data)) {
                inMemoryLocalityCache.set(city, parsed);
                const isStale = Date.now() - parsed.timestamp > LOCALITY_CACHE_TTL_MS;
                return { data: parsed.data, isStale };
            }
        }
    } catch {
        // Fallback silently if storage unavailable
    }

    return null;
}

async function saveCachedLocalities(city, data) {
    const record = { timestamp: Date.now(), data };
    inMemoryLocalityCache.set(city, record);
    try {
        await AsyncStorage.setItem(ASYNC_STORAGE_PREFIX + city, JSON.stringify(record));
    } catch {
        // Ignore storage write failures (e.g. quota or unsupported platform)
    }
}

async function fetchAndCacheLocalities(city) {
    if (inFlightLocalityRequests.has(city)) {
        return inFlightLocalityRequests.get(city);
    }

    const promise = (async () => {
        try {
            const q = query(
                collection(db, COLLECTIONS.localities),
                where('city', '==', city),
                where('status', '==', 'ACTIVE'),
                orderBy('name', 'asc')
            );
            const snap = await withTimeout(getDocs(q), 10000, 'listActiveByCity');
            const records = snap.docs.map(toRecord);
            await saveCachedLocalities(city, records);
            return records;
        } finally {
            inFlightLocalityRequests.delete(city);
        }
    })();

    inFlightLocalityRequests.set(city, promise);
    return promise;
}

export const localityService = {
    async getLocality(localityId) {
        if (!localityId) return null;
        try {
            const snap = await withTimeout(
                getDoc(doc(db, COLLECTIONS.localities, localityId)),
                10000,
                'getLocality'
            );
            return snap.exists() ? toRecord(snap) : null;
        } catch (error) {
            if (isPermissionDenied(error)) return null;
            throw error;
        }
    },

    async listActiveByCity(city) {
        if (!city) return [];
        const cached = await getCachedLocalities(city);
        if (cached) {
            if (cached.isStale) {
                // Background revalidation (stale-while-revalidate)
                fetchAndCacheLocalities(city).catch((err) => {
                    console.warn('[localityService] Background revalidation failed:', err?.message);
                });
            }
            return cached.data;
        }
        return fetchAndCacheLocalities(city);
    },

    async clearLocalityCache(city = null) {
        if (city) {
            inMemoryLocalityCache.delete(city);
            try {
                await AsyncStorage.removeItem(ASYNC_STORAGE_PREFIX + city);
            } catch {
                // Ignore storage error
            }
        } else {
            inMemoryLocalityCache.clear();
            try {
                const keys = await AsyncStorage.getAllKeys();
                const localityKeys = keys.filter((k) => k.startsWith(ASYNC_STORAGE_PREFIX));
                if (localityKeys.length) {
                    await AsyncStorage.multiRemove(localityKeys);
                }
            } catch {
                // Ignore storage error
            }
        }
    },

    /**
     * Catalog writes are admin-only in Firestore rules.
     * Callers must be an authenticated admin user.
     */
    async createLocality(input = {}) {
        if (!auth.currentUser) throw new Error('You must be signed in');
        const issues = validateLocalityInput(input);
        assertNoIssues(issues);
        const geo = buildGeoFields(input.latitude, input.longitude);
        const payload = {
            name: input.name.trim(),
            city: input.city.trim(),
            state: input.state.trim(),
            country: (input.country || DEFAULT_COUNTRY).trim(),
            aliases: Array.isArray(input.aliases) ? input.aliases : [],
            latitude: geo.latitude,
            longitude: geo.longitude,
            geohash: geo.geohash,
            geo: new GeoPoint(geo.latitude, geo.longitude),
            bounds: input.bounds || null,
            status: input.status || 'ACTIVE',
            source: {
                type: 'admin',
                channel: 'ADMIN_CREATED',
                uid: auth.currentUser.uid,
                importedAt: serverTimestamp(),
                authoritative: true,
                externalId: null,
            },
            stats: null,
            intelligence: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const ref = await withTimeout(
            addDoc(collection(db, COLLECTIONS.localities), payload),
            10000,
            'createLocality'
        );
        await this.clearLocalityCache(payload.city);
        return { id: ref.id, ...payload };
    },
};
