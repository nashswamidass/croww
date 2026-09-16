import React from 'react';
import CrowwRiveView from './CrowwRiveView';
import { resolveRiveAsset } from './riveRegistry';

export { resolveRiveAsset } from './riveRegistry';

/**
 * Universal Croww Rive facade.
 *
 * Automatically delegates to CrowwRiveView.web on web and CrowwRiveView.native on iOS/Android.
 * Resolves static assets from public/rive/ (web) or bundled assets (native).
 * Falls back to CrowwRiveFallback if assets are missing, during loading, or if reduced motion is enabled.
 */
export const CrowwRive = (props) => {
    const artboard = props.artboard || props.artboardName;
    const asset = resolveRiveAsset(artboard, props.fileName);
    const resolvedProps = {
        ...props,
        artboard,
        artboardName: artboard,
        src: props.src || asset?.webSrc,
        resourceName: props.resourceName || asset?.nativeResource,
    };
    return <CrowwRiveView {...resolvedProps} />;
};

export default CrowwRive;
