/**
 * Croww property-domain constants.
 * Canonical enums for the new real-estate product. Do not reuse event statuses.
 */

export const PROPERTY_CATEGORIES = ['residential', 'commercial', 'land'] as const;

export const TRANSACTION_TYPES = ['buy', 'rent'] as const;

export const STAY_SUBTYPES = [
    'bed',
    'shared_room',
    'private_room',
    'pg',
    'coliving',
    'roommate_replacement',
] as const;

export const RESIDENTIAL_SUBTYPES = [
    'apartment',
    'independent_house',
    'villa',
    'plot',
    ...STAY_SUBTYPES,
] as const;
export const COMMERCIAL_SUBTYPES = ['office', 'shop', 'warehouse', 'industrial', 'commercial_land'] as const;
export const LAND_SUBTYPES = ['residential_plot', 'agricultural', 'commercial_plot', 'other'] as const;
export const PROPERTY_SUBTYPES = [
    ...RESIDENTIAL_SUBTYPES,
    ...COMMERCIAL_SUBTYPES,
    ...LAND_SUBTYPES,
] as const;

export const PROPERTY_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export const LISTING_STATUSES = [
    'DRAFT',
    'PUBLISHED',
    'PAUSED',
    'SOLD',
    'RENTED',
    'EXPIRED',
    'ARCHIVED',
] as const;
export const MEDIA_STATUSES = ['ACTIVE', 'HIDDEN', 'DELETED'] as const;
export const LOCALITY_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const VERIFICATION_STATUSES = [
    'NOT_VERIFIED',
    'PENDING',
    'VERIFIED',
    'REJECTED',
    'EXPIRED',
] as const;

export const LISTING_ACTOR_ROLES = ['owner', 'agent', 'builder', 'admin'] as const;
export const PROPERTY_USER_ROLES = ['buyer', 'owner', 'agent', 'builder'] as const;

export const MEDIA_TYPES = ['photo', 'floor_plan', 'video', 'document', 'spatial'] as const;
export const MEDIA_PARENT_TYPES = ['property', 'listing'] as const;
export const MEDIA_VISIBILITIES = ['public', 'private'] as const;

export const LOCATION_PRECISIONS = ['exact', 'approximate', 'locality', 'approximate_on_request'] as const;
export const LOCATION_VISIBILITY_MODES = [
    'approximate_on_request',
    'approximate',
    'exact',
] as const;
export const LOCATION_SHARE_STATUSES = [
    'PENDING',
    'APPROVED',
    'DECLINED',
    'REVOKED',
    'EXPIRED',
] as const;
export const FURNISHING_LEVELS = ['unfurnished', 'semi', 'fully', 'unknown'] as const;
export const POSSESSION_STATUSES = ['ready', 'under_construction', 'unknown'] as const;
export const SOURCE_TYPES = ['owner', 'agent', 'builder', 'admin', 'external'] as const;
export const INGESTION_CHANNELS = [
    'USER_CREATED',
    'ADMIN_CREATED',
    'ADMIN_IMPORTED',
    'FUTURE_API',
    'FUTURE_BULK_IMPORT',
] as const;
export const CONTACT_PREFERENCES = ['in_app', 'phone', 'both'] as const;
export const MODERATION_STATUSES = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'] as const;
export const REPRESENTATION_STATUSES = ['unverified', 'verified'] as const;

export const COLLECTIONS = {
    properties: 'properties',
    listings: 'listings',
    localities: 'localities',
    propertyMedia: 'property_media',
    locationShares: 'location_shares',
} as const;

/** Subcollection under a property. Exact coordinates never live on the public property/listing docs. */
export const PRIVATE_GEO_SUBCOLLECTION = 'private_geo';
export const PRIVATE_GEO_DOC_ID = 'current';
/** Subcollection under a listing. Moderation internals are not on the public listing doc. */
export const LISTING_PRIVATE_META_SUBCOLLECTION = 'private_meta';
export const LISTING_PRIVATE_META_DOC_ID = 'current';
/** Admin/server only. Unpublished or raw intelligence — never public client writes. */
export const LOCALITY_INTELLIGENCE_DRAFT_SUBCOLLECTION = 'intelligence_draft';
export const LOCALITY_INTELLIGENCE_HISTORY_SUBCOLLECTION = 'intelligence_history';
export const LOCALITY_INTELLIGENCE_INTERNAL_SUBCOLLECTION = 'intelligence_internal';

/** Firebase Storage prefixes. verification_docs remains KYC-only and is never public listing media. */
export const STORAGE_PREFIXES = {
    publicMedia: 'property_media',
    privateDocuments: 'property_documents',
    spatial: 'property_spatial',
} as const;

export const DEFAULT_VERIFICATION_STATUS = 'NOT_VERIFIED';
export const DEFAULT_COUNTRY = 'IN';

export const LISTING_STATUS_TRANSITIONS: Record<(typeof LISTING_STATUSES)[number], readonly (typeof LISTING_STATUSES)[number][]> = {
    DRAFT: ['PUBLISHED', 'ARCHIVED'],
    PUBLISHED: ['PAUSED', 'SOLD', 'RENTED', 'EXPIRED', 'ARCHIVED'],
    PAUSED: ['PUBLISHED', 'EXPIRED', 'ARCHIVED'],
    SOLD: ['ARCHIVED'],
    RENTED: ['ARCHIVED'],
    EXPIRED: ['DRAFT', 'ARCHIVED'],
    ARCHIVED: [],
};

export const PROPERTY_STATUS_TRANSITIONS: Record<(typeof PROPERTY_STATUSES)[number], readonly (typeof PROPERTY_STATUSES)[number][]> = {
    ACTIVE: ['INACTIVE', 'ARCHIVED'],
    INACTIVE: ['ACTIVE', 'ARCHIVED'],
    ARCHIVED: [],
};
