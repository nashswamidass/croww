import { VERIFICATION_CASE_TRANSITIONS } from './constants.ts';
import type { TrustVerificationStatus, VerificationDecision } from './types.ts';

export function canTransitionVerification(
    from: TrustVerificationStatus | string,
    to: TrustVerificationStatus | string
): boolean {
    return (VERIFICATION_CASE_TRANSITIONS[from as TrustVerificationStatus] || []).includes(
        to as TrustVerificationStatus
    );
}

export function decisionToStatus(decision: VerificationDecision | string): TrustVerificationStatus | null {
    if (decision === 'APPROVED') return 'VERIFIED';
    if (decision === 'REJECTED') return 'REJECTED';
    if (decision === 'EXPIRED') return 'EXPIRED';
    return null;
}

/** Clients may only introduce PENDING. They never write VERIFIED. */
export function clientMaySetVerificationStatus(
    fromStatus: TrustVerificationStatus | string | null | undefined,
    toStatus: TrustVerificationStatus | string
): boolean {
    if (toStatus === 'VERIFIED' || toStatus === 'EXPIRED') return false;
    if (toStatus !== 'PENDING') return false;
    const from = fromStatus || 'NOT_VERIFIED';
    return canTransitionVerification(from, 'PENDING');
}

export function adminMayDecide(
    fromStatus: TrustVerificationStatus | string | null | undefined,
    decision: VerificationDecision | string
): boolean {
    const to = decisionToStatus(decision);
    if (!to) return false;
    const from = fromStatus || 'NOT_VERIFIED';
    return canTransitionVerification(from, to);
}
