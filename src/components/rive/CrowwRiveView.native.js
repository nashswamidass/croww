import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Rive, { Fit, Alignment } from 'rive-react-native';
import CrowwRiveFallback from './CrowwRiveFallback';
import { useRiveMotion } from './RiveMotionContext';

/**
 * Native implementation of Croww Rive viewer using rive-react-native.
 */
export const CrowwRiveView = ({
    resourceName,
    url,
    artboard,
    artboardName,
    stateMachineName,
    stateMachines,
    inputs = {},
    fallbackType,
    fallbackState,
    fallbackSize = 40,
    style,
    fit = 'contain',
    alignment = 'center',
    autoplay = true,
    onStateChange,
}) => {
    const { isReduceMotionEnabled } = useRiveMotion();
    const riveRef = useRef(null);
    const [hasError, setHasError] = useState(false);

    const smName = stateMachineName || (Array.isArray(stateMachines) ? stateMachines[0] : stateMachines);
    const targetArtboard = artboardName || artboard;

    // Apply state machine inputs whenever inputs prop changes
    useEffect(() => {
        if (!riveRef.current || !smName || !inputs) return;

        Object.entries(inputs).forEach(([inputName, val]) => {
            try {
                if (typeof val === 'boolean') {
                    riveRef.current.setBooleanState(smName, inputName, val);
                } else if (typeof val === 'number') {
                    riveRef.current.setNumberState(smName, inputName, val);
                } else if (val === 'trigger') {
                    riveRef.current.fireState(smName, inputName);
                }
            } catch (err) {
                console.warn(`[CrowwRive.native] Failed to set input ${inputName}:`, err?.message);
            }
        });
    }, [inputs, smName]);

    // Reduced motion or missing asset fallback
    if (isReduceMotionEnabled || (!resourceName && !url) || hasError) {
        return (
            <CrowwRiveFallback
                type={fallbackType}
                state={fallbackState}
                size={fallbackSize}
                style={style}
            />
        );
    }

    const fitMapping = {
        cover: Fit.Cover,
        contain: Fit.Contain,
        fill: Fit.Fill,
        fitWidth: Fit.FitWidth,
        fitHeight: Fit.FitHeight,
        none: Fit.None,
    };

    const alignmentMapping = {
        center: Alignment.Center,
        topLeft: Alignment.TopLeft,
        topCenter: Alignment.TopCenter,
        topRight: Alignment.TopRight,
        bottomLeft: Alignment.BottomLeft,
        bottomCenter: Alignment.BottomCenter,
        bottomRight: Alignment.BottomRight,
    };

    return (
        <View style={[styles.container, style]}>
            <Rive
                ref={riveRef}
                resourceName={resourceName}
                url={url}
                artboardName={targetArtboard}
                stateMachineName={smName}
                autoplay={autoplay}
                fit={fitMapping[fit] || Fit.Contain}
                alignment={alignmentMapping[alignment] || Alignment.Center}
                onError={() => setHasError(true)}
                onStateChanged={onStateChange}
                style={styles.riveView}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    riveView: {
        width: '100%',
        height: '100%',
    },
});

export default CrowwRiveView;
