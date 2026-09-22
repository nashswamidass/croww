/**
 * Post-flow helpers. UI uses these; inventoryService / validate.ts stay authoritative.
 * Does not write Firestore. Does not grant roles.
 */

import {
    COMMERCIAL_SUBTYPES,
    LAND_SUBTYPES,
    RESIDENTIAL_SUBTYPES,
} from './constants.ts';
import { validateListingInput, validatePropertyInput } from './validate.ts';
import type { InventoryErrorCode } from './errors.ts';

export const POST_STEPS = [
    'actor',
    'source',
    'transaction',
    'category',
    'property',
    'location',
    'listing',
    'media',
    'review',
] as const;

export type PostStep = (typeof POST_STEPS)[number];

export const MAX_POST_PHOTOS = 12;

export const SUBTYPE_LABELS: Record<string, string> = {
    apartment: 'Apartment',
    independent_house: 'House',
    villa: 'Villa',
    plot: 'Plot',
    office: 'Office',
    shop: 'Shop / Retail',
    warehouse: 'Warehouse',
    industrial: 'Industrial',
    commercial_land: 'Commercial land',
    residential_plot: 'Residential plot',
    agricultural: 'Agricultural land',
    commercial_plot: 'Commercial plot',
    other: 'Other land',
    bed: 'Bed / Single Bed',
    shared_room: 'Shared Room',
    private_room: 'Private Room',
    pg: 'PG / Paying Guest',
    coliving: 'Co-living Space',
    roommate_replacement: 'Roommate Replacement',
};

export const CATEGORY_LABELS: Record<string, string> = {
    residential: 'Residential',
    commercial: 'Commercial',
    land: 'Land',
};

export const PRECISION_COPY = {
    approximate_on_request: {
        label: 'Approximate + share on request',
        hint: 'Keep the exact location private unless I approve a viewer’s request.',
    },
    approximate: {
        label: 'Approximate',
        hint: 'Show an approximate location publicly.',
    },
    exact: {
        label: 'Exact',
        hint: 'Show the exact location publicly.',
    },
    locality: {
        label: 'Locality',
        hint: 'Show the area, not the property’s exact position.',
    },
} as const;

export const LOCATION_VISIBILITY_COPY = {
    approximate_on_request: PRECISION_COPY.approximate_on_request,
    approximate: PRECISION_COPY.approximate,
    exact: PRECISION_COPY.exact,
} as const;

export const RESIDENTIAL_AMENITIES = [
    'lift',
    'power backup',
    'security',
    'swimming pool',
    'gym',
    'parking',
    'balcony',
    'gated community',
] as const;

export const COMMERCIAL_AMENITIES = [
    'parking',
    'lift',
    'power backup',
    'security',
    'reception',
    'conference room',
] as const;

export type PostingActorChoice = {
    role: 'owner' | 'agent' | 'builder';
    allowed: boolean;
    title: string;
    body: string;
    lockedHint: string | null;
};

export function postingActorChoices(roles: string[] | null | undefined): PostingActorChoice[] {
    const list = Array.isArray(roles) ? roles : [];
    const hasAgent = list.includes('agent');
    const hasBuilder = list.includes('builder');
    return [
        {
            role: 'owner',
            allowed: true,
            title: 'I’m listing my property',
            body: 'List a home or land you own. Croww will not mark ownership as verified.',
            lockedHint: null,
        },
        {
            role: 'agent',
            allowed: hasAgent,
            title: 'I’m listing on behalf of a client',
            body: 'Add a property you are representing. Representation stays unverified.',
            lockedHint: hasAgent
                ? null
                : 'You can list your own property. Broker inventory requires an agent role.',
        },
        {
            role: 'builder',
            allowed: hasBuilder,
            title: 'I’m listing builder / developer inventory',
            body: 'Add inventory you are bringing to market as a builder.',
            lockedHint: hasBuilder
                ? null
                : 'Builder inventory requires a builder role. You can still list your own property.',
        },
    ];
}

export function postingHubCopy(roles: string[] | null | undefined): { title: string; subtitle: string } {
    const list = Array.isArray(roles) ? roles : [];
    if (list.includes('builder') && list.includes('agent')) {
        return { title: 'Post', subtitle: 'Add inventory you own, represent, or are developing.' };
    }
    if (list.includes('builder')) {
        return { title: 'Add your inventory', subtitle: 'Save a draft, then request review before it goes live.' };
    }
    if (list.includes('agent')) {
        return { title: 'Add a property you’re representing', subtitle: 'Save a draft, then request review before it goes live.' };
    }
    return { title: 'List your property', subtitle: 'Anyone signed in can list their own property. Broker listings need an agent role.' };
}

export function subtypeOptions(category: string | null | undefined): { value: string; label: string }[] {
    const values = category === 'commercial'
        ? COMMERCIAL_SUBTYPES
        : category === 'land'
            ? LAND_SUBTYPES
            : RESIDENTIAL_SUBTYPES;
    return values.map((value) => ({ value, label: SUBTYPE_LABELS[value] || value }));
}

export type PropertyFieldVisibility = {
    bedrooms: boolean;
    bathrooms: boolean;
    carpetArea: boolean;
    builtUpArea: boolean;
    plotArea: boolean;
    floor: boolean;
    totalFloors: boolean;
    furnishing: boolean;
    parking: boolean;
    constructionYear: boolean;
    projectName: boolean;
    amenities: boolean;
};

export function propertyFieldVisibility(
    category: string | null | undefined,
    subtype: string | null | undefined
): PropertyFieldVisibility {
    const isStay = subtype === 'bed' || subtype === 'shared_room' || subtype === 'private_room' || subtype === 'pg' || subtype === 'coliving' || subtype === 'roommate_replacement';
    const isLand = category === 'land' || subtype === 'plot' || subtype === 'commercial_land'
        || subtype === 'residential_plot' || subtype === 'agricultural' || subtype === 'commercial_plot'
        || subtype === 'other';
    const isResidentialUnit = category === 'residential' && subtype !== 'plot' && !isStay;
    const isCommercialUnit = category === 'commercial' && subtype !== 'commercial_land';
    return {
        bedrooms: isResidentialUnit || subtype === 'roommate_replacement',
        bathrooms: isResidentialUnit || isStay,
        carpetArea: isResidentialUnit || subtype === 'office' || subtype === 'shop',
        builtUpArea: isResidentialUnit || isCommercialUnit,
        plotArea: isLand,
        floor: isResidentialUnit || isCommercialUnit || isStay,
        totalFloors: isResidentialUnit || isCommercialUnit || isStay,
        furnishing: isResidentialUnit || subtype === 'office' || subtype === 'shop' || isStay,
        parking: (!isLand || subtype === 'commercial_land') && subtype !== 'bed',
        constructionYear: isResidentialUnit,
        projectName: category !== 'land',
        amenities: category !== 'land' || subtype === 'commercial_land' || isStay,
    };
}

export function amenityOptions(category: string | null | undefined): readonly string[] {
    if (category === 'commercial') return COMMERCIAL_AMENITIES;
    return RESIDENTIAL_AMENITIES;
}

export function parseInrAmount(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') {
        return Number.isFinite(raw) && raw >= 0 ? raw : null;
    }
    const text = String(raw).trim().toLowerCase().replace(/₹/g, '').replace(/,/g, '').replace(/\s+/g, ' ');
    if (!text) return null;
    const match = text.match(/^([0-9]*\.?[0-9]+)\s*(cr|crore|l|lac|lakh|k|thousand)?s?$/);
    if (!match) {
        const fallback = Number(text);
        return Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
    }
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) return null;
    const unit = match[2];
    if (unit === 'cr' || unit === 'crore') return amount * 10000000;
    if (unit === 'l' || unit === 'lac' || unit === 'lakh') return amount * 100000;
    if (unit === 'k' || unit === 'thousand') return amount * 1000;
    return amount;
}

export function slugLocalityId(city: string, localityName: string): string {
    const slug = (value: string) => value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    const cityPart = slug(city) || 'city';
    const namePart = slug(localityName) || 'locality';
    return `${cityPart}__${namePart}`;
}

export function bhkValueFromChoice(choice: string | number | null | undefined): number | null {
    if (choice == null || choice === '') return null;
    if (choice === '5+' || choice === 5) return 5;
    const n = Number(choice);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export function visibleSteps(form: {
    existingPropertyId?: string | null;
    category?: string | null;
    subtype?: string | null;
    listingTypeId?: string | null;
}): PostStep[] {
    if (form.existingPropertyId) {
        return ['actor', 'source', 'transaction', 'listing', 'media', 'review'];
    }
    const isStay = form.subtype === 'bed' || form.subtype === 'shared_room'
        || form.subtype === 'private_room' || form.subtype === 'pg'
        || form.subtype === 'coliving' || form.subtype === 'roommate_replacement';
    if (isStay && form.listingTypeId) {
        return ['property', 'location', 'listing', 'media', 'review'];
    }
    return [...POST_STEPS];
}

export function inventoryErrorMessage(
    code: InventoryErrorCode | string | null | undefined,
    fallback?: string
): string {
    switch (code) {
        case 'TAXONOMY_POSTING_DISABLED':
            return fallback || 'This listing type is missing required details or is not available for posting.';
        case 'POTENTIAL_DUPLICATE':
            return 'A similar property may already exist on Croww. Review and continue only if this is a different property.';
        case 'UNAUTHENTICATED':
            return 'Sign in to list a property.';
        case 'UNAUTHORIZED_ACTOR':
        case 'ACTOR_NOT_PERMITTED':
        case 'OWNERSHIP_CONFLICT':
            return 'You don’t have permission to list this property.';
        case 'INVALID_LOCATION':
            return 'Please select a valid property location on the map or from search.';
        case 'PROTECTED_FIELD':
            return 'Some listing information can only be changed after review.';
        case 'PUBLICATION_FORBIDDEN':
            return 'Listings stay in draft until Croww reviews them. You cannot publish instantly.';
        case 'INVALID_PROPERTY':
            return fallback || 'Please check the property details and try again.';
        case 'INVALID_LISTING':
            return fallback || 'Please check the listing details and try again.';
        case 'MEDIA_NOT_PERMITTED':
            return 'That file can’t be added to the public photo gallery.';
        case 'INVALID_STATUS_TRANSITION':
            return 'This listing can’t be submitted in its current state.';
        default:
            return fallback || 'Something went wrong. Please try again.';
    }
}

export function listerStatusCopy(listing: {
    status?: string | null;
    reviewRequestedAt?: unknown;
} | null): string {
    if (!listing) return 'Draft';
    if (listing.status === 'PUBLISHED') return 'Live';
    if (listing.status === 'PAUSED') return 'Paused';
    if (listing.status === 'SOLD') return 'Sold';
    if (listing.status === 'RENTED') return 'Rented';
    if (listing.status === 'EXPIRED') return 'Expired';
    if (listing.status === 'ARCHIVED') return 'Archived';
    if (listing.status === 'DRAFT' && listing.reviewRequestedAt) return 'Submitted for review';
    return 'Draft';
}

export type PostFormLike = {
    listedByRole?: string | null;
    existingPropertyId?: string | null;
    propertyId?: string | null;
    listingId?: string | null;
    transactionType?: string | null;
    category?: string | null;
    subtype?: string | null;
    listingTypeId?: string | null;
    taxonomyId?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    carpetAreaSqft?: number | null;
    builtUpAreaSqft?: number | null;
    plotAreaSqft?: number | null;
    floor?: number | null;
    totalFloors?: number | null;
    furnishing?: string | null;
    parking?: number | null;
    constructionYear?: number | null;
    amenities?: string[] | null;
    propertyDescription?: string | null;
    projectName?: string | null;
    city?: string | null;
    state?: string | null;
    localityId?: string | null;
    localityName?: string | null;
    localityCoordinate?: { latitude: number; longitude: number } | null;
    addressLine1?: string | null;
    pincode?: string | null;
    exactLatitude?: number | null;
    exactLongitude?: number | null;
    locationPrecision?: string | null;
    title?: string | null;
    listingDescription?: string | null;
    askingPriceText?: string | null;
    rentMonthlyText?: string | null;
    depositText?: string | null;
    maintenanceText?: string | null;
    negotiable?: boolean;
    availableFrom?: string | null;
    occupancy?: string | null;
    foodIncluded?: boolean | null;
    attachedBathroom?: boolean | null;
    genderPreference?: string | null;
};

function numericOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

export function stripHiddenPropertyFields(form: PostFormLike): PostFormLike {
    const vis = propertyFieldVisibility(form.category, form.subtype);
    return {
        ...form,
        bedrooms: vis.bedrooms ? form.bedrooms : null,
        bathrooms: vis.bathrooms ? form.bathrooms : null,
        carpetAreaSqft: vis.carpetArea ? form.carpetAreaSqft : null,
        builtUpAreaSqft: vis.builtUpArea ? form.builtUpAreaSqft : null,
        plotAreaSqft: vis.plotArea ? form.plotAreaSqft : null,
        floor: vis.floor ? form.floor : null,
        totalFloors: vis.totalFloors ? form.totalFloors : null,
        furnishing: vis.furnishing ? (form.furnishing || 'unknown') : 'unknown',
        parking: vis.parking ? form.parking : null,
        constructionYear: vis.constructionYear ? form.constructionYear : null,
        projectName: vis.projectName ? form.projectName : null,
        amenities: vis.amenities ? form.amenities : [],
    };
}

export function buildPropertyCreateInput(form: PostFormLike): Record<string, unknown> {
    const cleaned = stripHiddenPropertyFields(form);
    const city = (cleaned.city || '').trim();
    const localityName = (cleaned.localityName || '').trim();
    const localityId = (cleaned.localityId || '').trim()
        || (city && localityName ? slugLocalityId(city, localityName) : '');
    const isStay = cleaned.subtype === 'bed' || cleaned.subtype === 'shared_room'
        || cleaned.subtype === 'private_room' || cleaned.subtype === 'pg'
        || cleaned.subtype === 'coliving' || cleaned.subtype === 'roommate_replacement';
    const bedrooms = isStay ? (cleaned.bedrooms || 1) : (cleaned.bedrooms ?? null);
    const bathrooms = isStay ? (cleaned.bathrooms ?? 1) : (cleaned.bathrooms ?? null);
    const line1 = (cleaned.addressLine1 || '').trim()
        || (city && localityName ? `${localityName}, ${city}` : (city ? `Main Road, ${city}` : 'Property address on request'));
    return {
        category: cleaned.category || 'residential',
        subtype: cleaned.subtype || 'private_room',
        status: 'ACTIVE',
        localityId,
        localityCoordinate: cleaned.localityCoordinate || null,
        address: {
            line1,
            city,
            state: (cleaned.state || '').trim(),
            pincode: (cleaned.pincode || '').trim() || null,
            country: 'IN',
        },
        city,
        state: (cleaned.state || '').trim(),
        country: 'IN',
        latitude: cleaned.exactLatitude,
        longitude: cleaned.exactLongitude,
        locationPrecision: cleaned.locationPrecision || 'approximate',
        bedrooms,
        bathrooms,
        carpetAreaSqft: cleaned.carpetAreaSqft ?? null,
        builtUpAreaSqft: cleaned.builtUpAreaSqft ?? null,
        plotAreaSqft: cleaned.plotAreaSqft ?? null,
        floor: cleaned.floor ?? null,
        totalFloors: cleaned.totalFloors ?? null,
        furnishing: cleaned.furnishing || 'unknown',
        parking: cleaned.parking ?? null,
        constructionYear: cleaned.constructionYear ?? null,
        amenities: Array.isArray(cleaned.amenities) ? cleaned.amenities : [],
        description: (cleaned.propertyDescription || '').trim() || null,
        projectName: (cleaned.projectName || '').trim() || null,
        sourceType: cleaned.listedByRole || 'owner',
        sourceChannel: 'USER_CREATED',
    };
}

export function buildListingCreateInput(form: PostFormLike): Record<string, unknown> {
    const transactionType = form.transactionType || 'rent';
    const depositAmount = parseInrAmount(form.depositText);
    const title = (form.title || '').trim()
        || (form.subtype ? `${SUBTYPE_LABELS[form.subtype] || form.subtype} in ${form.localityName || form.city || 'Bangalore'}` : 'New Listing');
    return {
        propertyId: form.propertyId || form.existingPropertyId,
        taxonomyId: form.listingTypeId || form.taxonomyId || null,
        listingTypeId: form.listingTypeId || form.taxonomyId || null,
        transactionType,
        listedByRole: form.listedByRole || 'owner',
        title,
        description: (form.listingDescription || '').trim() || null,
        askingPrice: transactionType === 'buy' ? parseInrAmount(form.askingPriceText) : null,
        rentMonthly: transactionType === 'rent' ? parseInrAmount(form.rentMonthlyText) : null,
        deposit: transactionType === 'rent' ? (depositAmount != null ? depositAmount : 0) : null,
        maintenanceMonthly: transactionType === 'rent' ? parseInrAmount(form.maintenanceText) : null,
        negotiable: form.negotiable !== false,
        availableFrom: form.availableFrom || 'immediate',
        occupancy: form.occupancy || 'single',
        foodIncluded: Boolean(form.foodIncluded),
        attachedBathroom: Boolean(form.attachedBathroom),
        genderPreference: form.genderPreference || 'any',
        status: 'DRAFT',
        sourceChannel: 'USER_CREATED',
    };
}

export function buildListingUpdatePatch(form: PostFormLike): Record<string, unknown> {
    const transactionType = form.transactionType || 'rent';
    const depositAmount = parseInrAmount(form.depositText);
    const title = (form.title || '').trim()
        || (form.subtype ? `${SUBTYPE_LABELS[form.subtype] || form.subtype} in ${form.localityName || form.city || 'Bangalore'}` : 'New Listing');
    return {
        title,
        description: (form.listingDescription || '').trim() || null,
        askingPrice: transactionType === 'buy' ? parseInrAmount(form.askingPriceText) : null,
        rentMonthly: transactionType === 'rent' ? parseInrAmount(form.rentMonthlyText) : null,
        deposit: transactionType === 'rent' ? (depositAmount != null ? depositAmount : 0) : null,
        maintenanceMonthly: transactionType === 'rent' ? parseInrAmount(form.maintenanceText) : null,
        negotiable: form.negotiable !== false,
        availableFrom: form.availableFrom || 'immediate',
        occupancy: form.occupancy || 'single',
        foodIncluded: Boolean(form.foodIncluded),
        attachedBathroom: Boolean(form.attachedBathroom),
        genderPreference: form.genderPreference || 'any',
    };
}

export function validatePostProperty(form: PostFormLike) {
    return validatePropertyInput(buildPropertyCreateInput(form));
}

export function validatePostListing(form: PostFormLike, { forPublish = false } = {}) {
    const input = buildListingCreateInput({
        ...form,
        propertyId: form.propertyId || form.existingPropertyId || 'pending',
    });
    if (forPublish) input.status = 'PUBLISHED';
    return validateListingInput(input);
}

export function canSaveDraft(form: PostFormLike): boolean {
    if (!form.listedByRole || !form.transactionType) return false;
    if (form.existingPropertyId || form.propertyId) return true;
    return validatePostProperty(form).length === 0;
}

export function canRequestPublish(form: PostFormLike): boolean {
    if (!canSaveDraft(form)) return false;
    return validatePostListing(form, { forPublish: true }).length === 0;
}

export function numericField(value: unknown): number | null {
    return numericOrNull(value);
}

export type FeatureChip = {
    id: string;
    label: string;
    icon?: string;
    group?: string;
};

export const CATEGORY_QUICK_FEATURES: Record<string, FeatureChip[]> = {
    bed: [
        { id: 'ac', label: 'AC' },
        { id: 'attached_bathroom', label: 'Attached bathroom' },
        { id: 'shared_bathroom', label: 'Shared bathroom' },
        { id: 'bed_included', label: 'Bed included' },
        { id: 'furnished', label: 'Furnished' },
        { id: 'wifi', label: 'Wi-Fi' },
        { id: 'food_included', label: 'Food included' },
        { id: 'laundry', label: 'Laundry' },
        { id: 'housekeeping', label: 'Housekeeping' },
        { id: 'parking', label: 'Parking' },
    ],
    shared_room: [
        { id: 'attached_bathroom', label: 'Attached bathroom' },
        { id: 'shared_bathroom', label: 'Shared bathroom' },
        { id: 'ac', label: 'AC' },
        { id: 'bed_included', label: 'Bed included' },
        { id: 'furnished', label: 'Furnished' },
        { id: 'wifi', label: 'Wi-Fi' },
        { id: 'food_included', label: 'Food' },
        { id: 'laundry', label: 'Laundry' },
        { id: 'parking', label: 'Parking' },
        { id: 'housekeeping', label: 'Housekeeping' },
    ],
    private_room: [
        { id: 'attached_bathroom', label: 'Attached bathroom' },
        { id: 'ac', label: 'AC' },
        { id: 'furnished', label: 'Furnished' },
        { id: 'bed_included', label: 'Bed included' },
        { id: 'wardrobe', label: 'Wardrobe' },
        { id: 'wifi', label: 'Wi-Fi' },
        { id: 'balcony', label: 'Balcony' },
        { id: 'study_table', label: 'Study table' },
        { id: 'parking', label: 'Parking' },
    ],
    pg: [
        { id: 'ac', label: 'AC' },
        { id: 'attached_bathroom', label: 'Attached bathroom' },
        { id: 'wifi', label: 'Wi-Fi' },
        { id: 'food_included', label: 'Food included' },
        { id: 'furnished', label: 'Furnished' },
        { id: 'laundry', label: 'Laundry' },
        { id: 'housekeeping', label: 'Housekeeping' },
        { id: 'parking', label: 'Parking' },
    ],
    coliving: [
        { id: 'furnished', label: 'Furnished' },
        { id: 'ac', label: 'AC' },
        { id: 'attached_bathroom', label: 'Attached bathroom' },
        { id: 'wifi', label: 'Wi-Fi' },
        { id: 'housekeeping', label: 'Housekeeping' },
        { id: 'laundry', label: 'Laundry' },
        { id: 'kitchen', label: 'Kitchen' },
        { id: 'workspace', label: 'Workspace' },
        { id: 'parking', label: 'Parking' },
        { id: 'food_included', label: 'Food' },
    ],
    roommate_replacement: [
        { id: 'attached_bathroom', label: 'Attached bathroom' },
        { id: 'balcony', label: 'Balcony' },
        { id: 'furnished', label: 'Furnished' },
        { id: 'bed_included', label: 'Bed' },
        { id: 'wardrobe', label: 'Wardrobe' },
        { id: 'ac', label: 'AC' },
        { id: 'wifi', label: 'Wi-Fi' },
        { id: 'parking', label: 'Parking' },
    ],
};

export const CATEGORY_ADDITIONAL_FEATURES: Record<string, FeatureChip[]> = {
    bed: [
        { id: 'fan', label: 'Fan', group: 'Comfort' },
        { id: 'mattress', label: 'Mattress', group: 'Comfort' },
        { id: 'wardrobe', label: 'Wardrobe', group: 'Room' },
        { id: 'study_table', label: 'Study table', group: 'Room' },
        { id: 'geyser', label: 'Geyser', group: 'Comfort' },
        { id: 'kitchen_access', label: 'Kitchen access', group: 'Facilities' },
        { id: 'fridge', label: 'Fridge', group: 'Facilities' },
        { id: 'washing_machine', label: 'Washing machine', group: 'Facilities' },
        { id: 'power_backup', label: 'Power backup', group: 'Building' },
        { id: 'cctv', label: 'CCTV', group: 'Security' },
        { id: 'security', label: 'Security guard', group: 'Security' },
        { id: 'curfew', label: 'No curfew', group: 'Rules' },
        { id: 'visitor_friendly', label: 'Visitors allowed', group: 'Rules' },
    ],
    shared_room: [
        { id: 'veg_only', label: 'Vegetarian household', group: 'Rules' },
        { id: 'kitchen_access', label: 'Kitchen access', group: 'Facilities' },
        { id: 'power_backup', label: 'Power backup', group: 'Building' },
        { id: 'geyser', label: 'Geyser', group: 'Comfort' },
        { id: 'wardrobe', label: 'Wardrobe', group: 'Room' },
        { id: 'study_table', label: 'Study table', group: 'Room' },
        { id: 'cctv', label: 'CCTV / Security', group: 'Security' },
        { id: 'no_curfew', label: 'No curfew', group: 'Rules' },
        { id: 'visitor_friendly', label: 'Visitors allowed', group: 'Rules' },
        { id: 'non_smoking', label: 'Non-smoking only', group: 'Rules' },
        { id: 'non_drinking', label: 'Non-drinking only', group: 'Rules' },
    ],
    private_room: [
        { id: 'fan', label: 'Fan', group: 'Comfort' },
        { id: 'geyser', label: 'Geyser', group: 'Comfort' },
        { id: 'washing_machine', label: 'Washing machine', group: 'Facilities' },
        { id: 'fridge', label: 'Refrigerator', group: 'Facilities' },
        { id: 'kitchen_access', label: 'Kitchen access', group: 'Facilities' },
        { id: 'power_backup', label: 'Power backup', group: 'Building' },
        { id: 'housekeeping', label: 'Housekeeping', group: 'Services' },
        { id: 'maid', label: 'Maid available', group: 'Services' },
        { id: 'cook', label: 'Cook available', group: 'Services' },
        { id: 'pets_allowed', label: 'Pets allowed', group: 'Rules' },
        { id: 'smoking_allowed', label: 'Smoking allowed', group: 'Rules' },
        { id: 'visitor_friendly', label: 'Visitors allowed', group: 'Rules' },
    ],
    pg: [
        { id: 'breakfast', label: 'Breakfast included', group: 'Food' },
        { id: 'lunch', label: 'Lunch included', group: 'Food' },
        { id: 'dinner', label: 'Dinner included', group: 'Food' },
        { id: 'veg_nonveg', label: 'Veg & Non-Veg', group: 'Food' },
        { id: 'electricity_included', label: 'Electricity included', group: 'Utilities' },
        { id: 'power_backup', label: 'Power backup', group: 'Utilities' },
        { id: 'cctv', label: 'CCTV', group: 'Security' },
        { id: 'security', label: 'Security guard', group: 'Security' },
        { id: 'drinking_water', label: 'RO drinking water', group: 'Facilities' },
        { id: 'geyser', label: 'Geyser', group: 'Comfort' },
        { id: 'study_area', label: 'Study area', group: 'Facilities' },
        { id: 'common_area', label: 'Common lounge', group: 'Facilities' },
        { id: 'gym', label: 'Gym', group: 'Fitness' },
        { id: 'workspace', label: 'Co-work zone', group: 'Facilities' },
        { id: 'no_curfew', label: 'No curfew', group: 'Rules' },
        { id: 'visitor_friendly', label: 'Visitors allowed', group: 'Rules' },
    ],
    coliving: [
        { id: 'gym', label: 'Gym / Fitness', group: 'Amenities' },
        { id: 'common_area', label: 'Community lounge', group: 'Community' },
        { id: 'power_backup', label: '100% Power backup', group: 'Utilities' },
        { id: 'cctv', label: 'CCTV & Biometric', group: 'Security' },
        { id: 'security', label: '24/7 Security', group: 'Security' },
        { id: 'utilities_included', label: 'Utilities included', group: 'Bills' },
        { id: 'electricity_included', label: 'Electricity included', group: 'Bills' },
        { id: 'flexible_stay', label: 'Flexible stay duration', group: 'Terms' },
        { id: 'short_term', label: 'Short-term available', group: 'Terms' },
        { id: 'pets_allowed', label: 'Pet friendly', group: 'Rules' },
        { id: 'visitor_friendly', label: 'Visitors welcome', group: 'Rules' },
    ],
    roommate_replacement: [
        { id: 'washing_machine', label: 'Washing machine', group: 'Appliances' },
        { id: 'fridge', label: 'Refrigerator', group: 'Appliances' },
        { id: 'kitchen', label: 'Equipped kitchen', group: 'Appliances' },
        { id: 'gas_stove', label: 'Gas / Stove setup', group: 'Appliances' },
        { id: 'maid', label: 'Daily maid / cleaner', group: 'Services' },
        { id: 'cook', label: 'Cook available', group: 'Services' },
        { id: 'power_backup', label: 'Power backup', group: 'Building' },
        { id: 'pets_allowed', label: 'Pets allowed', group: 'Household' },
        { id: 'visitor_friendly', label: 'Visitors allowed', group: 'Household' },
        { id: 'veg_household', label: 'Vegetarian household', group: 'Household' },
        { id: 'non_smoking', label: 'Non-smoking', group: 'Household' },
        { id: 'non_drinking', label: 'Non-drinking', group: 'Household' },
    ],
};

export const CATEGORY_OCCUPANCY_OPTIONS: Record<string, { value: string; label: string }[]> = {
    bed: [
        { value: 'single', label: 'Single Bed' },
        { value: 'double', label: '2 Sharing' },
    ],
    shared_room: [
        { value: 'double', label: '2 Sharing' },
        { value: 'triple', label: '3 Sharing' },
        { value: '4_plus', label: '4+ Sharing' },
    ],
    private_room: [
        { value: 'single', label: 'Private (Single)' },
    ],
    pg: [
        { value: 'single', label: 'Single' },
        { value: 'double', label: '2 Sharing' },
        { value: 'triple', label: '3 Sharing' },
        { value: '4_sharing', label: '4 Sharing' },
        { value: '5_plus', label: '5+ Sharing' },
    ],
    coliving: [
        { value: 'single', label: 'Private' },
        { value: 'double', label: '2 Sharing' },
        { value: 'triple', label: '3 Sharing' },
        { value: '4_plus', label: '4+ Sharing' },
    ],
    roommate_replacement: [
        { value: 'single', label: 'Private Room' },
        { value: 'double', label: 'Shared Room' },
    ],
};

const DEFAULT_QUICK_FEATURES: FeatureChip[] = [
    { id: 'ac', label: 'AC' },
    { id: 'attached_bathroom', label: 'Attached bathroom' },
    { id: 'furnished', label: 'Furnished' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'parking', label: 'Parking' },
    { id: 'power_backup', label: 'Power backup' },
];

export function getCategoryQuickFeatures(subtype: string | null | undefined): FeatureChip[] {
    const key = (subtype || '').toLowerCase().replace(/^stay_/, '');
    return CATEGORY_QUICK_FEATURES[key] || DEFAULT_QUICK_FEATURES;
}

export function getCategoryAdditionalFeatures(subtype: string | null | undefined): FeatureChip[] {
    const key = (subtype || '').toLowerCase().replace(/^stay_/, '');
    return CATEGORY_ADDITIONAL_FEATURES[key] || [];
}

export function getCategoryOccupancyOptions(subtype: string | null | undefined): { value: string; label: string }[] {
    const key = (subtype || '').toLowerCase().replace(/^stay_/, '');
    return CATEGORY_OCCUPANCY_OPTIONS[key] || [
        { value: 'single', label: 'Single' },
        { value: 'double', label: 'Double Sharing' },
    ];
}

