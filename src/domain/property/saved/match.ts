import { isCoordinateInBounds, viewportToBounds } from '../geo.ts';
import type { CanonicalSavedSearch, PublicListingForMatch } from './types.ts';

export function cityKeyFromValue(city: unknown): string | null {
    if (typeof city !== 'string') return null;
    const key = city.trim().toLowerCase();
    return key || null;
}

/**
 * Buy uses askingPrice. Rent uses rentMonthly.
 * Never compare rent to sale price.
 */
export function listingMarketAmount(listing: PublicListingForMatch | null | undefined): number | null {
    if (!listing) return null;
    if (listing.transactionType === 'rent') {
        const value = listing.rentMonthly;
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
    }
    if (listing.transactionType === 'buy') {
        const value = listing.askingPrice;
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
    }
    return null;
}

/**
 * True when a listing newly becomes PUBLISHED.
 * DRAFT→PUBLISHED and PAUSED/EXPIRED→PUBLISHED count.
 * PUBLISHED→PUBLISHED edits do not.
 */
export function isPublicationTransition(
    before: { status?: string | null } | null | undefined,
    after: { status?: string | null } | null | undefined
): boolean {
    if (!after || after.status !== 'PUBLISHED') return false;
    if (!before) return true;
    return before.status !== 'PUBLISHED';
}

export function listingMatchesSavedSearch(
    listing: PublicListingForMatch | null | undefined,
    search: CanonicalSavedSearch | null | undefined
): boolean {
    if (!listing || !search) return false;
    if (listing.status !== 'PUBLISHED') return false;

    const { filters, location } = search;
    if (filters.transactionType && listing.transactionType !== filters.transactionType) return false;
    if (filters.category && listing.category !== filters.category) return false;
    if (filters.subtype && listing.subtype !== filters.subtype) return false;
    if (filters.bhk != null) {
        const beds = listing.bedrooms;
        if (beds == null || !Number.isFinite(beds)) return false;
        if (filters.bhk >= 5) {
            if (beds < 5) return false;
        } else if (beds !== filters.bhk) return false;
    }

    const amount = listingMarketAmount(listing);
    if (filters.minPrice != null || filters.maxPrice != null) {
        if (amount == null) return false;
        if (filters.minPrice != null && amount < filters.minPrice) return false;
        if (filters.maxPrice != null && amount > filters.maxPrice) return false;
    }

    if (location.mode === 'CITY') {
        if (!location.cityKey) return false;
        const listingCity = cityKeyFromValue(listing.city);
        if (!listingCity || listingCity !== location.cityKey) return false;
    } else if (location.cityKey) {
        const listingCity = cityKeyFromValue(listing.city);
        if (!listingCity || listingCity !== location.cityKey) return false;
    }

    if (location.mode === 'LOCALITY' || location.localityId) {
        if (!location.localityId || listing.localityId !== location.localityId) return false;
    }

    if (location.mode === 'VIEWPORT') {
        if (!location.viewport) return false;
        const lat = Number(listing.latitude);
        const lng = Number(listing.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        if (!isCoordinateInBounds(lat, lng, viewportToBounds(location.viewport))) return false;
    }

    return true;
}

export function savedSearchMatchId(savedSearchId: string, listingId: string, eventType = 'listingPublished'): string {
    return `${savedSearchId}_${listingId}_${eventType}`.slice(0, 700);
}
