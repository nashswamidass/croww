/**
 * Actor scoping for the supply-side inventory dashboard.
 * Never infer agent from provider or builder from business.
 */

export type DashboardListing = {
    id?: string | null;
    listedByUid?: string | null;
    createdByUid?: string | null;
    ownerUid?: string | null;
    status?: string | null;
    propertyId?: string | null;
};

export type DashboardProperty = {
    id?: string | null;
    ownerUid?: string | null;
    createdByUid?: string | null;
};

export type DashboardMedia = {
    id?: string | null;
    createdByUid?: string | null;
    visibility?: string | null;
    status?: string | null;
    mediaType?: string | null;
};

export function canAccessListingInventory(
    uid: string | null | undefined,
    listing: DashboardListing | null | undefined
): boolean {
    if (!uid || !listing) return false;
    return listing.listedByUid === uid;
}

export function canAccessPropertyInventory(
    uid: string | null | undefined,
    property: DashboardProperty | null | undefined
): boolean {
    if (!uid || !property) return false;
    return property.ownerUid === uid || property.createdByUid === uid;
}

/**
 * Agents/builders manage listings they created/represent (listedByUid).
 * They do not get arbitrary property edit rights from representation.
 */
export function canEditListingOffer(
    uid: string | null | undefined,
    listing: DashboardListing | null | undefined
): boolean {
    return canAccessListingInventory(uid, listing);
}

export function canManageListingMedia(
    uid: string | null | undefined,
    listing: DashboardListing | null | undefined,
    property?: DashboardProperty | null
): boolean {
    if (canAccessListingInventory(uid, listing)) return true;
    if (listing?.propertyId && property?.id && listing.propertyId === property.id) {
        return canAccessPropertyInventory(uid, property);
    }
    return false;
}

export function isPublicGalleryMedia(media: DashboardMedia | null | undefined): boolean {
    if (!media) return false;
    if (media.visibility !== 'public' || media.status !== 'ACTIVE') return false;
    if (media.mediaType === 'document' || media.mediaType === 'spatial') return false;
    return media.mediaType === 'photo' || media.mediaType === 'floor_plan' || media.mediaType === 'video';
}

export function canMutateMediaItem(
    uid: string | null | undefined,
    media: DashboardMedia | null | undefined
): boolean {
    if (!uid || !media) return false;
    if (!isPublicGalleryMedia(media) && media.status !== 'HIDDEN') return false;
    if (media.mediaType === 'document' || media.mediaType === 'spatial') return false;
    return media.createdByUid === uid;
}

export function filterAccessibleListings(
    uid: string | null | undefined,
    listings: DashboardListing[] | null | undefined
): DashboardListing[] {
    if (!uid || !Array.isArray(listings)) return [];
    return listings.filter((row) => canAccessListingInventory(uid, row));
}

export function filterAccessibleProperties(
    uid: string | null | undefined,
    properties: DashboardProperty[] | null | undefined
): DashboardProperty[] {
    if (!uid || !Array.isArray(properties)) return [];
    return properties.filter((row) => canAccessPropertyInventory(uid, row));
}
