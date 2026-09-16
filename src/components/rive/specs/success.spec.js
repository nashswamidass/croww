/**
 * Croww Rive Specification: Contextual Success Feedback
 * 
 * Target file: success.riv
 * Artboard: SuccessBadge
 * State Machine: SuccessSM
 */

export const SUCCESS_RIVE_SPEC = {
    fileName: 'success.riv',
    artboard: 'SuccessBadge',
    stateMachine: 'SuccessSM',
    inputs: {
        triggerSuccess: { name: 'triggerSuccess', type: 'trigger' },
        dismiss: { name: 'dismiss', type: 'trigger' },
    },
    states: ['idle', 'burst', 'checkmark', 'settle'],
    events: ['onAnimationComplete'],
    consumers: ['SaveButton.js', 'SubmitVerificationScreen.js', 'PostListingScreen.js'],
};
