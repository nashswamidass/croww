import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    adminMayDecide,
    agentRoleIsNotVerifiedAgent,
    buildEvidenceStoragePath,
    canSubmitVerification,
    canTransitionVerification,
    claimedOwnerIsNotVerifiedOwner,
    clientMaySetVerificationStatus,
    dashboardVerificationLabel,
    decisionToStatus,
    evidenceBelongsToUid,
    hasOpenPending,
    identityStatusFromUser,
    clientMayWriteUserField,
    clientMaySetUserType,
    clientMaySetVerificationDataStatus,
    signupUserType,
    stripServerOnlyUserFields,
    isCurrentlyVerified,
    isPrivateEvidencePath,
    listingCardTrustHint,
    notificationPayloadIsPrivate,
    publicCaseView,
    publicNotificationPayload,
    publicSliceHasPrivateLeak,
    sanitizeEvidenceForPublic,
    toPublicVerificationSlice,
    trustBadges,
    validateSubmitInput,
} from './index.ts';

const now = Date.parse('2026-09-11T12:00:00Z');

describe('verification state transitions', () => {
    it('allows submit and admin review paths only', () => {
        assert.equal(canTransitionVerification('NOT_VERIFIED', 'PENDING'), true);
        assert.equal(canTransitionVerification('PENDING', 'VERIFIED'), true);
        assert.equal(canTransitionVerification('PENDING', 'REJECTED'), true);
        assert.equal(canTransitionVerification('REJECTED', 'PENDING'), true);
        assert.equal(canTransitionVerification('VERIFIED', 'EXPIRED'), true);
        assert.equal(canTransitionVerification('EXPIRED', 'PENDING'), true);
    });

    it('rejects invalid transitions including self-approve', () => {
        assert.equal(canTransitionVerification('NOT_VERIFIED', 'VERIFIED'), false);
        assert.equal(canTransitionVerification('REJECTED', 'VERIFIED'), false);
        assert.equal(canTransitionVerification('VERIFIED', 'PENDING'), false);
        assert.equal(clientMaySetVerificationStatus('NOT_VERIFIED', 'VERIFIED'), false);
        assert.equal(clientMaySetVerificationStatus('PENDING', 'VERIFIED'), false);
        assert.equal(clientMaySetVerificationStatus('NOT_VERIFIED', 'PENDING'), true);
        assert.equal(adminMayDecide('PENDING', 'APPROVED'), true);
        assert.equal(adminMayDecide('NOT_VERIFIED', 'APPROVED'), false);
        assert.equal(decisionToStatus('APPROVED'), 'VERIFIED');
    });
});

describe('authorization', () => {
    it('does not let a user approve or verify another actor’s property', () => {
        const actor = { uid: 'u1' };
        assert.deepEqual(
            canSubmitVerification('OWNERSHIP', actor, { property: { id: 'p1', ownerUid: 'other', createdByUid: 'other' } }),
            { ok: false, code: 'ACTOR_NOT_PERMITTED' }
        );
        assert.equal(canSubmitVerification('OWNERSHIP', actor, { property: { id: 'p1', ownerUid: 'u1' } }).ok, true);
        assert.equal(canSubmitVerification('REPRESENTATION', actor, { listing: { id: 'l1', listedByUid: 'u1', listedByRole: 'owner' } }).ok, false);
        assert.equal(canSubmitVerification('REPRESENTATION', actor, { listing: { id: 'l1', listedByUid: 'u1', listedByRole: 'agent' } }).ok, true);
        assert.equal(canSubmitVerification('IDENTITY', actor).ok, false);
        assert.equal(canSubmitVerification('AGENT', actor, { subjectId: 'other' }).ok, false);
        assert.equal(canSubmitVerification('AGENT', actor, { subjectId: 'u1' }).ok, true);
        assert.equal(canSubmitVerification('AGENT', actor, { openPending: true }).ok, false);
        assert.equal(hasOpenPending([{ type: 'AGENT', subjectId: 'u1', status: 'PENDING' }], 'AGENT', 'u1'), true);
    });
});

describe('owner claim vs verified owner and agent role vs verified agent', () => {
    it('keeps claimed ownerUid distinct from verified ownership', () => {
        assert.equal(claimedOwnerIsNotVerifiedOwner('owner-1', { status: 'NOT_VERIFIED' }, now), true);
        assert.equal(claimedOwnerIsNotVerifiedOwner('owner-1', { status: 'VERIFIED' }, now), false);
        assert.equal(agentRoleIsNotVerifiedAgent(['agent'], { status: 'NOT_VERIFIED' }, now), true);
        assert.equal(agentRoleIsNotVerifiedAgent(['agent'], { status: 'VERIFIED' }, now), false);
        assert.equal(agentRoleIsNotVerifiedAgent(['buyer'], { status: 'NOT_VERIFIED' }, now), false);
    });
});

describe('expiration and public projection', () => {
    it('does not treat expired slices as currently verified', () => {
        const expired = { status: 'VERIFIED', expiresAt: new Date(now - 1000) };
        assert.equal(isCurrentlyVerified(expired, now), false);
        assert.equal(isCurrentlyVerified({ status: 'VERIFIED', expiresAt: new Date(now + 86400000) }, now), true);
        const slice = toPublicVerificationSlice(expired, now);
        assert.equal(slice.status, 'EXPIRED');
        assert.equal(slice.verifiedAt, null);
    });

    it('strips private evidence from public slices and case views', () => {
        assert.equal(sanitizeEvidenceForPublic(), null);
        assert.equal(publicSliceHasPrivateLeak({ status: 'VERIFIED', evidence: [] }), true);
        assert.equal(publicSliceHasPrivateLeak({ status: 'VERIFIED', verifiedAt: now }), false);
        const view = publicCaseView({
            id: 'c1',
            type: 'PROPERTY',
            subjectKind: 'property',
            subjectId: 'p1',
            submittedByUid: 'u1',
            status: 'PENDING',
            evidenceType: 'PROPERTY_DOCUMENT',
            evidence: [{ storagePath: 'property_documents/u1/secret.pdf' }],
            notes: 'internal',
            reviewedByUid: 'admin',
        });
        assert.equal(view.status, 'PENDING');
        assert.equal('evidence' in view, false);
        assert.equal('reviewedByUid' in view, false);
        assert.equal('notes' in view, false);
    });
});

describe('identity KYC mapping and badges', () => {
    it('maps DigiLocker flags to identity without copying KYC payloads', () => {
        const slice = identityStatusFromUser({
            aadhaarVerified: true,
            aadhaarVerifiedAt: new Date(now),
            verificationData: { data: { full_name: 'SECRET', aadhaar: '1234' } },
        });
        assert.equal(slice.status, 'VERIFIED');
        assert.equal(JSON.stringify(slice).includes('SECRET'), false);
        assert.equal(identityStatusFromUser({ verificationData: { status: 'pending' } }).status, 'PENDING');
        assert.equal(identityStatusFromUser({}).status, 'NOT_VERIFIED');
        assert.equal(identityStatusFromUser({
            aadhaarVerified: false,
            trust: { identity: { status: 'VERIFIED', verifiedAt: new Date(now) } },
        }).status, 'VERIFIED');
        assert.equal(identityStatusFromUser({
            verificationStatus: 'verified',
        }).status, 'NOT_VERIFIED');
    });

    it('does not let clients self-assert identity KYC fields', () => {
        assert.equal(clientMayWriteUserField('aadhaarVerified'), false);
        assert.equal(clientMayWriteUserField('isVerified'), false);
        assert.equal(clientMayWriteUserField('trust'), false);
        assert.equal(clientMayWriteUserField('roles'), false);
        assert.equal(clientMayWriteUserField('displayName'), true);
        assert.equal(clientMaySetUserType('admin', 'individual'), false);
        assert.equal(clientMaySetUserType('business', 'individual'), false);
        assert.equal(clientMaySetUserType('individual', 'individual'), true);
        assert.equal(clientMaySetVerificationDataStatus('verified'), false);
        assert.equal(clientMaySetVerificationDataStatus('pending'), true);
        assert.equal(signupUserType('admin'), 'individual');
        assert.equal('aadhaarVerified' in stripServerOnlyUserFields({ aadhaarVerified: true, name: 'A' }), false);
        assert.equal('userType' in stripServerOnlyUserFields({ userType: 'provider', name: 'A' }), false);
    });

    it('shows explicit badges and ignores generic property.identity as owner', () => {
        const badges = trustBadges({
            property: {
                verification: {
                    identity: { status: 'VERIFIED' },
                    ownership: { status: 'PENDING' },
                    property: { status: 'VERIFIED' },
                    location: { status: 'VERIFIED' },
                },
            },
            listing: { listedByRole: 'agent', representationStatus: 'unverified' },
            actorTrust: {
                identity: { status: 'VERIFIED' },
                agent: { status: 'VERIFIED' },
                builder: { status: 'NOT_VERIFIED' },
            },
            now,
        });
        const labels = badges.map((b) => b.label);
        assert.ok(labels.includes('Property verified'));
        assert.ok(labels.includes('Location verified'));
        assert.ok(labels.includes('Agent verified'));
        assert.equal(labels.includes('Owner verified'), false);
        assert.ok(!labels.includes('Verified'));
        assert.equal(
            dashboardVerificationLabel({
                verification: { property: { status: 'PENDING' } },
            }, null, now),
            'Pending'
        );
        assert.equal(dashboardVerificationLabel({}, {}, now), 'Not verified');
        assert.equal(listingCardTrustHint({ representationStatus: 'unverified' }, now), null);
        assert.equal(listingCardTrustHint({
            verification: { representation: { status: 'VERIFIED' } },
        }, now), 'Reviewed');
    });

    it('does not show representation verified merely because a listing exists', () => {
        const badges = trustBadges({
            listing: { listedByRole: 'agent', representationStatus: 'unverified' },
            actorTrust: { agent: { status: 'VERIFIED' } },
            now,
        });
        assert.equal(badges.some((b) => b.key === 'representation'), false);
        assert.ok(badges.some((b) => b.key === 'agent'));
    });
});

describe('evidence privacy and notifications', () => {
    it('rejects public media paths and keeps evidence uid-scoped', () => {
        assert.equal(isPrivateEvidencePath('property_media/u1/photo.jpg'), false);
        assert.equal(isPrivateEvidencePath('property_documents/u1/verification/c1/deed.pdf'), true);
        assert.equal(evidenceBelongsToUid('property_documents/u1/verification/c1/deed.pdf', 'u1'), true);
        assert.equal(evidenceBelongsToUid('property_documents/u1/verification/c1/deed.pdf', 'other'), false);
        const issues = validateSubmitInput({
            type: 'PROPERTY',
            subjectId: 'p1',
            evidenceType: 'PROPERTY_DOCUMENT',
            evidence: [{ storagePath: 'property_media/u1/a.jpg' }],
            uid: 'u1',
        });
        assert.ok(issues.some((row) => /private/.test(row)));
        assert.match(buildEvidenceStoragePath('u1', 'c1', 'deed.pdf'), /property_documents\/u1\/verification\/c1/);
    });

    it('keeps notification payloads free of evidence and reviewer fields', () => {
        const payload = publicNotificationPayload({
            type: 'PROPERTY',
            status: 'VERIFIED',
            caseId: 'c1',
            subjectId: 'p1',
        });
        assert.match(payload.message, /approved/);
        assert.equal(payload.message.includes('100% trusted'), false);
        assert.equal(notificationPayloadIsPrivate(payload), false);
        assert.equal(notificationPayloadIsPrivate({ data: { reviewedByUid: 'admin', documentUrl: 'x' } }), true);
    });
});

describe('resubmission after rejection', () => {
    it('allows a new PENDING after REJECTED without treating it as overwrite', () => {
        assert.equal(canTransitionVerification('REJECTED', 'PENDING'), true);
        assert.equal(hasOpenPending([{ type: 'PROPERTY', subjectId: 'p1', status: 'REJECTED' }], 'PROPERTY', 'p1'), false);
        assert.equal(clientMaySetVerificationStatus('REJECTED', 'PENDING'), true);
    });
});
