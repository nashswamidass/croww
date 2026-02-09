import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const GenderPreferenceSelector = ({ value, onChange }) => {
    const options = [
        { value: 'any', label: 'Any', icon: '👥' },
        { value: 'male', label: 'Male', icon: '👨' },
        { value: 'female', label: 'Female', icon: '👩' },
        { value: 'non-binary', label: 'Non-binary', icon: '🌈' }
    ];

    return (
        <View style={styles.container}>
            <Typography variant="body" style={styles.label}>
                Gender Preference
            </Typography>
            <Typography variant="caption" style={styles.subtitle}>
                Who would you like to join your group?
            </Typography>

            <View style={styles.optionsContainer}>
                {options.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        style={[
                            styles.option,
                            value === option.value && styles.optionSelected
                        ]}
                        onPress={() => onChange(option.value)}
                        activeOpacity={0.7}
                    >
                        <Typography variant="h3" style={styles.icon}>
                            {option.icon}
                        </Typography>
                        <Typography
                            variant="small"
                            style={[
                                styles.optionText,
                                value === option.value && styles.optionTextSelected
                            ]}
                        >
                            {option.label}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.l,
    },
    label: {
        fontWeight: '600',
        marginBottom: SPACING.xs,
    },
    subtitle: {
        color: COLORS.secondary,
        marginBottom: SPACING.m,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.m,
    },
    option: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: COLORS.surface,
        borderWidth: 2,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionSelected: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '10',
    },
    icon: {
        marginBottom: SPACING.xs,
    },
    optionText: {
        color: COLORS.secondary,
    },
    optionTextSelected: {
        color: COLORS.accent,
        fontWeight: '600',
    },
});

export default GenderPreferenceSelector;
