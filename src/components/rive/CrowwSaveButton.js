import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import CrowwRive from './CrowwRive';
import { SAVE_RIVE_SPEC } from './specs/save.spec';
import { COLORS, TOUCH_TARGETS } from '../../constants/theme';

/**
 * Priority #2: Interactive Save Property Button
 * 
 * State Machine (SaveSM):
 *   idle -> unsaved -> pressed -> saved
 * 
 * React state remains authoritative. Rive serves as the tactile visual state layer.
 */
export const CrowwSaveButton = ({
    saved = false,
    onToggle,
    disabled = false,
    size = 44,
    accessibilityLabel,
    style,
}) => {
    const [busy, setBusy] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    const label = accessibilityLabel || (saved ? 'Saved. Tap to remove' : 'Save property');

    const handlePress = async () => {
        if (busy || disabled || !onToggle) return;
        setBusy(true);
        setIsPressed(true);

        try {
            await onToggle();
        } catch (err) {
            console.warn('[CrowwSaveButton] Toggle failed, reverting visual state:', err?.message);
        } finally {
            setBusy(false);
            setTimeout(() => setIsPressed(false), 250);
        }
    };

    const inputs = {
        isSaved: Boolean(saved),
        onPress: isPressed ? 'trigger' : undefined,
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={busy || disabled}
            activeOpacity={0.8}
            hitSlop={TOUCH_TARGETS.hitSlop}
            accessibilityRole="button"
            accessibilityState={{ selected: !!saved, busy, disabled: !!(busy || disabled) }}
            accessibilityLabel={label}
            style={[styles.btn, { minWidth: size, minHeight: size }, style]}
        >
            {busy ? (
                <ActivityIndicator color={COLORS.accent} size="small" />
            ) : (
                <CrowwRive
                    artboard={SAVE_RIVE_SPEC.artboard}
                    artboardName={SAVE_RIVE_SPEC.artboard}
                    stateMachineName={SAVE_RIVE_SPEC.stateMachine}
                    inputs={inputs}
                    fallbackType="save"
                    fallbackState={{ isSaved: saved, isPressed }}
                    fallbackSize={size}
                    style={{ width: size, height: size }}
                />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    btn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CrowwSaveButton;
