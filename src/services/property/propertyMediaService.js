import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
    COLLECTIONS,
    STORAGE_PREFIXES,
    assertNoIssues,
    validateMediaInput,
} from '../../domain/property';

const withTimeout = (promise, ms = 10000, label = 'propertyMediaService') =>
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

function defaultVisibility(mediaType) {
    if (mediaType === 'document' || mediaType === 'spatial') return 'private';
    return 'public';
}

function isPublicGalleryItem(item) {
    if (!item) return false;
    if (item.visibility !== 'public' || item.status !== 'ACTIVE') return false;
    if (item.mediaType === 'document' || item.mediaType === 'spatial') return false;
    return Boolean(item.url || item.thumbnailUrl);
}

export function buildPropertyStoragePath({ uid, propertyId, listingId, mediaType, filename }) {
    if (mediaType === 'document') {
        return `${STORAGE_PREFIXES.privateDocuments}/${uid}/${propertyId}/${filename}`;
    }
    if (mediaType === 'spatial') {
        return `${STORAGE_PREFIXES.spatial}/${uid}/${propertyId}/${filename}`;
    }
    const parent = listingId || propertyId;
    return `${STORAGE_PREFIXES.publicMedia}/${uid}/${parent}/${filename}`;
}

export const propertyMediaService = {
    async addMedia(input = {}) {
        const uid = requireUid();
        if (input.mediaType === 'spatial') {
            throw new Error('3D media must be created with property3DService');
        }
        const visibility = input.visibility || defaultVisibility(input.mediaType);
        const payload = {
            parentType: input.parentType,
            parentId: input.parentId,
            propertyId: input.propertyId,
            mediaType: input.mediaType,
            storagePath: input.storagePath,
            url: visibility === 'public' ? (input.url || null) : null,
            thumbnailUrl: input.thumbnailUrl || null,
            sortOrder: input.sortOrder || 0,
            visibility,
            mimeType: input.mimeType || null,
            sizeBytes: input.sizeBytes || null,
            originalName: input.originalName || null,
            createdByUid: uid,
            status: input.status || 'ACTIVE',
            createdAt: serverTimestamp(),
        };
        const issues = validateMediaInput(payload);
        assertNoIssues(issues);

        const ref = await withTimeout(
            addDoc(collection(db, COLLECTIONS.propertyMedia), payload),
            10000,
            'addMedia'
        );
        return { id: ref.id, ...payload };
    },

    async listForParent(parentType, parentId, { includePrivate = false } = {}) {
        const constraints = [
            where('parentType', '==', parentType),
            where('parentId', '==', parentId),
        ];
        if (includePrivate) {
            const uid = requireUid();
            constraints.push(where('createdByUid', '==', uid));
        } else {
            constraints.push(where('visibility', '==', 'public'));
            constraints.push(where('status', '==', 'ACTIVE'));
            constraints.push(where('mediaType', 'in', ['photo', 'floor_plan', 'video']));
        }
        const q = query(collection(db, COLLECTIONS.propertyMedia), ...constraints);
        const snap = await withTimeout(getDocs(q), 10000, 'listForParent');
        const rows = snap.docs.map(toRecord);
        rows.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
        return rows;
    },

    /**
     * Public gallery only: photos, videos, floor plans.
     * Never returns documents or spatial assets.
     * Prefers listing-attached media; falls back to property media in one extra query.
     */
    async listPublicGallery({ listingId, propertyId } = {}) {
        const load = async (parentType, parentId) => {
            if (!parentId) return [];
            try {
                const rows = await propertyMediaService.listForParent(parentType, parentId);
                return rows.filter(isPublicGalleryItem);
            } catch (error) {
                console.warn('[propertyMediaService] gallery query failed', error?.code || error?.message);
                return [];
            }
        };
        const listingVisible = await load('listing', listingId);
        if (listingVisible.length) return listingVisible;
        return load('property', propertyId);
    },

    async hideMedia(mediaId) {
        const uid = requireUid();
        const snap = await withTimeout(getDoc(doc(db, COLLECTIONS.propertyMedia, mediaId)), 10000, 'hideMedia.get');
        if (!snap.exists()) throw new Error('Media not found');
        const current = snap.data();
        if (current.createdByUid !== uid) throw new Error('Not allowed to hide this media');
        await withTimeout(
            updateDoc(doc(db, COLLECTIONS.propertyMedia, mediaId), { status: 'HIDDEN' }),
            10000,
            'hideMedia'
        );
    },

    async setCover(mediaId, parentType, parentId) {
        const uid = requireUid();
        const rows = await propertyMediaService.listForParent(parentType, parentId, { includePrivate: true });
        let cover = rows.find((row) => row.id === mediaId);
        if (!cover) {
            const directSnap = await withTimeout(
                getDoc(doc(db, COLLECTIONS.propertyMedia, mediaId)),
                10000,
                'setCover.getDoc'
            );
            if (directSnap.exists()) {
                cover = toRecord(directSnap);
                rows.push(cover);
            }
        }
        if (!cover || cover.createdByUid !== uid) {
            throw new Error('Media not found on this parent');
        }
        if (cover.visibility !== 'public' || cover.mediaType === 'document' || cover.mediaType === 'spatial') {
            throw new Error('Cover must be public gallery media');
        }
        await Promise.all(rows.map((row, index) => (
            withTimeout(
                updateDoc(doc(db, COLLECTIONS.propertyMedia, row.id), {
                    sortOrder: row.id === mediaId ? 0 : index + 1,
                }),
                10000,
                'setCover'
            )
        )));
        return { coverMediaId: mediaId, thumbnailUrl: cover.thumbnailUrl || cover.url || null };
    },

    async reorderPublicMedia(parentType, parentId, orderedIds = []) {
        const uid = requireUid();
        if (!Array.isArray(orderedIds) || !orderedIds.length) {
            throw new Error('Nothing to reorder');
        }
        const rows = await propertyMediaService.listForParent(parentType, parentId);
        const byId = new Map(rows.map((row) => [row.id, row]));
        orderedIds.forEach((id) => {
            const row = byId.get(id);
            if (!row) throw new Error('Media not found on this parent');
            if (row.createdByUid !== uid) throw new Error('Not allowed to reorder this media');
            if (!isPublicGalleryItem(row)) throw new Error('Only public gallery media can be reordered');
        });
        await Promise.all(orderedIds.map((id, index) => (
            withTimeout(
                updateDoc(doc(db, COLLECTIONS.propertyMedia, id), { sortOrder: index }),
                10000,
                'reorderPublicMedia'
            )
        )));
        return { orderedIds };
    },
};
