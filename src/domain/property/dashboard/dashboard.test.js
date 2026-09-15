import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionListing } from '../validate.ts';
import { clientMaySetListingStatus } from '../actorPolicy.ts';
import {
    ANALYTICS_UNAVAILABLE_COPY,
    DASHBOARD_PAGE_SIZE,
    DASHBOARD_STALE_UPDATE_MS,
    actionById,
    availableDashboardActions,
    canAccessListingInventory,
    canAccessPropertyInventory,
    canContinueEditing,
    canEditListingOffer,
    canManageListingMedia,
    canMutateMediaItem,
    clampDashboardPageSize,
    completenessWarnings,
    dashboardAttention,
    dashboardCopy,
    dedupeInventoryById,
    filterAccessibleListings,
    filterListingInquiries,
    inquiryUnreadCount,
    isDraftListing,
    isPublicGalleryMedia,
    isSelfPublishAction,
    isUnderReviewListing,
    listingCompleteness,
    listingMatchesDashboardFilter,
    listingMatchesQuery,
    mergePropertyInventory,
    mergeSortedInventory,
    normalizeInventoryPage,
    uniquePropertyIds,
} from './index.ts';

const OWNER = 'owner-1';
const AGENT = 'agent-1';
const BUILDER = 'builder-1';
const OTHER = 'other-1';

function listing(overrides = {}) {
    return {
        id: 'listing-1',
        propertyId: 'prop-1',
        listedByUid: OWNER,
        status: 'DRAFT',
        transactionType: 'buy',
        title: '3 BHK in Whitefield',
        city: 'Bengaluru',
        localityId: 'bengaluru__whitefield',
        askingPrice: 13500000,
        rentMonthly: null,
        description: 'Bright apartment',
        coverThumbnailUrl: 'https://example.com/cover.jpg',
        latitude: 12.97,
        longitude: 77.75,
        bedrooms: 3,
        subtype: 'apartment',
        category: 'residential',
        updatedAt: new Date('2026-09-01T00:00:00Z'),
        ...overrides,
    };
}

function property(overrides = {}) {
    return {
        id: 'prop-1',
        ownerUid: OWNER,
        createdByUid: OWNER,
        category: 'residential',
        subtype: 'apartment',
        city: 'Bengaluru',
        localityId: 'bengaluru__whitefield',
        bedrooms: 3,
        builtUpAreaSqft: 1450,
        ...overrides,
    };
}

describe('actor scoping', () => {
    it('lets an owner access only listings they listed', () => {
        assert.equal(canAccessListingInventory(OWNER, listing()), true);
        assert.equal(canAccessListingInventory(OWNER, listing({ listedByUid: OTHER })), false);
        assert.equal(canEditListingOffer(OWNER, listing()), true);
        assert.equal(canAccessPropertyInventory(OWNER, property()), true);
    });

    it('lets an agent access only their listed inventory', () => {
        const agentListing = listing({ listedByUid: AGENT, listedByRole: 'agent' });
        assert.equal(canAccessListingInventory(AGENT, agentListing), true);
        assert.equal(canAccessListingInventory(AGENT, listing()), false);
        assert.deepEqual(
            filterAccessibleListings(AGENT, [agentListing, listing()]).map((row) => row.id),
            ['listing-1']
        );
    });

    it('lets a builder access only their listed inventory', () => {
        const builderListing = listing({ id: 'listing-b', listedByUid: BUILDER, listedByRole: 'builder' });
        assert.equal(canAccessListingInventory(BUILDER, builderListing), true);
        assert.equal(canAccessListingInventory(BUILDER, listing()), false);
    });

    it('rejects unauthorized inventory access', () => {
        assert.equal(canAccessListingInventory(null, listing()), false);
        assert.equal(canAccessListingInventory(OTHER, listing()), false);
        assert.equal(canAccessPropertyInventory(OTHER, property()), false);
        assert.equal(canAccessPropertyInventory(AGENT, property({ ownerUid: OWNER, createdByUid: OWNER })), false);
    });

    it('does not let an owner edit someone else’s listing', () => {
        assert.equal(canEditListingOffer(OWNER, listing({ listedByUid: AGENT })), false);
    });

    it('does not let an agent edit an arbitrary property they do not own or create', () => {
        const foreign = property({ ownerUid: OWNER, createdByUid: OWNER });
        assert.equal(canAccessPropertyInventory(AGENT, foreign), false);
        const agentListing = listing({ listedByUid: AGENT, propertyId: foreign.id });
        assert.equal(canManageListingMedia(AGENT, agentListing, foreign), true);
        assert.equal(canAccessPropertyInventory(AGENT, foreign), false);
    });
});

describe('status action availability', () => {
    it('exposes pause/sold/archive on published sale listings and not publish', () => {
        const ids = availableDashboardActions(listing({ status: 'PUBLISHED', transactionType: 'buy' }))
            .map((row) => row.id);
        assert.ok(ids.includes('pause'));
        assert.ok(ids.includes('sold'));
        assert.ok(ids.includes('archive'));
        assert.equal(ids.includes('publish'), false);
        assert.equal(ids.includes('rented'), false);
        assert.equal(availableDashboardActions(listing({ status: 'PUBLISHED' })).some(isSelfPublishAction), false);
    });

    it('exposes rented instead of sold on published rent listings', () => {
        const ids = availableDashboardActions(listing({ status: 'PUBLISHED', transactionType: 'rent' }))
            .map((row) => row.id);
        assert.ok(ids.includes('rented'));
        assert.equal(ids.includes('sold'), false);
    });

    it('does not expose invalid transitions', () => {
        assert.equal(actionById(listing({ status: 'SOLD' }), 'pause'), null);
        assert.equal(actionById(listing({ status: 'RENTED' }), 'sold'), null);
        assert.equal(canTransitionListing('SOLD', 'PUBLISHED'), false);
        assert.equal(canTransitionListing('RENTED', 'PUBLISHED'), false);
        assert.equal(clientMaySetListingStatus('PAUSED', 'PUBLISHED'), false);
        const paused = availableDashboardActions(listing({ status: 'PAUSED' }));
        assert.equal(paused.some((row) => row.toStatus === 'PUBLISHED'), false);
        assert.ok(paused.some((row) => row.id === 'request_review'));
        assert.equal(paused.some((row) => row.id === 'pause'), false);
    });

    it('identifies drafts versus submitted-for-review', () => {
        assert.equal(isDraftListing(listing()), true);
        assert.equal(isUnderReviewListing(listing({ reviewRequestedAt: new Date() })), true);
        assert.equal(isDraftListing(listing({ reviewRequestedAt: new Date() })), false);
        assert.equal(canContinueEditing(listing()), true);
        assert.equal(canContinueEditing(listing({ status: 'PUBLISHED' })), false);
        assert.equal(listingMatchesDashboardFilter(listing(), 'draft'), true);
        assert.equal(listingMatchesDashboardFilter(listing({ reviewRequestedAt: new Date() }), 'review'), true);
        assert.equal(listingMatchesDashboardFilter(listing({ status: 'SOLD' }), 'sold_rented'), true);
    });
});

describe('freshness and completeness', () => {
    it('warns from real timestamps and does not treat updates as verification', () => {
        const now = Date.parse('2026-09-11T00:00:00Z');
        const stale = new Date(now - DASHBOARD_STALE_UPDATE_MS - 1000);
        const keys = dashboardAttention(listing({
            status: 'PUBLISHED',
            updatedAt: stale,
            lastVerifiedAt: stale,
            expiresAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
        }), now).map((row) => row.key);
        assert.ok(keys.includes('needs_update'));
        assert.ok(keys.includes('needs_verification'));
        assert.ok(keys.includes('expires_soon'));
        assert.equal(
            dashboardAttention(listing({ status: 'PUBLISHED', updatedAt: stale }), now)
                .some((row) => row.key === 'needs_verification'),
            false
        );
    });

    it('scores listing completeness without calling it verification', () => {
        const complete = listingCompleteness(listing(), property(), { mediaCount: 2 });
        assert.equal(complete.isComplete, true);
        assert.equal(complete.total, 5);
        const incomplete = listingCompleteness(listing({
            coverThumbnailUrl: null,
            description: '',
            askingPrice: null,
            latitude: null,
            longitude: null,
        }), property({ latitude: null, longitude: null }), { mediaCount: 0 });
        const warnings = completenessWarnings(incomplete);
        assert.ok(warnings.includes('Missing cover'));
        assert.ok(warnings.includes('Missing description'));
        assert.ok(warnings.includes('Missing price'));
        assert.ok(warnings.includes('Location incomplete'));
    });
});

describe('pagination and inventory shape', () => {
    it('normalizes page size and drops duplicate ids', () => {
        assert.equal(clampDashboardPageSize(200), 50);
        const page = normalizeInventoryPage({
            items: [listing(), listing(), listing({ id: 'listing-2' })],
            pageSize: DASHBOARD_PAGE_SIZE,
            hasMore: true,
            cursor: { id: 'cursor' },
        });
        assert.equal(page.items.length, 2);
        assert.equal(page.hasMore, true);
        assert.deepEqual(dedupeInventoryById([listing(), listing()]).map((row) => row.id), ['listing-1']);
        const merged = mergeSortedInventory([
            [listing({ id: 'a', updatedAt: new Date('2026-09-02') })],
            [listing({ id: 'a', updatedAt: new Date('2026-09-01') }), listing({ id: 'b', updatedAt: new Date('2026-09-03') })],
        ], 10);
        assert.deepEqual(merged.map((row) => row.id), ['b', 'a']);
    });

    it('keeps properties and listings separate while grouping offers', () => {
        const sale = listing({ id: 'sale', transactionType: 'buy', askingPrice: 13500000 });
        const rent = listing({ id: 'rent', transactionType: 'rent', rentMonthly: 42000, askingPrice: null });
        const grouped = mergePropertyInventory([property()], [sale, rent]);
        assert.equal(grouped.length, 1);
        assert.equal(grouped[0].listingCount, 2);
        assert.equal(grouped[0].listings.length, 2);
        assert.deepEqual(uniquePropertyIds([sale, rent, listing({ propertyId: null })]), ['prop-1']);
        assert.equal(listingMatchesQuery(sale, property(), 'whitefield'), true);
        assert.equal(listingMatchesQuery(sale, property(), 'kochi'), false);
    });
});

describe('media permissions and inquiries', () => {
    it('allows public gallery mutation only for the uploader', () => {
        const photo = {
            id: 'media-1',
            createdByUid: OWNER,
            visibility: 'public',
            status: 'ACTIVE',
            mediaType: 'photo',
        };
        assert.equal(isPublicGalleryMedia(photo), true);
        assert.equal(isPublicGalleryMedia({ ...photo, mediaType: 'document' }), false);
        assert.equal(canMutateMediaItem(OWNER, photo), true);
        assert.equal(canMutateMediaItem(AGENT, photo), false);
        assert.equal(canMutateMediaItem(OWNER, { ...photo, mediaType: 'spatial' }), false);
    });

    it('keeps inquiries listing-scoped to the actor and does not invent analytics', () => {
        const chats = [
            { id: 'c1', listingId: 'listing-1', participantIds: [OWNER, OTHER], unreadCounts: { [OWNER]: 2 } },
            { id: 'c2', listingId: 'listing-1', participantIds: [AGENT, OTHER] },
            { id: 'c3', participantIds: [OWNER, OTHER] },
            { id: 'c4', listingId: 'foreign', participantIds: [OWNER, OTHER] },
        ];
        const mine = filterListingInquiries(chats, { uid: OWNER, listings: [listing()] });
        assert.deepEqual(mine.map((row) => row.id), ['c1']);
        assert.equal(inquiryUnreadCount(chats[0], OWNER), 2);
        assert.match(ANALYTICS_UNAVAILABLE_COPY, /unavailable/i);
        assert.equal(dashboardCopy(['agent']).title, 'Your listings');
        assert.equal(dashboardCopy(['builder']).title, 'Your inventory');
        assert.equal(dashboardCopy(['owner']).title, 'Your properties');
        assert.equal(dashboardCopy(['agent']).title.includes('Broker'), false);
    });
});
