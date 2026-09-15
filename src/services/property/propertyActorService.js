/**
 * Additive property roles on the existing users/{uid} document.
 * Does NOT change userType (individual / business / provider / admin).
 * Does NOT grant admin. users.roles[] is not Verified Agent / Verified Builder.
 */
import { auth } from '../firebaseConfig';
import { PROPERTY_USER_ROLES, isPropertyUserRole, InventoryError } from '../../domain/property';
import { userService } from '../userService';
import { publicActorProjection } from '../../utils/propertyDetailView';

export const propertyActorService = {
    allowedRoles: PROPERTY_USER_ROLES,

    async addMyPropertyRole(role) {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('You must be signed in');
        if (!isPropertyUserRole(role) || role === 'admin') {
            throw new Error('Invalid property role');
        }
        throw new InventoryError(
            'ACTOR_NOT_PERMITTED',
            'Property roles cannot be self-granted. An admin must assign agent or builder.'
        );
    },

    /**
     * Public-safe listing actor. Role must come from listing.listedByRole, not userType.
     * Omits email, phone, KYC, admin flags.
     */
    async getPublicActor(uid) {
        if (!uid) return null;
        if (!auth.currentUser) return null;
        try {
            const user = await userService.getUserById(uid);
            return publicActorProjection(user);
        } catch (error) {
            console.warn('[propertyActorService] actor lookup failed', error?.code || error?.message);
            return null;
        }
    },
};
