export type SpatialActor = { uid: string };

export type SpatialProperty = {
    id?: string | null;
    ownerUid?: string | null;
    createdByUid?: string | null;
};

export type SpatialListing = {
    id?: string | null;
    listedByUid?: string | null;
    propertyId?: string | null;
};

export function canManageSpatialAsset(
    actor: SpatialActor | null | undefined,
    {
        property,
        listing,
        createdByUid,
    }: {
        property?: SpatialProperty | null;
        listing?: SpatialListing | null;
        createdByUid?: string | null;
    } = {}
): boolean {
    if (!actor?.uid) return false;
    if (createdByUid && createdByUid === actor.uid) return true;
    if (property?.ownerUid === actor.uid || property?.createdByUid === actor.uid) return true;
    if (listing?.listedByUid === actor.uid) return true;
    return false;
}

export function preferPropertyAttachment(
    listing?: SpatialListing | null,
    propertyId?: string | null
): 'property' | 'listing' {
    if (propertyId || listing?.propertyId) return 'property';
    return 'listing';
}
