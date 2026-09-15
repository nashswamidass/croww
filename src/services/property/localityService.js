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
        const q = query(
            collection(db, COLLECTIONS.localities),
            where('city', '==', city),
            where('status', '==', 'ACTIVE'),
            orderBy('name', 'asc')
        );
        const snap = await withTimeout(getDocs(q), 10000, 'listActiveByCity');
        return snap.docs.map(toRecord);
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
        return { id: ref.id, ...payload };
    },
};
