/**
 * Supply-side inventory dashboard. Screens must call this, not Firestore.
 * Hierarchy: actor → properties → listings → inquiries (existing chats).
 */
import { auth } from '../firebaseConfig';
import {
    ANALYTICS_UNAVAILABLE_COPY,
    DASHBOARD_INQUIRY_CHAT_LIMIT,
    DASHBOARD_PAGE_SIZE,
    DASHBOARD_PROPERTY_PAGE_SIZE,
    DASHBOARD_UNDER_REVIEW_SCAN_LIMIT,
    InventoryError,
    actionById,
    canAccessListingInventory,
    canManageListingMedia,
    canMutateMediaItem,
    clampDashboardPageSize,
    completenessWarnings,
    dashboardAttention,
    filterListingInquiries,
    isPublicGalleryMedia,
    isSelfPublishAction,
    isUnderReviewListing,
    listingCompleteness,
    mergePropertyInventory,
    mergeSortedInventory,
    normalizeInventoryPage,
    uniquePropertyIds,
} from '../../domain/property';
import { inventoryService } from './inventoryService';
import { listingService } from './listingService';
import { propertyService } from './propertyService';
import { propertyMediaService } from './propertyMediaService';
import { chatService } from '../chatService';

function requireUid() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new InventoryError('UNAUTHENTICATED', 'You must be signed in');
    return uid;
}

function wrap(error, fallbackCode, fallbackMessage) {
    if (error instanceof InventoryError) throw error;
    throw new InventoryError(fallbackCode, fallbackMessage || error?.message || 'Dashboard request failed');
}

async function safeCount(status) {
    try {
        return await inventoryService.countMyListings(status);
    } catch {
        return null;
    }
}

function decorateListing(listing, property = null, mediaCount = 0) {
    const completeness = listingCompleteness(listing, property, { mediaCount });
    return {
        listing,
        property,
        mediaCount,
        completeness,
        completenessWarnings: completenessWarnings(completeness),
        attention: dashboardAttention(listing),
    };
}

export const inventoryDashboardService = {
    async loadSummary() {
        requireUid();
        try {
            const [total, published, draft, paused, sold, rented, archived, expired, properties] = await Promise.all([
                safeCount(),
                safeCount('PUBLISHED'),
                safeCount('DRAFT'),
                safeCount('PAUSED'),
                safeCount('SOLD'),
                safeCount('RENTED'),
                safeCount('ARCHIVED'),
                safeCount('EXPIRED'),
                propertyService.countMyProperties().catch(() => null),
            ]);

            let underReview = null;
            if (draft === 0) underReview = 0;
            else if (typeof draft === 'number' && draft <= DASHBOARD_UNDER_REVIEW_SCAN_LIMIT) {
                const page = await inventoryService.listMyListingsPage({
                    status: 'DRAFT',
                    limitCount: DASHBOARD_UNDER_REVIEW_SCAN_LIMIT,
                });
                underReview = (page.items || []).filter(isUnderReviewListing).length;
            }

            return {
                total,
                published,
                draft,
                underReview,
                paused,
                sold,
                rented,
                soldRented: sold == null && rented == null ? null : (sold || 0) + (rented || 0),
                archived,
                expired,
                properties,
                analytics: {
                    views: null,
                    impressions: null,
                    saves: null,
                    conversion: null,
                    unavailableCopy: ANALYTICS_UNAVAILABLE_COPY,
                },
            };
        } catch (error) {
            wrap(error, 'INVALID_LISTING', 'Could not load inventory summary');
        }
    },

    async loadListings({ filter = 'all', cursor = null, pageSize = DASHBOARD_PAGE_SIZE } = {}) {
        const uid = requireUid();
        const size = clampDashboardPageSize(pageSize);
        try {
            if (filter === 'sold_rented') {
                const [sold, rented] = await Promise.all([
                    inventoryService.listMyListingsPage({ status: 'SOLD', limitCount: size, cursor: null }),
                    inventoryService.listMyListingsPage({ status: 'RENTED', limitCount: size, cursor: null }),
                ]);
                const items = mergeSortedInventory([sold.items, rented.items], Math.min(size * 2, 50))
                    .filter((row) => canAccessListingInventory(uid, row));
                return normalizeInventoryPage({
                    items,
                    cursor: null,
                    pageSize: Math.min(size * 2, 50),
                    hasMore: false,
                });
            }

            if (filter === 'review') {
                const page = await inventoryService.listMyListingsPage({
                    status: 'DRAFT',
                    limitCount: size,
                    cursor,
                });
                const items = (page.items || [])
                    .filter((row) => canAccessListingInventory(uid, row) && isUnderReviewListing(row));
                return normalizeInventoryPage({
                    items,
                    cursor: page.cursor,
                    pageSize: size,
                    hasMore: page.hasMore,
                });
            }

            if (filter === 'draft') {
                const page = await inventoryService.listMyListingsPage({
                    status: 'DRAFT',
                    limitCount: size,
                    cursor,
                });
                const items = (page.items || [])
                    .filter((row) => canAccessListingInventory(uid, row) && !isUnderReviewListing(row));
                return normalizeInventoryPage({
                    items,
                    cursor: page.cursor,
                    pageSize: size,
                    hasMore: page.hasMore,
                });
            }

            if (filter === 'archived') {
                const [archived, expired] = await Promise.all([
                    inventoryService.listMyListingsPage({ status: 'ARCHIVED', limitCount: size, cursor: null }),
                    inventoryService.listMyListingsPage({ status: 'EXPIRED', limitCount: size, cursor: null }),
                ]);
                const items = mergeSortedInventory([archived.items, expired.items], Math.min(size * 2, 50))
                    .filter((row) => canAccessListingInventory(uid, row));
                return normalizeInventoryPage({
                    items,
                    cursor: null,
                    pageSize: Math.min(size * 2, 50),
                    hasMore: false,
                });
            }

            const status = filter === 'all' || !filter
                ? undefined
                : filter === 'published'
                    ? 'PUBLISHED'
                    : filter === 'paused'
                        ? 'PAUSED'
                        : undefined;
            const page = await inventoryService.listMyListingsPage({
                status,
                limitCount: size,
                cursor,
            });
            const items = (page.items || []).filter((row) => canAccessListingInventory(uid, row));
            return normalizeInventoryPage({
                items,
                cursor: page.cursor,
                pageSize: size,
                hasMore: page.hasMore,
            });
        } catch (error) {
            wrap(error, 'INVALID_LISTING', 'Could not load listings');
        }
    },

    async loadProperties({ pageSize = DASHBOARD_PROPERTY_PAGE_SIZE } = {}) {
        const uid = requireUid();
        const size = clampDashboardPageSize(pageSize);
        try {
            const [owned, listingPage] = await Promise.all([
                inventoryService.listMyProperties({ limitCount: size }),
                inventoryService.listMyListingsPage({ limitCount: size }),
            ]);
            const mineListings = (listingPage.items || []).filter((row) => canAccessListingInventory(uid, row));
            const missingIds = uniquePropertyIds(mineListings)
                .filter((id) => !(owned || []).some((row) => row.id === id));
            const extra = missingIds.length
                ? await propertyService.getPropertiesByIds(missingIds)
                : [];
            const properties = mergePropertyInventory([...(owned || []), ...extra], mineListings);
            return {
                items: properties.slice(0, size),
                hasMore: (owned || []).length >= size || listingPage.hasMore,
            };
        } catch (error) {
            wrap(error, 'INVALID_PROPERTY', 'Could not load properties');
        }
    },

    async loadListingRow(listingId) {
        const uid = requireUid();
        const listing = await listingService.getListing(listingId);
        if (!listing || !canAccessListingInventory(uid, listing)) {
            throw new InventoryError('ACTOR_NOT_PERMITTED', 'You can only manage your own listings');
        }
        const property = listing.propertyId
            ? await propertyService.getProperty(listing.propertyId)
            : null;
        const media = await propertyMediaService.listPublicGallery({
            listingId: listing.id,
            propertyId: listing.propertyId,
        }).catch(() => []);
        return decorateListing(listing, property, media.length);
    },

    async applyListingAction(listingId, actionId) {
        const uid = requireUid();
        const current = await listingService.getListing(listingId);
        if (!current || !canAccessListingInventory(uid, current)) {
            throw new InventoryError('ACTOR_NOT_PERMITTED', 'You can only manage your own listings');
        }
        const action = actionById(current, actionId);
        if (!action || isSelfPublishAction(action)) {
            throw new InventoryError('INVALID_STATUS_TRANSITION', 'That action is not available for this listing');
        }
        if (action.kind === 'request_review') {
            return inventoryService.requestPublish(listingId);
        }
        if (action.kind === 'status' && action.toStatus) {
            return inventoryService.markUnavailable(listingId, action.toStatus);
        }
        throw new InventoryError('INVALID_STATUS_TRANSITION', 'That action is not available for this listing');
    },

    async loadPublicMedia(listingId) {
        const uid = requireUid();
        const listing = await listingService.getListing(listingId);
        if (!listing || !canAccessListingInventory(uid, listing)) {
            throw new InventoryError('ACTOR_NOT_PERMITTED', 'You can only manage media on your listings');
        }
        const property = listing.propertyId
            ? await propertyService.getProperty(listing.propertyId)
            : null;
        if (!canManageListingMedia(uid, listing, property)) {
            throw new InventoryError('ACTOR_NOT_PERMITTED', 'You can only manage media on your listings');
        }
        const media = await propertyMediaService.listPublicGallery({
            listingId: listing.id,
            propertyId: listing.propertyId,
        });
        return {
            listing,
            property,
            media: (media || []).filter(isPublicGalleryMedia),
        };
    },

    async addListingPhotos(listingId, photos = []) {
        const bundle = await inventoryDashboardService.loadPublicMedia(listingId);
        return inventoryService.attachLocalPhotos({
            propertyId: bundle.listing.propertyId,
            listingId: bundle.listing.id,
            photos,
        });
    },

    async setListingCover(listingId, mediaId) {
        const uid = requireUid();
        const bundle = await inventoryDashboardService.loadPublicMedia(listingId);
        const media = (bundle.media || []).find((row) => row.id === mediaId);
        if (!canMutateMediaItem(uid, media)) {
            throw new InventoryError('MEDIA_NOT_PERMITTED', 'You can only change media you uploaded');
        }
        return inventoryService.setCoverMedia(mediaId, 'listing', listingId);
    },

    async hideListingMedia(listingId, mediaId) {
        const uid = requireUid();
        const bundle = await inventoryDashboardService.loadPublicMedia(listingId);
        const media = (bundle.media || []).find((row) => row.id === mediaId);
        if (!canMutateMediaItem(uid, media)) {
            throw new InventoryError('MEDIA_NOT_PERMITTED', 'You can only change media you uploaded');
        }
        await inventoryService.hidePublicMedia(mediaId, { listingId });
        return { id: mediaId, status: 'HIDDEN' };
    },

    async reorderListingMedia(listingId, orderedIds) {
        const uid = requireUid();
        const bundle = await inventoryDashboardService.loadPublicMedia(listingId);
        (orderedIds || []).forEach((id) => {
            const media = (bundle.media || []).find((row) => row.id === id);
            if (!canMutateMediaItem(uid, media)) {
                throw new InventoryError('MEDIA_NOT_PERMITTED', 'You can only change media you uploaded');
            }
        });
        return inventoryService.reorderPublicMedia('listing', listingId, orderedIds);
    },

    async loadInquiries() {
        const uid = requireUid();
        try {
            const chats = await chatService.listUserChats(uid, { limitCount: DASHBOARD_INQUIRY_CHAT_LIMIT });
            const listingIds = [...new Set((chats || []).map((row) => row.listingId).filter(Boolean))].slice(0, 40);
            const listings = (await Promise.all(listingIds.map((id) => listingService.getListing(id).catch(() => null))))
                .filter(Boolean);
            const items = filterListingInquiries(chats, { uid, listings });
            const byId = Object.fromEntries(listings.map((row) => [row.id, row]));
            return {
                items: items.map((chat) => ({
                    chat,
                    listing: byId[chat.listingId] || null,
                })),
                bounded: true,
                analyticsUnavailable: ANALYTICS_UNAVAILABLE_COPY,
            };
        } catch (error) {
            wrap(error, 'INVALID_LISTING', 'Could not load inquiries');
        }
    },

    async updateListingAvailability(listingId, availabilityInput, options = {}) {
        requireUid();
        try {
            return await listingService.updateAvailability(listingId, availabilityInput, options);
        } catch (error) {
            wrap(error, 'UPDATE_FAILED', error?.message || 'Could not update listing availability');
        }
    },

    async listListingAvailabilityHistory(listingId, options = {}) {
        requireUid();
        try {
            return await listingService.listAvailabilityHistory(listingId, options);
        } catch (error) {
            wrap(error, 'HISTORY_FAILED', error?.message || 'Could not load availability history');
        }
    },
};
