import {
    COMMERCIAL_SUBTYPES,
    CONTACT_PREFERENCES,
    FURNISHING_LEVELS,
    LAND_SUBTYPES,
    LISTING_ACTOR_ROLES,
    LISTING_STATUSES,
    LISTING_STATUS_TRANSITIONS,
    LOCALITY_STATUSES,
    INGESTION_CHANNELS,
    LOCATION_PRECISIONS,
    LOCATION_VISIBILITY_MODES,
    MEDIA_PARENT_TYPES,
    MEDIA_STATUSES,
    MEDIA_TYPES,
    MEDIA_VISIBILITIES,
    POSSESSION_STATUSES,
    PROPERTY_CATEGORIES,
    PROPERTY_STATUSES,
    PROPERTY_STATUS_TRANSITIONS,
    PROPERTY_SUBTYPES,
    PROPERTY_USER_ROLES,
    RESIDENTIAL_SUBTYPES,
    SOURCE_TYPES,
    TRANSACTION_TYPES,
} from './constants.ts';
import { isLikelyInIndia, isValidLatitude, isValidLongitude } from './geo.ts';
import type {
    ListingStatus,
    PropertyCategory,
    PropertyStatus,
    PropertySubtype,
} from './types';

export type ValidationIssue = { field: string; message: string };

export class PropertyValidationError extends Error {
    issues: ValidationIssue[];
    constructor(issues: ValidationIssue[]) {
        super(issues.map((i) => `${i.field}: ${i.message}`).join('; '));
        this.name = 'PropertyValidationError';
        this.issues = issues;
    }
}

function includes(list: readonly string[], value: unknown): boolean {
    return typeof value === 'string' && list.includes(value);
}

function optionalNonNegative(value: unknown): boolean {
    return value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function optionalPositiveInt(value: unknown, max: number): boolean {
    if (value == null) return true;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

export function subtypeMatchesCategory(category: PropertyCategory, subtype: PropertySubtype): boolean {
    if (category === 'residential') return (RESIDENTIAL_SUBTYPES as readonly string[]).includes(subtype);
    if (category === 'commercial') return (COMMERCIAL_SUBTYPES as readonly string[]).includes(subtype);
    if (category === 'land') return (LAND_SUBTYPES as readonly string[]).includes(subtype);
    return false;
}

export function validatePropertyInput(input: Record<string, unknown>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!includes(PROPERTY_CATEGORIES, input.category)) {
        issues.push({ field: 'category', message: 'Must be residential, commercial, or land' });
    }
    if (!includes(PROPERTY_SUBTYPES, input.subtype)) {
        issues.push({ field: 'subtype', message: 'Unknown property subtype' });
    } else if (
        includes(PROPERTY_CATEGORIES, input.category) &&
        !subtypeMatchesCategory(input.category as PropertyCategory, input.subtype as PropertySubtype)
    ) {
        issues.push({ field: 'subtype', message: 'Subtype does not match category' });
    }
    if (input.status != null && !includes(PROPERTY_STATUSES, input.status)) {
        issues.push({ field: 'status', message: 'Unknown property status' });
    }
    if (!isValidLatitude(input.latitude)) {
        issues.push({ field: 'latitude', message: 'Must be a number between -90 and 90' });
    }
    if (!isValidLongitude(input.longitude)) {
        issues.push({ field: 'longitude', message: 'Must be a number between -180 and 180' });
    }
    if (typeof input.localityId !== 'string' || !input.localityId.trim()) {
        issues.push({ field: 'localityId', message: 'Required' });
    }
    const address = input.address as Record<string, unknown> | undefined;
    if (!address || typeof address.line1 !== 'string' || !address.line1.trim()) {
        issues.push({ field: 'address.line1', message: 'Required' });
    }
    if (!address || typeof address.city !== 'string' || !address.city.trim()) {
        issues.push({ field: 'address.city', message: 'Required' });
    }
    if (!optionalPositiveInt(input.bedrooms, 20)) {
        issues.push({ field: 'bedrooms', message: 'Must be an integer from 0 to 20' });
    }
    if (!optionalPositiveInt(input.bathrooms, 20)) {
        issues.push({ field: 'bathrooms', message: 'Must be an integer from 0 to 20' });
    }
    if (!optionalNonNegative(input.builtUpAreaSqft)) {
        issues.push({ field: 'builtUpAreaSqft', message: 'Cannot be negative' });
    }
    if (!optionalNonNegative(input.carpetAreaSqft)) {
        issues.push({ field: 'carpetAreaSqft', message: 'Cannot be negative' });
    }
    if (!optionalNonNegative(input.plotAreaSqft)) {
        issues.push({ field: 'plotAreaSqft', message: 'Cannot be negative' });
    }
    if (!optionalPositiveInt(input.floor, 200)) {
        issues.push({ field: 'floor', message: 'Must be an integer from 0 to 200' });
    }
    if (!optionalPositiveInt(input.totalFloors, 200)) {
        issues.push({ field: 'totalFloors', message: 'Must be an integer from 0 to 200' });
    }
    if (
        typeof input.floor === 'number' &&
        typeof input.totalFloors === 'number' &&
        input.floor > input.totalFloors
    ) {
        issues.push({ field: 'floor', message: 'Cannot exceed totalFloors' });
    }
    if (input.furnishing != null && !includes(FURNISHING_LEVELS, input.furnishing)) {
        issues.push({ field: 'furnishing', message: 'Unknown furnishing value' });
    }
    if (!optionalNonNegative(input.parking)) {
        issues.push({ field: 'parking', message: 'Cannot be negative' });
    }
    if (input.constructionYear != null) {
        const year = input.constructionYear;
        if (typeof year !== 'number' || year < 1800 || year > 2100) {
            issues.push({ field: 'constructionYear', message: 'Must be a plausible year' });
        }
    }
    if (input.locationPrecision != null && !includes(LOCATION_PRECISIONS, input.locationPrecision)) {
        issues.push({ field: 'locationPrecision', message: 'Unknown location precision' });
    }
    if (input.locationVisibility != null && !includes(LOCATION_VISIBILITY_MODES, input.locationVisibility)) {
        issues.push({ field: 'locationVisibility', message: 'Unknown location visibility' });
    }
    if (
        includes(['IN', 'India', 'in'], (input.country as string)
            || ((input.address as Record<string, unknown> | undefined)?.country as string)
            || 'IN')
        && isValidLatitude(input.latitude)
        && isValidLongitude(input.longitude)
        && !isLikelyInIndia(input.latitude as number, input.longitude as number)
    ) {
        issues.push({
            field: 'latitude',
            message: 'Coordinates are outside the expected India range; city defaults are not applied',
        });
    }
    if (input.possessionStatus != null && !includes(POSSESSION_STATUSES, input.possessionStatus)) {
        issues.push({ field: 'possessionStatus', message: 'Unknown possession status' });
    }
    return issues;
}

export function validateListingInput(input: Record<string, unknown>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (typeof input.propertyId !== 'string' || !input.propertyId.trim()) {
        issues.push({ field: 'propertyId', message: 'Required' });
    }
    if (!includes(TRANSACTION_TYPES, input.transactionType)) {
        issues.push({ field: 'transactionType', message: 'Must be buy or rent' });
    }
    if (!includes(LISTING_ACTOR_ROLES, input.listedByRole)) {
        issues.push({ field: 'listedByRole', message: 'Unknown listing actor role' });
    }
    if (typeof input.title !== 'string' || !input.title.trim()) {
        issues.push({ field: 'title', message: 'Required' });
    }
    if (input.status != null && !includes(LISTING_STATUSES, input.status)) {
        issues.push({ field: 'status', message: 'Unknown listing status' });
    }
    if (!optionalNonNegative(input.askingPrice)) {
        issues.push({ field: 'askingPrice', message: 'Cannot be negative' });
    }
    if (!optionalNonNegative(input.rentMonthly)) {
        issues.push({ field: 'rentMonthly', message: 'Cannot be negative' });
    }
    if (!optionalNonNegative(input.deposit)) {
        issues.push({ field: 'deposit', message: 'Cannot be negative' });
    }
    if (!optionalNonNegative(input.maintenanceMonthly)) {
        issues.push({ field: 'maintenanceMonthly', message: 'Cannot be negative' });
    }
    if (!optionalPositiveInt(input.leaseDurationMonths, 600)) {
        issues.push({ field: 'leaseDurationMonths', message: 'Must be an integer from 0 to 600' });
    }
    const requiresOfferPrice = input.status === 'PUBLISHED';
    if (
        requiresOfferPrice &&
        input.transactionType === 'buy' &&
        (typeof input.askingPrice !== 'number' || input.askingPrice <= 0)
    ) {
        issues.push({ field: 'askingPrice', message: 'Sale listings require a positive asking price' });
    }
    if (
        requiresOfferPrice &&
        input.transactionType === 'rent' &&
        (typeof input.rentMonthly !== 'number' || input.rentMonthly <= 0)
    ) {
        issues.push({ field: 'rentMonthly', message: 'Rent listings require a positive monthly rent' });
    }
    if (input.contactPreference != null && !includes(CONTACT_PREFERENCES, input.contactPreference)) {
        issues.push({ field: 'contactPreference', message: 'Unknown contact preference' });
    }
    if (input.sourceType != null && !includes(SOURCE_TYPES, input.sourceType)) {
        issues.push({ field: 'source.type', message: 'Unknown source type' });
    }
    if (input.sourceChannel != null && !includes(INGESTION_CHANNELS, input.sourceChannel)) {
        issues.push({ field: 'source.channel', message: 'Unknown ingestion channel' });
    }
    return issues;
}

export function validateMediaInput(input: Record<string, unknown>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!includes(MEDIA_PARENT_TYPES, input.parentType)) {
        issues.push({ field: 'parentType', message: 'Must be property or listing' });
    }
    if (typeof input.parentId !== 'string' || !input.parentId.trim()) {
        issues.push({ field: 'parentId', message: 'Required' });
    }
    if (typeof input.propertyId !== 'string' || !input.propertyId.trim()) {
        issues.push({ field: 'propertyId', message: 'Required' });
    }
    if (!includes(MEDIA_TYPES, input.mediaType)) {
        issues.push({ field: 'mediaType', message: 'Unknown media type' });
    }
    if (typeof input.storagePath !== 'string' || !input.storagePath.trim()) {
        issues.push({ field: 'storagePath', message: 'Required' });
    }
    if (input.visibility != null && !includes(MEDIA_VISIBILITIES, input.visibility)) {
        issues.push({ field: 'visibility', message: 'Must be public or private' });
    }
    if (input.status != null && !includes(MEDIA_STATUSES, input.status)) {
        issues.push({ field: 'status', message: 'Unknown media status' });
    }
    if (input.sortOrder != null && (typeof input.sortOrder !== 'number' || input.sortOrder < 0)) {
        issues.push({ field: 'sortOrder', message: 'Cannot be negative' });
    }
    if (input.mediaType === 'document' && input.visibility === 'public') {
        issues.push({ field: 'visibility', message: 'Documents cannot be public property media' });
    }
    if (input.mediaType === 'spatial' && input.visibility === 'public') {
        issues.push({ field: 'visibility', message: 'Clients cannot publish 3D media' });
    }
    if (input.mediaType === 'spatial' && (input.url || input.processingStatus === 'READY')) {
        issues.push({ field: 'processingStatus', message: 'Clients cannot mark 3D media READY' });
    }
    return issues;
}

export function validateLocalityInput(input: Record<string, unknown>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (typeof input.name !== 'string' || !input.name.trim()) {
        issues.push({ field: 'name', message: 'Required' });
    }
    if (typeof input.city !== 'string' || !input.city.trim()) {
        issues.push({ field: 'city', message: 'Required' });
    }
    if (typeof input.state !== 'string' || !input.state.trim()) {
        issues.push({ field: 'state', message: 'Required' });
    }
    if (!isValidLatitude(input.latitude)) {
        issues.push({ field: 'latitude', message: 'Must be a number between -90 and 90' });
    }
    if (!isValidLongitude(input.longitude)) {
        issues.push({ field: 'longitude', message: 'Must be a number between -180 and 180' });
    }
    if (input.status != null && !includes(LOCALITY_STATUSES, input.status)) {
        issues.push({ field: 'status', message: 'Unknown locality status' });
    }
    if (input.intelligence != null) {
        issues.push({ field: 'intelligence', message: 'Clients cannot write locality intelligence' });
    }
    if (input.stats != null) {
        issues.push({ field: 'stats', message: 'Clients cannot write locality stats' });
    }
    return issues;
}

export function canTransitionListing(from: ListingStatus, to: ListingStatus): boolean {
    return (LISTING_STATUS_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionProperty(from: PropertyStatus, to: PropertyStatus): boolean {
    return (PROPERTY_STATUS_TRANSITIONS[from] || []).includes(to);
}

export function assertNoIssues(issues: ValidationIssue[]): void {
    if (issues.length) throw new PropertyValidationError(issues);
}

export function isPropertyUserRole(value: unknown): boolean {
    return includes(PROPERTY_USER_ROLES, value);
}

export function listingProtectedFieldsTouched(patch: Record<string, unknown>): string[] {
    const protectedKeys = [
        'listedByUid', 'listedByRole', 'propertyId', 'ownerUid', 'createdByUid',
        'source', 'lastVerifiedAt', 'publishedAt', 'latitude', 'longitude', 'geo',
        'geohash', 'localityId', 'city', 'category', 'subtype', 'locationPrecision',
        'representationStatus', 'verification', 'moderation', 'spatialTourAvailable',
    ];
    return protectedKeys.filter((key) => Object.prototype.hasOwnProperty.call(patch, key));
}
