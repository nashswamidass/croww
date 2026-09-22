import React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';

export default function PreferenceStep({
    stepNumber,
    totalSteps,
    title,
    subtitle,
    options = [],
    selectedValues = [],
    onToggleOption,
    onContinue,
    canContinue = true,
    continueLabel = 'Continue',
    customContent = null,
}) {
    const insets = useSafeAreaInsets();
    return (
        <View style={styles.container}>
            {/* Brand Header */}
            <View style={styles.brandRow}>
                <Image
                    source={require('../../../assets/croww-logo.png')}
                    style={styles.brandLogo}
                    resizeMode="contain"
                    accessibilityLabel="Croww"
                />
                <View style={styles.brandDivider} />
                <Text style={styles.brandTag}>AREAS</Text>
            </View>

            {/* Step indicator header */}
            <View style={styles.progressRow}>
                <Text style={styles.stepText}>
                    STEP {stepNumber} OF {totalSteps}
                </Text>
                <View style={styles.progressBarBg}>
                    <View
                        style={[
                            styles.progressBarFill,
                            { width: `${(stepNumber / totalSteps) * 100}%` },
                        ]}
                    />
                </View>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

            {/* Custom content (like Google Places search for work location) */}
            {customContent}

            {/* Option Cards */}
            <ScrollView
                style={styles.optionsList}
                contentContainerStyle={styles.optionsContent}
                showsVerticalScrollIndicator={false}
            >
                {options.map((option) => {
                    const isSelected = selectedValues.includes(option.id);
                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.optionCard,
                                isSelected && styles.optionCardSelected,
                            ]}
                            activeOpacity={0.8}
                            onPress={() => onToggleOption(option.id)}
                        >
                            <View style={styles.optionLeft}>
                                {option.icon && (
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            isSelected && styles.iconContainerSelected,
                                        ]}
                                    >
                                        <Ionicons
                                            name={option.icon}
                                            size={20}
                                            color={isSelected ? COLORS.primary : COLORS.secondary}
                                        />
                                    </View>
                                )}
                                <View style={styles.optionTextContainer}>
                                    <Text
                                        style={[
                                            styles.optionLabel,
                                            isSelected && styles.optionLabelSelected,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    {option.description ? (
                                        <Text style={styles.optionDescription}>
                                            {option.description}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.selectionIndicator,
                                    isSelected && styles.selectionIndicatorSelected,
                                ]}
                            >
                                {isSelected && (
                                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Continue CTA */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 84 }]}>
                <TouchableOpacity
                    style={[
                        styles.continueBtn,
                        !canContinue && styles.continueBtnDisabled,
                    ]}
                    activeOpacity={0.88}
                    disabled={!canContinue}
                    onPress={onContinue}
                >
                    <Text
                        style={[
                            styles.continueBtnText,
                            !canContinue && styles.continueBtnTextDisabled,
                        ]}
                    >
                        {continueLabel}
                    </Text>
                    <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={canContinue ? '#FFFFFF' : COLORS.tertiary}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: 16,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    brandLogo: {
        width: 64,
        height: 20,
    },
    brandDivider: {
        width: 1,
        height: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
        marginHorizontal: 8,
    },
    brandTag: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        color: '#6B7280',
    },
    progressRow: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    stepText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.accent,
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    progressBarBg: {
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.accent,
        borderRadius: 2,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.primary,
        paddingHorizontal: 20,
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: FONT_SIZES.m,
        color: COLORS.secondary,
        paddingHorizontal: 20,
        marginBottom: 16,
        lineHeight: 20,
    },
    optionsList: {
        flex: 1,
    },
    optionsContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 10,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        padding: 16,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        minHeight: TOUCH_TARGETS.buttonLarge,
        ...SHADOWS.subtle,
    },
    optionCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surfaceHighlight,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    iconContainerSelected: {
        backgroundColor: COLORS.surfaceHighlight,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionLabel: {
        fontSize: FONT_SIZES.m,
        fontWeight: '600',
        color: COLORS.primary,
    },
    optionLabelSelected: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    optionDescription: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.secondary,
        marginTop: 2,
    },
    selectionIndicator: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: COLORS.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    selectionIndicatorSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 88,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderSubtle,
    },
    continueBtn: {
        height: TOUCH_TARGETS.button,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.button,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.medium,
    },
    continueBtnDisabled: {
        backgroundColor: COLORS.surfaceHighlight,
        shadowOpacity: 0,
        elevation: 0,
    },
    continueBtnText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.m,
        fontWeight: '700',
        marginRight: 8,
    },
    continueBtnTextDisabled: {
        color: COLORS.tertiary,
    },
});
