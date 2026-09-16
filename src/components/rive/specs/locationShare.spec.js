/**
 * Croww Rive Specification: Exact Location Share
 * 
 * Target file: location-share.riv
 * Artboard: LocationShare
 * State Machine: LocationShareSM
 */

export const LOCATION_SHARE_RIVE_SPEC = {
    fileName: 'location-share.riv',
    artboard: 'LocationShare',
    stateMachine: 'LocationShareSM',
    inputs: {
        // Status mapping:
        // 0: idle (approximate only)
        // 1: requesting (optimistic feedback)
        // 2: pending (backend confirmed request)
        // 3: approved (owner shared exact pin)
        // 4: declined (owner declined)
        // 5: revoked (owner revoked access)
        status: { name: 'status', type: 'number', defaultValue: 0 },
        triggerRequest: { name: 'triggerRequest', type: 'trigger' },
    },
    states: ['idle', 'requesting', 'pending', 'approved', 'declined', 'revoked'],
    events: ['onRequestTriggered', 'onApprovedViewed'],
    consumers: ['PropertyLocation.js', 'ListingScreen.js'],
};
