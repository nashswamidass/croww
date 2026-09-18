/**
 * Shared layout constants and safe clearance calculations.
 * Ensures floating UI elements (property cards, intelligence sheets, carousels)
 * never collide with or get obscured by the floating black pill navigation bar.
 */

export const FLOATING_NAVBAR_HEIGHT = 64;
export const FLOATING_NAVBAR_BASE_MARGIN = 12;
export const FLOATING_NAVBAR_GAP = 12;

/**
 * Returns the bottom margin of the floating navbar based on device safe area insets.
 */
export function getFloatingNavbarBottom(insets) {
    return Math.max(insets?.bottom || 0, FLOATING_NAVBAR_BASE_MARGIN);
}

/**
 * Returns the required bottom clearance so that content floating above
 * the navigation bar clears it completely with a comfortable visual gap.
 */
export function getFloatingNavbarClearance(insets, extraGap = FLOATING_NAVBAR_GAP) {
    return getFloatingNavbarBottom(insets) + FLOATING_NAVBAR_HEIGHT + extraGap;
}
