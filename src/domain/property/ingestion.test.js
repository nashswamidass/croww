import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    derivePublicCoordinate,
    buildPublicGeoFields,
    toPublicMapCoordinate,
    haversineMeters,
} from './geo.ts';
import { normalizeAddress, publicAddressFromInput } from './address.ts';
import { scoreDuplicateCandidates } from './duplicates.ts';
import { listingProtectedFieldsTouched, validateListingInput, validatePropertyInput, canTransitionListing } from './validate.ts';
import { assertListingActorAllowed, clientMaySetListingStatus } from './actorPolicy.ts';
import { InventoryError } from './errors.ts';

const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };

describe('public/private geo', () => {
    it('keeps exact public pin equal to exact coordinate', () => {
        const pub = derivePublicCoordinate('prop1', CHENNAI, 'exact');
        assert.equal(pub.latitude, CHENNAI.latitude);
        assert.equal(pub.longitude, CHENNAI.longitude);
    });

    it('does not expose exact coords on the approximate public pin', () => {
        const pub = derivePublicCoordinate('prop-approx', CHENNAI, 'approximate');
        assert.notEqual(pub.latitude, CHENNAI.latitude);
        assert.notEqual(pub.longitude, CHENNAI.longitude);
        const meters = haversineMeters(CHENNAI, pub);
        assert.ok(meters > 50);
        assert.ok(meters < 400);
    });

    it('uses locality centroid for locality precision when provided', () => {
        const locality = { latitude: 13.0067, longitude: 80.2206 };
        const pub = derivePublicCoordinate('prop-loc', CHENNAI, 'locality', locality);
        assert.equal(pub.latitude, locality.latitude);
        assert.equal(pub.longitude, locality.longitude);
    });

    it('does not jitter stored public pins again at read time', () => {
        const stored = buildPublicGeoFields('prop-approx', CHENNAI.latitude, CHENNAI.longitude, 'approximate');
        const display = toPublicMapCoordinate('prop-approx', stored.latitude, stored.longitude, 'approximate');
        assert.equal(display.latitude, stored.latitude);
        assert.equal(display.longitude, stored.longitude);
    });

    it('rejects coordinates outside India when country is IN', () => {
        const issues = validatePropertyInput({
            category: 'residential',
            subtype: 'apartment',
            localityId: 'adyar',
            address: { line1: '12 Beach', city: 'Chennai', state: 'TN', country: 'IN' },
            latitude: 40.7,
            longitude: -74.0,
        });
        assert.ok(issues.some((i) => i.field === 'latitude'));
    });

    it('does not invent a default city pin', () => {
        const issues = validatePropertyInput({
            category: 'residential',
            subtype: 'apartment',
            localityId: 'adyar',
            address: { line1: '12 Beach', city: 'Chennai' },
        });
        assert.ok(issues.some((i) => i.field === 'latitude'));
        assert.ok(issues.some((i) => i.field === 'longitude'));
    });

    it('rejects out-of-range coordinates', () => {
        const issues = validatePropertyInput({
            category: 'residential',
            subtype: 'apartment',
            localityId: 'adyar',
            address: { line1: '12 Beach', city: 'Chennai', country: 'IN' },
            latitude: 91,
            longitude: 80.27,
        });
        assert.ok(issues.some((i) => i.field === 'latitude'));
    });

    it('uses a different public geohash for approximate pins', () => {
        const exact = buildPublicGeoFields('prop-hash', CHENNAI.latitude, CHENNAI.longitude, 'exact');
        const approx = buildPublicGeoFields('prop-hash', CHENNAI.latitude, CHENNAI.longitude, 'approximate');
        assert.notEqual(approx.geohash, exact.geohash);
    });
});

describe('address', () => {
    it('preserves original while normalizing comparison text', () => {
        const original = { line1: '12, Beach  Road', city: 'Chennai', state: 'TN', pincode: '600020' };
        assert.equal(normalizeAddress(original), '12 beach road chennai tn 600020');
        const hidden = publicAddressFromInput(original, 'approximate');
        assert.equal(hidden.line1, null);
        assert.equal(hidden.pincode, null);
        assert.equal(hidden.city, 'Chennai');
        const shown = publicAddressFromInput(original, 'exact');
        assert.equal(shown.line1, '12, Beach  Road');
    });
});

describe('duplicates', () => {
    it('returns potential duplicates without merging', () => {
        const input = {
            id: 'new',
            localityId: 'adyar',
            category: 'residential',
            subtype: 'apartment',
            addressNormalized: '12 beach road chennai',
            latitude: 13.08,
            longitude: 80.27,
            bedrooms: 3,
            floor: 4,
        };
        const existing = [{
            id: 'old',
            localityId: 'adyar',
            category: 'residential',
            subtype: 'apartment',
            addressNormalized: '12 beach road chennai',
            latitude: 13.0801,
            longitude: 80.2701,
            bedrooms: 3,
            floor: 4,
        }];
        const hits = scoreDuplicateCandidates(input, existing);
        assert.equal(hits.length, 1);
        assert.equal(hits[0].propertyId, 'old');
        assert.ok(hits[0].reasons.includes('normalized_address'));
    });
});

describe('actors and protected fields', () => {
    it('allows owner create on their claimed property', () => {
        const ok = assertListingActorAllowed('owner', { uid: 'u1' }, { ownerUid: 'u1', createdByUid: 'u1' });
        assert.equal(ok.ok, true);
    });

    it('rejects owner listing on someone else\'s property', () => {
        const result = assertListingActorAllowed('owner', { uid: 'u2' }, { ownerUid: 'u1', createdByUid: 'u1' });
        assert.equal(result.ok, false);
        assert.equal(result.code, 'OWNERSHIP_CONFLICT');
    });

    it('requires agent role and does not infer it from provider userType', () => {
        const no = assertListingActorAllowed('agent', { uid: 'a1', roles: [], userType: 'provider' }, { ownerUid: 'o1' });
        assert.equal(no.ok, false);
        const yes = assertListingActorAllowed('agent', { uid: 'a1', roles: ['agent'], userType: 'individual' }, { ownerUid: 'o1' });
        assert.equal(yes.ok, true);
    });

    it('requires builder role and does not infer it from business userType', () => {
        const no = assertListingActorAllowed('builder', { uid: 'b1', roles: [], userType: 'business' }, { ownerUid: 'o1' });
        assert.equal(no.ok, false);
        const yes = assertListingActorAllowed('builder', { uid: 'b1', roles: ['builder'] }, { ownerUid: 'o1' });
        assert.equal(yes.ok, true);
    });

    it('rejects unauthorized actor', () => {
        const result = assertListingActorAllowed('admin', { uid: 'u1', userType: 'individual' }, {});
        assert.equal(result.ok, false);
        assert.equal(result.code, 'UNAUTHORIZED_ACTOR');
    });

    it('blocks protected field patches', () => {
        const touched = listingProtectedFieldsTouched({
            title: 'ok',
            listedByUid: 'attacker',
            latitude: 1,
            lastVerifiedAt: 'now',
            spatialTourAvailable: true,
        });
        assert.ok(touched.includes('listedByUid'));
        assert.ok(touched.includes('latitude'));
        assert.ok(touched.includes('lastVerifiedAt'));
        assert.ok(touched.includes('spatialTourAvailable'));
        assert.ok(!touched.includes('title'));
    });

    it('allows listing offer edits without touching provenance', () => {
        const touched = listingProtectedFieldsTouched({
            title: 'Updated 3 BHK',
            description: 'Bright',
            askingPrice: 15000000,
            negotiable: false,
        });
        assert.equal(touched.length, 0);
    });

    it('blocks client publish transitions', () => {
        assert.equal(clientMaySetListingStatus('DRAFT', 'PUBLISHED'), false);
        assert.equal(clientMaySetListingStatus('PAUSED', 'PUBLISHED'), false);
        assert.equal(clientMaySetListingStatus('PUBLISHED', 'PAUSED'), true);
        assert.equal(canTransitionListing('DRAFT', 'ARCHIVED'), true);
        assert.equal(canTransitionListing('SOLD', 'PUBLISHED'), false);
        assert.equal(canTransitionListing('RENTED', 'PUBLISHED'), false);
        assert.equal(canTransitionListing('ARCHIVED', 'PUBLISHED'), false);
        assert.equal(canTransitionListing('SOLD', 'DRAFT'), false);
    });
});

describe('listing validation', () => {
    it('allows draft without price and requires price to publish', () => {
        const draft = validateListingInput({
            propertyId: 'p1',
            transactionType: 'buy',
            listedByRole: 'owner',
            title: '3 BHK',
            status: 'DRAFT',
        });
        assert.deepEqual(draft, []);
        const published = validateListingInput({
            propertyId: 'p1',
            transactionType: 'buy',
            listedByRole: 'owner',
            title: '3 BHK',
            status: 'PUBLISHED',
            askingPrice: 0,
        });
        assert.ok(published.some((i) => i.field === 'askingPrice'));
        const rent = validateListingInput({
            propertyId: 'p1',
            transactionType: 'rent',
            listedByRole: 'agent',
            title: 'Rent',
            status: 'PUBLISHED',
            rentMonthly: -1,
        });
        assert.ok(rent.some((i) => i.field === 'rentMonthly'));
    });
});

describe('errors', () => {
    it('uses stable codes without leaking internals', () => {
        const err = new InventoryError('PUBLICATION_FORBIDDEN', 'Clients cannot publish listings');
        assert.equal(err.code, 'PUBLICATION_FORBIDDEN');
        assert.equal(err.message.includes('firestore'), false);
    });
});
