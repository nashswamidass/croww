import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/theme';

/**
 * Optimistic UI is forbidden: icon flips only after the write succeeds.
 */
const SaveButton = ({
    saved,
    onToggle,
    disabled,
    accessibilityLabel,
}) => {
    const [busy, setBusy] = useState(false);
    const label = accessibilityLabel || (saved ? 'Saved. Tap to remove' : 'Save');

    const press = async () => {
        if (busy || disabled || !onToggle) return;
        setBusy(true);
        try {
            await onToggle();
        } finally {
            setBusy(false);
        }
    };

    return (
        <TouchableOpacity
            onPress={press}
            disabled={busy || disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: !!saved, busy, disabled: !!(busy || disabled) }}
            accessibilityLabel={label}
            style={styles.btn}
        >
            {busy ? (
                <ActivityIndicator color={COLORS.accent} size="small" />
            ) : (
                <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={disabled ? COLORS.secondary : COLORS.primary}
                />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    btn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default SaveButton;
