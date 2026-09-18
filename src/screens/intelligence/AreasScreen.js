import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrowwAreaIntelligenceIcon from '../../components/icons/CrowwAreaIntelligenceIcon';
import PropertyMap from '../../components/property/PropertyMap';
import PreferenceStep from '../../components/intelligence/PreferenceStep';
import IntelligenceMapOverlay from '../../components/intelligence/IntelligenceMapOverlay';
import LocalityDetailSheet from '../../components/intelligence/LocalityDetailSheet';
import { localityService } from '../../services/property/localityService';
import { areaScoreService } from '../../services/intelligence/areaScoreService';
import { areaScorePreferenceService } from '../../services/intelligence/areaScorePreferenceService';
import { useExplore } from '../../context/ExploreContext';
import { TABS } from '../../navigation/routeNames';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';

const PHASES = {
    INTRO: 'INTRO',
    PREFERENCES: 'PREFERENCES',
    MAP: 'MAP',
};

const STEP_OPTIONS = [
    // Step 1: What are you looking for?
    {
        title: 'What are you looking for?',
        subtitle: 'Select the home format that matches your stay.',
        isMulti: false,
        options: [
            { id: 'apartment', label: 'Entire Apartment', description: '1BHK, 2BHK, or 3BHK for complete privacy', icon: 'home-outline' },
            { id: 'private_room', label: 'Private Room', description: 'Own bedroom with shared or attached washroom', icon: 'bed-outline' },
            { id: 'coliving', label: 'Coliving Space', description: 'Fully managed with food, WiFi, and housekeeping', icon: 'people-outline' },
            { id: 'independent', label: 'Independent House / Villa', description: 'Spacious independent home or floor', icon: 'business-outline' },
        ],
    },
    // Step 2: Monthly Budget
    {
        title: 'What is your budget?',
        subtitle: 'Target monthly rent excluding deposit.',
        isMulti: false,
        options: [
            { id: 'under_12k', label: 'Under ₹12,000 / month', description: 'Budget & shared stays', icon: 'wallet-outline' },
            { id: '12k_20k', label: '₹12,000 – ₹20,000 / month', description: 'Standard 1BHK / premium private rooms', icon: 'cash-outline' },
            { id: '20k_35k', label: '₹20,000 – ₹35,000 / month', description: '2BHK / gated communities', icon: 'trending-up-outline' },
            { id: 'above_35k', label: '₹35,000+ / month', description: 'Luxury 3BHK & premium villas', icon: 'diamond-outline' },
        ],
    },
    // Step 3: Work / Study corridor
    {
        title: 'Where do you commute to?',
        subtitle: 'Croww optimizes travel times and metro access to your primary hub.',
        isMulti: false,
        options: [
            { id: 'omr', label: 'OMR / IT Corridor', description: 'Tidel Park, SRP Tools, Sholinganallur, Siruseri', icon: 'laptop-outline' },
            { id: 'guindy', label: 'Guindy / Olympia Tech Park', description: 'Ekkattuthangal, Kathipara, Ashok Nagar', icon: 'briefcase-outline' },
            { id: 'central', label: 'Central / Nungambakkam', description: 'T. Nagar, Anna Salai, Alwarpet, Mylapore', icon: 'business-outline' },
            { id: 'annangar', label: 'Anna Nagar / Ambattur', description: 'Ambattur Estate, Mogappair, Koyambedu', icon: 'location-outline' },
            { id: 'remote', label: 'Fully Remote / Work from Home', description: 'Prioritize quiet residential vibe & lifestyle', icon: 'wifi-outline' },
        ],
    },
    // Step 4: Primary commute mode
    {
        title: 'How do you commute?',
        subtitle: 'Helps us weigh metro proximity vs road corridor connectivity.',
        isMulti: false,
        options: [
            { id: 'metro', label: 'Metro Rail', description: 'Station proximity within 1.5 km is critical', icon: 'train-outline' },
            { id: 'two_wheeler', label: 'Bike / Two Wheeler', description: 'Quick arterial roads and bypass connectivity', icon: 'bicycle-outline' },
            { id: 'car_cab', label: 'Car / Cab / Auto', description: 'Smooth main road corridors and parking', icon: 'car-outline' },
            { id: 'walking', label: 'Walk / Cycle', description: 'Self-sufficient walkable neighborhoods', icon: 'walk-outline' },
        ],
    },
    // Step 5: Priorities
    {
        title: 'What matters most to you?',
        subtitle: 'Pick up to 3 factors that Croww will heavily weigh.',
        isMulti: true,
        options: [
            { id: 'flood', label: 'Zero Flood Risk', description: 'High ground, well-drained during monsoon', icon: 'shield-checkmark-outline' },
            { id: 'transport', label: 'Metro & Public Transit', description: 'Walking distance to stations and bus hubs', icon: 'train-outline' },
            { id: 'affordability', label: 'Best Rental Value', description: 'High space-to-cost ratio', icon: 'pricetag-outline' },
            { id: 'schools', label: 'Schools & Family Friendly', description: 'Top education institutes & green parks', icon: 'school-outline' },
            { id: 'healthcare', label: 'Healthcare & Hospitals', description: 'Multi-specialty emergency care nearby', icon: 'medkit-outline' },
            { id: 'airport', label: 'Airport & Outstation Transit', description: 'Fast access to airport & bypass highways', icon: 'airplane-outline' },
        ],
    },
];

export default function AreasScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { city, focusLocality, setViewport } = useExplore();

    const [phase, setPhase] = useState(PHASES.INTRO);
    const [stepIndex, setStepIndex] = useState(0);
    const [answers, setAnswers] = useState({
        0: ['apartment'],
        1: ['12k_20k'],
        2: ['omr'],
        3: ['metro'],
        4: ['flood', 'transport'],
    });

    const [loadingLocalities, setLoadingLocalities] = useState(false);
    const [scoredLocalities, setScoredLocalities] = useState([]);
    const [selectedLocality, setSelectedLocality] = useState(null);
    const [selectedLocalityData, setSelectedLocalityData] = useState(null);

    // Map answers to Area Score weights
    const computeWeightsFromAnswers = useCallback((userAnswers) => {
        const priorities = userAnswers[4] || [];
        const commute = userAnswers[3]?.[0];

        const weights = {
            affordability: priorities.includes('affordability') ? 0.35 : 0.15,
            transport: commute === 'metro' || priorities.includes('transport') ? 0.35 : 0.15,
            flood: priorities.includes('flood') ? 0.40 : 0.15,
            schools: priorities.includes('schools') ? 0.25 : 0.05,
            healthcare: priorities.includes('healthcare') ? 0.25 : 0.05,
            airport: priorities.includes('airport') ? 0.25 : 0.05,
            connectivity: 0.15,
            marketFit: 0.10,
        };

        return weights;
    }, []);

    // Load localities and score them
    const loadAndScoreLocalities = useCallback(async (weights) => {
        setLoadingLocalities(true);
        try {
            const targetCity = city || 'Chennai';
            const localities = await localityService.listActiveByCity(targetCity);

            const scored = (localities || [])
                .filter((loc) => loc.latitude && loc.longitude)
                .map((locality) => {
                    const result = areaScoreService.calculate({
                        snapshot: locality.intelligence,
                        city: targetCity,
                        weights,
                    });
                    const score = result?.score != null ? result.score : 70;
                    return {
                        locality,
                        score,
                        result,
                    };
                })
                .sort((a, b) => b.score - a.score);

            setScoredLocalities(scored);
            if (scored.length > 0) {
                const first = scored[0];
                setSelectedLocality(first.locality);
                setSelectedLocalityData(first);
            }
        } catch (err) {
            console.warn('[AreasScreen] Failed to score localities:', err?.message);
        } finally {
            setLoadingLocalities(false);
        }
    }, [city]);

    const handleStartPreferences = () => {
        setStepIndex(0);
        setPhase(PHASES.PREFERENCES);
    };

    const handleSkipToIntelligenceMap = async () => {
        const weights = computeWeightsFromAnswers(answers);
        await areaScorePreferenceService.save(weights);
        setPhase(PHASES.MAP);
        loadAndScoreLocalities(weights);
    };

    const handleToggleOption = (optionId) => {
        const currentStep = STEP_OPTIONS[stepIndex];
        const currentSelected = answers[stepIndex] || [];

        if (currentStep.isMulti) {
            if (currentSelected.includes(optionId)) {
                setAnswers((prev) => ({
                    ...prev,
                    [stepIndex]: currentSelected.filter((id) => id !== optionId),
                }));
            } else {
                if (currentSelected.length < 3) {
                    setAnswers((prev) => ({
                        ...prev,
                        [stepIndex]: [...currentSelected, optionId],
                    }));
                }
            }
        } else {
            setAnswers((prev) => ({
                ...prev,
                [stepIndex]: [optionId],
            }));
        }
    };

    const handleContinueStep = async () => {
        if (stepIndex < STEP_OPTIONS.length - 1) {
            setStepIndex((prev) => prev + 1);
        } else {
            // Completed last step!
            const weights = computeWeightsFromAnswers(answers);
            try {
                await areaScorePreferenceService.save(weights);
            } catch (e) {
                console.warn('[AreasScreen] save preferences failed', e);
            }
            setPhase(PHASES.MAP);
            loadAndScoreLocalities(weights);
        }
    };

    const handleSelectLocality = (locality, item) => {
        setSelectedLocality(locality);
        setSelectedLocalityData(item);
        if (locality.latitude && locality.longitude) {
            setViewport((prev) => ({
                ...prev,
                latitude: locality.latitude,
                longitude: locality.longitude,
                zoom: 14,
            }));
        }
    };

    const handleExploreLocality = (locality) => {
        if (locality?.id) {
            focusLocality(locality.id);
        }
        navigation.navigate(TABS.Explore);
    };

    // Format properties for map pin representation
    const mapProperties = useMemo(() => {
        return scoredLocalities.map((item) => ({
            listingId: item.locality.id,
            id: item.locality.id,
            latitude: item.locality.latitude,
            longitude: item.locality.longitude,
            mapCoordinate: {
                latitude: item.locality.latitude,
                longitude: item.locality.longitude,
            },
            title: item.locality.name,
            price: Math.round(item.score),
            currency: '₹',
            transactionType: 'rent',
        }));
    }, [scoredLocalities]);

    return (
        <View style={styles.screen}>
            {/* Background Map always visible during INTRO and MAP */}
            {phase !== PHASES.PREFERENCES && (
                <View style={StyleSheet.absoluteFillObject}>
                    <PropertyMap
                        initialRegion={{ latitude: 13.0827, longitude: 80.2707, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
                        listings={mapProperties}
                        selectedId={selectedLocality?.id}
                        onSelect={(item) => {
                            const found = scoredLocalities.find(
                                (s) => s.locality.id === (item.listingId || item.id)
                            );
                            if (found) {
                                setSelectedLocality(found.locality);
                                setSelectedLocalityData(found);
                            }
                        }}
                    />
                </View>
            )}

            {/* PHASE 1: INTRO SHEET */}
            {phase === PHASES.INTRO && (
                <View style={[styles.introSheet, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]}>
                    <View style={styles.introContent}>
                        {/* Network/Intelligence Icon */}
                        <View style={styles.symbolWrap}>
                            <CrowwAreaIntelligenceIcon size={32} color={COLORS.accent} focused />
                        </View>

                        <Text style={styles.introTitle}>Find your best area</Text>
                        <Text style={styles.introSubtitle}>
                            Croww scores localities based on your commute, budget, flood resilience, and lifestyle priorities.
                        </Text>

                        <View style={styles.highlightsContainer}>
                            <View style={styles.highlightRow}>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} style={styles.highlightIcon} />
                                <Text style={styles.highlightText}>Personalized read-time Area Score</Text>
                            </View>
                            <View style={styles.highlightRow}>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} style={styles.highlightIcon} />
                                <Text style={styles.highlightText}>Verified flood & drainage evidence</Text>
                            </View>
                            <View style={styles.highlightRow}>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} style={styles.highlightIcon} />
                                <Text style={styles.highlightText}>Optimized metro & road travel times</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.primaryBtn}
                            activeOpacity={0.88}
                            onPress={handleStartPreferences}
                        >
                            <Text style={styles.primaryBtnText}>Start Personalization</Text>
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                            onPress={handleSkipToIntelligenceMap}
                        >
                            <Text style={styles.secondaryBtnText}>Browse with default scores</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* PHASE 2: 5-STEP WIZARD */}
            {phase === PHASES.PREFERENCES && (
                <View style={[styles.wizardContainer, { paddingTop: insets.top }]}>
                    <View style={styles.wizardHeader}>
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => {
                                if (stepIndex > 0) {
                                    setStepIndex((prev) => prev - 1);
                                } else {
                                    setPhase(PHASES.INTRO);
                                }
                            }}
                        >
                            <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Text style={styles.wizardBrand}>Croww Intelligence</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <PreferenceStep
                        stepNumber={stepIndex + 1}
                        totalSteps={STEP_OPTIONS.length}
                        title={STEP_OPTIONS[stepIndex].title}
                        subtitle={STEP_OPTIONS[stepIndex].subtitle}
                        options={STEP_OPTIONS[stepIndex].options}
                        selectedValues={answers[stepIndex] || []}
                        onToggleOption={handleToggleOption}
                        onContinue={handleContinueStep}
                        canContinue={(answers[stepIndex] || []).length > 0}
                        continueLabel={
                            stepIndex === STEP_OPTIONS.length - 1
                                ? 'Generate My Top Areas'
                                : 'Continue'
                        }
                    />
                </View>
            )}

            {/* PHASE 3: INTELLIGENCE MAP OVERLAY */}
            {phase === PHASES.MAP && (
                <>
                    {loadingLocalities ? (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={COLORS.accent} />
                            <Text style={styles.loadingText}>Analyzing areas for you...</Text>
                        </View>
                    ) : (
                        <IntelligenceMapOverlay
                            scoredLocalities={scoredLocalities}
                            selectedLocality={selectedLocality}
                            onSelectLocality={handleSelectLocality}
                            onResetPreferences={handleStartPreferences}
                        />
                    )}

                    {selectedLocality && (
                        <View style={[styles.sheetWrapper, { bottom: Math.max(insets.bottom, 12) + 70 }]}>
                            <LocalityDetailSheet
                                locality={selectedLocality}
                                scoreResult={selectedLocalityData?.result}
                                onExplore={handleExploreLocality}
                                onClose={() => setSelectedLocality(null)}
                            />
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    introSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.sheet,
        borderTopRightRadius: BORDER_RADIUS.sheet,
        ...SHADOWS.floating,
    },
    introContent: {
        padding: 24,
        alignItems: 'center',
    },
    symbolWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
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
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    highlightsContainer: {
        width: '100%',
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: BORDER_RADIUS.l,
        padding: 16,
        marginBottom: 20,
        gap: 12,
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    highlightIcon: {
        marginRight: 10,
    },
    highlightText: {
        fontSize: FONT_SIZES.s,
        fontWeight: '600',
        color: COLORS.primary,
    },
    primaryBtn: {
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
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.m,
        fontWeight: '700',
        marginRight: 8,
    },
    secondaryBtn: {
        paddingVertical: 10,
    },
    secondaryBtnText: {
        color: COLORS.secondary,
        fontSize: FONT_SIZES.s,
        fontWeight: '600',
    },
    wizardContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    wizardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wizardBrand: {
        fontSize: FONT_SIZES.m,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: -0.2,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: FONT_SIZES.m,
        fontWeight: '600',
        color: COLORS.primary,
        marginTop: 12,
    },
    sheetWrapper: {
        position: 'absolute',
        left: 12,
        right: 12,
    },
});
