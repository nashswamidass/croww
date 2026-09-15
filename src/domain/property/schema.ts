/**
 * Canonical property-domain field catalog.
 * Services and rules must not invent a second set of names for these entities.
 *
 * Top-level collections (never `events`):
 *   properties, listings, localities, property_media, spatial_processing_jobs
 *
 * Embedded (not collections):
 *   address, source, verification, bounds, intelligence (current public snapshot)
 *
 * Subcollections:
 *   properties/{id}/private_geo/current  — exact coordinates (owner/admin)
 *   listings/{id}/private_meta/current   — moderation (lister/owner/admin)
 *   localities/{id}/intelligence_draft|history|internal — admin/server only
 *
 * Trust cases: verification_cases (private evidence). Public status lives on
 * properties.verification, listings.verification.representation, users.trust.
 * Spatial processing jobs: spatial_processing_jobs (private). READY 3D is server-only.
 *
 * Public `latitude` / `longitude` / `geo` / `geohash` are the PUBLIC pin only.
 */

export const PROPERTY_PHYSICAL_FIELDS = [
    'category',
    'subtype',
    'address',
    'addressNormalized',
    'localityId',
    'city',
    'state',
    'country',
    'latitude',
    'longitude',
    'geo',
    'geohash',
    'locationPrecision',
    'bedrooms',
    'bathrooms',
    'builtUpAreaSqft',
    'carpetAreaSqft',
    'plotAreaSqft',
    'floor',
    'totalFloors',
    'furnishing',
    'parking',
    'constructionYear',
    'amenities',
    'description',
    'projectName',
    'possessionStatus',
] as const;

/** Exact coordinates. Never copied onto listings or public property fields when precision is not exact. */
export const PROPERTY_PRIVATE_GEO_FIELDS = [
    'latitude',
    'longitude',
    'geo',
    'geohash',
    'addressLine1',
    'pincode',
] as const;

export const PROPERTY_SERVER_FIELDS = [
    'verification',
    'source.authoritative',
    'ownerUid',
] as const;

export const LISTING_OFFER_FIELDS = [
    'transactionType',
    'title',
    'description',
    'askingPrice',
    'rentMonthly',
    'deposit',
    'maintenanceMonthly',
    'leaseDurationMonths',
    'negotiable',
    'availableFrom',
    'contactPreference',
    'expiresAt',
    'status',
] as const;

export const LISTING_CLIENT_EDIT_FIELDS = [
    'title',
    'description',
    'askingPrice',
    'rentMonthly',
    'deposit',
    'maintenanceMonthly',
    'leaseDurationMonths',
    'negotiable',
    'availableFrom',
    'contactPreference',
    'expiresAt',
] as const;

export const LISTING_PROTECTED_FIELDS = [
    'listedByUid',
    'listedByRole',
    'propertyId',
    'ownerUid',
    'createdByUid',
    'source',
    'lastVerifiedAt',
    'publishedAt',
    'latitude',
    'longitude',
    'geo',
    'geohash',
    'localityId',
    'city',
    'category',
    'subtype',
    'locationPrecision',
    'representationStatus',
    'verification',
    'moderation',
    'spatialTourAvailable',
] as const;

/** Public query copy from the property. Public pin only — never private_geo. */
export const LISTING_DENORMALIZED_FROM_PROPERTY = [
    'localityId',
    'city',
    'category',
    'subtype',
    'latitude',
    'longitude',
    'geohash',
    'geo',
    'ownerUid',
    'bedrooms',
    'bathrooms',
    'builtUpAreaSqft',
    'plotAreaSqft',
    'locationPrecision',
] as const;

export const LISTING_FRESHNESS_FIELDS = [
    'createdAt',
    'updatedAt',
    'publishedAt',
    'expiresAt',
    'lastVerifiedAt',
] as const;

export const LOCALITY_IDENTITY_FIELDS = [
    'name',
    'city',
    'state',
    'country',
    'aliases',
    'status',
] as const;

export const LOCALITY_GEO_FIELDS = [
    'latitude',
    'longitude',
    'geo',
    'geohash',
    'bounds',
] as const;

/** Admin/server-generated. Clients must not write. */
export const LOCALITY_SERVER_FIELDS = [
    'intelligence',
    'stats',
] as const;
