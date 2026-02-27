import React from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

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
                style={[styles.input, props.multiline && { height: 'auto', minHeight: 48 }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.secondary}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                {...props}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.m,
    },
    label: {
        marginBottom: SPACING.s,
        marginLeft: SPACING.xs,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        fontSize: FONT_SIZES.m,
        color: COLORS.primary,
        backgroundColor: COLORS.surfaceHighlight,
    },
});

export default NotionInput;
