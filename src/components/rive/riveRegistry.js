/**
 * Canonical registry for Croww Rive Artboard-to-Asset resolution.
 * Pure JavaScript module without JSX for universal client and test execution.
 */

export const ARTBOARD_TO_FILE = {
    CrowwBrand: 'croww-logo.riv',
    SaveBookmark: 'save.riv',
    LocationShare: 'location-share.riv',
    PostWizard: 'post-wizard.riv',
    EmptyDiscovery: 'empty-states.riv',
    EmptySaved: 'empty-states.riv',
    EmptyMessages: 'empty-states.riv',
    SuccessBadge: 'success.riv',
};

export const resolveRiveAsset = (artboardName, fileName) => {
    const file = fileName || (artboardName ? ARTBOARD_TO_FILE[artboardName] : null);
    if (!file) return null;
    return {
        fileName: file,
        webSrc: `/rive/${file}`,
        nativeResource: file.replace('.riv', '').replace(/-/g, '_'),
    };
};
