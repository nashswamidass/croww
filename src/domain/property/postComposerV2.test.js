import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    getCategoryQuickFeatures,
    getCategoryAdditionalFeatures,
    getCategoryOccupancyOptions,
    buildListingCreateInput,
    buildPropertyCreateInput,
    validatePostListing,
    validatePostProperty,
    canSaveDraft,
    canRequestPublish,
    SUBTYPE_LABELS,
} from './posting.ts';

describe('Croww Single-Page Post Composer v2', () => {
    const categories = [
        'stay_bed',
        'stay_shared_room',
        'stay_private_room',
        'stay_pg',
        'stay_coliving',
        'stay_roommate_replacement',
    ];

    it('1. provides high-signal quick features tailored for each of the 6 launch categories', () => {
        // Bed
        const bedFeatures = getCategoryQuickFeatures('bed');
        assert.ok(bedFeatures.length >= 8 && bedFeatures.length <= 12, 'Bed should have 8-12 quick features');
        assert.ok(bedFeatures.some((f) => f.id === 'ac'));
        assert.ok(bedFeatures.some((f) => f.id === 'bed_included'));
        assert.ok(bedFeatures.some((f) => f.id === 'food_included'));

        // Shared Room
        const sharedFeatures = getCategoryQuickFeatures('shared_room');
        assert.ok(sharedFeatures.some((f) => f.id === 'shared_bathroom'));
        assert.ok(sharedFeatures.some((f) => f.id === 'wifi'));

        // Private Room
        const privateFeatures = getCategoryQuickFeatures('private_room');
        assert.ok(privateFeatures.some((f) => f.id === 'attached_bathroom'));
        assert.ok(privateFeatures.some((f) => f.id === 'wardrobe'));
        assert.ok(privateFeatures.some((f) => f.id === 'balcony'));

        // PG
        const pgFeatures = getCategoryQuickFeatures('pg');
        assert.ok(pgFeatures.some((f) => f.id === 'food_included'));
        assert.ok(pgFeatures.some((f) => f.id === 'housekeeping'));

        // Co-living
        const colivingFeatures = getCategoryQuickFeatures('coliving');
        assert.ok(colivingFeatures.some((f) => f.id === 'workspace'));
        assert.ok(colivingFeatures.some((f) => f.id === 'kitchen'));

        // Roommate Replacement
        const roommateFeatures = getCategoryQuickFeatures('roommate_replacement');
        assert.ok(roommateFeatures.some((f) => f.id === 'balcony'));
        assert.ok(roommateFeatures.some((f) => f.id === 'wardrobe'));
    });

    it('2. provides grouped additional features for progressive disclosure', () => {
        categories.forEach((cat) => {
            const add = getCategoryAdditionalFeatures(cat);
            assert.ok(add.length > 5, `Category ${cat} should have rich additional features`);
            assert.ok(add.every((f) => f.id && f.label && f.group), 'Each feature must have id, label and group');
        });

        // PG food details
        const pgAdd = getCategoryAdditionalFeatures('pg');
        assert.ok(pgAdd.some((f) => f.id === 'breakfast'));
        assert.ok(pgAdd.some((f) => f.id === 'dinner'));
        assert.ok(pgAdd.some((f) => f.id === 'electricity_included'));

        // Roommate facilities
        const rrAdd = getCategoryAdditionalFeatures('roommate_replacement');
        assert.ok(rrAdd.some((f) => f.id === 'washing_machine'));
        assert.ok(rrAdd.some((f) => f.id === 'cook'));
        assert.ok(rrAdd.some((f) => f.id === 'veg_household'));
    });

    it('3. provides category-aware occupancy options', () => {
        const bedOcc = getCategoryOccupancyOptions('bed');
        assert.ok(bedOcc.some((o) => o.value === 'single'));

        const sharedOcc = getCategoryOccupancyOptions('shared_room');
        assert.ok(sharedOcc.some((o) => o.value === 'double'));
        assert.ok(sharedOcc.some((o) => o.value === 'triple'));

        const pgOcc = getCategoryOccupancyOptions('pg');
        assert.ok(pgOcc.length >= 4);

        const privOcc = getCategoryOccupancyOptions('private_room');
        assert.equal(privOcc[0].value, 'single');
    });

    it('4. builds and validates valid single-page composer payloads across all 6 categories', () => {
        categories.forEach((catId) => {
            const subtype = catId.replace(/^stay_/, '');
            const form = {
                listedByRole: 'owner',
                transactionType: 'rent',
                category: 'residential',
                subtype,
                listingTypeId: catId,
                taxonomyId: catId,
                city: 'Chennai',
                localityName: 'Thiruvanmiyur',
                localityId: 'chennai__thiruvanmiyur',
                addressLine1: 'South Mada Street, Thiruvanmiyur',
                exactLatitude: 12.983,
                exactLongitude: 80.259,
                locationPrecision: 'approximate_on_request',
                title: `Comfortable ${SUBTYPE_LABELS[subtype]} in Thiruvanmiyur`,
                listingDescription: 'Near bus stand and beach. Very calm neighborhood.',
                rentMonthlyText: '14500',
                depositText: '30000',
                occupancy: subtype === 'shared_room' ? 'double' : 'single',
                availableFrom: 'immediate',
                attachedBathroom: true,
                foodIncluded: subtype === 'pg',
                genderPreference: 'any',
                amenities: ['ac', 'wifi', 'parking'],
                photos: [{ localId: 'p1', uri: 'file:///photo1.jpg' }],
            };

            // Property creation input
            const propInput = buildPropertyCreateInput(form);
            assert.equal(propInput.subtype, subtype);
            assert.equal(propInput.city, 'Chennai');
            assert.equal(propInput.latitude, 12.983);
            assert.equal(propInput.longitude, 80.259);
            assert.deepEqual(validatePostProperty(form), []);

            // Listing creation input
            const listInput = buildListingCreateInput(form);
            assert.equal(listInput.transactionType, 'rent');
            assert.equal(listInput.rentMonthly, 14500);
            assert.equal(listInput.deposit, 30000);
            assert.equal(listInput.status, 'DRAFT');
            assert.deepEqual(validatePostListing(form, { forPublish: true }), []);

            // Publication readiness
            assert.equal(canSaveDraft(form), true);
            assert.equal(canRequestPublish(form), true);
        });
    });

    it('5. detects missing rent or missing location as invalid for publication', () => {
        const invalidForm = {
            listedByRole: 'owner',
            transactionType: 'rent',
            category: 'residential',
            subtype: 'private_room',
            listingTypeId: 'stay_private_room',
            city: '',
            localityName: '',
            rentMonthlyText: '', // missing
            depositText: '',
            title: 'Test',
        };

        const issues = validatePostListing(invalidForm, { forPublish: true });
        assert.ok(issues.some((i) => i.field === 'rentMonthly'));
        assert.equal(canRequestPublish(invalidForm), false);
    });
});
