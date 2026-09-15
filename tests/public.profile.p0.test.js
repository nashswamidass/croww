/**
 * Public profile projection tests. Does not contact production.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    toPublicUserProfile,
    publicProfileContainsPrivateData,
    publicProfileUserType,
} from '../src/domain/verification/publicProfile.ts';

describe('public_profiles projection', () => {
    it('keeps display fields and drops KYC, email, phone, pushToken, admin, trust', () => {
        const profile = toPublicUserProfile('u1', {
            name: 'Ada',
            avatar: 'https://example/a.png',
            email: 'secret@example.com',
            phone: '999',
            pushToken: 'tok',
            userType: 'provider',
            kycDetails: { masked_aadhaar: 'x', dob: 'y' },
            aadhaarVerified: true,
            isVerified: true,
            verificationData: { status: 'pending' },
            trust: { identity: { status: 'VERIFIED' } },
            roles: ['agent'],
            isAdmin: true,
            bio: 'DJ',
            packages: [{ id: 'p1' }],
            coordinates: { latitude: 12.9, longitude: 77.6 },
        });
        assert.equal(profile.name, 'Ada');
        assert.equal(profile.userType, 'provider');
        assert.equal(profile.bio, 'DJ');
        assert.equal(Array.isArray(profile.packages), true);
        assert.equal(publicProfileContainsPrivateData(profile), false);
        assert.equal('email' in profile, false);
        assert.equal('phone' in profile, false);
        assert.equal('kycDetails' in profile, false);
        assert.equal('aadhaarVerified' in profile, false);
        assert.equal('isVerified' in profile, false);
        assert.equal('pushToken' in profile, false);
        assert.equal('trust' in profile, false);
        assert.equal('roles' in profile, false);
        assert.equal('isAdmin' in profile, false);
        assert.equal('verificationData' in profile, false);
    });

    it('does not publish admin as a public userType', () => {
        assert.equal(publicProfileUserType('admin'), 'individual');
        const profile = toPublicUserProfile('u2', { name: 'Ops', userType: 'admin', role: 'admin' });
        assert.equal(profile.userType, 'individual');
        assert.equal(profile.role, 'individual');
    });
});
