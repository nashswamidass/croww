import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatInrCompact, formatOfferPrice } from './propertyFormat.js';
import {
    listingOfferState,
    listingStatusLabel,
    canContactListing,
    actorRoleLabel,
    contactCtaLabel,
    splitDescriptions,
    formatPublicLocation,
    buildPropertyFacts,
    verificationBadges,
    freshnessLines,
    publicActorProjection,
    buildListingShare,
    isPublicGalleryMedia,
} from './propertyDetailView.js';

describe('formatInrCompact', () => {
    it('formats crore, lakh, and rupee amounts', () => {
        assert.equal(formatInrCompact(13500000), '₹1.35 Cr');
        assert.equal(formatInrCompact(8500000), '₹85 L');
        assert.equal(formatInrCompact(42000), '₹42,000');
        assert.equal(formatInrCompact(2500000000), '₹250 Cr');
        assert.equal(formatInrCompact(1), '₹1');
        assert.equal(formatInrCompact(null), null);
        assert.equal(formatInrCompact('not-a-number'), null);
    });
});

describe('formatOfferPrice', () => {
    it('does not present sale price as monthly rent', () => {
        const rent = formatOfferPrice({
            transactionType: 'rent',
            rentMonthly: 42000,
            askingPrice: 13500000,
            deposit: 150000,
            maintenanceMonthly: 3500,
            negotiable: true,
        });
        assert.equal(rent.primary, '₹42,000 / month');
        assert.ok(rent.secondary.some((line) => line.includes('Deposit')));
        assert.equal(rent.amount, 42000);

        const buy = formatOfferPrice({
            transactionType: 'buy',
            askingPrice: 13500000,
            rentMonthly: 42000,
            negotiable: true,
        });
        assert.equal(buy.primary, '₹1.35 Cr');
        assert.equal(buy.negotiable, true);
        assert.equal(buy.amount, 13500000);
    });

    it('does not invent a missing price', () => {
        const none = formatOfferPrice({ transactionType: 'buy' });
        assert.equal(none.primary, 'Price on request');
        assert.equal(none.amount, null);
        assert.equal(none.negotiable, false);
    });
});

describe('listing availability', () => {
    it('treats past expiresAt as expired even when status is PUBLISHED', () => {
        const listing = { status: 'PUBLISHED', expiresAt: new Date('2020-01-01') };
        assert.equal(listingOfferState(listing, Date.parse('2026-09-11')), 'expired');
        assert.equal(listingStatusLabel(listing, Date.parse('2026-09-11')), 'This listing has expired');
        assert.equal(canContactListing({ listing, currentUid: 'buyer' }), false);
    });

    it('hides contact on inactive property and own listing', () => {
        const listing = { status: 'PUBLISHED', listedByUid: 'owner1', ownerUid: 'owner1' };
        assert.equal(canContactListing({ listing, currentUid: 'buyer1' }), true);
        assert.equal(canContactListing({ listing, property: { status: 'INACTIVE' }, currentUid: 'buyer1' }), false);
        assert.equal(canContactListing({ listing, currentUid: 'owner1' }), false);
        assert.equal(canContactListing({ listing: { status: 'SOLD' }, currentUid: 'buyer1' }), false);
    });
});

describe('actors', () => {
    it('labels listedByRole without guessing from userType', () => {
        assert.equal(actorRoleLabel('owner'), 'Listed by Owner');
        assert.equal(actorRoleLabel('agent'), 'Listed by Agent');
        assert.equal(actorRoleLabel('builder'), 'Listed by Builder');
        assert.equal(actorRoleLabel('business'), null);
        assert.equal(contactCtaLabel('agent'), 'Contact agent');
    });

    it('strips private identity fields', () => {
        const publicActor = publicActorProjection({
            id: 'u1',
            name: 'Priya',
            email: 'hidden@example.com',
            phone: '9999999999',
            avatar: 'https://cdn/a.jpg',
            userType: 'business',
            kycStatus: 'verified',
            verificationData: { data: { full_name: 'SECRET' } },
        });
        assert.equal(publicActor.uid, 'u1');
        assert.equal(publicActor.displayName, 'Priya');
        assert.equal(publicActor.photoURL, 'https://cdn/a.jpg');
        assert.equal('email' in publicActor, false);
        assert.equal('phone' in publicActor, false);
        assert.equal(JSON.stringify(publicActor).includes('SECRET'), false);
        assert.equal(JSON.stringify(publicActor).includes('hidden@example.com'), false);
        assert.equal(publicActor.trust.identity.status, 'NOT_VERIFIED');
    });
});

describe('descriptions and location', () => {
    it('dedupes identical listing and property copy', () => {
        assert.deepEqual(splitDescriptions('Bright flat', 'Bright flat'), {
            listing: 'Bright flat',
            property: null,
        });
        assert.deepEqual(splitDescriptions('Offer text', 'Asset text'), {
            listing: 'Offer text',
            property: 'Asset text',
        });
    });

    it('does not surface street or pincode for approximate/locality precision', () => {
        const approx = formatPublicLocation({
            precision: 'approximate',
            city: 'Chennai',
            localityName: 'Adyar',
            address: { line1: '12 Secret Street', pincode: '600020', city: 'Chennai' },
        });
        assert.equal(approx.headline, 'Adyar, Chennai');
        assert.equal(approx.street, null);
        assert.equal(approx.showExactAddress, false);

        const exact = formatPublicLocation({
            precision: 'exact',
            city: 'Chennai',
            localityName: 'Adyar',
            address: { line1: '12 Beach Road', line2: 'Near park', pincode: '600020', state: 'TN' },
        });
        assert.equal(exact.street, '12 Beach Road');
        assert.equal(exact.showExactAddress, true);
    });
});

describe('facts and trust', () => {
    it('does not force residential fields onto land', () => {
        const facts = buildPropertyFacts({
            category: 'land',
            subtype: 'residential_plot',
            plotAreaSqft: 2400,
            bedrooms: 3,
            bathrooms: 2,
            furnishing: 'fully',
        });
        assert.deepEqual(facts.map((f) => f.label).sort(), ['Land type', 'Plot area', 'Type']);
        assert.ok(!facts.some((f) => f.label === 'BHK'));
    });

    it('omits empty and unknown values', () => {
        const facts = buildPropertyFacts({
            category: 'residential',
            subtype: 'apartment',
            bedrooms: 3,
            furnishing: 'unknown',
            possessionStatus: 'unknown',
        });
        assert.ok(facts.some((f) => f.label === 'BHK' && f.value === '3'));
        assert.ok(!facts.some((f) => f.label === 'Furnishing'));
        assert.ok(!facts.some((f) => f.label === 'Possession'));
    });

    it('shows verification only for currently VERIFIED dimensions', () => {
        const badges = verificationBadges({
            verification: {
                identity: { status: 'VERIFIED' },
                ownership: { status: 'PENDING' },
                property: { status: 'NOT_VERIFIED' },
                location: { status: 'VERIFIED' },
            },
        });
        assert.deepEqual(badges.map((b) => b.label), ['Location verified']);
        assert.deepEqual(verificationBadges({}), []);
    });

    it('keeps updatedAt and lastVerifiedAt semantically distinct', () => {
        const now = Date.parse('2026-09-11T12:00:00Z');
        const lines = freshnessLines({
            updatedAt: new Date('2026-09-11T08:00:00Z'),
            publishedAt: new Date('2026-09-08T08:00:00Z'),
            lastVerifiedAt: new Date('2026-09-10T08:00:00Z'),
        }, {}, now);
        assert.ok(lines.some((l) => l.key === 'updated' && l.text === 'Updated today'));
        assert.ok(lines.some((l) => l.key === 'published' && l.text.includes('Listed')));
        assert.ok(lines.some((l) => l.key === 'verified' && l.text.includes('Listing reviewed')));
    });
});

describe('media and share', () => {
    it('rejects private documents as gallery media', () => {
        assert.equal(isPublicGalleryMedia({
            visibility: 'private',
            status: 'ACTIVE',
            mediaType: 'document',
            url: 'https://secret',
        }), false);
        assert.equal(isPublicGalleryMedia({
            visibility: 'public',
            status: 'ACTIVE',
            mediaType: 'photo',
            thumbnailUrl: 'https://img',
        }), true);
    });

    it('shares a listing URL without coordinates', () => {
        const share = buildListingShare({
            listingId: 'abc',
            title: '3 BHK in Adyar',
            city: 'Chennai',
            priceText: '₹1.35 Cr',
        });
        assert.equal(share.url, 'https://croww.ai/listing/abc');
        assert.equal(share.message.includes('latitude'), false);
        assert.equal(share.message.includes('12.9'), false);
    });
});
