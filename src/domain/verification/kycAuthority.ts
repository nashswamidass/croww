/**
 * Identity KYC is server-authored. Clients must not self-assert Aadhaar / isVerified.
 * DigiLocker / Cashfree results write these fields via Admin SDK only.
 * userType / role / admin flags are frozen on client update.
 */

export const SERVER_ONLY_USER_FIELDS = [
    'trust',
    'userType',
    'role',
    'roles',
    'isApproved',
    'isBlocked',
    'isAdmin',
    'admin',
    'aadhaarVerified',
    'isVerified',
    'aadhaarVerifiedAt',
    'kycStatus',
    'kycDetails',
    'kycProvider',
    'verifiedAt',
    'verificationStatus',
    'verificationType',
] as const;

const LOCKED_ON_CLIENT_UPDATE = new Set<string>(SERVER_ONLY_USER_FIELDS);

const CLIENT_USER_TYPES = new Set(['individual', 'business', 'provider']);

export function stripServerOnlyUserFields(
    input: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    const next: Record<string, unknown> = { ...(input || {}) };
    SERVER_ONLY_USER_FIELDS.forEach((key) => {
        delete next[key];
    });
    return next;
}

export function clientMayWriteUserField(field: string): boolean {
    return !LOCKED_ON_CLIENT_UPDATE.has(field);
}

export function clientMaySetUserType(next: unknown, previous: unknown): boolean {
    return next === previous;
}

export function clientMayCreateUserType(next: unknown): boolean {
    return typeof next === 'string' && CLIENT_USER_TYPES.has(next);
}

export function clientMaySetVerificationDataStatus(status: unknown): boolean {
    return status === 'pending';
}

export function signupUserType(value: unknown): 'individual' | 'business' | 'provider' {
    if (typeof value === 'string' && CLIENT_USER_TYPES.has(value)) {
        return value as 'individual' | 'business' | 'provider';
    }
    return 'individual';
}
