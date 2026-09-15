/**
 * 3D / spatial media. Screens must not write property_media or jobs via raw Firestore.
 * Clients never mark READY. GPU processing is a future server boundary.
 */
import {
    addDoc,
    collection,
    doc,
    getDocs,
    increment,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebaseConfig';
import {
    COLLECTIONS,
    InventoryError,
} from '../../domain/property';
import {
    DEFAULT_SPATIAL_FORMAT,
    SPATIAL_JOBS_COLLECTION,
    SPATIAL_MAX_SOURCE_BYTES,
    SPATIAL_MEDIA_TYPE,
    actorSpatialStatusLabel,
    buildSpatialSourcePath,
    canManageSpatialAsset,
    canRetrySpatial,
    clientMaySetSpatialProcessing,
    dashboardSpatialLabel,
    isCurrentlyReadySpatial,
    pickReusablePropertyAsset,
    preferPropertyAttachment,
    spatialProcessingOf,
    toPublicSpatialTour,
    toViewerDescriptor,
    validateClientSpatialCreate,
    validateSpatialUpload,
} from '../../domain/spatial';
import { propertyService } from './propertyService';
import { listingService } from './listingService';
import { API_ENDPOINTS } from '../../constants/apiConfig';
import { authenticatedFetch } from '../../utils/authenticatedFetch';

function requireUid() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new InventoryError('UNAUTHENTICATED', 'You must be signed in');
    return uid;
}

async function blobFromFile(file) {
    if (file?._webFile instanceof Blob) return file._webFile;
    const uri = typeof file === 'string' ? file : file?.uri;
    if (!uri) return null;
    const response = await fetch(uri);
    return response.blob();
}

async function loadContext({ propertyId, listingId }) {
    let listing = null;
    let property = null;
    if (listingId) {
        listing = await listingService.getListing(listingId);
        if (listing?.propertyId) property = await propertyService.getProperty(listing.propertyId);
    }
    if (!property && propertyId) property = await propertyService.getProperty(propertyId);
    return { listing, property };
}

export const property3DService = {
    dashboardSpatialLabel,
    actorSpatialStatusLabel,
    toViewerDescriptor,

    async getPublicReadyAsset({ propertyId, listingId, posterUrl } = {}) {
        const ids = [propertyId, listingId].filter(Boolean);
        if (!ids.length) return toPublicSpatialTour(null);

        const rows = [];
        if (propertyId) {
            const q = query(
                collection(db, COLLECTIONS.propertyMedia),
                where('propertyId', '==', propertyId),
                where('mediaType', '==', SPATIAL_MEDIA_TYPE),
                where('visibility', '==', 'public'),
                where('status', '==', 'ACTIVE'),
                limit(8)
            );
            const snap = await getDocs(q);
            snap.docs.forEach((row) => rows.push({ id: row.id, ...row.data() }));
        }
        const propertyLevel = pickReusablePropertyAsset(rows, propertyId);
        const listingLevel = rows.find((row) => row.parentType === 'listing' && row.parentId === listingId && isCurrentlyReadySpatial(row));
        return toPublicSpatialTour(propertyLevel || listingLevel || null, posterUrl || null);
    },

    async listMyAssets({ propertyId } = {}) {
        const uid = requireUid();
        const constraints = [
            where('createdByUid', '==', uid),
            where('mediaType', '==', SPATIAL_MEDIA_TYPE),
            orderBy('createdAt', 'desc'),
            limit(20),
        ];
        const snap = await getDocs(query(collection(db, COLLECTIONS.propertyMedia), ...constraints));
        return snap.docs.map((row) => {
            const data = { id: row.id, ...row.data() };
            if (propertyId && data.propertyId !== propertyId) return null;
            return {
                id: data.id,
                propertyId: data.propertyId,
                parentType: data.parentType,
                status: spatialProcessingOf(data),
                label: actorSpatialStatusLabel(spatialProcessingOf(data)),
                createdAt: data.createdAt || null,
                retryCount: data.processing?.retryCount || 0,
                available: isCurrentlyReadySpatial(data),
            };
        }).filter(Boolean);
    },

    async createAsset({ propertyId, listingId, intendedFormat, captureProvider } = {}) {
        const uid = requireUid();
        const { listing, property } = await loadContext({ propertyId, listingId });
        const resolvedPropertyId = property?.id || propertyId || listing?.propertyId;
        if (!resolvedPropertyId) throw new InventoryError('PROPERTY_NOT_FOUND', 'Property is required for a 3D tour');
        if (!canManageSpatialAsset({ uid }, { property, listing })) {
            throw new InventoryError('ACTOR_NOT_PERMITTED', 'You cannot add 3D media to this property');
        }

        const existing = await property3DService.listMyAssets({ propertyId: resolvedPropertyId });
        const reusable = existing.find((row) => row.available && row.parentType === 'property');
        if (reusable) {
            return { reused: true, mediaId: reusable.id, status: 'READY' };
        }

        const parentType = preferPropertyAttachment(listing, resolvedPropertyId);
        const parentId = parentType === 'property' ? resolvedPropertyId : (listing?.id || resolvedPropertyId);
        const mediaRef = doc(collection(db, COLLECTIONS.propertyMedia));
        const sourcePath = buildSpatialSourcePath(uid, resolvedPropertyId, mediaRef.id, 'placeholder');
        const payload = {
            parentType,
            parentId,
            propertyId: resolvedPropertyId,
            listingId: listing?.id || listingId || null,
            mediaType: SPATIAL_MEDIA_TYPE,
            storagePath: sourcePath,
            url: null,
            thumbnailUrl: null,
            sortOrder: 0,
            visibility: 'private',
            mimeType: null,
            sizeBytes: null,
            originalName: null,
            createdByUid: uid,
            status: 'ACTIVE',
            processingStatus: 'UPLOADING',
            processing: {
                status: 'UPLOADING',
                intendedFormat: intendedFormat || DEFAULT_SPATIAL_FORMAT,
                assetFormat: intendedFormat || DEFAULT_SPATIAL_FORMAT,
                captureProvider: captureProvider || 'PROCESSED_UPLOAD',
                processor: 'INTERNAL',
                processorVersion: null,
                sourceStoragePath: null,
                derivedStoragePath: null,
                assetVersion: 1,
                processingVersion: 'v1',
                retryCount: 0,
                publicError: null,
                variants: null,
            },
            createdAt: serverTimestamp(),
        };
        const createIssues = validateClientSpatialCreate(payload);
        if (createIssues.length) throw new InventoryError('MEDIA_NOT_PERMITTED', createIssues[0]);

        await setDoc(mediaRef, payload);
        return { reused: false, mediaId: mediaRef.id, status: 'UPLOADING', propertyId: resolvedPropertyId };
    },

    async uploadSource({ mediaId, propertyId, file } = {}) {
        const uid = requireUid();
        if (!mediaId || !propertyId || !file) {
            throw new InventoryError('INVALID_PROPERTY', 'A 3D source file is required');
        }
        const name = file.name || file.originalName || 'source.bin';
        const mimeType = file.mimeType || file.type || 'application/octet-stream';
        const sizeBytes = file.size || file.sizeBytes || 0;
        if (sizeBytes > SPATIAL_MAX_SOURCE_BYTES) {
            throw new InventoryError('MEDIA_NOT_PERMITTED', 'File exceeds the 512 MB 3D source limit');
        }
        const storagePath = buildSpatialSourcePath(uid, propertyId, mediaId, name);
        const issues = validateSpatialUpload({ mimeType, sizeBytes, originalName: name, storagePath });
        if (issues.length) throw new InventoryError('MEDIA_NOT_PERMITTED', issues[0]);

        const blob = await blobFromFile(file);
        if (!blob) throw new InventoryError('MEDIA_NOT_PERMITTED', 'Could not read the 3D source file');
        if (blob.size > SPATIAL_MAX_SOURCE_BYTES) {
            throw new InventoryError('MEDIA_NOT_PERMITTED', 'File exceeds the 512 MB 3D source limit');
        }
        await uploadBytes(ref(storage, storagePath), blob, { contentType: mimeType });
        await updateDoc(doc(db, COLLECTIONS.propertyMedia, mediaId), {
            storagePath,
            mimeType,
            sizeBytes: blob.size,
            originalName: name,
            'processing.sourceStoragePath': storagePath,
            'processing.status': 'UPLOADING',
            processingStatus: 'UPLOADING',
        });
        return { mediaId, storagePath, sizeBytes: blob.size };
    },

    async attachAsset({ mediaId, propertyId, listingId } = {}) {
        const uid = requireUid();
        const { listing, property } = await loadContext({ propertyId, listingId });
        if (!canManageSpatialAsset({ uid }, { property, listing, createdByUid: uid })) {
            throw new InventoryError('ACTOR_NOT_PERMITTED', 'You cannot submit this 3D asset');
        }
        if (!clientMaySetSpatialProcessing('UPLOADING', 'PROCESSING')) {
            throw new InventoryError('INVALID_STATUS_TRANSITION', 'Cannot queue processing');
        }
        await updateDoc(doc(db, COLLECTIONS.propertyMedia, mediaId), {
            processingStatus: 'PROCESSING',
            'processing.status': 'PROCESSING',
            'processing.processingStartedAt': serverTimestamp(),
        });
        await addDoc(collection(db, SPATIAL_JOBS_COLLECTION), {
            mediaId,
            propertyId: property?.id || propertyId,
            listingId: listing?.id || listingId || null,
            submittedByUid: uid,
            status: 'QUEUED',
            processor: 'INTERNAL',
            processorVersion: null,
            retryOf: null,
            publicError: null,
            createdAt: serverTimestamp(),
        });
        return { mediaId, status: 'PROCESSING' };
    },

    async archiveAsset(mediaId) {
        const response = await authenticatedFetch(API_ENDPOINTS.ARCHIVE_SPATIAL_ASSET, {
            body: { mediaId },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new InventoryError('MEDIA_NOT_PERMITTED', body.message || 'Could not archive 3D asset');
        return body;
    },

    async retryProcessing({ mediaId, propertyId, listingId, retryCount } = {}) {
        if (!canRetrySpatial({ status: 'FAILED', retryCount })) {
            throw new InventoryError('INVALID_STATUS_TRANSITION', 'This 3D asset cannot be retried');
        }
        await updateDoc(doc(db, COLLECTIONS.propertyMedia, mediaId), {
            'processing.retryCount': increment(1),
        });
        return property3DService.attachAsset({ mediaId, propertyId, listingId });
    },

    async requestFinalize(mediaId, decision, extra = {}) {
        const response = await authenticatedFetch(API_ENDPOINTS.FINALIZE_SPATIAL_ASSET, {
            body: { mediaId, decision, ...extra },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new InventoryError('MEDIA_NOT_PERMITTED', body.message || 'Finalize failed');
        return body;
    },
};
