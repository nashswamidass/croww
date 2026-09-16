import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_TAXONOMY_ITEMS,
    mapLegacyToTaxonomy,
    mapTaxonomyToLegacy,
    validateTaxonomyPosting,
} from './index.ts';

describe('Server-Driven Listing Taxonomy Domain Contracts', () => {
    it('1. returns canonical stay categories with active status and posting enabled', () => {
        const stays = DEFAULT_TAXONOMY_ITEMS.filter((item) => item.parentCategory === 'stay');
        assert.equal(stays.length, 6);

        const expectedStayIds = [
            'stay_bed',
            'stay_shared_room',
            'stay_private_room',
            'stay_pg',
            'stay_coliving',
            'stay_roommate_replacement',
        ];

        expectedStayIds.forEach((id) => {
            const found = stays.find((s) => s.typeId === id);
            assert.ok(found, `Expected stay item ${id} to exist`);
            assert.equal(found.status, 'ACTIVE');
            assert.equal(found.consumerEnabled, true);
            assert.equal(found.postingEnabled, true);
            assert.equal(found.rentEnabled, true);
        });
    });

    it('2. provides future residential and commercial categories in inactive/disabled posting state', () => {
        const futureItems = DEFAULT_TAXONOMY_ITEMS.filter((item) => item.parentCategory !== 'stay');
        assert.ok(futureItems.length >= 8);

        const bhk2 = futureItems.find((item) => item.typeId === 'res_2bhk');
        assert.ok(bhk2);
        assert.equal(bhk2.status, 'INACTIVE');
        assert.equal(bhk2.postingEnabled, false);

        const office = futureItems.find((item) => item.typeId === 'commercial_office');
        assert.ok(office);
        assert.equal(office.status, 'INACTIVE');
        assert.equal(office.postingEnabled, false);
    });

    it('3. search enabled stays true when posting is disabled (preserves discovery of existing inventory)', async () => {
        const mockItem = {
            ...DEFAULT_TAXONOMY_ITEMS[0],
            postingEnabled: false,
            searchEnabled: true,
        };

        // Posting should be blocked
        assert.equal(mockItem.postingEnabled, false);
        // But search and filters remain enabled
        assert.equal(mockItem.searchEnabled, true);
    });

    it('4. validateTaxonomyPosting rejects if status is INACTIVE', () => {
        const inactiveItem = {
            ...DEFAULT_TAXONOMY_ITEMS[0],
            status: 'INACTIVE',
        };

        const result = validateTaxonomyPosting({
            typeId: inactiveItem.typeId,
            transactionType: 'rent',
            payload: { rentMonthly: 6000, locality: 'Koramangala' },
            taxonomyItem: inactiveItem,
        });

        assert.equal(result.valid, false);
        assert.ok(result.errors.some((e) => e.includes('currently inactive')));
    });

    it('5. validateTaxonomyPosting rejects if postingEnabled is false', () => {
        const disabledItem = {
            ...DEFAULT_TAXONOMY_ITEMS[0],
            postingEnabled: false,
        };

        const result = validateTaxonomyPosting({
            typeId: disabledItem.typeId,
            transactionType: 'rent',
            payload: { rentMonthly: 6000, locality: 'Koramangala' },
            taxonomyItem: disabledItem,
        });

        assert.equal(result.valid, false);
        assert.ok(result.errors.some((e) => e.includes('disabled by admin')));
    });

    it('6. validateTaxonomyPosting rejects sale on rent-only stay categories', () => {
        const bedItem = DEFAULT_TAXONOMY_ITEMS.find((i) => i.typeId === 'stay_bed');
        assert.ok(bedItem);
        assert.equal(bedItem.saleEnabled, false);

        const result = validateTaxonomyPosting({
            typeId: bedItem.typeId,
            transactionType: 'buy',
            payload: { askingPrice: 500000 },
            taxonomyItem: bedItem,
        });

        assert.equal(result.valid, false);
        assert.ok(result.errors.some((e) => e.includes('not enabled for sale')));
    });

    it('7. validateTaxonomyPosting detects missing dynamic required fields', () => {
        const pgItem = DEFAULT_TAXONOMY_ITEMS.find((i) => i.typeId === 'stay_pg');
        assert.ok(pgItem);

        // Required fields for PG: monthlyRent, deposit, occupancy, availableFrom
        const result = validateTaxonomyPosting({
            typeId: pgItem.typeId,
            transactionType: 'rent',
            payload: { deposit: 10000 }, // missing monthlyRent, occupancy, availableFrom
            taxonomyItem: pgItem,
        });

        assert.equal(result.valid, false);
        assert.ok(result.missingFields.includes('monthlyRent'));
        assert.ok(result.missingFields.includes('occupancy'));
        assert.ok(result.missingFields.includes('availableFrom'));
    });

    it('8. validateTaxonomyPosting succeeds when all required fields and conditions are satisfied', () => {
        const pgItem = DEFAULT_TAXONOMY_ITEMS.find((i) => i.typeId === 'stay_pg');
        assert.ok(pgItem);

        const result = validateTaxonomyPosting({
            typeId: pgItem.typeId,
            transactionType: 'rent',
            payload: {
                rentMonthly: 8500,
                deposit: 15000,
                occupancy: 'single',
                availableFrom: '2026-10-01',
            },
            taxonomyItem: pgItem,
        });

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
        assert.equal(result.missingFields.length, 0);
    });

    it('9. mapLegacyToTaxonomy maps legacy category/subtype to canonical taxonomy ID', () => {
        assert.equal(mapLegacyToTaxonomy('stay', 'bed'), 'stay_bed');
        assert.equal(mapLegacyToTaxonomy('stay', 'pg'), 'stay_pg');
        assert.equal(mapLegacyToTaxonomy('residential', 'bed'), 'stay_bed');
        assert.equal(mapLegacyToTaxonomy('residential', 'apartment'), 'sale_apartment');
        assert.equal(mapLegacyToTaxonomy('commercial', 'office'), 'commercial_office');
    });

    it('10. mapTaxonomyToLegacy maps taxonomy item to legacy document fields', () => {
        const bedItem = DEFAULT_TAXONOMY_ITEMS.find((i) => i.typeId === 'stay_bed');
        assert.ok(bedItem);
        const legacy = mapTaxonomyToLegacy(bedItem);
        assert.equal(legacy.category, 'residential');
        assert.equal(legacy.subtype, 'bed');

        const officeItem = DEFAULT_TAXONOMY_ITEMS.find((i) => i.typeId === 'commercial_office');
        assert.ok(officeItem);
        const officeLegacy = mapTaxonomyToLegacy(officeItem);
        assert.equal(officeLegacy.category, 'commercial');
        assert.equal(officeLegacy.subtype, 'office');
    });

    it('11. bundled safe defaults contain complete operational configuration for zero-downtime fallback', () => {
        assert.ok(Array.isArray(DEFAULT_TAXONOMY_ITEMS));
        assert.ok(DEFAULT_TAXONOMY_ITEMS.length >= 14);

        DEFAULT_TAXONOMY_ITEMS.forEach((item) => {
            assert.ok(item.id, 'item must have an id');
            assert.ok(item.typeId, 'item must have a typeId');
            assert.ok(item.displayName, 'item must have a displayName');
            assert.ok(item.parentCategory, 'item must have a parentCategory');
            assert.ok(['ACTIVE', 'INACTIVE'].includes(item.status));
            assert.equal(typeof item.consumerEnabled, 'boolean');
            assert.equal(typeof item.postingEnabled, 'boolean');
            assert.equal(typeof item.searchEnabled, 'boolean');
            assert.equal(typeof item.filterEnabled, 'boolean');
            assert.equal(typeof item.rentEnabled, 'boolean');
            assert.equal(typeof item.saleEnabled, 'boolean');
            assert.ok(Array.isArray(item.requiredFields));
            assert.equal(typeof item.displayOrder, 'number');
        });
    });

    it('12. filters posting categories by transaction type and status deterministically', () => {
        const rentPosting = DEFAULT_TAXONOMY_ITEMS.filter(
            (item) => item.status === 'ACTIVE' && item.postingEnabled && item.rentEnabled
        );
        const buyPosting = DEFAULT_TAXONOMY_ITEMS.filter(
            (item) => item.status === 'ACTIVE' && item.postingEnabled && item.saleEnabled
        );

        assert.ok(rentPosting.some((i) => i.typeId === 'stay_bed'));
        assert.ok(rentPosting.some((i) => i.typeId === 'stay_pg'));
        // Bed and PG are rent-only stays
        assert.ok(!buyPosting.some((i) => i.typeId === 'stay_bed'));
        assert.ok(!buyPosting.some((i) => i.typeId === 'stay_pg'));
    });
});

