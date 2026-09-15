/**
 * Operations that MUST be server/admin-controlled later.
 * Do not implement these as unauthenticated or client-trusted writes.
 *
 * Identity for all of these must come from a verified Firebase ID token
 * (see functions/httpAuth.js), never from body.uid / userType.
 */

export const PROPERTY_SERVER_OPERATIONS = {
    SET_VERIFICATION_STATUS: {
        reason: 'Clients must not self-approve identity, ownership, property, or location verification.',
        collections: ['properties', 'listings', 'users', 'verification_cases'],
        function: 'reviewVerification',
    },
    PUBLISH_LISTING: {
        reason: 'Client creates DRAFT only. PUBLISHED is admin/Cloud Function after moderation.',
        collections: ['listings'],
        function: 'publishListing',
    },
    APPROVE_MODERATION: {
        reason: 'moderation.status APPROVED/REJECTED is admin-only on listings/{id}/private_meta.',
        collections: ['listings'],
        function: 'publishListing',
    },
    TRANSFER_PROPERTY_OWNERSHIP: {
        reason: 'ownerUid changes are an ownership transfer and must not be a free client field.',
        collections: ['properties', 'listings'],
    },
    MARK_LISTING_FRESHNESS: {
        reason: 'lastVerifiedAt is a Croww attestation, not a client clock.',
        collections: ['listings'],
    },
    SET_SOURCE_AUTHORITATIVE: {
        reason: 'authoritative=true means Croww has accepted the source. Client always writes false.',
        collections: ['properties', 'listings', 'localities'],
    },
    WRITE_PRIVATE_GEO_AS_PUBLIC: {
        reason: 'Exact coordinates belong in properties/{id}/private_geo/current, never on public listing docs.',
        collections: ['properties', 'listings'],
        function: 'syncPropertyPublicLocation',
    },
    VERIFY_AGENT_REPRESENTATION: {
        reason: 'representationStatus verified is server-only. Clients write unverified.',
        collections: ['listings'],
    },
    WRITE_LOCALITY_STATS: {
        reason: 'Legacy reserved map. New evidence belongs on localities.intelligence (admin/server).',
        collections: ['localities'],
    },
    WRITE_LOCALITY_INTELLIGENCE: {
        reason: 'Public area-intelligence snapshots are admin/server-generated. Clients must not write metrics, flood class, or medians.',
        collections: ['localities'],
        function: 'recomputeLocalityMarket',
    },
    INGEST_EXTERNAL_LISTING: {
        reason: 'External feeds must be normalized and never treated as verified.',
        collections: ['properties', 'listings', 'property_media'],
    },
    MODERATE_OR_TAKE_DOWN: {
        reason: 'Admin/moderation pause, expire, or archive of another actor’s listing.',
        collections: ['listings', 'properties', 'property_media'],
    },
    FINALIZE_SPATIAL_ASSET: {
        reason: 'Clients must not mark 3D / Gaussian assets READY or set public derived URLs.',
        collections: ['property_media', 'spatial_processing_jobs', 'properties', 'listings'],
        function: 'finalizeSpatialAsset',
    },
} as const;
