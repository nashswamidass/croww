import {
    COMMERCIAL_SUBTYPES,
    CONTACT_PREFERENCES,
    FURNISHING_LEVELS,
    LAND_SUBTYPES,
    LISTING_ACTOR_ROLES,
    LISTING_STATUSES,
    LOCALITY_STATUSES,
    LOCATION_PRECISIONS,
    LOCATION_VISIBILITY_MODES,
    LOCATION_SHARE_STATUSES,
    MEDIA_PARENT_TYPES,
    MEDIA_STATUSES,
    MEDIA_TYPES,
    MEDIA_VISIBILITIES,
    POSSESSION_STATUSES,
    PROPERTY_CATEGORIES,
    PROPERTY_STATUSES,
    PROPERTY_USER_ROLES,
    RESIDENTIAL_SUBTYPES,
    SOURCE_TYPES,
    TRANSACTION_TYPES,
    VERIFICATION_STATUSES,
    INGESTION_CHANNELS,
    MODERATION_STATUSES,
    REPRESENTATION_STATUSES,
} from './constants';
import type { AvailabilityMode, ListingAvailability } from './availability/types.ts';

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type ResidentialSubtype = (typeof RESIDENTIAL_SUBTYPES)[number];
export type CommercialSubtype = (typeof COMMERCIAL_SUBTYPES)[number];
export type LandSubtype = (typeof LAND_SUBTYPES)[number];
export type PropertySubtype = ResidentialSubtype | CommercialSubtype | LandSubtype;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type MediaStatus = (typeof MEDIA_STATUSES)[number];
export type LocalityStatus = (typeof LOCALITY_STATUSES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type ListingActorRole = (typeof LISTING_ACTOR_ROLES)[number];
export type PropertyUserRole = (typeof PROPERTY_USER_ROLES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type MediaParentType = (typeof MEDIA_PARENT_TYPES)[number];
export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[number];
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];
export type LocationVisibilityMode = (typeof LOCATION_VISIBILITY_MODES)[number];
export type LocationShareStatus = (typeof LOCATION_SHARE_STATUSES)[number];
export type FurnishingLevel = (typeof FURNISHING_LEVELS)[number];
export type PossessionStatus = (typeof POSSESSION_STATUSES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type IngestionChannel = (typeof INGESTION_CHANNELS)[number];
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];
export type RepresentationStatus = (typeof REPRESENTATION_STATUSES)[number];

export type LocationShare = {
    id: string;
    propertyId: string;
    listingId?: string | null;
    ownerUid: string;
    viewerUid: string;
    status: LocationShareStatus;
    requestedByUid: string;
    reviewedByUid?: string | null;
    createdAt: TimestampLike;
    updatedAt: TimestampLike;
    approvedAt?: TimestampLike;
    declinedAt?: TimestampLike;
    revokedAt?: TimestampLike;
    expiresAt?: TimestampLike;
};

/** Firestore Timestamp or ISO string depending on client vs snapshot. */
export type TimestampLike = { toDate?: () => Date; seconds?: number } | string | Date | null;

export type PropertyAddress = {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode?: string | null;
    country: string;
};

export type DataSource = {
    type: SourceType;
    channel: IngestionChannel;
    uid: string | null;
    importedAt: TimestampLike;
    /** True only when Croww/admin has marked the source authoritative. Client cannot set this. */
    authoritative: boolean;
    externalId?: string | null;
};

export type VerificationRecord = {
    status: VerificationStatus;
    updatedAt: TimestampLike;
    verifiedAt?: TimestampLike | null;
    expiresAt?: TimestampLike | null;
};

export type PropertyVerification = {
    identity: VerificationRecord;
    ownership: VerificationRecord;
    property: VerificationRecord;
    location: VerificationRecord;
};

export type PropertyRecord = {
    id: string;
    category: PropertyCategory;
    subtype: PropertySubtype;
    status: PropertyStatus;
    address: PropertyAddress;
    localityId: string;
    city: string;
    state: string;
    country: string;
    /**
     * PUBLIC map pin. For `exact` this equals the private coordinate.
     * For `approximate` / `locality` this is a derived public pin — never the private exact.
     * Never store `lat`/`lng` aliases. Exact coordinates live in `private_geo/current`.
     */
    latitude: number;
    longitude: number;
    /** Firestore GeoPoint matching the PUBLIC latitude/longitude. */
    geo?: { latitude: number; longitude: number };
    /** Geohash of the PUBLIC pin (precision 9). Used by Explore. */
    geohash: string;
    locationPrecision: LocationPrecision;
    locationVisibility?: LocationVisibilityMode;
    /** Comparison key only. Original `address` is preserved. */
    addressNormalized?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    builtUpAreaSqft?: number | null;
    carpetAreaSqft?: number | null;
    plotAreaSqft?: number | null;
    floor?: number | null;
    totalFloors?: number | null;
    furnishing: FurnishingLevel;
    parking?: number | null;
    constructionYear?: number | null;
    amenities: string[];
    description?: string | null;
    projectName?: string | null;
    possessionStatus: PossessionStatus;
    createdByUid: string;
    ownerUid: string;
    updatedByUid?: string | null;
    source: DataSource;
    verification: PropertyVerification;
    /** Server-only. True when a READY public spatial tour exists. Not a trust badge. */
    spatialTourAvailable?: boolean;
    createdAt: TimestampLike;
    updatedAt: TimestampLike;
};

/** Owner/admin only. Never denormalized onto listings. */
export type PropertyPrivateGeoRecord = {
    latitude: number;
    longitude: number;
    geo?: { latitude: number; longitude: number };
    geohash: string;
    addressLine1?: string | null;
    pincode?: string | null;
    updatedAt: TimestampLike;
    updatedByUid: string;
};

/**
 * Listing is a market offering. Physical facts live on PropertyRecord.
 * Query denormalization (city, localityId, category, coordinates) is copied from
 * the property at write time so map/feed queries do not require a join.
 */
export type ListingRecord = {
    id: string;
    propertyId: string;
    transactionType: TransactionType;
    status: ListingStatus;
    listedByUid: string;
    listedByRole: ListingActorRole;
    ownerUid: string;
    title: string;
    description?: string | null;
    askingPrice?: number | null;
    rentMonthly?: number | null;
    deposit?: number | null;
    maintenanceMonthly?: number | null;
    leaseDurationMonths?: number | null;
    negotiable: boolean;
    availableFrom?: TimestampLike;
    contactPreference: ContactPreference;
    source: DataSource;
    localityId: string;
    city: string;
    category: PropertyCategory;
    subtype: PropertySubtype;
    /** PUBLIC pin copied from the property. Never private exact coordinates. */
    latitude: number;
    longitude: number;
    geo?: { latitude: number; longitude: number };
    geohash: string;
    /** Copied from the property so Explore cards/filters do not N+1. */
    bedrooms?: number | null;
    bathrooms?: number | null;
    builtUpAreaSqft?: number | null;
    plotAreaSqft?: number | null;
    locationPrecision?: LocationPrecision;
    locationVisibility?: LocationVisibilityMode;
    coverThumbnailUrl?: string | null;
    /** Agent/builder representation of a property they may not own. Server may later set `verified`. */
    representationStatus?: RepresentationStatus;
    /** Server-only availability flag for Explore cards. Not a 3D filter. */
    spatialTourAvailable?: boolean;
    /** Normalized inventory/vacancy tracking for PG / co-living / shared accommodation. */
    availability?: ListingAvailability | null;
    availableCount?: number | null;
    availabilityMode?: AvailabilityMode | null;
    createdByUid?: string;
    updatedByUid?: string | null;
    createdAt: TimestampLike;
    updatedAt: TimestampLike;
    publishedAt: TimestampLike;
    expiresAt: TimestampLike;
    lastVerifiedAt: TimestampLike;
};

export type PropertyMediaRecord = {
    id: string;
    parentType: MediaParentType;
    parentId: string;
    propertyId: string;
    mediaType: MediaType;
    storagePath: string;
    url?: string | null;
    thumbnailUrl?: string | null;
    sortOrder: number;
    visibility: MediaVisibility;
    mimeType?: string | null;
    sizeBytes?: number | null;
    originalName?: string | null;
    createdByUid: string;
    status: MediaStatus;
    processingStatus?: string | null;
    processing?: Record<string, unknown> | null;
    createdAt: TimestampLike;
};

export type LocalityRecord = {
    id: string;
    name: string;
    city: string;
    state: string;
    country: string;
    aliases: string[];
    latitude: number;
    longitude: number;
    geo?: { latitude: number; longitude: number };
    geohash: string;
    bounds?: {
        north: number;
        south: number;
        east: number;
        west: number;
    } | null;
    /**
     * Canonical municipal boundary GeoJSON (Polygon or MultiPolygon).
     * Sourced from verified administrative spatial data. Null when unverified.
     */
    boundaryGeoJSON?: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: number[][][] | number[][][][];
    } | null;
    status: LocalityStatus;
    source: DataSource;
    /**
     * Current public area-intelligence snapshot. Admin/server-written only.
     * Null means no published evidence — clients must not invent metrics.
     * See `src/domain/intelligence`. Personalized Area Score does not live here.
     */
    intelligence?: import('../intelligence/types').IntelligenceSnapshot | null;
    /**
     * Legacy reserved map. Do not write new metrics here; use `intelligence`.
     * Clients must not write this map.
     */
    stats?: Record<string, unknown> | null;
    createdAt: TimestampLike;
    updatedAt: TimestampLike;
};

export type PropertyCreateInput = Omit<
    PropertyRecord,
    'id' | 'createdAt' | 'updatedAt' | 'geohash' | 'createdByUid' | 'verification' | 'source' | 'city' | 'state' | 'country'
> & {
    city?: string;
    state?: string;
    country?: string;
    sourceType?: SourceType;
};

export type ListingCreateInput = {
    propertyId: string;
    transactionType: TransactionType;
    listedByRole: ListingActorRole;
    title: string;
    description?: string | null;
    askingPrice?: number | null;
    rentMonthly?: number | null;
    deposit?: number | null;
    maintenanceMonthly?: number | null;
    leaseDurationMonths?: number | null;
    negotiable?: boolean;
    availableFrom?: TimestampLike;
    contactPreference?: ContactPreference;
    expiresAt?: TimestampLike;
    /** Clients may only create DRAFT. Admin/function publish is a separate operation. */
    status?: Extract<ListingStatus, 'DRAFT'>;
    sourceChannel?: IngestionChannel;
};

export type ListingPrivateMetaRecord = {
    moderation: {
        status: ModerationStatus;
        reason?: string | null;
        reviewedAt?: TimestampLike;
        reviewedByUid?: string | null;
    };
    updatedAt: TimestampLike;
    updatedByUid: string;
};
