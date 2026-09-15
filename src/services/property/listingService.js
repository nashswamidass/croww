import {
    collection,
    doc,
    getCountFromServer,
    getDoc,
    getDocs,
    GeoPoint,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    startAfter,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
    COLLECTIONS,
    LISTING_PRIVATE_META_DOC_ID,
    LISTING_PRIVATE_META_SUBCOLLECTION,
    assertNoIssues,
    canTransitionListing,
    listingProtectedFieldsTouched,
    validateListingInput,
} from '../../domain/property';
import { propertyService } from './propertyService';

const withTimeout = (promise, ms = 10000, label = 'listingService') =>
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

function isPermissionDenied(error) {
    const code = error?.code || '';
    return code === 'permission-denied' || code === 'firestore/permission-denied';
}

/** Public pin and query fields only. Never private_geo. */
function denormalizeFromProperty(property) {
    return {
        localityId: property.localityId,
        city: property.city,
        category: property.category,
        subtype: property.subtype,
        latitude: property.latitude,
        longitude: property.longitude,
        geohash: property.geohash,
        geo: new GeoPoint(property.latitude, property.longitude),
        ownerUid: property.ownerUid,
        bedrooms: property.bedrooms ?? null,
        bathrooms: property.bathrooms ?? null,
        builtUpAreaSqft: property.builtUpAreaSqft ?? null,
        plotAreaSqft: property.plotAreaSqft ?? null,
        locationPrecision: property.locationPrecision || 'approximate_on_request',
        locationVisibility: property.locationVisibility || (property.locationPrecision === 'exact' ? 'exact' : property.locationPrecision === 'approximate' ? 'approximate' : 'approximate_on_request'),
        coverThumbnailUrl: null,
    };
}

function privateMetaRef(listingId) {
    return doc(db, COLLECTIONS.listings, listingId, LISTING_PRIVATE_META_SUBCOLLECTION, LISTING_PRIVATE_META_DOC_ID);
}

export const listingService = {
    async createListing(input = {}) {
        const uid = requireUid();
        const issues = validateListingInput({ ...input, status: 'DRAFT' });
        assertNoIssues(issues);

        const property = await propertyService.getProperty(input.propertyId);
        if (!property) throw new Error('Property not found');
        if (
            input.listedByRole === 'owner' &&
            property.ownerUid !== uid &&
            property.createdByUid !== uid
        ) {
            throw new Error('Only the property owner can create an owner listing');
        }

        const payload = {
            propertyId: input.propertyId,
            transactionType: input.transactionType,
            status: 'DRAFT',
            listedByUid: uid,
            listedByRole: input.listedByRole,
            createdByUid: uid,
            updatedByUid: uid,
            title: input.title.trim(),
            description: input.description || null,
            askingPrice: input.transactionType === 'buy' ? input.askingPrice : null,
            rentMonthly: input.transactionType === 'rent' ? input.rentMonthly : null,
            deposit: input.deposit ?? null,
            maintenanceMonthly: input.maintenanceMonthly ?? null,
            leaseDurationMonths: input.leaseDurationMonths ?? null,
            negotiable: input.negotiable !== false,
            availableFrom: input.availableFrom || null,
            contactPreference: input.contactPreference || 'in_app',
            representationStatus: 'unverified',
            verification: {
                representation: {
                    status: 'NOT_VERIFIED',
                    updatedAt: serverTimestamp(),
                    verifiedAt: null,
                    expiresAt: null,
                },
            },
            source: {
                type: input.listedByRole === 'admin' ? 'admin' : input.listedByRole,
                channel: input.sourceChannel || 'USER_CREATED',
                uid,
                importedAt: serverTimestamp(),
                authoritative: false,
                externalId: input.externalId || null,
            },
            ...denormalizeFromProperty(property),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            publishedAt: null,
            expiresAt: input.expiresAt || null,
            lastVerifiedAt: null,
        };

        const listingRef = doc(collection(db, COLLECTIONS.listings));
        const batch = writeBatch(db);
        batch.set(listingRef, payload);
        batch.set(privateMetaRef(listingRef.id), {
            moderation: {
                status: 'NONE',
                reason: null,
                reviewedAt: null,
                reviewedByUid: null,
            },
            updatedAt: serverTimestamp(),
            updatedByUid: uid,
        });
        await withTimeout(batch.commit(), 10000, 'createListing');
        return { id: listingRef.id, ...payload };
    },

    async getListing(listingId) {
        if (!listingId) return null;
        try {
            const snap = await withTimeout(getDoc(doc(db, COLLECTIONS.listings, listingId)), 10000, 'getListing');
            return snap.exists() ? toRecord(snap) : null;
        } catch (error) {
            if (isPermissionDenied(error)) return null;
            throw error;
        }
    },

    async listPublished({ city, localityId, transactionType } = {}) {
        const constraints = [where('status', '==', 'PUBLISHED')];
        if (localityId) constraints.unshift(where('localityId', '==', localityId));
        else if (city) constraints.unshift(where('city', '==', city));
        else if (transactionType) constraints.unshift(where('transactionType', '==', transactionType));
        constraints.push(orderBy('publishedAt', 'desc'));

        const q = query(collection(db, COLLECTIONS.listings), ...constraints);
        const snap = await withTimeout(getDocs(q), 10000, 'listPublished');
        return snap.docs.map(toRecord);
    },

    async listMine(status) {
        const page = await listingService.listMinePage({ status, limitCount: 50 });
        return page.items;
    },

    async listMinePage({ status, limitCount = 25, cursor = null } = {}) {
        const uid = requireUid();
        const size = Math.min(Math.max(Number(limitCount) || 25, 1), 50);
        const constraints = [where('listedByUid', '==', uid)];
        if (status) constraints.push(where('status', '==', status));
        constraints.push(orderBy('updatedAt', 'desc'));
        if (cursor) constraints.push(startAfter(cursor));
        constraints.push(limit(size));
        const q = query(collection(db, COLLECTIONS.listings), ...constraints);
        const snap = await withTimeout(getDocs(q), 10000, 'listMinePage');
        const last = snap.docs[snap.docs.length - 1] || null;
        return {
            items: snap.docs.map(toRecord),
            cursor: last,
            hasMore: snap.docs.length >= size,
        };
    },

    async countMine(status) {
        const uid = requireUid();
        const constraints = [where('listedByUid', '==', uid)];
        if (status) constraints.push(where('status', '==', status));
        const q = query(collection(db, COLLECTIONS.listings), ...constraints);
        const snap = await withTimeout(getCountFromServer(q), 10000, 'countMine');
        return snap.data().count;
    },

    async listByProperty(propertyId) {
        if (!propertyId) return [];
        const q = query(
            collection(db, COLLECTIONS.listings),
            where('propertyId', '==', propertyId)
        );
        const snap = await withTimeout(getDocs(q), 10000, 'listByProperty');
        return snap.docs.map(toRecord);
    },

    async listPublishedForProperty(propertyId, { limitCount = 8 } = {}) {
        if (!propertyId) return [];
        try {
            const q = query(
                collection(db, COLLECTIONS.listings),
                where('propertyId', '==', propertyId),
                where('status', '==', 'PUBLISHED'),
                limit(limitCount)
            );
            const snap = await withTimeout(getDocs(q), 10000, 'listPublishedForProperty');
            return snap.docs.map(toRecord);
        } catch (error) {
            console.warn('[listingService] listPublishedForProperty failed', error?.code || error?.message);
            return [];
        }
    },

    async updateListing(listingId, patch = {}) {
        const uid = requireUid();
        const current = await listingService.getListing(listingId);
        if (!current) throw new Error('Listing not found');
        if (current.listedByUid !== uid) throw new Error('Not allowed to update this listing');

        const protectedTouched = listingProtectedFieldsTouched(patch);
        if (protectedTouched.length) {
            throw new Error(`Protected fields cannot be updated: ${protectedTouched.join(', ')}`);
        }

        const updates = { updatedAt: serverTimestamp(), updatedByUid: uid };
        const offerKeys = [
            'title', 'description', 'askingPrice', 'rentMonthly', 'deposit',
            'maintenanceMonthly', 'leaseDurationMonths', 'negotiable',
            'availableFrom', 'contactPreference', 'expiresAt',
        ];
        offerKeys.forEach((key) => {
            if (patch[key] !== undefined) updates[key] = patch[key];
        });

        if (patch.status && patch.status !== current.status) {
            if (patch.status === 'PUBLISHED') {
                throw new Error('Clients cannot publish listings');
            }
            if (!canTransitionListing(current.status, patch.status)) {
                throw new Error(`Cannot change listing status from ${current.status} to ${patch.status}`);
            }
            updates.status = patch.status;
        }

        const merged = { ...current, ...updates };
        const issues = validateListingInput(merged);
        assertNoIssues(issues);

        await withTimeout(updateDoc(doc(db, COLLECTIONS.listings, listingId), updates), 10000, 'updateListing');
        return { ...current, ...updates, id: listingId };
    },

    async setCoverThumbnail(listingId, coverThumbnailUrl) {
        const uid = requireUid();
        const current = await listingService.getListing(listingId);
        if (!current) throw new Error('Listing not found');
        if (current.listedByUid !== uid) throw new Error('Not allowed to update this listing');
        await withTimeout(
            updateDoc(doc(db, COLLECTIONS.listings, listingId), {
                coverThumbnailUrl: coverThumbnailUrl || null,
                updatedAt: serverTimestamp(),
                updatedByUid: uid,
            }),
            10000,
            'setCoverThumbnail'
        );
        return { ...current, coverThumbnailUrl, id: listingId };
    },

    async requestModeration(listingId, { reason } = {}) {
        const uid = requireUid();
        const current = await listingService.getListing(listingId);
        if (!current) throw new Error('Listing not found');
        if (current.listedByUid !== uid) throw new Error('Not allowed to request review');
        await withTimeout(
            setDoc(privateMetaRef(listingId), {
                moderation: {
                    status: 'PENDING',
                    reason: reason || null,
                    reviewedAt: null,
                    reviewedByUid: null,
                },
                updatedAt: serverTimestamp(),
                updatedByUid: uid,
            }),
            10000,
            'requestModeration'
        );
        await withTimeout(
            updateDoc(doc(db, COLLECTIONS.listings, listingId), {
                reviewRequestedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                updatedByUid: uid,
            }),
            10000,
            'requestModeration.listing'
        );
        return { listingId, moderationStatus: 'PENDING', status: current.status, reviewRequestedAt: true };
    },

    async getPrivateMeta(listingId) {
        const uid = requireUid();
        const current = await listingService.getListing(listingId);
        if (!current) return null;
        if (current.listedByUid !== uid && current.ownerUid !== uid) {
            throw new Error('Not allowed to read listing review state');
        }
        try {
            const snap = await withTimeout(getDoc(privateMetaRef(listingId)), 10000, 'getPrivateMeta');
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch (error) {
            if (isPermissionDenied(error)) return null;
            throw error;
        }
    },
};
