import type { VerificationCase, VerificationType } from './types.ts';

export type SubmitActor = {
    uid: string;
    roles?: string[] | null;
};

export type SubmitProperty = {
    id?: string | null;
    ownerUid?: string | null;
    createdByUid?: string | null;
};

export type SubmitListing = {
    id?: string | null;
    listedByUid?: string | null;
    listedByRole?: string | null;
    propertyId?: string | null;
};

export function subjectKindForType(type: VerificationType | string): 'user' | 'property' | 'listing' {
    if (type === 'AGENT' || type === 'BUILDER' || type === 'OWNER' || type === 'IDENTITY') return 'user';
    if (type === 'REPRESENTATION') return 'listing';
    return 'property';
}

export function canSubmitVerification(
    type: VerificationType | string,
    actor: SubmitActor,
    {
        property,
        listing,
        openPending = false,
        subjectId,
    }: {
        property?: SubmitProperty | null;
        listing?: SubmitListing | null;
        openPending?: boolean;
        subjectId?: string | null;
    } = {}
): { ok: boolean; code?: string } {
    if (!actor?.uid) return { ok: false, code: 'UNAUTHENTICATED' };
    if (openPending) return { ok: false, code: 'PENDING_EXISTS' };
    if (type === 'IDENTITY') return { ok: false, code: 'USE_EXISTING_KYC' };

    if (type === 'AGENT' || type === 'BUILDER' || type === 'OWNER') {
        if (subjectId && subjectId !== actor.uid) return { ok: false, code: 'ACTOR_NOT_PERMITTED' };
        return { ok: true };
    }

    if (type === 'OWNERSHIP' || type === 'PROPERTY' || type === 'LOCATION') {
        if (!property?.id) return { ok: false, code: 'PROPERTY_REQUIRED' };
        if (property.ownerUid !== actor.uid && property.createdByUid !== actor.uid) {
            return { ok: false, code: 'ACTOR_NOT_PERMITTED' };
        }
        return { ok: true };
    }

    if (type === 'REPRESENTATION') {
        if (!listing?.id) return { ok: false, code: 'LISTING_REQUIRED' };
        if (listing.listedByUid !== actor.uid) return { ok: false, code: 'ACTOR_NOT_PERMITTED' };
        if (listing.listedByRole !== 'agent' && listing.listedByRole !== 'builder') {
            return { ok: false, code: 'ACTOR_NOT_PERMITTED' };
        }
        return { ok: true };
    }

    return { ok: false, code: 'UNKNOWN_TYPE' };
}

export function hasOpenPending(
    cases: Array<Pick<VerificationCase, 'type' | 'subjectId' | 'status'> | null | undefined>,
    type: VerificationType | string,
    subjectId: string
): boolean {
    return (cases || []).some((row) => (
        row
        && row.type === type
        && row.subjectId === subjectId
        && row.status === 'PENDING'
    ));
}
