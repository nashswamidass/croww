/**
 * Area intelligence constants.
 *
 * Locality intelligence is an evidence layer, not a personalized Croww Area Score.
 * Do not invent values, scores, or neighborhood marketing copy here.
 */

export const INTELLIGENCE_VERSION = '1';
export const INTELLIGENCE_METHODOLOGY_VERSION = 'area-intelligence-v1';
export const MARKET_METHODOLOGY_VERSION = 'croww-median-v1';
export const PROXIMITY_METHODOLOGY_VERSION = 'haversine-centroid-v1';
export const FLOOD_METHODOLOGY_VERSION = 'source-passthrough-v1';

export const INTELLIGENCE_DOMAINS = [
    'market',
    'transport',
    'schools',
    'healthcare',
    'airport',
    'connectivity',
    'flood',
    'affordability',
] as const;

/** Not implemented. Architecture allows adding these without changing locality identity. */
export const FUTURE_INTELLIGENCE_DOMAINS = [
    'groundwater',
    'crime',
    'pollution',
    'noise',
    'walkability',
    'employment',
    'rental_yield',
    'appreciation',
    'amenities',
    'demographics',
] as const;

export const SOURCE_CLASSES = [
    'OFFICIAL',
    'GOVERNMENT',
    'OPEN_DATA',
    'VERIFIED_PROVIDER',
    'DERIVED',
    'INTERNAL',
    'COMMUNITY',
] as const;

export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;

export const DOMAIN_STATUSES = ['AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'STALE'] as const;

export const METRIC_STATUSES = [
    'AVAILABLE',
    'PARTIAL',
    'UNAVAILABLE',
    'STALE',
    'INSUFFICIENT_SAMPLE',
] as const;

export const FLOOD_CLASSES = ['LOW', 'MODERATE', 'HIGH', 'UNKNOWN'] as const;

export const MARKET_AREA_UNIT = 'sqft';
export const MARKET_PRICE_UNIT = 'INR';
export const MARKET_RENT_UNIT = 'INR_PER_MONTH';
export const MARKET_SALE_PSF_UNIT = 'INR_PER_SQFT';
export const MARKET_RENT_PSF_UNIT = 'INR_PER_SQFT_PER_MONTH';
export const DISTANCE_UNIT_M = 'm';

/**
 * Medians are not shown as locality "market truth" below this Croww published-listing count.
 * Counts may still be displayed when labeled as Croww inventory.
 */
export const MARKET_MEDIAN_MIN_SAMPLE = 8;
export const MARKET_CONFIDENCE_HIGH_SAMPLE = 40;
export const MARKET_SERVER_QUERY_LIMIT = 250;

/** Snapshot older than this is STALE. Not a refresh worker. */
export const INTELLIGENCE_STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

/** Documented proximity radii for when POI data exists. Not used to invent coverage. */
export const SCHOOL_RADIUS_M = 2000;
export const HOSPITAL_RADIUS_M = 2000;
export const METRO_RADIUS_M = 1500;
export const ROAD_RADIUS_M = 1000;

/**
 * Camera span when a locality has a centroid but no official boundary.
 * This is a map framing hint, not a locality polygon.
 */
export const LOCALITY_CAMERA_DELTA = 0.045;

export const LOCALITY_INTELLIGENCE_SUBCOLLECTIONS = {
    draft: 'intelligence_draft',
    history: 'intelligence_history',
    internal: 'intelligence_internal',
} as const;

export const LOCALITY_INTELLIGENCE_CURRENT_DOC = 'current';

/**
 * Acceptable source classes per domain, highest trust first.
 * COMMUNITY is never sufficient for flood, schools quality, or hospital ranking.
 */
export const SOURCE_HIERARCHY = {
    flood: ['GOVERNMENT', 'OFFICIAL', 'OPEN_DATA'],
    transport: ['OFFICIAL', 'GOVERNMENT', 'OPEN_DATA', 'VERIFIED_PROVIDER'],
    schools: ['GOVERNMENT', 'OFFICIAL', 'OPEN_DATA', 'VERIFIED_PROVIDER'],
    healthcare: ['GOVERNMENT', 'OFFICIAL', 'OPEN_DATA', 'VERIFIED_PROVIDER'],
    airport: ['OFFICIAL', 'OPEN_DATA', 'INTERNAL'],
    connectivity: ['GOVERNMENT', 'OPEN_DATA', 'OFFICIAL'],
    market: ['DERIVED'],
    affordability: ['DERIVED'],
} as const;

export const CROWW_MARKET_SOURCE_LABEL = 'Croww published listings';
export const CROWW_MARKET_SOURCE_REF = 'croww:listings:PUBLISHED';
