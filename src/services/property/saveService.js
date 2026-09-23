import {
    collection,
    deleteDoc,
    doc,
    documentId,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
    COLLECTIONS,
    MAX_SAVED_LISTINGS,
    MAX_SAVED_PROPERTIES,
    SAVED_LISTINGS_SUBCOLLECTION,
    SAVED_LIST_READ_LIMIT,
    SAVED_PROPERTIES_SUBCOLLECTION,
    listingSaveSnapshot,
    propertySaveSnapshot,
} from '../../domain/property';

const withTimeout = (promise, ms = 10000, label = 'saveService') =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms)
        ),
    ]);

const SAVED_CACHE_TTL_MS = 30 * 1000; // 30 seconds fresh cache to collapse render/navigation spikes

const inFlightSavedRequests = new Map();
const savedListingsCache = new Map(); // uid -> { data, timestamp }
const savedPropertiesCache = new Map(); // uid -> { data, timestamp }
const savedIdsCache = new Map(); // `${uid}:${subcollection}` -> { data, timestamp }

export function clearSavedCache(uid = null) {
    if (uid) {
        savedListingsCache.delete(uid);
        savedPropertiesCache.delete(uid);
        savedIdsCache.delete(`${uid}:${SAVED_LISTINGS_SUBCOLLECTION}`);
        savedIdsCache.delete(`${uid}:${SAVED_PROPERTIES_SUBCOLLECTION}`);
    } else {
        savedListingsCache.clear();
        savedPropertiesCache.clear();
        savedIdsCache.clear();
    }
}

function requireUid() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in');
    return uid;
}

function toRecord(snapshot) {
    return { id: snapshot.id, ...snapshot.data() };
}

function col(uid, name) {
    return collection(db, 'users', uid, name);
}

async function countDocs(uid, name, cap) {
    const snap = await withTimeout(
        getDocs(query(col(uid, name), limit(cap + 1))),
        10000,
        `count:${name}`
    );
    return snap.size;
}

async function getDocsByIds(collectionName, ids) {
    const unique = [...new Set(ids.filter(Boolean))].slice(0, SAVED_LIST_READ_LIMIT);
    if (!unique.length) return new Map();
    const chunks = [];
    for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
    const maps = await Promise.all(chunks.map(async (chunk) => {
        const q = query(collection(db, collectionName), where(documentId(), 'in', chunk));
        const snap = await withTimeout(getDocs(q), 10000, `ids:${collectionName}`);
        return snap.docs.map(toRecord);
    }));
    const byId = new Map();
    maps.flat().forEach((row) => byId.set(row.id, row));
    return byId;
}

export const saveService = {
    clearCache: clearSavedCache,

    listingRef(listingId) {
        return doc(db, 'users', requireUid(), SAVED_LISTINGS_SUBCOLLECTION, listingId);
    },

    propertyRef(propertyId) {
        return doc(db, 'users', requireUid(), SAVED_PROPERTIES_SUBCOLLECTION, propertyId);
    },

    async isListingSaved(listingId) {
        if (!listingId || !auth.currentUser?.uid) return false;
        const uid = auth.currentUser.uid;
        // Fast-path: check cached IDs or listings first
        const cachedIds = savedIdsCache.get(`${uid}:${SAVED_LISTINGS_SUBCOLLECTION}`);
        if (cachedIds && Date.now() - cachedIds.timestamp < SAVED_CACHE_TTL_MS) {
            return cachedIds.data.includes(listingId);
        }
        const cachedListings = savedListingsCache.get(uid);
        if (cachedListings && Date.now() - cachedListings.timestamp < SAVED_CACHE_TTL_MS) {
            return cachedListings.data.some((r) => (r.listingId || r.id) === listingId);
        }
        const snap = await withTimeout(getDoc(this.listingRef(listingId)), 8000, 'isListingSaved');
        return snap.exists();
    },

    async isPropertySaved(propertyId) {
        if (!propertyId || !auth.currentUser?.uid) return false;
        const uid = auth.currentUser.uid;
        // Fast-path: check cached IDs or properties first
        const cachedIds = savedIdsCache.get(`${uid}:${SAVED_PROPERTIES_SUBCOLLECTION}`);
        if (cachedIds && Date.now() - cachedIds.timestamp < SAVED_CACHE_TTL_MS) {
            return cachedIds.data.includes(propertyId);
        }
        const cachedProperties = savedPropertiesCache.get(uid);
        if (cachedProperties && Date.now() - cachedProperties.timestamp < SAVED_CACHE_TTL_MS) {
            return cachedProperties.data.some((r) => (r.propertyId || r.id) === propertyId);
        }
        const snap = await withTimeout(getDoc(this.propertyRef(propertyId)), 8000, 'isPropertySaved');
        return snap.exists();
    },

    async saveListing(listing, extras = {}) {
        const uid = requireUid();
        const listingId = listing?.id || listing?.listingId;
        if (!listingId) throw new Error('Listing is required');
        const existing = await getDoc(doc(db, 'users', uid, SAVED_LISTINGS_SUBCOLLECTION, listingId));
        if (!existing.exists()) {
            const n = await countDocs(uid, SAVED_LISTINGS_SUBCOLLECTION, MAX_SAVED_LISTINGS);
            if (n >= MAX_SAVED_LISTINGS) throw new Error(`You can save up to ${MAX_SAVED_LISTINGS} listings`);
        }
        const payload = {
            listingId,
            propertyId: listing.propertyId || null,
            snapshot: listingSaveSnapshot(listing, extras),
            savedAt: serverTimestamp(),
            kind: 'savedListing',
        };
        await withTimeout(
            setDoc(doc(db, 'users', uid, SAVED_LISTINGS_SUBCOLLECTION, listingId), payload),
            10000,
            'saveListing'
        );
        clearSavedCache(uid);
        return payload;
    },

    async unsaveListing(listingId) {
        const uid = requireUid();
        if (!listingId) return;
        await withTimeout(
            deleteDoc(doc(db, 'users', uid, SAVED_LISTINGS_SUBCOLLECTION, listingId)),
            8000,
            'unsaveListing'
        );
        clearSavedCache(uid);
    },

    async saveProperty(property, extras = {}) {
        const uid = requireUid();
        const propertyId = property?.id || property?.propertyId;
        if (!propertyId) throw new Error('Property is required');
        const existing = await getDoc(doc(db, 'users', uid, SAVED_PROPERTIES_SUBCOLLECTION, propertyId));
        if (!existing.exists()) {
            const n = await countDocs(uid, SAVED_PROPERTIES_SUBCOLLECTION, MAX_SAVED_PROPERTIES);
            if (n >= MAX_SAVED_PROPERTIES) throw new Error(`You can save up to ${MAX_SAVED_PROPERTIES} properties`);
        }
        const payload = {
            propertyId,
            snapshot: propertySaveSnapshot(property, extras),
            savedAt: serverTimestamp(),
            kind: 'savedProperty',
        };
        await withTimeout(
            setDoc(doc(db, 'users', uid, SAVED_PROPERTIES_SUBCOLLECTION, propertyId), payload),
            10000,
            'saveProperty'
        );
        clearSavedCache(uid);
        return payload;
    },

    async unsaveProperty(propertyId) {
        const uid = requireUid();
        if (!propertyId) return;
        await withTimeout(
            deleteDoc(doc(db, 'users', uid, SAVED_PROPERTIES_SUBCOLLECTION, propertyId)),
            8000,
            'unsaveProperty'
        );
        clearSavedCache(uid);
    },

    async listSavedIds(subcollection, cap, options = {}) {
        const { forceRefresh = false } = options;
        const uid = requireUid();
        const now = Date.now();
        const cacheKey = `${uid}:${subcollection}`;

        if (!forceRefresh) {
            const cached = savedIdsCache.get(cacheKey);
            if (cached && now - cached.timestamp < SAVED_CACHE_TTL_MS) {
                return cached.data.slice(0, cap);
            }
        }

        const inFlightKey = `ids:${cacheKey}`;
        if (inFlightSavedRequests.has(inFlightKey)) {
            return inFlightSavedRequests.get(inFlightKey);
        }

        const fetchPromise = (async () => {
            try {
                const snap = await withTimeout(
                    getDocs(query(col(uid, subcollection), limit(cap))),
                    10000,
                    `savedIds:${subcollection}`
                );
                const ids = snap.docs.map((row) => row.id);
                savedIdsCache.set(cacheKey, { data: ids, timestamp: Date.now() });
                return ids;
            } finally {
                inFlightSavedRequests.delete(inFlightKey);
            }
        })();

        inFlightSavedRequests.set(inFlightKey, fetchPromise);
        return fetchPromise;
    },

    async listSavedListings(options = {}) {
        const { forceRefresh = false } = options;
        const uid = requireUid();
        const now = Date.now();

        if (!forceRefresh) {
            const cached = savedListingsCache.get(uid);
            if (cached && now - cached.timestamp < SAVED_CACHE_TTL_MS) {
                return cached.data;
            }
        }

        const inFlightKey = `listings:${uid}`;
        if (inFlightSavedRequests.has(inFlightKey)) {
            return inFlightSavedRequests.get(inFlightKey);
        }

        const fetchPromise = (async () => {
            try {
                const snap = await withTimeout(
                    getDocs(query(
                        col(uid, SAVED_LISTINGS_SUBCOLLECTION),
                        orderBy('savedAt', 'desc'),
                        limit(SAVED_LIST_READ_LIMIT)
                    )),
                    10000,
                    'listSavedListings'
                );
                const saved = snap.docs.map(toRecord);
                if (saved.length === 0) {
                    savedListingsCache.set(uid, { data: [], timestamp: Date.now() });
                    savedIdsCache.set(`${uid}:${SAVED_LISTINGS_SUBCOLLECTION}`, { data: [], timestamp: Date.now() });
                    return [];
                }
                const ids = saved.map((row) => row.listingId || row.id);
                const live = await getDocsByIds(COLLECTIONS.listings, ids);
                const result = saved.map((row) => {
                    const listing = live.get(row.listingId || row.id) || null;
                    return { ...row, listing, missing: !listing };
                });

                savedListingsCache.set(uid, { data: result, timestamp: Date.now() });
                savedIdsCache.set(`${uid}:${SAVED_LISTINGS_SUBCOLLECTION}`, { data: ids, timestamp: Date.now() });
                return result;
            } finally {
                inFlightSavedRequests.delete(inFlightKey);
            }
        })();

        inFlightSavedRequests.set(inFlightKey, fetchPromise);
        return fetchPromise;
    },

    async listSavedProperties(options = {}) {
        const { forceRefresh = false } = options;
        const uid = requireUid();
        const now = Date.now();

        if (!forceRefresh) {
            const cached = savedPropertiesCache.get(uid);
            if (cached && now - cached.timestamp < SAVED_CACHE_TTL_MS) {
                return cached.data;
            }
        }

        const inFlightKey = `properties:${uid}`;
        if (inFlightSavedRequests.has(inFlightKey)) {
            return inFlightSavedRequests.get(inFlightKey);
        }

        const fetchPromise = (async () => {
            try {
                const snap = await withTimeout(
                    getDocs(query(
                        col(uid, SAVED_PROPERTIES_SUBCOLLECTION),
                        orderBy('savedAt', 'desc'),
                        limit(SAVED_LIST_READ_LIMIT)
                    )),
                    10000,
                    'listSavedProperties'
                );
                const saved = snap.docs.map(toRecord);
                if (saved.length === 0) {
                    savedPropertiesCache.set(uid, { data: [], timestamp: Date.now() });
                    savedIdsCache.set(`${uid}:${SAVED_PROPERTIES_SUBCOLLECTION}`, { data: [], timestamp: Date.now() });
                    return [];
                }
                const ids = saved.map((row) => row.propertyId || row.id);
                const live = await getDocsByIds(COLLECTIONS.properties, ids);
                const validLiveIds = ids.filter((id) => live.has(id));
                const publishedCounts = validLiveIds.length > 0
                    ? await this.countPublishedListings(validLiveIds)
                    : new Map();

                const result = saved.map((row) => {
                    const propertyId = row.propertyId || row.id;
                    const property = live.get(propertyId) || null;
                    return {
                        ...row,
                        property,
                        missing: !property,
                        publishedListingCount: publishedCounts.get(propertyId) || 0,
                    };
                });

                savedPropertiesCache.set(uid, { data: result, timestamp: Date.now() });
                savedIdsCache.set(`${uid}:${SAVED_PROPERTIES_SUBCOLLECTION}`, { data: ids, timestamp: Date.now() });
                return result;
            } finally {
                inFlightSavedRequests.delete(inFlightKey);
            }
        })();

        inFlightSavedRequests.set(inFlightKey, fetchPromise);
        return fetchPromise;
    },

    async countPublishedListings(propertyIds) {
        const unique = [...new Set(propertyIds.filter(Boolean))].slice(0, SAVED_LIST_READ_LIMIT);
        if (!unique.length) return new Map();
        const counts = new Map(unique.map((id) => [id, 0]));
        const chunks = [];
        for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
        await Promise.all(chunks.map(async (chunk) => {
            const q = query(
                collection(db, COLLECTIONS.listings),
                where('propertyId', 'in', chunk),
                where('status', '==', 'PUBLISHED'),
                limit(50)
            );
            const snap = await withTimeout(getDocs(q), 10000, 'publishedCounts');
            snap.docs.forEach((item) => {
                const propertyId = item.data().propertyId;
                if (propertyId && counts.has(propertyId)) {
                    counts.set(propertyId, (counts.get(propertyId) || 0) + 1);
                }
            });
        }));
        return counts;
    },
};
