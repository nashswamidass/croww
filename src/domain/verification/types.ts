import type {
    EVIDENCE_TYPES,
    REJECTION_REASONS,
    VERIFICATION_DECISIONS,
    VERIFICATION_STATUSES,
    VERIFICATION_SUBJECT_KINDS,
    VERIFICATION_TYPES,
} from './constants.ts';

export type VerificationType = (typeof VERIFICATION_TYPES)[number];
export type TrustVerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];
export type VerificationSubjectKind = (typeof VERIFICATION_SUBJECT_KINDS)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export type TimestampLike = { toDate?: () => Date; seconds?: number } | string | Date | number | null;

/** Safe public slice. No evidence, reviewer, or KYC payload. */
export type PublicVerificationSlice = {
    status: TrustVerificationStatus;
    verifiedAt?: TimestampLike | null;
    expiresAt?: TimestampLike | null;
    updatedAt?: TimestampLike | null;
};

export type PublicPropertyVerification = {
    identity: PublicVerificationSlice;
    ownership: PublicVerificationSlice;
    property: PublicVerificationSlice;
    location: PublicVerificationSlice;
};

export type PublicListingVerification = {
    representation?: PublicVerificationSlice;
};

export type PublicActorTrust = {
    identity?: PublicVerificationSlice;
    owner?: PublicVerificationSlice;
    agent?: PublicVerificationSlice;
    builder?: PublicVerificationSlice;
};

export type EvidenceRef = {
    storagePath: string;
    originalName?: string | null;
    mimeType?: string | null;
};

export type VerificationCase = {
    id?: string;
    type: VerificationType;
    subjectKind: VerificationSubjectKind;
    subjectId: string;
    propertyId?: string | null;
    listingId?: string | null;
    submittedByUid: string;
    status: TrustVerificationStatus;
    evidenceType: EvidenceType;
    evidence?: EvidenceRef[];
    submittedAt?: TimestampLike;
    reviewedAt?: TimestampLike | null;
    reviewedByUid?: string | null;
    reason?: RejectionReason | string | null;
    notes?: string | null;
    expiresAt?: TimestampLike | null;
    methodologyVersion?: string;
};

export type TrustBadge = {
    key: string;
    label: string;
    explanation: string;
};
