/**
 * Highest-risk Firestore rules matrix.
 *
 * These tests document expected allow/deny outcomes. They run as executable
 * assertions against helper predicates in-repo. Live emulator evaluation is
 * optional: `firebase emulators:exec --project croww-demo --only firestore`.
 *
 * This file does not contact production.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clientMaySetListingStatus } from '../src/domain/property/actorPolicy.ts';
import { clientMaySetVerificationStatus } from '../src/domain/verification/transitions.ts';
import { clientMaySetSpatialProcessing } from '../src/domain/spatial/transitions.ts';
import {
    clientMayWriteUserField,
    clientMaySetUserType,
    clientMayCreateUserType,
    clientMaySetVerificationDataStatus,
} from '../src/domain/verification/kycAuthority.ts';

describe('rules matrix (domain predicates matching firestore.rules)', () => {
    it('CLIENT cannot self-publish, self-verify, or mark spatial READY', () => {
        assert.equal(clientMaySetListingStatus('DRAFT', 'PUBLISHED'), false);
        assert.equal(clientMaySetVerificationStatus('NOT_VERIFIED', 'VERIFIED'), false);
        assert.equal(clientMaySetSpatialProcessing('PROCESSING', 'READY'), false);
    });

    it('CLIENT cannot self-assert identity KYC or escalate to admin', () => {
        assert.equal(clientMayWriteUserField('aadhaarVerified'), false);
        assert.equal(clientMayWriteUserField('trust'), false);
        assert.equal(clientMayWriteUserField('kycDetails'), false);
        assert.equal(clientMayWriteUserField('userType'), false);
        assert.equal(clientMaySetUserType('admin', 'individual'), false);
        assert.equal(clientMaySetUserType('business', 'individual'), false);
        assert.equal(clientMayCreateUserType('admin'), false);
        assert.equal(clientMayCreateUserType('individual'), true);
        assert.equal(clientMaySetVerificationDataStatus('approved'), false);
        assert.equal(clientMaySetVerificationDataStatus('pending'), true);
        assert.equal(clientMayWriteUserField('name'), true);
        assert.equal(clientMayWriteUserField('pushToken'), true);
    });

    it('OWNER may keep drafts and submit pending verification', () => {
        assert.equal(clientMaySetListingStatus('DRAFT', 'DRAFT'), true);
        assert.equal(clientMaySetVerificationStatus('NOT_VERIFIED', 'PENDING'), true);
        assert.equal(clientMaySetSpatialProcessing('UPLOADING', 'PROCESSING'), true);
    });
});
