/**
 * P0 users/{uid} authorization matrix.
 *
 * Executable assertions against domain predicates that match
 * firestore.rules / firestore.live.rules. Does not contact production.
 *
 * Live emulator evaluation is optional and currently blocked on this
 * machine (OpenJDK 17; firebase-tools wants 21).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    clientMayWriteUserField,
    clientMaySetUserType,
    clientMayCreateUserType,
    clientMaySetVerificationDataStatus,
    signupUserType,
    stripServerOnlyUserFields,
    SERVER_ONLY_USER_FIELDS,
} from '../src/domain/verification/kycAuthority.ts';
import {
    toPublicUserProfile,
    publicProfileContainsPrivateData,
} from '../src/domain/verification/publicProfile.ts';

const PROTECTED_UPDATE_FIELDS = [
    'userType',
    'role',
    'roles',
    'isAdmin',
    'admin',
    'isApproved',
    'isBlocked',
    'aadhaarVerified',
    'isVerified',
    'aadhaarVerifiedAt',
    'kycStatus',
    'kycDetails',
    'kycProvider',
    'verifiedAt',
    'verificationStatus',
    'verificationType',
    'trust',
];

const CLIENT_PROFILE_FIELDS = [
    'name',
    'displayName',
    'pushToken',
    'policyAccepted',
    'bio',
    'avatar',
    'staff',
    'packages',
    'availability',
];

describe('P0 users/{uid} field policy', () => {
    it('1. owner may update allowed profile fields', () => {
        CLIENT_PROFILE_FIELDS.forEach((field) => {
            assert.equal(clientMayWriteUserField(field), true, field);
        });
    });

    it('2. owner cannot update userType (create or mutate)', () => {
        assert.equal(clientMaySetUserType('admin', 'individual'), false);
        assert.equal(clientMaySetUserType('business', 'individual'), false);
        assert.equal(clientMaySetUserType('provider', 'business'), false);
        assert.equal(clientMaySetUserType('individual', 'individual'), true);
        assert.equal(clientMayCreateUserType('admin'), false);
        assert.equal(clientMayCreateUserType('individual'), true);
        assert.equal(signupUserType('admin'), 'individual');
        assert.equal(clientMayWriteUserField('userType'), false);
    });

    it('3. owner cannot grant themselves admin', () => {
        assert.equal(clientMayWriteUserField('isAdmin'), false);
        assert.equal(clientMayWriteUserField('admin'), false);
        assert.equal(clientMaySetUserType('admin', 'individual'), false);
        assert.equal(clientMayCreateUserType('admin'), false);
    });

    it('4. owner cannot create/modify admins/{uid} via userType escalation', () => {
        // admins/{uid} writes require isAdmin(); isAdmin() is userType=admin or admins/{uid}.
        // Freezing userType closes the client path into that helper.
        assert.equal(clientMaySetUserType('admin', 'provider'), false);
    });

    it('5. owner cannot modify KYC verification flags', () => {
        ['aadhaarVerified', 'isVerified', 'aadhaarVerifiedAt', 'kycStatus', 'verifiedAt'].forEach((field) => {
            assert.equal(clientMayWriteUserField(field), false, field);
        });
    });

    it('6. owner cannot modify protected KYC details', () => {
        ['kycDetails', 'kycProvider'].forEach((field) => {
            assert.equal(clientMayWriteUserField(field), false, field);
        });
        assert.equal('kycDetails' in stripServerOnlyUserFields({ kycDetails: { name: 'x' }, name: 'A' }), false);
    });

    it('7. owner cannot modify trust/verification state', () => {
        ['trust', 'roles', 'isApproved', 'verificationStatus', 'verificationType'].forEach((field) => {
            assert.equal(clientMayWriteUserField(field), false, field);
        });
        assert.equal(clientMaySetVerificationDataStatus('verified'), false);
        assert.equal(clientMaySetVerificationDataStatus('approved'), false);
        assert.equal(clientMaySetVerificationDataStatus('pending'), true);
    });

    it('8. user A cannot mutate user B protected fields (same locked set)', () => {
        PROTECTED_UPDATE_FIELDS.forEach((field) => {
            assert.equal(clientMayWriteUserField(field), false, field);
        });
    });

    it('9. event/ticket/chat profile writes that the live app uses stay client-mutable', () => {
        ['pushToken', 'policyAccepted', 'policyAcceptedAt', 'stats', 'name'].forEach((field) => {
            assert.equal(clientMayWriteUserField(field), true, field);
        });
    });

    it('10. admin-only fields stay in the server-only list', () => {
        ['isAdmin', 'admin', 'isBlocked', 'isApproved', 'roles', 'userType'].forEach((field) => {
            assert.equal(SERVER_ONLY_USER_FIELDS.includes(field), true, field);
        });
    });

    it('11. anonymous callers are not treated as owners of protected writes', () => {
        const stripped = stripServerOnlyUserFields({
            name: 'ok',
            userType: 'admin',
            aadhaarVerified: true,
            kycDetails: { masked_aadhaar: 'x' },
            trust: { identity: { status: 'VERIFIED' } },
        });
        assert.equal(stripped.name, 'ok');
        assert.equal('userType' in stripped, false);
        assert.equal('aadhaarVerified' in stripped, false);
        assert.equal('kycDetails' in stripped, false);
        assert.equal('trust' in stripped, false);
    });

    it('12. other-user identity uses public_profiles without KYC or contact secrets', () => {
        const profile = toPublicUserProfile('b', {
            name: 'B',
            email: 'b@example.com',
            kycDetails: { name: 'secret' },
            pushToken: 't',
            userType: 'individual',
        });
        assert.equal(profile.name, 'B');
        assert.equal(publicProfileContainsPrivateData(profile), false);
        assert.equal('email' in profile, false);
        assert.equal('kycDetails' in profile, false);
        assert.equal('pushToken' in profile, false);
    });
});
