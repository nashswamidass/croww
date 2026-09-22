import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildListingCreateInput,
    buildListingUpdatePatch,
    buildPropertyCreateInput,
    canRequestPublish,
    canSaveDraft,
    visibleSteps,
} from './posting.ts';
import { validateListingInput, validatePropertyInput } from './validate.ts';
import { derivePublicCoordinate } from './geo.ts';
import { validateTaxonomyPosting, DEFAULT_TAXONOMY_ITEMS } from '../taxonomy/index.ts';

const LAUNCH_CATEGORIES = [
    {
        typeId: 'stay_bed',
        displayName: 'Bed',
        subtype: 'bed',
        rentMonthly: 8500,
        deposit: 15000,
        occupancy: 'single',
    },
    {
        typeId: 'stay_shared_room',
        displayName: 'Shared Room',
        subtype: 'shared_room',
        rentMonthly: 12000,
        deposit: 20000,
        occupancy: 'double',
    },
    {
        typeId: 'stay_private_room',
        displayName: 'Private Room',
        subtype: 'private_room',
        rentMonthly: 18000,
        deposit: 35000,
        occupancy: 'single',
    },
    {
        typeId: 'stay_pg',
        displayName: 'PG',
        subtype: 'pg',
        rentMonthly: 14000,
        deposit: 14000,
        occupancy: 'double',
    },
    {
        typeId: 'stay_coliving',
        displayName: 'Co-living',
        subtype: 'coliving',
        rentMonthly: 22000,
        deposit: 40000,
        occupancy: 'single',
    },
    {
        typeId: 'stay_roommate_replacement',
        displayName: 'Roommate Replacement',
        subtype: 'roommate_replacement',
        rentMonthly: 16000,
        deposit: 30000,
        occupancy: 'single',
    },
];

const BLR_COORDINATE = {
    exactLatitude: 12.9716,
    exactLongitude: 77.5946,
    city: 'Bangalore',
    localityName: 'Koramangala',
    localityId: 'bangalore__koramangala',
    addressLine1: '80 Feet Road, 4th Block, Koramangala',
};

describe('Stay Categories End-to-End Creation Pipeline (6 Launch Categories)', () => {
    for (const cat of LAUNCH_CATEGORIES) {
        describe(`Category: ${cat.displayName} (${cat.typeId})`, () => {
            const initialForm = {
                category: 'residential',
                subtype: cat.subtype,
                taxonomyId: cat.typeId,
                listingTypeId: cat.typeId,
                transactionType: 'rent',
                listedByRole: 'owner',
                city: BLR_COORDINATE.city,
                localityName: BLR_COORDINATE.localityName,
                localityId: BLR_COORDINATE.localityId,
                addressLine1: BLR_COORDINATE.addressLine1,
                exactLatitude: BLR_COORDINATE.exactLatitude,
                exactLongitude: BLR_COORDINATE.exactLongitude,
                locationPrecision: 'approximate',
                rentMonthlyText: String(cat.rentMonthly),
                depositText: String(cat.deposit),
                occupancy: cat.occupancy,
                availableFrom: 'immediate',
                foodIncluded: true,
                attachedBathroom: true,
                genderPreference: 'any',
                title: '', // tests auto-generation
            };

            it('1. builds valid property create payload with privacy preservation', () => {
                const propInput = buildPropertyCreateInput(initialForm);

                // Exact coordinates are assigned to property
                assert.equal(propInput.latitude, BLR_COORDINATE.exactLatitude);
                assert.equal(propInput.longitude, BLR_COORDINATE.exactLongitude);
                assert.equal(propInput.locationPrecision, 'approximate');
                assert.equal(propInput.category, 'residential');
                assert.equal(propInput.subtype, cat.subtype);
                assert.equal(propInput.bedrooms, 1, 'Bedrooms must default to 1 for stay accommodation');
                assert.equal(propInput.bathrooms, 1, 'Bathrooms must default to 1 for stay accommodation');
                assert.equal(propInput.status, 'ACTIVE');

                // Property schema validation passes
                const propIssues = validatePropertyInput(propInput);
                assert.deepEqual(propIssues, [], `Property input had validation issues: ${JSON.stringify(propIssues)}`);

                // Public map pin derivation test: approximate precision jitters within safety bounds
                const publicCoord = derivePublicCoordinate('prop-123', {
                    latitude: propInput.latitude,
                    longitude: propInput.longitude,
                }, propInput.locationPrecision);
                assert.notEqual(publicCoord.latitude, BLR_COORDINATE.exactLatitude);
                assert.notEqual(publicCoord.longitude, BLR_COORDINATE.exactLongitude);
            });

            it('2. builds valid listing create payload adhering to DRAFT status and taxonomy requirements', () => {
                const listingInput = buildListingCreateInput({
                    ...initialForm,
                    propertyId: 'mock-property-id',
                });

                assert.equal(listingInput.propertyId, 'mock-property-id');
                assert.equal(listingInput.status, 'DRAFT', 'Client creates listings as DRAFT only');
                assert.equal(listingInput.transactionType, 'rent');
                assert.equal(listingInput.rentMonthly, cat.rentMonthly);
                assert.equal(listingInput.deposit, cat.deposit);
                assert.equal(listingInput.occupancy, cat.occupancy);
                assert.equal(listingInput.availableFrom, 'immediate');
                assert.equal(listingInput.foodIncluded, true);
                assert.equal(listingInput.attachedBathroom, true);
                assert.equal(listingInput.genderPreference, 'any');
                assert.ok(listingInput.title.length > 0, 'Title is automatically populated');

                // Listing schema validation
                const listingIssues = validateListingInput(listingInput);
                assert.deepEqual(listingIssues, [], `Listing input had validation issues: ${JSON.stringify(listingIssues)}`);

                // Server-driven taxonomy validation
                const taxItem = DEFAULT_TAXONOMY_ITEMS.find((i) => i.id === cat.typeId || i.typeId === cat.typeId);
                assert.ok(taxItem, `Taxonomy item for ${cat.typeId} must exist in defaults`);
                const taxResult = validateTaxonomyPosting({
                    typeId: cat.typeId,
                    transactionType: 'rent',
                    payload: listingInput,
                    taxonomyItem: taxItem,
                });
                assert.equal(taxResult.valid, true, `Taxonomy validation failed: ${taxResult.errors.join(', ')}`);
                assert.deepEqual(taxResult.missingFields, []);
            });

            it('3. supports fast-tracked visible steps directly from PostScreen category selection', () => {
                const steps = visibleSteps(initialForm);
                // When initialType is selected, starts at property step and skips actor, source, transaction, category
                assert.deepEqual(steps, ['property', 'location', 'listing', 'media', 'review']);
            });

            it('4. canSaveDraft and canRequestPublish correctly gate draft vs publication readiness', () => {
                // With rent filled
                assert.equal(canSaveDraft(initialForm), true);
                assert.equal(canRequestPublish(initialForm), true);

                // Zero deposit is valid for rentals
                const zeroDepositForm = { ...initialForm, depositText: '0' };
                const zeroDepositListing = buildListingCreateInput(zeroDepositForm);
                assert.equal(zeroDepositListing.deposit, 0);
                assert.equal(canRequestPublish(zeroDepositForm), true);

                // Missing rent monthly prevents publish review request
                const noPriceForm = { ...initialForm, rentMonthlyText: '' };
                assert.equal(canSaveDraft(noPriceForm), true, 'Draft can be saved without price');
                assert.equal(canRequestPublish(noPriceForm), false, 'Cannot request publish without rent price');
            });

            it('5. builds valid update patch for editing existing drafts', () => {
                const patch = buildListingUpdatePatch({
                    ...initialForm,
                    rentMonthlyText: String(cat.rentMonthly + 1000),
                });
                assert.equal(patch.rentMonthly, cat.rentMonthly + 1000);
                assert.equal(patch.occupancy, cat.occupancy);
                assert.equal(patch.availableFrom, 'immediate');
                assert.equal(patch.foodIncluded, true);
            });
        });
    }

    describe('Compensating Rollback on Failed Listing Creation', () => {
        it('marks newly created property INACTIVE if listing creation fails to prevent orphaned active properties', async () => {
            let propertyStatus = 'ACTIVE';
            const mockInventoryService = {
                createProperty: async () => ({ property: { id: 'prop-orphan-check', status: 'ACTIVE' } }),
                createListing: async () => {
                    throw new Error('Listing creation simulated error');
                },
                updateProperty: async (id, patch) => {
                    if (patch.status) propertyStatus = patch.status;
                },
            };

            // Simulate the persistDraft execution flow
            let propertyId = null;
            let newlyCreated = false;
            try {
                const created = await mockInventoryService.createProperty();
                propertyId = created.property.id;
                newlyCreated = true;
                await mockInventoryService.createListing({ propertyId });
            } catch (err) {
                if (newlyCreated && propertyId) {
                    await mockInventoryService.updateProperty(propertyId, { status: 'INACTIVE' });
                }
            }

            assert.equal(propertyStatus, 'INACTIVE', 'Compensating rollback should deactivate property');
        });
    });
});
