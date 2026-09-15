import type { DashboardFilter } from './constants.ts';
import { isDraftListing, isUnderReviewListing } from './actions.ts';
import { dedupeInventoryById } from './pagination.ts';

export type InventoryListing = {
    id?: string | null;
    propertyId?: string | null;
    title?: string | null;
    city?: string | null;
    localityId?: string | null;
    status?: string | null;
    transactionType?: string | null;
    askingPrice?: number | null;
    rentMonthly?: number | null;
    reviewRequestedAt?: unknown;
    coverThumbnailUrl?: string | null;
    listedByUid?: string | null;
    listedByRole?: string | null;
    bedrooms?: number | null;
    subtype?: string | null;
    category?: string | null;
    updatedAt?: unknown;
};

export type InventoryProperty = {
    id?: string | null;
    ownerUid?: string | null;
    createdByUid?: string | null;
    category?: string | null;
    subtype?: string | null;
    city?: string | null;
    localityId?: string | null;
    bedrooms?: number | null;
    builtUpAreaSqft?: number | null;
    plotAreaSqft?: number | null;
    updatedAt?: unknown;
    projectName?: string | null;
};

export function listingMatchesDashboardFilter(
    listing: InventoryListing | null | undefined,
    filter: DashboardFilter | string
): boolean {
    if (!listing) return false;
    if (filter === 'all' || !filter) return true;
    if (filter === 'draft') return isDraftListing(listing);
    if (filter === 'review') return isUnderReviewListing(listing);
    if (filter === 'published') return listing.status === 'PUBLISHED';
    if (filter === 'paused') return listing.status === 'PAUSED';
    if (filter === 'sold_rented') return listing.status === 'SOLD' || listing.status === 'RENTED';
    if (filter === 'archived') return listing.status === 'ARCHIVED' || listing.status === 'EXPIRED';
    return listing.status === filter;
}

export function inventoryLocalityLabel(
    listing: InventoryListing | null | undefined,
    property: InventoryProperty | null | undefined = null
): string | null {
    const city = listing?.city || property?.city || null;
    const id = listing?.localityId || property?.localityId || '';
    const slug = typeof id === 'string' && id.includes('__') ? id.split('__').pop() : '';
    const locality = slug ? slug.replace(/_/g, ' ') : null;
    if (locality && city) return `${locality}, ${city}`;
    return locality || city || null;
}

export function propertyInventoryTitle(
    property: InventoryProperty | null | undefined,
    listings: InventoryListing[] = []
): string {
    const listing = listings[0];
    const bedrooms = property?.bedrooms ?? listing?.bedrooms;
    const subtype = property?.subtype || listing?.subtype;
    const locality = inventoryLocalityLabel(listing, property);
    const bhk = typeof bedrooms === 'number' ? `${bedrooms} BHK` : null;
    const project = property?.projectName || null;
    const parts = [project || locality, bhk, subtype].filter(Boolean);
    return parts.join(' · ') || 'Property';
}

export function groupListingsByProperty(listings: InventoryListing[] | null | undefined): Record<string, InventoryListing[]> {
    const grouped: Record<string, InventoryListing[]> = {};
    (listings || []).forEach((listing) => {
        const key = listing?.propertyId;
        if (!key) return;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(listing);
    });
    return grouped;
}

/**
 * Property cards from owned/created properties plus properties referenced by the actor’s listings.
 * Listing arrays are the actor’s listings only — never other people’s inventory.
 */
export function mergePropertyInventory(
    properties: InventoryProperty[] | null | undefined,
    listings: InventoryListing[] | null | undefined
): Array<InventoryProperty & { listings: InventoryListing[]; listingCount: number }> {
    const byId = new Map<string, InventoryProperty>();
    (properties || []).forEach((row) => {
        if (row?.id) byId.set(row.id, row);
    });
    const grouped = groupListingsByProperty(listings);
    Object.keys(grouped).forEach((propertyId) => {
        if (!byId.has(propertyId)) {
            const sample = grouped[propertyId][0];
            byId.set(propertyId, {
                id: propertyId,
                city: sample?.city || null,
                localityId: sample?.localityId || null,
                subtype: sample?.subtype || null,
                category: sample?.category || null,
                bedrooms: sample?.bedrooms ?? null,
            });
        }
    });
    return Array.from(byId.values()).map((property) => {
        const rows = grouped[property.id || ''] || [];
        return {
            ...property,
            listings: rows,
            listingCount: rows.length,
        };
    });
}

export function listingMatchesQuery(
    listing: InventoryListing | null | undefined,
    property: InventoryProperty | null | undefined,
    rawQuery: string | null | undefined
): boolean {
    const q = (rawQuery || '').trim().toLowerCase();
    if (!q) return true;
    if (!listing) return false;
    const haystack = [
        listing.title,
        listing.city,
        listing.localityId,
        inventoryLocalityLabel(listing, property),
        property?.projectName,
        propertyInventoryTitle(property, listing ? [listing] : []),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(q);
}

export function uniquePropertyIds(listings: InventoryListing[] | null | undefined): string[] {
    const ids = (listings || []).map((row) => row?.propertyId).filter((id): id is string => typeof id === 'string' && !!id);
    return dedupeInventoryById(ids.map((id) => ({ id }))).map((row) => row.id as string);
}
