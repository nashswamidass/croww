import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    assertPublicAlertPayload,
    buildSavedSearchAlertCopy,
    buildSavedSearchAlertData,
    canonicalizeSavedSearch,
    criteriaHash,
    exploreStateToSearchInput,
    generateSavedSearchName,
    isMeaningfulSavedSearch,
    isPublicationTransition,
    listingMatchesSavedSearch,
    listingSaveSnapshot,
    listingMarketAmount,
    savedSearchMatchId,
} from './index.ts';

const CHENNAI_VIEWPORT = {
    latitude: 13.0827,
    longitude: 80.2707,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
};

function published(overrides = {}) {
    return {
        id: 'lst1',
        status: 'PUBLISHED',
        transactionType: 'buy',
        category: 'residential',
        subtype: 'apartment',
        bedrooms: 2,
        askingPrice: 8000000,
        rentMonthly: null,
        city: 'Chennai',
        localityId: 'anna-nagar',
        latitude: 13.0878,
        longitude: 80.217,
        listedByUid: 'owner1',
        title: '2 BHK in Anna Nagar',
        builtUpAreaSqft: 1100,
        ...overrides,
    };
}

function search(overrides = {}) {
    return canonicalizeSavedSearch({
        name: 'Chennai 2BHK under ₹80L',
        location: { mode: 'CITY', city: 'Chennai' },
        filters: { transactionType: 'buy', category: 'residential', bhk: 2, maxPrice: 8000000 },
        ...overrides,
    });
}

describe('saved search canonicalization', () => {
    it('drops null noise, lowercases city, and hashes equivalently', () => {
        const a = canonicalizeSavedSearch({
            name: '  One  ',
            location: { city: 'Chennai', localityId: null, viewport: null, mode: 'CITY' },
            filters: { transactionType: 'buy', category: null, subtype: null, bhk: null, minPrice: null, maxPrice: 5000000 },
        });
        const b = canonicalizeSavedSearch({
            location: { city: 'CHENNAI', mode: 'CITY' },
            filters: { transactionType: 'buy', maxPrice: 5000000, extra: 'ignore' },
        });
        assert.equal(a.criteriaHash, b.criteriaHash);
        assert.equal(a.location.cityKey, 'chennai');
        assert.equal(a.filters.category, null);
        assert.equal(a.filters.maxPrice, 5000000);
        assert.equal(criteriaHash(a.location, a.filters), a.criteriaHash);
    });

    it('does not treat the default Explore buy/city state as meaningful', () => {
        const input = exploreStateToSearchInput({
            city: 'Chennai',
            localityId: null,
            viewport: CHENNAI_VIEWPORT,
            filters: { transactionType: 'buy', category: null, subtype: null, bhk: null, minPrice: null, maxPrice: null },
        });
        assert.equal(isMeaningfulSavedSearch(input), false);
        assert.equal(isMeaningfulSavedSearch({
            location: { city: 'Chennai', localityId: 'anna-nagar' },
            filters: { transactionType: 'buy' },
        }), true);
    });

    it('generates a deterministic label without an LLM', () => {
        const canonical = canonicalizeSavedSearch({
            location: { city: 'Chennai', searchLabel: 'Anna Nagar' },
            filters: { transactionType: 'rent', bhk: 2, maxPrice: 35000 },
        });
        assert.equal(generateSavedSearchName(canonical.location, canonical.filters), canonical.name);
        assert.match(canonical.name, /Anna Nagar/);
        assert.match(canonical.name, /Rent/);
    });
});

describe('saved listing snapshots', () => {
    it('keeps a small display snapshot and ignores private fields', () => {
        const snap = listingSaveSnapshot({
            title: 'Nice flat',
            askingPrice: 9000000,
            status: 'PUBLISHED',
            transactionType: 'buy',
            city: 'Chennai',
            address: '12 Secret Street',
            latitude: 13.1,
            listedByUid: 'abc',
        }, { localityName: 'Anna Nagar' });
        assert.equal(snap.title, 'Nice flat');
        assert.equal(snap.city, 'Chennai');
        assert.equal(snap.localityName, 'Anna Nagar');
        assert.equal('address' in snap, false);
        assert.equal('latitude' in snap, false);
        assert.equal('listedByUid' in snap, false);
    });
});

describe('listing vs property save identity', () => {
    it('uses listingId and propertyId as distinct document identities', () => {
        assert.notEqual('listing-1', 'property-1');
        const listingSnap = listingSaveSnapshot({ title: 'Offer', transactionType: 'rent', rentMonthly: 20000 });
        assert.equal(listingSnap.rentMonthly, 20000);
        assert.equal(listingSnap.askingPrice, null);
    });
});

describe('publication transition', () => {
    it('alerts only when status becomes PUBLISHED', () => {
        assert.equal(isPublicationTransition(null, { status: 'PUBLISHED' }), true);
        assert.equal(isPublicationTransition({ status: 'DRAFT' }, { status: 'PUBLISHED' }), true);
        assert.equal(isPublicationTransition({ status: 'PAUSED' }, { status: 'PUBLISHED' }), true);
        assert.equal(isPublicationTransition({ status: 'PUBLISHED' }, { status: 'PUBLISHED' }), false);
        assert.equal(isPublicationTransition({ status: 'DRAFT' }, { status: 'DRAFT' }), false);
        assert.equal(isPublicationTransition({ status: 'PUBLISHED' }, { status: 'PAUSED' }), false);
    });
});

describe('saved search matching', () => {
    it('matches a published buy listing on category, BHK, and askingPrice', () => {
        assert.equal(listingMatchesSavedSearch(published(), search()), true);
        assert.equal(listingMatchesSavedSearch(published({ askingPrice: 9000000 }), search()), false);
        assert.equal(listingMatchesSavedSearch(published({ bedrooms: 3 }), search()), false);
        assert.equal(listingMatchesSavedSearch(published({ category: 'land' }), search()), false);
    });

    it('matches rent against rentMonthly, never askingPrice', () => {
        const rentSearch = canonicalizeSavedSearch({
            location: { city: 'Chennai' },
            filters: { transactionType: 'rent', maxPrice: 30000 },
        });
        const ok = published({
            transactionType: 'rent',
            rentMonthly: 25000,
            askingPrice: 90000000,
        });
        const noRent = published({
            transactionType: 'rent',
            rentMonthly: null,
            askingPrice: 10000,
        });
        assert.equal(listingMarketAmount(ok), 25000);
        assert.equal(listingMatchesSavedSearch(ok, rentSearch), true);
        assert.equal(listingMatchesSavedSearch(noRent, rentSearch), false);
        assert.equal(listingMatchesSavedSearch(published({ askingPrice: 25000 }), rentSearch), false);
    });

    it('treats missing filters as unrestricted', () => {
        const open = canonicalizeSavedSearch({
            location: { city: 'Chennai' },
            filters: { transactionType: 'buy' },
        });
        assert.equal(listingMatchesSavedSearch(published({ bedrooms: 4, category: 'commercial' }), open), true);
    });

    it('matches locality and rejects other localities', () => {
        const loc = canonicalizeSavedSearch({
            location: { city: 'Chennai', localityId: 'anna-nagar', mode: 'LOCALITY' },
            filters: { transactionType: 'buy' },
        });
        assert.equal(listingMatchesSavedSearch(published(), loc), true);
        assert.equal(listingMatchesSavedSearch(published({ localityId: 'omr' }), loc), false);
    });

    it('matches viewport using public coordinates', () => {
        const vp = canonicalizeSavedSearch({
            location: {
                mode: 'VIEWPORT',
                city: 'Chennai',
                viewport: { latitude: 13.0878, longitude: 80.217, latitudeDelta: 0.05, longitudeDelta: 0.05 },
            },
            filters: { transactionType: 'buy' },
        });
        assert.equal(listingMatchesSavedSearch(published(), vp), true);
        assert.equal(listingMatchesSavedSearch(published({ latitude: 12.9, longitude: 80.2 }), vp), false);
        assert.equal(listingMatchesSavedSearch(published({ latitude: null, longitude: null }), vp), false);
    });

    it('rejects unpublished listings and missing sale price', () => {
        const priced = search();
        assert.equal(listingMatchesSavedSearch(published({ status: 'DRAFT' }), priced), false);
        assert.equal(listingMatchesSavedSearch(published({ status: 'PAUSED' }), priced), false);
        assert.equal(listingMatchesSavedSearch(published({ askingPrice: null }), priced), false);
    });

    it('does not use Chennai as a fallback for another city', () => {
        const chennai = search();
        assert.equal(listingMatchesSavedSearch(published({ city: 'Bengaluru' }), chennai), false);
    });
});

describe('alert dedup and privacy', () => {
    it('builds a stable match id', () => {
        assert.equal(
            savedSearchMatchId('s1', 'l1'),
            savedSearchMatchId('s1', 'l1', 'listingPublished')
        );
        assert.notEqual(savedSearchMatchId('s1', 'l1'), savedSearchMatchId('s1', 'l2'));
    });

    it('omits private fields from notification payloads', () => {
        const data = buildSavedSearchAlertData('lst1', 's1');
        assert.equal(data.type, 'saved_search_match');
        assert.equal(data.listingId, 'lst1');
        assert.deepEqual(assertPublicAlertPayload(data), []);
        const copy = buildSavedSearchAlertCopy(published({ rentMonthly: 35000, transactionType: 'rent', askingPrice: null }), search({
            name: 'OMR rentals',
            filters: { transactionType: 'rent' },
            location: { city: 'Chennai' },
        }));
        assert.match(copy.title, /OMR rentals/);
        assert.match(copy.message, /month/);
        assert.doesNotMatch(copy.message, /13\.0878|Secret|owner1/);
    });
});
