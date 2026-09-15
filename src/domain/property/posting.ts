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
    const isLand = category === 'land' || subtype === 'plot' || subtype === 'commercial_land'
        || subtype === 'residential_plot' || subtype === 'agricultural' || subtype === 'commercial_plot'
        || subtype === 'other';
    const isResidentialUnit = category === 'residential' && subtype !== 'plot';
    const isCommercialUnit = category === 'commercial' && subtype !== 'commercial_land';
    return {
        bedrooms: isResidentialUnit,
        bathrooms: isResidentialUnit,
        carpetArea: isResidentialUnit || subtype === 'office' || subtype === 'shop',
        builtUpArea: isResidentialUnit || isCommercialUnit,
        plotArea: isLand,
        floor: isResidentialUnit || isCommercialUnit,
        totalFloors: isResidentialUnit || isCommercialUnit,
        furnishing: isResidentialUnit || subtype === 'office' || subtype === 'shop',
        parking: !isLand || subtype === 'commercial_land',
        constructionYear: isResidentialUnit,
        projectName: category !== 'land',
        amenities: category !== 'land' || subtype === 'commercial_land',
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
}): PostStep[] {
    if (form.existingPropertyId) {
        return ['actor', 'source', 'transaction', 'listing', 'media', 'review'];
    }
    return [...POST_STEPS];
}

export function inventoryErrorMessage(
    code: InventoryErrorCode | string | null | undefined,
    fallback?: string
): string {
    switch (code) {
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
    return {
        category: cleaned.category,
        subtype: cleaned.subtype,
        status: 'ACTIVE',
        localityId,
        localityCoordinate: cleaned.localityCoordinate || null,
        address: {
            line1: (cleaned.addressLine1 || '').trim(),
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
        bedrooms: cleaned.bedrooms ?? null,
        bathrooms: cleaned.bathrooms ?? null,
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
    const transactionType = form.transactionType;
    return {
        propertyId: form.propertyId || form.existingPropertyId,
        transactionType,
        listedByRole: form.listedByRole,
        title: (form.title || '').trim(),
        description: (form.listingDescription || '').trim() || null,
        askingPrice: transactionType === 'buy' ? parseInrAmount(form.askingPriceText) : null,
        rentMonthly: transactionType === 'rent' ? parseInrAmount(form.rentMonthlyText) : null,
        deposit: transactionType === 'rent' ? parseInrAmount(form.depositText) : null,
        maintenanceMonthly: transactionType === 'rent' ? parseInrAmount(form.maintenanceText) : null,
        negotiable: form.negotiable !== false,
        status: 'DRAFT',
        sourceChannel: 'USER_CREATED',
    };
}

export function buildListingUpdatePatch(form: PostFormLike): Record<string, unknown> {
    const transactionType = form.transactionType;
    return {
        title: (form.title || '').trim(),
        description: (form.listingDescription || '').trim() || null,
        askingPrice: transactionType === 'buy' ? parseInrAmount(form.askingPriceText) : null,
        rentMonthly: transactionType === 'rent' ? parseInrAmount(form.rentMonthlyText) : null,
        deposit: transactionType === 'rent' ? parseInrAmount(form.depositText) : null,
        maintenanceMonthly: transactionType === 'rent' ? parseInrAmount(form.maintenanceText) : null,
        negotiable: form.negotiable !== false,
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
    if (!(form.title || '').trim()) return false;
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
