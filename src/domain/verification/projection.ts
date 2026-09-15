import type {
    PublicActorTrust,
    PublicListingVerification,
    PublicPropertyVerification,
    PublicVerificationSlice,
    TimestampLike,
    TrustBadge,
    VerificationType,
} from './types.ts';
import type { TrustVerificationStatus } from './types.ts';

function toMillis(value: TimestampLike | undefined): number | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 1e12 ? value : value * 1000;
    }
    if (typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof value === 'object' && typeof (value as { seconds?: number }).seconds === 'number') {
        return (value as { seconds: number }).seconds * 1000;
    }
    const parsed = new Date(value as string);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function isCurrentlyVerified(
    slice: PublicVerificationSlice | null | undefined,
    now = Date.now()
): boolean {
    if (!slice || slice.status !== 'VERIFIED') return false;
    const expires = toMillis(slice.expiresAt);
    if (expires != null && expires <= now) return false;
    return true;
}

export function effectiveVerificationStatus(
    slice: PublicVerificationSlice | null | undefined,
    now = Date.now()
): TrustVerificationStatus {
    if (!slice || !slice.status) return 'NOT_VERIFIED';
    if (slice.status === 'VERIFIED' && !isCurrentlyVerified(slice, now)) return 'EXPIRED';
    return slice.status;
}

const PUBLIC_SLICE_KEYS = new Set(['status', 'verifiedAt', 'expiresAt', 'updatedAt']);

export function toPublicVerificationSlice(
    input: Record<string, unknown> | null | undefined,
    now = Date.now()
): PublicVerificationSlice {
    const status = effectiveVerificationStatus(
        { status: (input?.status as TrustVerificationStatus) || 'NOT_VERIFIED', expiresAt: input?.expiresAt as TimestampLike },
        now
    );
    return {
        status,
        verifiedAt: status === 'VERIFIED' ? (input?.verifiedAt as TimestampLike) || null : null,
        expiresAt: (input?.expiresAt as TimestampLike) || null,
        updatedAt: (input?.updatedAt as TimestampLike) || null,
    };
}

export function publicSliceHasPrivateLeak(slice: Record<string, unknown> | null | undefined): boolean {
    if (!slice || typeof slice !== 'object') return false;
    const leaked = [
        'evidence', 'evidenceType', 'evidenceReference', 'storagePath', 'reviewedByUid',
        'notes', 'reason', 'kyc', 'verificationData', 'documentUrl', 'documentUrls',
        'aadhaar', 'data',
    ];
    return leaked.some((key) => Object.prototype.hasOwnProperty.call(slice, key));
}

export function assertPublicSliceSafe(slice: Record<string, unknown> | null | undefined): boolean {
    if (!slice || typeof slice !== 'object') return true;
    return Object.keys(slice).every((key) => PUBLIC_SLICE_KEYS.has(key)) && !publicSliceHasPrivateLeak(slice);
}

/**
 * Map existing KYC/DigiLocker user fields to a public identity slice.
 * Does not copy Aadhaar payloads, names, or document URLs.
 */
export function identityStatusFromUser(user: Record<string, unknown> | null | undefined): PublicVerificationSlice {
    if (!user) return { status: 'NOT_VERIFIED', verifiedAt: null, expiresAt: null };
    const trust = user.trust && typeof user.trust === 'object'
        ? (user.trust as Record<string, Record<string, unknown>>).identity
        : null;
    if (trust && typeof trust.status === 'string') {
        return toPublicVerificationSlice(trust);
    }
    const biz = user.verificationData && typeof user.verificationData === 'object'
        ? (user.verificationData as Record<string, unknown>).status
        : null;
    if (user.aadhaarVerified === true || user.isVerified === true) {
        return {
            status: 'VERIFIED',
            verifiedAt: (user.aadhaarVerifiedAt as TimestampLike) || null,
            expiresAt: null,
        };
    }
    if (biz === 'pending') return { status: 'PENDING', verifiedAt: null, expiresAt: null };
    if (biz === 'rejected' || user.verificationStatus === 'rejected') {
        return { status: 'REJECTED', verifiedAt: null, expiresAt: null };
    }
    return { status: 'NOT_VERIFIED', verifiedAt: null, expiresAt: null };
}

export function publicActorTrustFromUser(user: Record<string, unknown> | null | undefined, now = Date.now()): PublicActorTrust {
    const trust = (user?.trust && typeof user.trust === 'object') ? user.trust as Record<string, Record<string, unknown>> : {};
    return {
        identity: identityStatusFromUser(user),
        owner: toPublicVerificationSlice(trust.owner, now),
        agent: toPublicVerificationSlice(trust.agent, now),
        builder: toPublicVerificationSlice(trust.builder, now),
    };
}

export const BADGE_EXPLANATIONS: Record<string, string> = {
    identity: 'Identity was reviewed through Croww’s identity check. This is not proof of property ownership.',
    ownership: 'Ownership evidence was reviewed by Croww. This is not a legal ownership guarantee.',
    property: 'Croww reviewed evidence that this property listing matches a real place. This is not a price guarantee.',
    location: 'The listed property location was reviewed. Exact coordinates may still stay private.',
    agent: 'This agent account was reviewed by Croww. It does not by itself prove they represent this property.',
    builder: 'This builder account was reviewed by Croww. It does not by itself prove project authority.',
    representation: 'Croww reviewed evidence that this agent or builder may represent this property.',
    owner_actor: 'This owner account was reviewed by Croww. It does not by itself prove they own a given property.',
};

function pushBadge(badges: TrustBadge[], key: string, label: string) {
    badges.push({ key, label, explanation: BADGE_EXPLANATIONS[key] || 'Verified by Croww based on submitted evidence.' });
}

/**
 * Explicit public badges. Never a generic “Verified”.
 * Expired slices are omitted. REJECTED/PENDING are not public badges.
 */
export function trustBadges({
    property,
    listing,
    actorTrust,
    now = Date.now(),
}: {
    property?: { verification?: PublicPropertyVerification | Record<string, PublicVerificationSlice> } | null;
    listing?: {
        listedByRole?: string | null;
        representationStatus?: string | null;
        verification?: PublicListingVerification | Record<string, PublicVerificationSlice>;
    } | null;
    actorTrust?: PublicActorTrust | null;
    now?: number;
} = {}): TrustBadge[] {
    const badges: TrustBadge[] = [];
    const pv = property?.verification || {};
    const ownership = toPublicVerificationSlice(pv.ownership as Record<string, unknown>, now);
    const prop = toPublicVerificationSlice(pv.property as Record<string, unknown>, now);
    const location = toPublicVerificationSlice(pv.location as Record<string, unknown>, now);
    const role = listing?.listedByRole;

    if (isCurrentlyVerified(ownership, now)) pushBadge(badges, 'ownership', 'Owner verified');
    if (role === 'agent' && isCurrentlyVerified(actorTrust?.agent, now)) pushBadge(badges, 'agent', 'Agent verified');
    if (role === 'builder' && isCurrentlyVerified(actorTrust?.builder, now)) pushBadge(badges, 'builder', 'Builder verified');
    if (isCurrentlyVerified(prop, now)) pushBadge(badges, 'property', 'Property verified');
    if (isCurrentlyVerified(location, now)) pushBadge(badges, 'location', 'Location verified');
    if (isCurrentlyVerified(actorTrust?.identity, now)) pushBadge(badges, 'identity', 'Identity verified');

    const representation = toPublicVerificationSlice(
        (listing?.verification as PublicListingVerification)?.representation as unknown as Record<string, unknown>,
        now
    );
    const representationOk = isCurrentlyVerified(representation, now)
        || (listing?.representationStatus === 'verified' && representation.status !== 'EXPIRED');
    if ((role === 'agent' || role === 'builder') && representationOk) {
        pushBadge(badges, 'representation', 'Representation verified');
    }

    return badges.slice(0, 4);
}

export function listingCardTrustHint(
    listing: { verification?: PublicListingVerification; representationStatus?: string | null } | null | undefined,
    now = Date.now()
): string | null {
    const representation = toPublicVerificationSlice(
        listing?.verification?.representation as unknown as Record<string, unknown>,
        now
    );
    if (isCurrentlyVerified(representation, now)) return 'Reviewed';
    if (listing?.representationStatus === 'verified' && representation.status !== 'EXPIRED') {
        return 'Reviewed';
    }
    return null;
}

export function dashboardVerificationLabel(
    property: { verification?: Record<string, PublicVerificationSlice> } | null | undefined,
    listing: { verification?: PublicListingVerification; representationStatus?: string | null } | null | undefined,
    now = Date.now()
): string {
    const slices = [
        property?.verification?.ownership,
        property?.verification?.property,
        property?.verification?.location,
        listing?.verification?.representation,
    ];
    if (listing?.representationStatus === 'verified') {
        slices.push({ status: 'VERIFIED' });
    }
    if (slices.some((s) => isCurrentlyVerified(s, now))) return 'Verified';
    if (slices.some((s) => effectiveVerificationStatus(s, now) === 'PENDING')) return 'Pending';
    return 'Not verified';
}

export function publicProjectionPatch(
    type: VerificationType,
    slice: PublicVerificationSlice
): { userTrustKey?: string; propertyKey?: string; listingRepresentation?: boolean } {
    if (type === 'AGENT') return { userTrustKey: 'agent' };
    if (type === 'BUILDER') return { userTrustKey: 'builder' };
    if (type === 'OWNER') return { userTrustKey: 'owner' };
    if (type === 'IDENTITY') return { userTrustKey: 'identity' };
    if (type === 'OWNERSHIP') return { propertyKey: 'ownership' };
    if (type === 'PROPERTY') return { propertyKey: 'property' };
    if (type === 'LOCATION') return { propertyKey: 'location' };
    if (type === 'REPRESENTATION') return { listingRepresentation: true };
    return {};
}

export function claimedOwnerIsNotVerifiedOwner(
    ownerUid: string | null | undefined,
    ownership: PublicVerificationSlice | null | undefined,
    now = Date.now()
): boolean {
    return Boolean(ownerUid) && !isCurrentlyVerified(ownership, now);
}

export function agentRoleIsNotVerifiedAgent(
    roles: unknown,
    agentTrust: PublicVerificationSlice | null | undefined,
    now = Date.now()
): boolean {
    const list = Array.isArray(roles) ? roles : [];
    return list.includes('agent') && !isCurrentlyVerified(agentTrust, now);
}
