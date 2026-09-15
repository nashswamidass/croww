/**
 * Saved listings, saved properties, and saved searches.
 * Private per user. Not a social follow graph.
 */

export const SAVED_LISTINGS_SUBCOLLECTION = 'savedListings';
export const SAVED_PROPERTIES_SUBCOLLECTION = 'savedProperties';
export const SAVED_SEARCHES_SUBCOLLECTION = 'savedSearches';
export const SAVED_SEARCH_MATCHES_SUBCOLLECTION = 'savedSearchMatches';

export const SAVED_SEARCH_LOCATION_MODES = ['CITY', 'LOCALITY', 'VIEWPORT'] as const;

export const SAVED_SEARCH_ALERT_EVENT = 'listingPublished';
export const SAVED_SEARCH_NOTIFICATION_TYPE = 'saved_search_match';

/** Product limits. Not a scientific capacity plan. */
export const MAX_SAVED_LISTINGS = 200;
export const MAX_SAVED_PROPERTIES = 200;
export const MAX_SAVED_SEARCHES = 25;
export const MAX_ACTIVE_ALERTS = 10;
export const MAX_SAVED_SEARCH_NAME_LENGTH = 80;
export const MAX_SNAPSHOT_TITLE_LENGTH = 120;
export const MAX_SEARCH_LABEL_LENGTH = 80;
export const MAX_ALERT_MATCHES_PER_PUBLICATION = 50;
export const MAX_ALERT_QUERY = 200;
export const SAVED_LIST_READ_LIMIT = 50;

export const SAVED_SEARCH_FILTER_KEYS = [
    'transactionType',
    'category',
    'subtype',
    'bhk',
    'minPrice',
    'maxPrice',
] as const;
