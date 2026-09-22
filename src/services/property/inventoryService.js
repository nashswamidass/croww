/**
 * Product ingestion boundary. Screens and future Post UI must call this,
 * not raw Firestore and not a mix of unvalidated service writes.
 */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
    COLLECTIONS,
    InventoryError,
    assertListingActorAllowed,
    canTransitionListing,
    listingProtectedFieldsTouched,
    scoreDuplicateCandidates,
    validateListingInput,
    validatePropertyInput,
} from '../../domain/property';
import { propertyService } from './propertyService';
import { listingService } from './listingService';
import { propertyMediaService, buildPropertyStoragePath } from './propertyMediaService';
import { localityService } from './localityService';
import { userService } from '../userService';
import { uploadService } from '../uploadService';
import { taxonomyService } from './taxonomyService';
import { validateTaxonomyPosting } from '../../domain/taxonomy/validation';

function requireUid() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new InventoryError('UNAUTHENTICATED', 'You must be signed in');
    return uid;
}

function wrap(error, fallbackCode, fallbackMessage) {
    if (error instanceof InventoryError) throw error;
    const message = error?.message || fallbackMessage;
    if (/must be signed in/i.test(message)) {
        throw new InventoryError('UNAUTHENTICATED', message);
    }
    if (/not found/i.test(message)) {
        throw new InventoryError(fallbackCode === 'INVALID_LISTING' ? 'LISTING_NOT_FOUND' : 'PROPERTY_NOT_FOUND', message);
    }
    if (/not allowed|only the property owner/i.test(message)) {
        throw new InventoryError('ACTOR_NOT_PERMITTED', message);
    }
    if (/protected field/i.test(message)) {
        throw new InventoryError('PROTECTED_FIELD', message);
    }
    if (/cannot publish|cannot change listing status/i.test(message)) {
        throw new InventoryError('INVALID_STATUS_TRANSITION', message);
    }
    if (/latitude and longitude must be updated together|outside the expected india/i.test(message)) {
        throw new InventoryError('INVALID_LOCATION', message);
    }
    throw new InventoryError(fallbackCode, fallbackMessage || message);
}

async function loadActorProfile(uid) {
    try {
        return await userService.getUserById(uid);
    } catch {
        return null;
    }
}

async function assertListingActor(uid, listedByRole, property) {
    const loaded = listedByRole === 'owner' ? null : await loadActorProfile(uid);
    const profile = loaded || { uid, roles: [], userType: null };
    const result = assertListingActorAllowed(listedByRole, { ...profile, uid }, property);
    if (!result.ok) {
        throw new InventoryError(result.code, result.message);
    }
}

export const inventoryService = {
    async listMyListings(status) {
        requireUid();
        try {
            return await listingService.listMine(status);
        } catch (error) {
            wrap(error, 'INVALID_LISTING', 'Could not load your listings');
        }
    },

    async listMyListingsPage(options = {}) {
        requireUid();
        try {
            return await listingService.listMinePage(options);
        } catch (error) {
            wrap(error, 'INVALID_LISTING', 'Could not load your listings');
        }
    },

    async countMyListings(status) {
        requireUid();
        try {
            return await listingService.countMine(status);
        } catch (error) {
            wrap(error, 'INVALID_LISTING', 'Could not count your listings');
        }
    },

    async listMyProperties(options = {}) {
        requireUid();
        try {
            return await propertyService.listMyProperties(options);
        } catch (error) {
            wrap(error, 'INVALID_PROPERTY', 'Could not load your properties');
        }
    },

    async loadForEdit(listingId) {
        requireUid();
        const listing = await listingService.getListing(listingId);
        if (!listing) throw new InventoryError('LISTING_NOT_FOUND', 'Listing not found');
        const uid = requireUid();
        if (listing.listedByUid !== uid) {
            throw new InventoryError('ACTOR_NOT_PERMITTED', 'You can only edit your own drafts');
        }
        const property = listing.propertyId
            ? await propertyService.getProperty(listing.propertyId)
            : null;
        const media = await propertyMediaService.listPublicGallery({
            listingId: listing.id,
            propertyId: listing.propertyId,
        }).catch(() => []);
        return { listing, property, media };
    },

    async listLocalitiesForCity(city) {
        requireUid();
        if (!city) return [];
        try {
            return await localityService.listActiveByCity(city);
        } catch {
            return [];
        }
    },

    async attachLocalPhotos({ propertyId, listingId, photos = [], coverUri } = {}) {
        const uid = requireUid();
        if (!propertyId || !listingId) {
            throw new InventoryError('INVALID_LISTING', 'Save a draft before adding photos');
        }
        const attached = [];
        for (let index = 0; index < photos.length; index += 1) {
            const photo = photos[index];
            if (photo?.mediaId) {
                attached.push(photo);
                continue;
            }
            const uri = photo?.uri;
            if (!uri || typeof uri !== 'string') continue;
            if (uri.startsWith('http')) {
                attached.push(photo);
                continue;
            }
            const filename = `${Date.now()}-${index}.jpg`;
            const storagePath = buildPropertyStoragePath({
                uid,
                propertyId,
                listingId,
                mediaType: 'photo',
                filename,
            });
            try {
                const url = await uploadService.uploadImage(uri, storagePath);
                const media = await propertyMediaService.addMedia({
                    parentType: 'listing',
                    parentId: listingId,
                    propertyId,
                    mediaType: 'photo',
                    storagePath,
                    url,
                    thumbnailUrl: url,
                    sortOrder: index,
                    visibility: 'public',
                });
                attached.push({ ...photo, mediaId: media.id, uri: url });
            } catch (error) {
                console.warn('[inventoryService.attachLocalPhotos] upload/addMedia error:', error?.message || error);
                wrap(error, 'MEDIA_NOT_PERMITTED', error?.message || 'Could not upload photos');
            }
        }
        const cover = attached.find((row) => row.uri === coverUri || row.localId === coverUri)
            || attached[0];
        if (cover?.mediaId) {
            try {
                await inventoryService.setCoverMedia(cover.mediaId, 'listing', listingId);
            } catch (coverErr) {
                console.warn('[inventoryService.attachLocalPhotos] setCoverMedia failed, continuing with thumbnail:', coverErr?.message || coverErr);
                if (cover.uri) {
                    await listingService.setCoverThumbnail(listingId, cover.uri).catch(() => {});
                }
            }
        } else if (cover?.uri) {
            await listingService.setCoverThumbnail(listingId, cover.uri).catch(() => {});
        }
        return attached;
    },

    async findDuplicateCandidates(input = {}) {
        requireUid();
        const localityId = input.localityId;
        if (!localityId) return [];
        const q = query(
            collection(db, COLLECTIONS.properties),
            where('localityId', '==', localityId),
            where('status', '==', 'ACTIVE'),
            limit(40)
        );
        const snap = await getDocs(q);
        const existing = snap.docs.map((row) => ({ id: row.id, ...row.data() }));
        return scoreDuplicateCandidates(input, existing);
    },

    async createProperty(input = {}, { allowDuplicates = false } = {}) {
        requireUid();
        const issues = validatePropertyInput(input);
        if (issues.length) {
            throw new InventoryError('INVALID_PROPERTY', issues.map((i) => i.message).join('; '), issues);
        }

        let localityCoordinate = input.localityCoordinate || null;
        if (!localityCoordinate && input.localityId) {
            const locality = await localityService.getLocality(input.localityId);
            if (locality) {
                localityCoordinate = { latitude: locality.latitude, longitude: locality.longitude };
            }
        }

        const duplicates = await inventoryService.findDuplicateCandidates(input);
        if (duplicates.length && !allowDuplicates) {
            throw new InventoryError(
                'POTENTIAL_DUPLICATE',
                'A similar property already exists in this locality',
                { candidates: duplicates }
            );
        }

        try {
            const property = await propertyService.createProperty({
                ...input,
                sourceChannel: input.sourceChannel || 'USER_CREATED',
                localityCoordinate,
            });
            return { property, duplicateCandidates: duplicates };
        } catch (error) {
            wrap(error, 'INVALID_PROPERTY', 'Could not create property');
        }
    },

    async createListing(input = {}) {
        const uid = requireUid();
        if (input.status && input.status !== 'DRAFT') {
            throw new InventoryError('PUBLICATION_FORBIDDEN', 'New listings must be created as DRAFT');
        }
        const issues = validateListingInput({ ...input, status: 'DRAFT' });
        if (issues.length) {
            throw new InventoryError('INVALID_LISTING', issues.map((i) => i.message).join('; '), issues);
        }
        const property = await propertyService.getProperty(input.propertyId);
        if (!property) throw new InventoryError('PROPERTY_NOT_FOUND', 'Property not found');
        await assertListingActor(uid, input.listedByRole, property);

        const taxonomyItem = await taxonomyService.getTaxonomyItem(
            input.taxonomyId,
            property.category || input.category,
            property.subtype || input.subtype
        );
        const taxVal = validateTaxonomyPosting({
            typeId: input.taxonomyId || taxonomyItem?.id,
            transactionType: input.transactionType,
            payload: { ...property, ...input },
            taxonomyItem,
        });
        if (!taxVal.valid) {
            throw new InventoryError('TAXONOMY_POSTING_DISABLED', taxVal.errors.join('; '), taxVal);
        }

        try {
            const listing = await listingService.createListing({
                ...input,
                taxonomyId: input.taxonomyId || taxonomyItem?.id,
                status: 'DRAFT',
                sourceChannel: input.sourceChannel || 'USER_CREATED',
            });
            return { listing, property };
        } catch (error) {
            console.warn('[inventoryService.createListing] error:', error);
            wrap(error, 'INVALID_LISTING', 'Could not create listing');
        }
    },

    async updateListing(listingId, patch = {}) {
        requireUid();
        const protectedTouched = listingProtectedFieldsTouched(patch || {});
        if (protectedTouched.length) {
            throw new InventoryError(
                'PROTECTED_FIELD',
                `Cannot update protected fields: ${protectedTouched.join(', ')}`,
                { fields: protectedTouched }
            );
        }
        if (patch.status === 'PUBLISHED') {
            throw new InventoryError('PUBLICATION_FORBIDDEN', 'Publishing requires the admin publishListing function');
        }
        try {
            return await listingService.updateListing(listingId, patch);
        } catch (error) {
            wrap(error, 'INVALID_LISTING', 'Could not update listing');
        }
    },

    async updateProperty(propertyId, patch = {}) {
        const uid = requireUid();
        if (patch.ownerUid && patch.ownerUid !== uid) {
            throw new InventoryError('PROTECTED_FIELD', 'Ownership transfer is server-only');
        }
        if (patch.verification || patch.source) {
            throw new InventoryError('PROTECTED_FIELD', 'Verification and source.authoritative are server-only');
        }
        try {
            return await propertyService.updateProperty(propertyId, patch);
        } catch (error) {
            wrap(error, 'INVALID_PROPERTY', 'Could not update property');
        }
    },

    async requestPublish(listingId, { reason } = {}) {
        requireUid();
        const listing = await listingService.getListing(listingId);
        if (!listing) throw new InventoryError('LISTING_NOT_FOUND', 'Listing not found');
        if (listing.status !== 'DRAFT' && listing.status !== 'PAUSED') {
            throw new InventoryError('INVALID_STATUS_TRANSITION', 'Only draft or paused listings can be submitted for review');
        }
        const issues = validateListingInput({ ...listing, status: 'PUBLISHED' });
        if (issues.length) {
            throw new InventoryError('INVALID_LISTING', issues.map((i) => i.message).join('; '), issues);
        }
        return listingService.requestModeration(listingId, { reason });
    },

    async markUnavailable(listingId, status = 'ARCHIVED') {
        requireUid();
        if (!['PAUSED', 'SOLD', 'RENTED', 'EXPIRED', 'ARCHIVED'].includes(status)) {
            throw new InventoryError('INVALID_STATUS_TRANSITION', 'Unsupported unavailable status');
        }
        const current = await listingService.getListing(listingId);
        if (!current) throw new InventoryError('LISTING_NOT_FOUND', 'Listing not found');
        if (!canTransitionListing(current.status, status)) {
            throw new InventoryError(
                'INVALID_STATUS_TRANSITION',
                `Cannot change listing status from ${current.status} to ${status}`
            );
        }
        return listingService.updateListing(listingId, { status });
    },

    async attachMedia(input = {}) {
        requireUid();
        try {
            return await propertyMediaService.addMedia(input);
        } catch (error) {
            wrap(error, 'MEDIA_NOT_PERMITTED', 'Could not attach media');
        }
    },

    async setCoverMedia(mediaId, parentType, parentId) {
        requireUid();
        try {
            const result = await propertyMediaService.setCover(mediaId, parentType, parentId);
            if (parentType === 'listing') {
                await listingService.setCoverThumbnail(parentId, result.thumbnailUrl);
            }
            return result;
        } catch (error) {
            console.warn('[inventoryService.setCoverMedia] error:', error?.message || error);
            wrap(error, 'MEDIA_NOT_PERMITTED', error?.message || 'Could not set cover media');
        }
    },

    async hidePublicMedia(mediaId, { listingId } = {}) {
        const uid = requireUid();
        if (listingId) {
            const listing = await listingService.getListing(listingId);
            if (!listing || listing.listedByUid !== uid) {
                throw new InventoryError('ACTOR_NOT_PERMITTED', 'You can only change media on your listings');
            }
        }
        try {
            await propertyMediaService.hideMedia(mediaId);
        } catch (error) {
            wrap(error, 'MEDIA_NOT_PERMITTED', 'Could not hide media');
        }
    },

    async reorderPublicMedia(parentType, parentId, orderedIds) {
        requireUid();
        try {
            return await propertyMediaService.reorderPublicMedia(parentType, parentId, orderedIds);
        } catch (error) {
            wrap(error, 'MEDIA_NOT_PERMITTED', 'Could not reorder media');
        }
    },
};
