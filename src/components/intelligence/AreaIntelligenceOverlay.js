import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrowwAreaIntelligenceIcon from '../icons/CrowwAreaIntelligenceIcon';
import PreferenceStep from './PreferenceStep';
import IntelligenceMapOverlay from './IntelligenceMapOverlay';
import LocalityDetailSheet from './LocalityDetailSheet';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { getFloatingNavbarClearance } from '../../constants/layout';

export const INTELLIGENCE_PHASES = {
    INTRO: 'INTRO',
    PREFERENCES: 'PREFERENCES',
    MAP: 'MAP',
};

export default function AreaIntelligenceOverlay({
    phase = INTELLIGENCE_PHASES.INTRO,
    stepIndex = 0,
    answers = {},
    stepOptions = [],
    scoredLocalities = [],
    selectedLocality = null,
    selectedLocalityData = null,
    onStart,
    onSkip,
    onToggleOption,
    onContinueStep,
    onBackStep,
    onResetPreferences,
    onSelectLocality,
    onCloseLocalityDetail,
    onExploreLocality,
    onClose,
}) {
    const insets = useSafeAreaInsets();

    // ─────────────────────────────────────────────────────────────
    // Phase 1: Intro Sheet floating over the map
    // ─────────────────────────────────────────────────────────────
    if (phase === INTELLIGENCE_PHASES.INTRO) {
        return (
            <View style={styles.introOverlay} pointerEvents="box-none">
                <View
                    style={[
                        styles.introSheet,
                        { paddingBottom: Math.max(insets.bottom, 12) + 84 },
                    ]}
                >
                    <View style={styles.introContent}>
                        <View style={styles.symbolWrap}>
                            <CrowwAreaIntelligenceIcon size={32} color={COLORS.accent} focused />
                        </View>

                        <Text style={styles.introTitle}>Find your best area</Text>
                        <Text style={styles.introSubtitle}>
                            Tell us what matters to you and Croww will compare localities using real area data.
                        </Text>

                        <View style={styles.highlightsContainer}>
                            <View style={styles.highlightRow}>
                                <Ionicons name="shield-checkmark" size={18} color={COLORS.accent} style={styles.highlightIcon} />
                                <Text style={styles.highlightText}>Personalized Area Score matching your budget</Text>
                            </View>
                            <View style={styles.highlightRow}>
                                <Ionicons name="train" size={18} color={COLORS.accent} style={styles.highlightIcon} />
                                <Text style={styles.highlightText}>Verified commute times & metro transit</Text>
                            </View>
                            <View style={styles.highlightRow}>
                                <Ionicons name="water" size={18} color={COLORS.accent} style={styles.highlightIcon} />
                                <Text style={styles.highlightText}>Monsoon drainage & ground-truth flood safety</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.startBtn}
                            activeOpacity={0.88}
                            onPress={onStart}
                        >
                            <Text style={styles.startBtnText}>Start</Text>
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.skipBtn}
                            activeOpacity={0.7}
                            onPress={onSkip}
                        >
                            <Text style={styles.skipBtnText}>Maybe later</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 2: Preference Wizard (5 steps)
    // ─────────────────────────────────────────────────────────────
    if (phase === INTELLIGENCE_PHASES.PREFERENCES && stepOptions[stepIndex]) {
        const currentStep = stepOptions[stepIndex];
        const stepSelected = answers[stepIndex] || [];
        const canContinue = stepSelected.length > 0;

        return (
            <View style={styles.preferencesOverlay}>
                <PreferenceStep
                    stepNumber={stepIndex + 1}
                    totalSteps={stepOptions.length}
                    title={currentStep.title}
                    subtitle={currentStep.subtitle}
                    options={currentStep.options}
                    selectedValues={stepSelected}
                    canContinue={canContinue}
                    continueLabel={stepIndex === stepOptions.length - 1 ? 'Find My Best Area' : 'Continue'}
                    isMulti={currentStep.isMulti}
                    onToggleOption={onToggleOption}
                    onContinue={onContinueStep}
                    onBack={onBackStep}
                />
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 3: Intelligent Map View
    // ─────────────────────────────────────────────────────────────
    if (phase === INTELLIGENCE_PHASES.MAP) {
        return (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
                {/* Top active control & ranked areas strip */}
                <IntelligenceMapOverlay
                    scoredLocalities={scoredLocalities}
                    selectedLocality={selectedLocality}
                    onSelectLocality={onSelectLocality}
                    onResetPreferences={onResetPreferences}
                    onClose={onClose}
                />

                {/* Floating Locality Detail Sheet when an area is selected */}
                {selectedLocality && (
                    <View
                        style={[
                            styles.detailSheetContainer,
                            { paddingBottom: getFloatingNavbarClearance(insets, 8) },
                        ]}
                        pointerEvents="box-none"
                    >
                        <LocalityDetailSheet
                            locality={selectedLocality}
                            scoreResult={selectedLocalityData?.result}
                            onExplore={onExploreLocality}
                            onClose={onCloseLocalityDetail}
                        />
                    </View>
                )}
            </View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    introOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
    },
    introSheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.sheet,
        borderTopRightRadius: BORDER_RADIUS.sheet,
        paddingHorizontal: 24,
        paddingTop: 24,
        ...SHADOWS.floating,
    },
    introContent: {
        alignItems: 'center',
    },
    symbolWrap: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: COLORS.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    introTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.4,
        marginBottom: 8,
        textAlign: 'center',
    },
    introSubtitle: {
        fontSize: FONT_SIZES.m,
        color: COLORS.secondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 12,
        marginBottom: 20,
    },
    highlightsContainer: {
        width: '100%',
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: BORDER_RADIUS.l,
        padding: 16,
        marginBottom: 24,
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
    },
    highlightIcon: {
        marginRight: 12,
    },
    highlightText: {
        fontSize: FONT_SIZES.s,
        fontWeight: '600',
        color: COLORS.primary,
        flex: 1,
    },
    startBtn: {
        width: '100%',
        height: TOUCH_TARGETS.button,
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.button,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        ...SHADOWS.medium,
    },
    startBtnText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.m,
        fontWeight: '700',
        marginRight: 8,
    },
    skipBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    skipBtnText: {
        color: COLORS.secondary,
        fontSize: FONT_SIZES.s,
        fontWeight: '600',
    },
    preferencesOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.surface,
        zIndex: 50,
    },
    detailSheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
});
