/**
 * Capability helpers for the property shell.
 * Does not replace userType. Does not treat business as builder or provider as agent.
 */
import { PROPERTY_USER_ROLES } from '../domain/property';

const LISTER_ROLES = new Set(['owner', 'agent', 'builder']);

export function getPropertyRoles(user) {
    if (!user || !Array.isArray(user.roles)) return [];
    return user.roles.filter((role) => PROPERTY_USER_ROLES.includes(role));
}

export function canListProperties(user) {
    return getPropertyRoles(user).some((role) => LISTER_ROLES.has(role));
}

export function isLegacyOrganizerAccount(user) {
    return user?.userType === 'business'
        || user?.userType === 'provider'
        || user?.isBusiness === true
        || user?.isProvider === true;
}

/**
 * All primary tabs stay visible. A buyer can also become an owner;
 * hiding Post would block that. Copy on Post/Profile can still adapt.
 */
export function getShellCapabilities(user) {
    const roles = getPropertyRoles(user);
    return {
        roles,
        canExplore: true,
        canSave: true,
        canPost: true,
        canMessage: true,
        canUseProfile: true,
        isLister: canListProperties(user),
        isLegacyOrganizer: isLegacyOrganizerAccount(user),
        isAdmin: user?.userType === 'admin',
    };
}
