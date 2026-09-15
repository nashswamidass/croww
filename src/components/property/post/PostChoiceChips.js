import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Typography from '../../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';

const PostChoiceChips = ({
    options,
    value,
    onChange,
    accessibilityLabel,
    wrap = true,
}) => (
    <View
        style={[styles.row, wrap && styles.wrap]}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
    >
        {options.map((option) => {
            const selected = value === option.value;
            const disabled = option.disabled;
            return (
                <TouchableOpacity
                    key={option.value}
                    style={[
                        styles.chip,
                        selected && styles.chipSelected,
                        disabled && styles.chipDisabled,
                    ]}
                    onPress={() => {
                        if (!disabled) onChange(option.value);
                    }}
                    disabled={disabled}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !!disabled }}
                    accessibilityLabel={option.accessibilityLabel || option.label}
                >
                    <Typography
                        variant="bodyMedium"
                        style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                        ]}
                    >
                        {option.label}
                    </Typography>
                    {option.hint ? (
                        <Typography variant="caption" style={styles.hint}>
                            {option.hint}
                        </Typography>
                    ) : null}
                </TouchableOpacity>
            );
        })}
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: SPACING.s,
        marginBottom: SPACING.m,
    },
    wrap: {
        flexWrap: 'wrap',
    },
    chip: {
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.l,
        paddingVertical: 14,
        minWidth: 100,
    },
    chipSelected: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accentMuted,
    },
    chipDisabled: {
        opacity: 0.45,
    },
    chipText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    hint: {
        color: COLORS.secondary,
        marginTop: 4,
        maxWidth: 220,
    },
});

export default PostChoiceChips;
