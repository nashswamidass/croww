import React from 'react';
import { View, StyleSheet } from 'react-native';
import Typography from '../../Typography';
import { COLORS, SPACING } from '../../../constants/theme';

const PostProgress = ({ stepIndex, stepCount, label }) => (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`Step ${stepIndex + 1} of ${stepCount}`}>
        <Typography variant="caption" style={styles.label}>
            {label || `Step ${stepIndex + 1} of ${stepCount}`}
        </Typography>
        <View style={styles.track}>
            {Array.from({ length: stepCount }).map((_, index) => (
                <View
                    key={index}
                    style={[
                        styles.dot,
                        index <= stepIndex ? styles.dotActive : styles.dotIdle,
                    ]}
                />
            ))}
        </View>
    </View>
);

const styles = StyleSheet.create({
    wrap: {
        marginBottom: SPACING.m,
    },
    label: {
        color: COLORS.secondary,
        marginBottom: SPACING.s,
    },
    track: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    dotActive: {
        backgroundColor: COLORS.accent,
    },
    dotIdle: {
        backgroundColor: COLORS.border,
    },
});

export default PostProgress;
