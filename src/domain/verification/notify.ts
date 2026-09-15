import type { TrustVerificationStatus, VerificationType } from './types.ts';

const PRIVATE_KEYS = [
    'storagePath', 'evidence', 'evidenceReference', 'reviewedByUid', 'notes',
    'kyc', 'verificationData', 'documentUrl', 'aadhaar', 'latitude', 'longitude',
];

export function verificationNotificationCopy(
    type: VerificationType | string,
    status: TrustVerificationStatus | string
): { title: string; message: string } {
    const subject = ({
        IDENTITY: 'identity',
        OWNER: 'owner',
        AGENT: 'agent',
        BUILDER: 'builder',
        OWNERSHIP: 'ownership',
        REPRESENTATION: 'representation',
        PROPERTY: 'property',
        LOCATION: 'location',
    } as Record<string, string>)[type] || 'verification';

    if (status === 'PENDING') {
        return {
            title: 'Verification submitted',
            message: `Your ${subject} verification was submitted and is pending review.`,
        };
    }
    if (status === 'VERIFIED') {
        return {
            title: 'Verification approved',
            message: `Your ${subject} verification was approved.`,
        };
    }
    if (status === 'REJECTED') {
        return {
            title: 'Verification not approved',
            message: `Your ${subject} verification was not approved. You can submit new evidence.`,
        };
    }
    if (status === 'EXPIRED') {
        return {
            title: 'Verification expired',
            message: `Your ${subject} verification has expired.`,
        };
    }
    return {
        title: 'Verification update',
        message: `Your ${subject} verification was updated.`,
    };
}

export function publicNotificationPayload(input: {
    type: VerificationType | string;
    status: TrustVerificationStatus | string;
    caseId: string;
    subjectId?: string | null;
}): Record<string, unknown> {
    const copy = verificationNotificationCopy(input.type, input.status);
    const data: Record<string, unknown> = {
        type: 'property_verification',
        verificationType: input.type,
        verificationStatus: input.status,
        verificationId: input.caseId,
        subjectId: input.subjectId || null,
    };
    PRIVATE_KEYS.forEach((key) => {
        delete data[key];
    });
    return {
        title: copy.title,
        message: copy.message,
        data,
    };
}

export function notificationPayloadIsPrivate(payload: Record<string, unknown> | null | undefined): boolean {
    if (!payload) return false;
    const blob = JSON.stringify(payload).toLowerCase();
    return PRIVATE_KEYS.some((key) => blob.includes(key.toLowerCase()))
        || blob.includes('reviewedby')
        || blob.includes('documenturl');
}
