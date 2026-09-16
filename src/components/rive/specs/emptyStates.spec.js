/**
 * Croww Rive Specification: Empty Discovery & Inbox States
 * 
 * Target file: empty-states.riv
 * Artboards: EmptyDiscovery, EmptySaved, EmptyMessages
 * State Machine: EmptySM
 */

export const EMPTY_STATES_RIVE_SPEC = {
    fileName: 'empty-states.riv',
    artboards: {
        discovery: 'EmptyDiscovery',
        saved: 'EmptySaved',
        messages: 'EmptyMessages',
    },
    stateMachine: 'EmptySM',
    inputs: {
        isActive: { name: 'isActive', type: 'boolean', defaultValue: true },
        triggerRefetch: { name: 'triggerRefetch', type: 'trigger' },
    },
    states: ['idle', 'ambientPulse', 'refresh'],
    events: ['onExploreTapped', 'onActionTriggered'],
    consumers: ['ExploreScreen.js', 'SavedScreen.js', 'ChatListScreen.js'],
};
