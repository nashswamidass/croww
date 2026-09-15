import {
    EVIDENCE_TYPES,
    PROPERTY_VERIFICATION_STORAGE_PREFIX,
    VERIFICATION_TYPES,
} from './constants.ts';
import type { EvidenceRef, EvidenceType, VerificationCase, VerificationType } from './types.ts';

const PUBLIC_MEDIA_PREFIXES = ['property_media/', 'event_images/', 'profile_pictures/', 'business_photos/'];

export function isPrivateEvidencePath(storagePath: string | null | undefined): boolean {
    if (typeof storagePath !== 'string' || !storagePath) return false;
    if (PUBLIC_MEDIA_PREFIXES.some((prefix) => storagePath.startsWith(prefix))) return false;
    return storagePath.startsWith(`${PROPERTY_VERIFICATION_STORAGE_PREFIX}/`)
        || storagePath.startsWith('verification_docs/');
}

export function evidenceBelongsToUid(storagePath: string, uid: string): boolean {
    if (!uid || !isPrivateEvidencePath(storagePath)) return false;
    return storagePath.startsWith(`${PROPERTY_VERIFICATION_STORAGE_PREFIX}/${uid}/`)
        || storagePath.startsWith(`verification_docs/${uid}/`);
}

export function sanitizeEvidenceForPublic(): null {
    return null;
}

export function publicCaseView(row: VerificationCase | null | undefined): Record<string, unknown> | null {
    if (!row) return null;
    return {
        id: row.id || null,
        type: row.type,
        subjectKind: row.subjectKind,
        subjectId: row.subjectId,
        propertyId: row.propertyId || null,
        listingId: row.listingId || null,
        status: row.status,
        submittedAt: row.submittedAt || null,
        expiresAt: row.expiresAt || null,
    };
}

export function buildEvidenceStoragePath(uid: string, caseId: string, filename: string): string {
    const safe = String(filename || 'document').replace(/[^\w.-]/g, '_').slice(0, 80);
    return `${PROPERTY_VERIFICATION_STORAGE_PREFIX}/${uid}/verification/${caseId}/${safe}`;
}

export function isKnownVerificationType(value: unknown): value is VerificationType {
    return typeof value === 'string' && (VERIFICATION_TYPES as readonly string[]).includes(value);
}

export function isKnownEvidenceType(value: unknown): value is EvidenceType {
    return typeof value === 'string' && (EVIDENCE_TYPES as readonly string[]).includes(value);
}

export function validateSubmitInput(input: {
    type?: unknown;
    subjectId?: unknown;
    evidenceType?: unknown;
    evidence?: EvidenceRef[] | null;
    uid?: string;
}): string[] {
    const issues: string[] = [];
    if (!isKnownVerificationType(input.type) || input.type === 'IDENTITY') {
        issues.push(input.type === 'IDENTITY'
            ? 'Identity uses the existing KYC flow, not a property document upload'
            : 'Unknown verification type');
    }
    if (typeof input.subjectId !== 'string' || !input.subjectId.trim()) {
        issues.push('subjectId is required');
    }
    if (!isKnownEvidenceType(input.evidenceType)) {
        issues.push('Unknown evidence type');
    }
    const evidence = Array.isArray(input.evidence) ? input.evidence : [];
    if (!evidence.length) issues.push('Evidence is required');
    evidence.forEach((item) => {
        if (!isPrivateEvidencePath(item?.storagePath)) {
            issues.push('Evidence must stay in private document storage');
        }
        if (input.uid && item?.storagePath && !evidenceBelongsToUid(item.storagePath, input.uid)) {
            issues.push('Evidence path does not belong to the submitter');
        }
    });
    return issues;
}
