/**
 * Public identity projection for other-user reads.
 * Firestore cannot hide fields on users/{uid}, so clients must read
 * public_profiles/{uid} instead of the private user document.
 */

export const PUBLIC_PROFILE_COLLECTION = 'public_profiles';

export const PUBLIC_PROFILE_ALWAYS_KEYS = [
    'id',
    'kind',
    'name',
    'username',
    'avatar',
    'photoURL',
    'profileImage',
    'profilePhotos',
    'coverImage',
    'userType',
    'role',
    'category',
    'bio',
    'joinedDate',
    'followersCount',
    'isBlocked',
    'updatedAt',
] as const;

export const PUBLIC_PROFILE_MARKETPLACE_KEYS = [
    'about',
    'location',
    'address',
    'coordinates',
    'socialLinks',
    'interests',
    'stats',
    'packages',
    'availability',
    'isBusiness',
    'isProvider',
    'rating',
    'reviews',
] as const;

export const PUBLIC_PROFILE_ALLOWED_KEYS = [
    ...PUBLIC_PROFILE_ALWAYS_KEYS,
    ...PUBLIC_PROFILE_MARKETPLACE_KEYS,
] as const;

const NEVER_PUBLIC = new Set([
    'email',
    'phone',
    'pushToken',
    'kycDetails',
    'kycStatus',
    'kycProvider',
    'aadhaarVerified',
    'aadhaarVerifiedAt',
    'isVerified',
    'isApproved',
    'verifiedAt',
    'verificationData',
    'verificationStatus',
    'verificationType',
    'trust',
    'roles',
    'isAdmin',
    'admin',
    'policyAccepted',
    'policyAcceptedAt',
    'staff',
]);

const CLIENT_USER_TYPES = new Set(['individual', 'business', 'provider']);

export function publicProfileUserType(value: unknown): 'individual' | 'business' | 'provider' {
    if (typeof value === 'string' && CLIENT_USER_TYPES.has(value)) {
        return value as 'individual' | 'business' | 'provider';
    }
    return 'individual';
}

function copyIfPresent(
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    keys: readonly string[]
): void {
    keys.forEach((key) => {
        if (NEVER_PUBLIC.has(key)) return;
        if (source[key] !== undefined) target[key] = source[key];
    });
}

function availabilityFromUser(source: Record<string, unknown>): Record<string, unknown> | undefined {
    const nested = source.availability;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested as Record<string, unknown>;
    }
    const dotted: Record<string, unknown> = {};
    Object.keys(source).forEach((key) => {
        if (key.startsWith('availability.') && key.length > 'availability.'.length) {
            dotted[key.slice('availability.'.length)] = source[key];
        }
    });
    return Object.keys(dotted).length ? dotted : undefined;
}

export function toPublicUserProfile(
    uid: string,
    source: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    const input = source || {};
    const userType = publicProfileUserType(input.userType);
    const next: Record<string, unknown> = {
        id: uid,
        kind: 'publicProfile',
        userType,
        updatedAt: new Date().toISOString(),
    };
    copyIfPresent(input, next, PUBLIC_PROFILE_ALWAYS_KEYS.filter((key) => key !== 'id' && key !== 'kind' && key !== 'userType' && key !== 'updatedAt'));
    next.userType = userType;
    if (next.role === 'admin') next.role = userType;
    if (userType === 'provider' || userType === 'business') {
        copyIfPresent(input, next, PUBLIC_PROFILE_MARKETPLACE_KEYS);
        const availability = availabilityFromUser(input);
        if (availability) next.availability = availability;
    }
    NEVER_PUBLIC.forEach((key) => {
        delete next[key];
    });
    return next;
}

export function publicProfileContainsPrivateData(profile: Record<string, unknown> | null | undefined): boolean {
    const keys = Object.keys(profile || {});
    return keys.some((key) => NEVER_PUBLIC.has(key));
}
