/**
 * Property trust / verification contracts.
 * Distinct dimensions. Never a single verified=true flag.
 * Identity KYC lives in the existing verificationService (DigiLocker/Cashfree).
 */

export const VERIFICATION_TYPES = [
    'IDENTITY',
    'OWNER',
    'AGENT',
    'BUILDER',
    'OWNERSHIP',
    'REPRESENTATION',
    'PROPERTY',
    'LOCATION',
] as const;

export const VERIFICATION_STATUSES = [
    'NOT_VERIFIED',
    'PENDING',
    'VERIFIED',
    'REJECTED',
    'EXPIRED',
] as const;

export const VERIFICATION_DECISIONS = ['APPROVED', 'REJECTED', 'EXPIRED'] as const;

export const VERIFICATION_SUBJECT_KINDS = ['user', 'property', 'listing'] as const;

export const EVIDENCE_TYPES = [
    'KYC_REFERENCE',
    'OWNERSHIP_DOCUMENT',
    'PROPERTY_DOCUMENT',
    'COMPANY_DOCUMENT',
    'AUTHORIZATION_DOCUMENT',
    'LOCATION_EVIDENCE',
    'OTHER',
] as const;

export const REJECTION_REASONS = [
    'INSUFFICIENT_EVIDENCE',
    'DOCUMENT_UNCLEAR',
    'MISMATCH',
    'EXPIRED_DOCUMENT',
    'REPRESENTATION_NOT_ESTABLISHED',
    'OTHER',
] as const;

export const VERIFICATION_COLLECTION = 'verification_cases';
export const VERIFICATION_HISTORY_SUBCOLLECTION = 'history';
export const VERIFICATION_METHODOLOGY_VERSION = 'v1';

/** Private storage. Never property_media / public gallery. */
export const PROPERTY_VERIFICATION_STORAGE_PREFIX = 'property_documents';

export const VERIFICATION_CASE_TRANSITIONS: Record<
    (typeof VERIFICATION_STATUSES)[number],
    readonly (typeof VERIFICATION_STATUSES)[number][]
> = {
    NOT_VERIFIED: ['PENDING'],
    PENDING: ['VERIFIED', 'REJECTED'],
    VERIFIED: ['EXPIRED', 'REJECTED'],
    REJECTED: ['PENDING'],
    EXPIRED: ['PENDING'],
};
