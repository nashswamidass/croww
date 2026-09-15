import type { SAVED_SEARCH_LOCATION_MODES } from './constants.ts';

export type SavedSearchLocationMode = (typeof SAVED_SEARCH_LOCATION_MODES)[number];

export type SavedViewport = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
};

export type SavedSearchFilters = {
    transactionType: 'buy' | 'rent' | null;
    category: string | null;
    subtype: string | null;
    bhk: number | null;
    minPrice: number | null;
    maxPrice: number | null;
};

export type SavedSearchLocation = {
    mode: SavedSearchLocationMode;
    city: string | null;
    cityKey: string | null;
    localityId: string | null;
    searchLabel: string | null;
    viewport: SavedViewport | null;
};

export type CanonicalSavedSearch = {
    name: string;
    location: SavedSearchLocation;
    filters: SavedSearchFilters;
    criteriaHash: string;
    alertEnabled: boolean;
};

export type SavedListingSnapshot = {
    title: string | null;
    askingPrice: number | null;
    rentMonthly: number | null;
    coverThumbnailUrl: string | null;
    localityName: string | null;
    city: string | null;
    transactionType: string | null;
    bedrooms: number | null;
    status: string | null;
};

export type SavedPropertySnapshot = {
    title: string | null;
    category: string | null;
    subtype: string | null;
    bedrooms: number | null;
    coverThumbnailUrl: string | null;
    localityName: string | null;
    city: string | null;
};

export type PublicListingForMatch = {
    id?: string | null;
    status?: string | null;
    transactionType?: string | null;
    category?: string | null;
    subtype?: string | null;
    bedrooms?: number | null;
    askingPrice?: number | null;
    rentMonthly?: number | null;
    price?: number | null;
    city?: string | null;
    localityId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    listedByUid?: string | null;
    ownerUid?: string | null;
    title?: string | null;
    builtUpAreaSqft?: number | null;
    coverThumbnailUrl?: string | null;
};

export type AlertNotificationPayload = {
    type: string;
    listingId: string;
    savedSearchId: string;
    eventType: string;
};
