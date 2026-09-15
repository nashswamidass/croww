import type { ListingActorRole } from './types';

export type ActorProfile = {
    uid: string;
    roles?: string[] | null;
    userType?: string | null;
};

export type PropertyOwnership = {
    ownerUid?: string | null;
    createdByUid?: string | null;
};

/**
 * Role grants are never implied from userType (business ≠ builder, provider ≠ agent).
 * Roles are never auto-assigned when posting.
 */
export function assertListingActorAllowed(
    listedByRole: ListingActorRole | string,
    profile: ActorProfile,
    property: PropertyOwnership
): { ok: true } | { ok: false; code: 'UNAUTHORIZED_ACTOR' | 'OWNERSHIP_CONFLICT'; message: string } {
    const uid = profile.uid;
    const roles = Array.isArray(profile.roles) ? profile.roles : [];

    if (listedByRole === 'admin') {
        if (profile.userType !== 'admin') {
            return { ok: false, code: 'UNAUTHORIZED_ACTOR', message: 'Admin listings require an admin account' };
        }
        return { ok: true };
    }
    if (listedByRole === 'owner') {
        if (property.ownerUid !== uid && property.createdByUid !== uid) {
            return { ok: false, code: 'OWNERSHIP_CONFLICT', message: 'Only the claimed owner can create an owner listing' };
        }
        return { ok: true };
    }
    if (listedByRole === 'agent') {
        if (!roles.includes('agent')) {
            return {
                ok: false,
                code: 'UNAUTHORIZED_ACTOR',
                message: 'Agent listings require users.roles to include agent',
            };
        }
        return { ok: true };
    }
    if (listedByRole === 'builder') {
        if (!roles.includes('builder')) {
            return {
                ok: false,
                code: 'UNAUTHORIZED_ACTOR',
                message: 'Builder listings require users.roles to include builder',
            };
        }
        return { ok: true };
    }
    return { ok: false, code: 'UNAUTHORIZED_ACTOR', message: 'Unknown listing actor role' };
}

export function clientMaySetListingStatus(fromStatus: string, toStatus: string): boolean {
    if (toStatus === 'PUBLISHED' && fromStatus !== 'PUBLISHED') return false;
    return true;
}
