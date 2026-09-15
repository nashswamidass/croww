import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    bhkValueFromChoice,
    buildListingCreateInput,
    buildPropertyCreateInput,
    canRequestPublish,
    canSaveDraft,
    inventoryErrorMessage,
    listerStatusCopy,
    parseInrAmount,
    postingActorChoices,
    propertyFieldVisibility,
    slugLocalityId,
    stripHiddenPropertyFields,
    subtypeOptions,
    validatePostListing,
    validatePostProperty,
    visibleSteps,
} from './posting.ts';

const baseLocation = {
    listedByRole: 'owner',
    transactionType: 'buy',
    category: 'residential',
    subtype: 'apartment',
    city: 'Chennai',
    localityName: 'Adyar',
    localityId: 'chennai__adyar',
    addressLine1: '12 Beach Road',
    exactLatitude: 13.0067,
    exactLongitude: 80.2206,
    locationPrecision: 'approximate',
    title: '3 BHK in Adyar',
    askingPriceText: '1.35 Cr',
    bedrooms: 3,
};

describe('posting actors', () => {
    it('always allows owner and does not infer agent from provider', () => {
        const choices = postingActorChoices([]);
        assert.equal(choices.find((c) => c.role === 'owner').allowed, true);
        assert.equal(choices.find((c) => c.role === 'agent').allowed, false);
        assert.match(choices.find((c) => c.role === 'agent').lockedHint, /agent role/);
    });

    it('allows agent and builder only when roles are present', () => {
        const choices = postingActorChoices(['agent', 'builder']);
        assert.equal(choices.find((c) => c.role === 'agent').allowed, true);
        assert.equal(choices.find((c) => c.role === 'builder').allowed, true);
    });
});

describe('dynamic fields', () => {
    it('hides BHK and bathrooms for land', () => {
        const vis = propertyFieldVisibility('land', 'residential_plot');
        assert.equal(vis.bedrooms, false);
        assert.equal(vis.bathrooms, false);
        assert.equal(vis.plotArea, true);
        const stripped = stripHiddenPropertyFields({
            category: 'land',
            subtype: 'residential_plot',
            bedrooms: 3,
            plotAreaSqft: 2400,
        });
        assert.equal(stripped.bedrooms, null);
        assert.equal(stripped.plotAreaSqft, 2400);
    });

    it('shows BHK for apartments and plot area for residential plots', () => {
        assert.equal(propertyFieldVisibility('residential', 'apartment').bedrooms, true);
        assert.equal(propertyFieldVisibility('residential', 'plot').bedrooms, false);
        assert.equal(propertyFieldVisibility('residential', 'plot').plotArea, true);
        assert.ok(subtypeOptions('commercial').some((o) => o.value === 'office'));
    });
});

describe('pricing', () => {
    it('parses Indian amount styles into canonical numbers', () => {
        assert.equal(parseInrAmount('1.35 Cr'), 13500000);
        assert.equal(parseInrAmount('85 L'), 8500000);
        assert.equal(parseInrAmount('₹42,000'), 42000);
        assert.equal(parseInrAmount('1.5 lakh'), 150000);
        const buy = buildListingCreateInput({ ...baseLocation, propertyId: 'p1' });
        assert.equal(buy.askingPrice, 13500000);
        assert.equal(buy.status, 'DRAFT');
        const rent = buildListingCreateInput({
            ...baseLocation,
            propertyId: 'p1',
            transactionType: 'rent',
            rentMonthlyText: '42000',
            depositText: '150000',
        });
        assert.equal(rent.rentMonthly, 42000);
        assert.equal(rent.askingPrice, null);
    });

    it('allows draft without price and requires price to publish', () => {
        const draft = { ...baseLocation, askingPriceText: '' };
        assert.equal(canSaveDraft(draft), true);
        assert.equal(canRequestPublish(draft), false);
        assert.ok(validatePostListing(draft, { forPublish: true }).some((i) => i.field === 'askingPrice'));
        assert.equal(canRequestPublish({ ...draft, askingPriceText: '9000000' }), true);
        const rentDraft = { ...baseLocation, transactionType: 'rent', rentMonthlyText: '' };
        assert.ok(validatePostListing(rentDraft, { forPublish: true }).some((i) => i.field === 'rentMonthly'));
    });
});

describe('location and privacy', () => {
    it('sends exact session coords on create and never sets status published', () => {
        const input = buildPropertyCreateInput(baseLocation);
        assert.equal(input.latitude, 13.0067);
        assert.equal(input.longitude, 80.2206);
        assert.equal(input.locationPrecision, 'approximate');
        assert.equal(input.sourceChannel, 'USER_CREATED');
        assert.equal(buildListingCreateInput({ ...baseLocation, propertyId: 'p1' }).status, 'DRAFT');
        assert.equal(slugLocalityId('Chennai', 'Adyar'), 'chennai__adyar');
        const issues = validatePostProperty({ ...baseLocation, exactLatitude: null });
        assert.ok(issues.some((i) => i.field === 'latitude'));
    });
});

describe('duplicates and errors', () => {
    it('maps duplicate and protected-field codes to UI copy', () => {
        assert.match(inventoryErrorMessage('POTENTIAL_DUPLICATE'), /similar property/i);
        assert.match(inventoryErrorMessage('PROTECTED_FIELD'), /after review/i);
        assert.match(inventoryErrorMessage('PUBLICATION_FORBIDDEN'), /cannot publish/i);
    });
});

describe('drafts and steps', () => {
    it('skips property/location steps when using an existing property', () => {
        const steps = visibleSteps({ existingPropertyId: 'prop-1' });
        assert.deepEqual(steps, ['actor', 'source', 'transaction', 'listing', 'media', 'review']);
        assert.equal(bhkValueFromChoice('5+'), 5);
        assert.equal(listerStatusCopy({ status: 'DRAFT' }), 'Draft');
        assert.equal(listerStatusCopy({ status: 'DRAFT', reviewRequestedAt: true }), 'Submitted for review');
        assert.equal(listerStatusCopy({ status: 'PUBLISHED' }), 'Live');
    });
});
