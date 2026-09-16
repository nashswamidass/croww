/**
 * Croww Rive Specification: Post Listing Wizard
 * 
 * Target file: post-wizard.riv
 * Artboard: PostWizard
 * State Machine: PostWizardSM
 */

export const POST_WIZARD_RIVE_SPEC = {
    fileName: 'post-wizard.riv',
    artboard: 'PostWizard',
    stateMachine: 'PostWizardSM',
    inputs: {
        step: { name: 'step', type: 'number', defaultValue: 1 }, // 1..4
        isSubmitting: { name: 'isSubmitting', type: 'boolean', defaultValue: false },
        isSuccess: { name: 'isSuccess', type: 'boolean', defaultValue: false },
        isFailed: { name: 'isFailed', type: 'boolean', defaultValue: false },
    },
    states: ['step1', 'step2', 'step3', 'step4', 'submitting', 'success', 'failed'],
    events: ['onStepChanged', 'onPostComplete'],
    consumers: ['PostProgress.js', 'PostListingScreen.js'],
};
