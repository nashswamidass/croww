import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRive, Alignment, Fit, Layout } from '@rive-app/react-canvas';
import CrowwRiveFallback from './CrowwRiveFallback';
import { useRiveMotion } from './RiveMotionContext';

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

const ActiveRiveCanvas = ({
    src,
    artboard,
    stateMachineName,
    inputs = {},
    fit = 'contain',
    alignment = 'center',
    autoplay = true,
    onStateChange,
    onError,
}) => {
    const { rive, RiveComponent } = useRive({
        src,
        artboard,
        stateMachines: stateMachineName,
        autoplay,
        layout: new Layout({
            fit: fitMapping[fit] || Fit.Contain,
            alignment: alignmentMapping[alignment] || Alignment.Center,
        }),
        onStateChange,
        onError,
    });

    useEffect(() => {
        if (!rive || !stateMachineName || !inputs) return;
        try {
            const smInputs = rive.stateMachineInputs(stateMachineName);
            if (!smInputs || smInputs.length === 0) return;

            Object.entries(inputs).forEach(([name, value]) => {
                if (value === undefined) return;
                const input = smInputs.find((i) => i.name === name);
                if (!input) return;

                if (typeof value === 'boolean') {
                    input.value = value;
                } else if (typeof value === 'number') {
                    input.value = value;
                } else if (value === 'trigger') {
                    input.fire();
                }
            });
        } catch (err) {
            console.warn('[CrowwRive.web] Failed to update input:', err?.message);
        }
    }, [rive, stateMachineName, inputs]);

    return <RiveComponent style={styles.riveCanvas} />;
};

/**
 * Web implementation of Croww Rive viewer using @rive-app/react-canvas.
 */
export const CrowwRiveView = ({
    src,
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
    const [hasError, setHasError] = useState(false);

    const smName = stateMachineName || (Array.isArray(stateMachines) ? stateMachines[0] : stateMachines);
    const targetArtboard = artboard || artboardName;

    // Reduced motion shortcut or missing asset
    if (isReduceMotionEnabled || !src || hasError) {
        return (
            <CrowwRiveFallback
                type={fallbackType}
                state={fallbackState}
                size={fallbackSize}
                style={style}
            />
        );
    }

    return (
        <View style={[styles.container, style]}>
            <ActiveRiveCanvas
                src={src}
                artboard={targetArtboard}
                stateMachineName={smName}
                inputs={inputs}
                fit={fit}
                alignment={alignment}
                autoplay={autoplay}
                onStateChange={onStateChange}
                onError={() => setHasError(true)}
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
    riveCanvas: {
        width: '100%',
        height: '100%',
    },
});

export default CrowwRiveView;
