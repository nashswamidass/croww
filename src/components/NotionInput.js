import React from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, TOUCH_TARGETS } from '../constants/theme';

const NotionInput = ({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    style,
    keyboardType = 'default',
    ...props
}) => {
    return (
        <View style={[styles.container, style]}>
            {label && (
                <Typography variant="caption" style={styles.label}>
                    {label}
                </Typography>
            )}
            <TextInput
                style={[styles.input, props.multiline && { height: 'auto', minHeight: 72, paddingTop: SPACING.m }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.tertiary}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                {...props}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.l,
    },
    label: {
        marginBottom: SPACING.xs,
        marginLeft: 2,
        fontWeight: '600',
        color: COLORS.primary,
        fontSize: 14,
    },
    input: {
        height: TOUCH_TARGETS.button,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.input,
        paddingHorizontal: SPACING.l,
        fontSize: FONT_SIZES.m,
        color: COLORS.primary,
        backgroundColor: COLORS.surface,
    },
});

export default NotionInput;
