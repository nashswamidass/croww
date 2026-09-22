import {
    collection,
    deleteDoc,
    doc,
    getCountFromServer,
    getDoc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    GeoPoint,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
    COLLECTIONS,
    DEFAULT_COUNTRY,
    DEFAULT_VERIFICATION_STATUS,
    PRIVATE_GEO_DOC_ID,
    PRIVATE_GEO_SUBCOLLECTION,
    assertNoIssues,
    buildGeoFields,
    buildPublicGeoFields,
    canTransitionProperty,
    normalizeAddress,
    publicAddressFromInput,
    validatePropertyInput,
} from '../../domain/property';

const withTimeout = (promise, ms = 10000, label = 'propertyService') =>
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

function unverifiedBlock() {
    const record = {
        status: DEFAULT_VERIFICATION_STATUS,
        updatedAt: serverTimestamp(),
        verifiedAt: null,
        expiresAt: null,
    };
    return {
        identity: { ...record },
        ownership: { ...record },
        property: { ...record },
        location: { ...record },
    };
}

function toRecord(snapshot) {
    return { id: snapshot.id, ...snapshot.data() };
}

function isPermissionDenied(error) {
    const code = error?.code || '';
    return code === 'permission-denied' || code === 'firestore/permission-denied';
}

function privateGeoRef(propertyId) {
    return doc(db, COLLECTIONS.properties, propertyId, PRIVATE_GEO_SUBCOLLECTION, PRIVATE_GEO_DOC_ID);
}

async function writePrivateGeo(propertyId, uid, exact, extras = {}) {
    const geo = buildGeoFields(exact.latitude, exact.longitude);
    await withTimeout(
        setDoc(privateGeoRef(propertyId), {
            latitude: geo.latitude,
            longitude: geo.longitude,
            geohash: geo.geohash,
            geo: new GeoPoint(geo.latitude, geo.longitude),
            addressLine1: extras.addressLine1 || null,
            pincode: extras.pincode || null,
            updatedAt: serverTimestamp(),
            updatedByUid: uid,
        }),
        10000,
        'writePrivateGeo'
    );
}

export const propertyService = {
    /**
     * Creates a public property document (public pin only) plus private_geo/current.
     * `input.latitude` / `input.longitude` are treated as the exact location and are
     * not stored on the public document unless locationPrecision is `exact`.
     */
    async createProperty(input = {}) {
        const uid = requireUid();
        const issues = validatePropertyInput(input);
        assertNoIssues(issues);

        const ref = doc(collection(db, COLLECTIONS.properties));
        const precision = input.locationPrecision || input.locationVisibility || 'approximate_on_request';
        const visibility = input.locationVisibility || (precision === 'exact' ? 'exact' : precision === 'approximate' ? 'approximate' : 'approximate_on_request');
        const exact = buildGeoFields(input.latitude, input.longitude);
        const publicGeo = buildPublicGeoFields(
            ref.id,
            exact.latitude,
            exact.longitude,
            precision,
            input.localityCoordinate || null
        );

        const address = input.address || {};
        const publicAddress = publicAddressFromInput({
            ...address,
            country: address.country || input.country || DEFAULT_COUNTRY,
        }, precision);
        const city = (publicAddress.city || input.city || '').trim();
        const state = (publicAddress.state || input.state || '').trim();
        const country = (publicAddress.country || DEFAULT_COUNTRY).trim();
        const status = input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

        const payload = {
            category: input.category,
            subtype: input.subtype,
            status,
            address: {
                line1: publicAddress.line1,
                line2: publicAddress.line2 || null,
                city,
                state,
                pincode: publicAddress.pincode || null,
                country,
            },
            addressNormalized: normalizeAddress(address),
            localityId: input.localityId.trim(),
            city,
            state,
            country,
            latitude: publicGeo.latitude,
            longitude: publicGeo.longitude,
            geohash: publicGeo.geohash,
            geo: new GeoPoint(publicGeo.latitude, publicGeo.longitude),
            locationPrecision: precision,
            locationVisibility: visibility,
            bedrooms: input.bedrooms ?? null,
            bathrooms: input.bathrooms ?? null,
            builtUpAreaSqft: input.builtUpAreaSqft ?? null,
            carpetAreaSqft: input.carpetAreaSqft ?? null,
            plotAreaSqft: input.plotAreaSqft ?? null,
            floor: input.floor ?? null,
            totalFloors: input.totalFloors ?? null,
            furnishing: input.furnishing || 'unknown',
            parking: input.parking ?? null,
            constructionYear: input.constructionYear ?? null,
            amenities: Array.isArray(input.amenities) ? input.amenities : [],
            description: input.description || null,
            projectName: input.projectName || null,
            possessionStatus: input.possessionStatus || 'unknown',
            createdByUid: uid,
            ownerUid: uid,
            updatedByUid: uid,
            source: {
                type: input.sourceType || 'owner',
                channel: input.sourceChannel || 'USER_CREATED',
                uid,
                importedAt: serverTimestamp(),
                authoritative: false,
                externalId: input.externalId || null,
            },
            verification: unverifiedBlock(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // Write the property document first so that private_geo rules can verify
        // ownership via isPropertyOwnerOrCreator. A Firestore batch evaluates rules
        // against the pre-batch state, so private_geo creation in a batch always
        // fails (exists(properties/{id}) returns false). Two sequential writes fix this.
        await withTimeout(setDoc(ref, payload), 10000, 'createProperty');
        try {
            await writePrivateGeo(ref.id, uid, exact, {
                addressLine1: address.line1 ? String(address.line1).trim() : null,
                pincode: address.pincode ? String(address.pincode).trim() : null,
            });
        } catch (geoError) {
            // Best-effort rollback: remove the property if private_geo write fails.
            try { await deleteDoc(ref); } catch (_rollbackErr) { /* ignore */ }
            throw geoError;
        }
        return { id: ref.id, ...payload };
    },

    async getProperty(propertyId) {
        if (!propertyId) return null;
        try {
            const snap = await withTimeout(getDoc(doc(db, COLLECTIONS.properties, propertyId)), 10000, 'getProperty');
            return snap.exists() ? toRecord(snap) : null;
        } catch (error) {
            if (isPermissionDenied(error)) return null;
            throw error;
        }
    },

    async getPrivateGeo(propertyId) {
        if (!propertyId) return null;
        try {
            const snap = await withTimeout(getDoc(privateGeoRef(propertyId)), 10000, 'getPrivateGeo');
            return snap.exists() ? toRecord(snap) : null;
        } catch (error) {
            if (isPermissionDenied(error)) return null;
            throw error;
        }
    },

    async listPropertiesByLocality(localityId, status = 'ACTIVE') {
        const q = query(
            collection(db, COLLECTIONS.properties),
            where('localityId', '==', localityId),
            where('status', '==', status)
        );
        const snap = await withTimeout(getDocs(q), 10000, 'listPropertiesByLocality');
        return snap.docs.map(toRecord);
    },

    async listPropertiesByCity(city, status = 'ACTIVE') {
        const q = query(
            collection(db, COLLECTIONS.properties),
            where('city', '==', city),
            where('status', '==', status)
        );
        const snap = await withTimeout(getDocs(q), 10000, 'listPropertiesByCity');
        return snap.docs.map(toRecord);
    },

    async listMyProperties({ limitCount = 25 } = {}) {
        const uid = requireUid();
        const size = Math.min(Math.max(Number(limitCount) || 25, 1), 50);
        const q = query(
            collection(db, COLLECTIONS.properties),
            where('createdByUid', '==', uid),
            limit(size)
        );
        const snap = await withTimeout(getDocs(q), 10000, 'listMyProperties');
        return snap.docs.map(toRecord);
    },

    async countMyProperties() {
        const uid = requireUid();
        const q = query(
            collection(db, COLLECTIONS.properties),
            where('createdByUid', '==', uid)
        );
        const snap = await withTimeout(getCountFromServer(q), 10000, 'countMyProperties');
        return snap.data().count;
    },

    async getPropertiesByIds(ids = []) {
        const unique = [...new Set((ids || []).filter((id) => typeof id === 'string' && id))];
        const bounded = unique.slice(0, 50);
        const rows = await Promise.all(bounded.map((id) => propertyService.getProperty(id)));
        return rows.filter(Boolean);
    },

    async updateProperty(propertyId, patch = {}) {
        const uid = requireUid();
        const current = await propertyService.getProperty(propertyId);
        if (!current) throw new Error('Property not found');
        if (current.createdByUid !== uid && current.ownerUid !== uid) {
            throw new Error('Not allowed to update this property');
        }

        const next = { ...current, ...patch };
        const issues = validatePropertyInput({
            ...next,
            latitude: patch.latitude ?? current.latitude,
            longitude: patch.longitude ?? current.longitude,
        });
        assertNoIssues(issues);

        const updates = { updatedAt: serverTimestamp(), updatedByUid: uid };
        const physicalKeys = [
            'category', 'subtype', 'localityId', 'locationPrecision', 'locationVisibility',
            'bedrooms', 'bathrooms', 'builtUpAreaSqft', 'carpetAreaSqft', 'plotAreaSqft',
            'floor', 'totalFloors', 'furnishing', 'parking', 'constructionYear',
            'amenities', 'description', 'projectName', 'possessionStatus',
        ];
        physicalKeys.forEach((key) => {
            if (patch[key] !== undefined) updates[key] = patch[key];
        });

        const precision = patch.locationPrecision
            || (patch.locationVisibility ? (patch.locationVisibility === 'exact' ? 'exact' : 'approximate') : current.locationPrecision)
            || 'approximate_on_request';
        const visibility = patch.locationVisibility
            || (precision === 'exact' ? 'exact' : precision === 'approximate' ? 'approximate' : 'approximate_on_request');
        updates.locationPrecision = precision;
        updates.locationVisibility = visibility;

        if (patch.address) {
            const publicAddress = publicAddressFromInput(patch.address, precision);
            updates.address = {
                line1: publicAddress.line1,
                line2: publicAddress.line2 || null,
                city: publicAddress.city,
                state: publicAddress.state,
                pincode: publicAddress.pincode || null,
                country: publicAddress.country || current.country,
            };
            updates.addressNormalized = normalizeAddress(patch.address);
            if (publicAddress.city) updates.city = publicAddress.city;
            if (publicAddress.state) updates.state = publicAddress.state;
            if (publicAddress.country) updates.country = publicAddress.country;
        }

        const precisionChanged = precision !== current.locationPrecision || visibility !== current.locationVisibility;

        if (patch.latitude != null || patch.longitude != null) {
            if (patch.latitude == null || patch.longitude == null) {
                throw new Error('Latitude and longitude must be updated together');
            }
            const exact = buildGeoFields(patch.latitude, patch.longitude);
            const publicGeo = buildPublicGeoFields(
                propertyId,
                exact.latitude,
                exact.longitude,
                precision,
                patch.localityCoordinate || null
            );
            updates.latitude = publicGeo.latitude;
            updates.longitude = publicGeo.longitude;
            updates.geohash = publicGeo.geohash;
            updates.geo = new GeoPoint(publicGeo.latitude, publicGeo.longitude);
            await writePrivateGeo(propertyId, uid, exact, {
                addressLine1: patch.address?.line1 || null,
                pincode: patch.address?.pincode || null,
            });
        } else if (precisionChanged) {
            const privateGeo = await propertyService.getPrivateGeo(propertyId);
            if (privateGeo) {
                const publicGeo = buildPublicGeoFields(
                    propertyId,
                    privateGeo.latitude,
                    privateGeo.longitude,
                    precision,
                    patch.localityCoordinate || null
                );
                updates.latitude = publicGeo.latitude;
                updates.longitude = publicGeo.longitude;
                updates.geohash = publicGeo.geohash;
                updates.geo = new GeoPoint(publicGeo.latitude, publicGeo.longitude);
            }
        }

        if (patch.status && patch.status !== current.status) {
            if (!canTransitionProperty(current.status, patch.status)) {
                throw new Error(`Cannot change property status from ${current.status} to ${patch.status}`);
            }
            updates.status = patch.status;
        }

        await withTimeout(updateDoc(doc(db, COLLECTIONS.properties, propertyId), updates), 10000, 'updateProperty');
        return { ...current, ...updates, id: propertyId };
    },
};
