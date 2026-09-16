/**
 * Croww Rive Specification: Brand Logo
 * 
 * Target file: croww-logo.riv
 * Artboard: CrowwBrand
 * State Machine: BrandSM
 */

export const BRAND_RIVE_SPEC = {
    fileName: 'croww-logo.riv',
    artboard: 'CrowwBrand',
    stateMachine: 'BrandSM',
    inputs: {
        triggerHover: { name: 'triggerHover', type: 'trigger' },
        triggerAuth: { name: 'triggerAuth', type: 'trigger' },
        isLoading: { name: 'isLoading', type: 'boolean', defaultValue: false },
    },
    states: ['idle', 'hovering', 'authTransition', 'loadingLoop'],
    events: ['onLogoTapped', 'onAuthComplete'],
    consumers: ['LoginScreen.js', 'SignupScreen.js', 'ProfileScreen.js'],
};
