import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { SCORE_DIMENSION_IDS, SCORE_DIMENSION_LABELS, defaultWeights } from '../../domain/areaScore';

const AreaScorePriorityEditor = ({ weights, onChange, onReset }) => {
    const [open, setOpen] = useState(false);
    const current = weights || defaultWeights();

    const bump = (id, delta) => {
        const next = Math.max(0, Math.min(40, (current[id] || 0) + delta));
        onChange({ ...current, [id]: next });
    };

    return (
        <View style={styles.wrap}>
            <TouchableOpacity
                onPress={() => setOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={open ? 'Hide priority editor' : 'Adjust what matters most'}
                style={styles.toggle}
            >
                <Typography variant="caption" style={styles.toggleText}>
                    {open ? 'Hide priorities' : 'What matters most'}
                </Typography>
            </TouchableOpacity>
            {open ? (
                <View>
                    <Typography variant="caption" style={styles.hint}>
                        These priorities are private. They change your Area Score, not the public locality evidence.
                    </Typography>
                    {SCORE_DIMENSION_IDS.map((id) => (
                        <View key={id} style={styles.row} accessible accessibilityLabel={`${SCORE_DIMENSION_LABELS[id]} priority ${current[id] || 0}`}>
                            <Typography variant="caption" style={styles.label}>{SCORE_DIMENSION_LABELS[id]}</Typography>
                            <View style={styles.stepper}>
                                <TouchableOpacity
                                    onPress={() => bump(id, -2)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Decrease ${SCORE_DIMENSION_LABELS[id]}`}
                                    style={styles.stepBtn}
                                >
                                    <Typography variant="h3">−</Typography>
                                </TouchableOpacity>
                                <Typography variant="body" style={styles.value}>{current[id] || 0}</Typography>
                                <TouchableOpacity
                                    onPress={() => bump(id, 2)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Increase ${SCORE_DIMENSION_LABELS[id]}`}
                                    style={styles.stepBtn}
                                >
                                    <Typography variant="h3">+</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    <TouchableOpacity
                        onPress={onReset}
                        accessibilityRole="button"
                        accessibilityLabel="Reset to default priorities"
                        style={styles.reset}
                    >
                        <Typography variant="caption" style={styles.resetText}>Reset to defaults</Typography>
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        marginTop: SPACING.m,
    },
    toggle: {
        minHeight: 44,
        justifyContent: 'center',
    },
    toggleText: {
        color: COLORS.accent,
        textTransform: 'none',
    },
    hint: {
        color: COLORS.secondary,
        textTransform: 'none',
        marginBottom: SPACING.s,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.s,
        gap: SPACING.s,
    },
    label: {
        flex: 1,
        color: COLORS.primary,
        textTransform: 'none',
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    stepBtn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    value: {
        minWidth: 28,
        textAlign: 'center',
    },
    reset: {
        minHeight: 44,
        justifyContent: 'center',
        marginTop: SPACING.s,
    },
    resetText: {
        color: COLORS.secondary,
        textTransform: 'none',
    },
});

export default AreaScorePriorityEditor;
