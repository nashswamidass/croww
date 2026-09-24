import React, { useCallback, useMemo, useState } from 'react';
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
import {
    AREA_CRITERIA_CONFIG,
    ALL_AREA_CRITERIA,
    matchLocalities,
} from '../../domain/areaScore/localityMatcher';
import { useExplore } from '../../context/ExploreContext';
import { TABS } from '../../navigation/routeNames';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';


const PHASES = {
    INTRO: 'INTRO',
    PREFERENCES: 'PREFERENCES',
    MAP: 'MAP',
};

const PRIORITIES_REQUIRED = 3;

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
    // Step 5: Top 3 Priorities (all 10 canonical criteria)
    {
        title: 'Pick your top 3 priorities',
        subtitle: 'Select exactly 3 factors that matter most to you. These will drive your Personal Match score.',
        isMulti: true,
        maxSelections: PRIORITIES_REQUIRED,
        options: ALL_AREA_CRITERIA.map((id) => ({
            id,
            label: AREA_CRITERIA_CONFIG[id].label,
            description: AREA_CRITERIA_CONFIG[id].description,
            icon: AREA_CRITERIA_CONFIG[id].icon,
        })),
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
        4: [], // user must explicitly pick 3 priorities
    });

    const [loadingLocalities, setLoadingLocalities] = useState(false);
    const [scoredLocalities, setScoredLocalities] = useState([]);
    const [selectedLocality, setSelectedLocality] = useState(null);
    const [selectedLocalityData, setSelectedLocalityData] = useState(null);

    // Map answers to Area Score weights + extract budget range for Personal Match
    const computeWeightsFromAnswers = useCallback((userAnswers) => {
        const topPriorities = userAnswers[4] || [];
        const commute = userAnswers[3]?.[0];

        // Map AreasScreen commute selection to CommuteMode used by localityMatcher
        const commuteMode = commute === 'metro' ? 'metro'
            : commute === 'two_wheeler' ? 'two_wheeler'
            : commute === 'car_cab' ? 'car'
            : commute === 'walking' ? 'walk'
            : 'transit';

        // Map budget chip selection to a BudgetRange object
        const budgetMap = {
            under_12k: { id: 'under_12k', min: 4000, max: 12000 },
            '12k_20k': { id: '12k_20k', min: 12000, max: 20000 },
            '20k_35k': { id: '20k_35k', min: 20000, max: 35000 },
            above_35k: { id: 'above_35k', min: 35000, max: 100000 },
        };
        const budgetId = userAnswers[1]?.[0] || '12k_20k';
        const budget = budgetMap[budgetId] || budgetMap['12k_20k'];

        return { topPriorities, commuteMode, budget };
    }, []);


    // Load localities and score them using matchLocalities for Personal Match + objective Area Score
    const loadAndScoreLocalities = useCallback(async ({ topPriorities, commuteMode, budget }) => {
        setLoadingLocalities(true);
        try {
            const targetCity = city || 'Chennai';
            const localities = await localityService.listActiveByCity(targetCity);

            // Default destination: center of the city
            const defaultDestination = {
                id: 'city_center',
                name: targetCity,
                latitude: targetCity === 'Bengaluru' ? 12.9716 : 13.0827,
                longitude: targetCity === 'Bengaluru' ? 77.5946 : 80.2707,
            };

            const matchInput = {
                destination: defaultDestination,
                budget,
                commuteMode: commuteMode || 'transit',
                topPriorities,
                city: targetCity,
            };

            const candidateLocalities = (localities || [])
                .filter((loc) => loc.latitude && loc.longitude)
                .map((loc) => ({
                    id: loc.id,
                    name: loc.name,
                    city: targetCity,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    intelligence: loc.intelligence,
                    publishedScore: loc.publishedScore,
                    boundaries: loc.boundaries,
                    stats: loc.stats,
                }));

            const matchResults = matchLocalities(matchInput, candidateLocalities);

            const scored = matchResults.map((matchResult) => {
                const locality = (localities || []).find((l) => l.id === matchResult.localityId);
                return {
                    locality: locality || {
                        id: matchResult.localityId,
                        name: matchResult.localityName,
                        city: matchResult.city,
                        latitude: matchResult.latitude,
                        longitude: matchResult.longitude,
                    },
                    score: matchResult.matchScore,
                    result: matchResult, // contains both areaScore and matchScore
                };
            });

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
        const params = computeWeightsFromAnswers(answers);
        try {
            await areaScorePreferenceService.save(params.topPriorities);
        } catch (e) { /* non-blocking */ }
        setPhase(PHASES.MAP);
        loadAndScoreLocalities(params);
    };

    const handleToggleOption = (optionId) => {
        const currentStep = STEP_OPTIONS[stepIndex];
        const currentSelected = answers[stepIndex] || [];
        const maxSel = currentStep.maxSelections ?? (currentStep.isMulti ? Infinity : 1);

        if (currentStep.isMulti) {
            if (currentSelected.includes(optionId)) {
                setAnswers((prev) => ({
                    ...prev,
                    [stepIndex]: currentSelected.filter((id) => id !== optionId),
                }));
            } else {
                if (currentSelected.length < maxSel) {
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
            const params = computeWeightsFromAnswers(answers);
            try {
                await areaScorePreferenceService.save(params.topPriorities);
            } catch (e) {
                console.warn('[AreasScreen] save preferences failed', e);
            }
            setPhase(PHASES.MAP);
            loadAndScoreLocalities(params);
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
                            const targetId = item.listingId || item.id || item.locality?.id;
                            const found = scoredLocalities.find(
                                (s) => (s.locality?.id || s.id) === targetId
                            );
                            if (found) {
                                setSelectedLocality(found.locality);
                                setSelectedLocalityData(found);
                            }
                        }}
                        intelligenceMode={phase === PHASES.MAP}
                        localityRegions={scoredLocalities}
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
                        canContinue={
                            stepIndex === STEP_OPTIONS.length - 1
                                ? (answers[stepIndex] || []).length === PRIORITIES_REQUIRED
                                : (answers[stepIndex] || []).length > 0
                        }
                        continueLabel={
                            stepIndex === STEP_OPTIONS.length - 1
                                ? 'Generate My Top Areas'
                                : 'Continue'
                        }
                        maxSelections={STEP_OPTIONS[stepIndex].maxSelections}
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
