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
    listingRef(listingId) {
        return doc(db, 'users', requireUid(), SAVED_LISTINGS_SUBCOLLECTION, listingId);
    },

    propertyRef(propertyId) {
        return doc(db, 'users', requireUid(), SAVED_PROPERTIES_SUBCOLLECTION, propertyId);
    },

    async isListingSaved(listingId) {
        if (!listingId || !auth.currentUser?.uid) return false;
        const snap = await withTimeout(getDoc(this.listingRef(listingId)), 8000, 'isListingSaved');
        return snap.exists();
    },

    async isPropertySaved(propertyId) {
        if (!propertyId || !auth.currentUser?.uid) return false;
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
    },

    async listSavedIds(subcollection, cap) {
        const uid = requireUid();
        const snap = await withTimeout(
            getDocs(query(col(uid, subcollection), limit(cap))),
            10000,
            `savedIds:${subcollection}`
        );
        return snap.docs.map((row) => row.id);
    },

    async listSavedListings() {
        const uid = requireUid();
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
        const live = await getDocsByIds(COLLECTIONS.listings, saved.map((row) => row.listingId || row.id));
        return saved.map((row) => {
            const listing = live.get(row.listingId || row.id) || null;
            return { ...row, listing, missing: !listing };
        });
    },

    async listSavedProperties() {
        const uid = requireUid();
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
        const ids = saved.map((row) => row.propertyId || row.id);
        const live = await getDocsByIds(COLLECTIONS.properties, ids);
        const publishedCounts = await this.countPublishedListings(ids);
        return saved.map((row) => {
            const propertyId = row.propertyId || row.id;
            const property = live.get(propertyId) || null;
            return {
                ...row,
                property,
                missing: !property,
                publishedListingCount: publishedCounts.get(propertyId) || 0,
            };
        });
    },

    async countPublishedListings(propertyIds) {
        const unique = [...new Set(propertyIds.filter(Boolean))].slice(0, SAVED_LIST_READ_LIMIT);
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
