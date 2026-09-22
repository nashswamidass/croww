import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    ScrollView,
    Modal,
    TouchableWithoutFeedback,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import {
    COMMUTE_MODE_CONFIG,
    MATTERS_CONFIG,
    POPULAR_CHENNAI_DESTINATIONS,
    BUDGET_PRESETS,
} from '../../domain/areaScore/localityMatcher';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export const COMPACT_BUDGET_CHIPS = [
    { id: 'under_8k', label: '< ₹8,000', min: 4000, max: 8000 },
    { id: '8k_12k', label: '₹8,000 – ₹12,000', min: 8000, max: 12000 },
    { id: '12k_18k', label: '₹12,000 – ₹18,000', min: 12000, max: 18000 },
    { id: '18k_plus', label: '₹18,000+', min: 18000, max: 60000 },
];

export const COMMUTE_OPTIONS = Object.entries(COMMUTE_MODE_CONFIG).map(([id, config]) => ({
    id,
    label: config.label,
    icon: config.icon,
}));

export const MATTERS_OPTIONS = Object.entries(MATTERS_CONFIG).map(([id, config]) => ({
    id,
    label: config.label,
    icon: config.icon,
}));

/**
 * Native bottom sheet questionnaire for Croww Areas mode.
 * Progressive 4-step flow:
 *   Step 1: Destination (Google Places / Popular Chennai Hubs)
 *   Step 2: Monthly rent budget chips
 *   Step 3: Commute mode
 *   Step 4: Priorities -> SHOW AREAS
 */
export default function AreaQuestionnaireSheet({
    visible,
    initialDestination,
    initialBudget,
    initialCommuteMode = 'transit',
    initialPriorities = ['short_commute', 'low_rent'],
    onClose,
    onShowAreas,
    onComplete,
}) {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();

    const [currentStep, setCurrentStep] = useState(1);

    // Step 1: Destination
    const [destination, setDestination] = useState(initialDestination || POPULAR_CHENNAI_DESTINATIONS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Step 2: Budget
    const [selectedBudget, setSelectedBudget] = useState(initialBudget || COMPACT_BUDGET_CHIPS[1]);

    // Step 3: Commute
    const [commuteMode, setCommuteMode] = useState(initialCommuteMode);

    // Step 4: Priorities
    const [priorities, setPriorities] = useState(initialPriorities);

    // Keep state synced if props change
    useEffect(() => {
        if (initialDestination) setDestination(initialDestination);
    }, [initialDestination]);

    useEffect(() => {
        if (initialBudget) setSelectedBudget(initialBudget);
    }, [initialBudget]);

    // Places autocomplete debounce
    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 3) {
            setPredictions([]);
            return undefined;
        }

        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                if (API_KEY) {
                    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
                        query
                    )}&key=${API_KEY}&components=country:in`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.status === 'OK' && Array.isArray(data.predictions)) {
                        setPredictions(data.predictions);
                        setSearchLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.warn('[AreaQuestionnaire] Places fetch error:', e?.message);
            }

            // Fallback match against popular destinations
            const matches = POPULAR_CHENNAI_DESTINATIONS.filter((p) =>
                p.name.toLowerCase().includes(query.toLowerCase())
            );
            setPredictions(
                matches.map((m) => ({
                    place_id: m.id,
                    description: m.name,
                    isPreset: true,
                    point: m,
                }))
            );
            setSearchLoading(false);
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectPrediction = async (item) => {
        if (item.isPreset && item.point) {
            setDestination(item.point);
            setSearchQuery('');
            setPredictions([]);
            return;
        }

        if (item.place_id && API_KEY) {
            try {
                const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${API_KEY}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.status === 'OK' && data.result?.geometry?.location) {
                    const loc = data.result.geometry.location;
                    setDestination({
                        id: item.place_id,
                        name: item.description?.split(',')[0] || item.description,
                        landmark: item.description,
                        latitude: loc.lat,
                        longitude: loc.lng,
                    });
                    setSearchQuery('');
                    setPredictions([]);
                    return;
                }
            } catch (err) {
                console.warn('[AreaQuestionnaire] Place details error:', err?.message);
            }
        }

        setDestination({
            id: item.place_id || 'custom',
            name: item.description?.split(',')[0] || item.description,
            landmark: item.description,
            latitude: 12.989,
            longitude: 80.2483,
        });
        setSearchQuery('');
        setPredictions([]);
    };

    const togglePriority = (priorityId) => {
        setPriorities((prev) => {
            if (prev.includes(priorityId)) {
                return prev.filter((p) => p !== priorityId);
            }
            return [...prev, priorityId];
        });
    };

    const handleShowAreas = () => {
        const payload = {
            destination,
            budget: selectedBudget,
            commuteMode,
            priorities,
        };
        if (typeof onComplete === 'function') {
            onComplete(payload);
        } else if (typeof onShowAreas === 'function') {
            onShowAreas(payload);
        }
    };

    const maxSheetHeight = useMemo(() => {
        return Math.min(windowHeight * 0.62, 540);
    }, [windowHeight]);

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalBackdrop}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.backdropDismissArea} />
                </TouchableWithoutFeedback>

                <View
                    style={[
                        styles.sheetContainer,
                        {
                            maxHeight: Math.min(windowHeight * 0.62, 520),
                            paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 52 : 20),
                        },
                    ]}
                >
                    {/* Drag handle */}
                    <View style={styles.dragHandle} />

                    {/* Sheet Header */}
                    <View style={styles.headerRow}>
                        <View style={styles.stepIndicatorPill}>
                            <Text style={styles.stepIndicatorText}>Step {currentStep} of 4</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Close questionnaire"
                        >
                            <Ionicons name="close" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Step Content */}
                    <View style={styles.stepContentContainer}>
                        {/* STEP 1: DESTINATION */}
                        {currentStep === 1 && (
                            <View style={styles.stepPane}>
                                <Text style={styles.stepTitle}>Where do you want to live?</Text>
                                <Text style={styles.stepSubtitle}>
                                    Search your workplace, university, or landmark
                                </Text>

                                {/* Search Bar */}
                                <View style={styles.searchBarContainer}>
                                    <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search office, college, hospital..."
                                        placeholderTextColor="#9CA3AF"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoCorrect={false}
                                        clearButtonMode="while-editing"
                                    />
                                    {searchLoading && <ActivityIndicator size="small" color="#111827" />}
                                </View>

                                {/* Autocomplete predictions dropdown */}
                                {predictions.length > 0 ? (
                                    <ScrollView style={styles.predictionsList} keyboardShouldPersistTaps="handled">
                                        {predictions.map((item) => (
                                            <TouchableOpacity
                                                key={item.place_id || item.description}
                                                style={styles.predictionRow}
                                                onPress={() => handleSelectPrediction(item)}
                                            >
                                                <Ionicons name="location-outline" size={18} color="#6B7280" style={{ marginRight: 10 }} />
                                                <Text style={styles.predictionText} numberOfLines={1}>
                                                    {item.description}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <View>
                                        {/* Selected Destination Card */}
                                        {destination ? (
                                            <View style={styles.selectedDestinationCard}>
                                                <View style={styles.destinationIconCircle}>
                                                    <Ionicons name="navigate" size={18} color="#111827" />
                                                </View>
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={styles.selectedDestinationLabel}>Selected Hub</Text>
                                                    <Text style={styles.selectedDestinationName} numberOfLines={1}>
                                                        {destination.name}
                                                    </Text>
                                                    {destination.landmark ? (
                                                        <Text style={styles.selectedDestinationLandmark} numberOfLines={1}>
                                                            {destination.landmark}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <TouchableOpacity
                                                    style={styles.changeDestinationBtn}
                                                    onPress={() => setDestination(null)}
                                                >
                                                    <Text style={styles.changeDestinationText}>Change</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={styles.validationNotice}>
                                                <Ionicons name="alert-circle-outline" size={16} color="#D97706" style={{ marginRight: 8 }} />
                                                <Text style={styles.validationNoticeText}>
                                                    Select a workplace, campus, or landmark to continue
                                                </Text>
                                            </View>
                                        )}

                                        {/* Popular Suggestions */}
                                        <Text style={styles.sectionLabel}>Popular Hubs in Chennai</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={styles.quickChipsScroll}
                                        >
                                            {POPULAR_CHENNAI_DESTINATIONS.slice(0, 5).map((item) => {
                                                const isSelected = destination?.id === item.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={item.id}
                                                        style={[styles.quickChip, isSelected && styles.quickChipSelected]}
                                                        onPress={() => setDestination(item)}
                                                    >
                                                        <Ionicons
                                                            name={isSelected ? 'checkmark' : 'business-outline'}
                                                            size={14}
                                                            color={isSelected ? '#FFFFFF' : '#374151'}
                                                            style={{ marginRight: 6 }}
                                                        />
                                                        <Text style={[styles.quickChipText, isSelected && styles.quickChipTextSelected]}>
                                                            {item.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* STEP 2: BUDGET */}
                        {currentStep === 2 && (
                            <View style={styles.stepPane}>
                                <Text style={styles.stepTitle}>What is your monthly budget?</Text>
                                <Text style={styles.stepSubtitle}>
                                    Find areas with stays matching your monthly rent
                                </Text>

                                <View style={styles.budgetChipsWrap}>
                                    {COMPACT_BUDGET_CHIPS.map((preset) => {
                                        const isSelected = selectedBudget?.id === preset.id;
                                        return (
                                            <TouchableOpacity
                                                key={preset.id}
                                                style={[styles.budgetChip, isSelected && styles.budgetChipSelected]}
                                                onPress={() => setSelectedBudget(preset)}
                                                activeOpacity={0.8}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Budget: ${preset.label}`}
                                            >
                                                <Text style={[styles.budgetChipText, isSelected && styles.budgetChipTextSelected]}>
                                                    {preset.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* STEP 3: COMMUTE */}
                        {currentStep === 3 && (
                            <View style={styles.stepPane}>
                                <Text style={styles.stepTitle}>How do you commute?</Text>
                                <Text style={styles.stepSubtitle}>
                                    We calculate travel times based on your transport mode
                                </Text>

                                <View style={styles.commuteGrid}>
                                    {COMMUTE_OPTIONS.map((mode) => {
                                        const isSelected = commuteMode === mode.id;
                                        return (
                                            <TouchableOpacity
                                                key={mode.id}
                                                style={[styles.commuteOption, isSelected && styles.commuteOptionSelected]}
                                                onPress={() => setCommuteMode(mode.id)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={[styles.commuteIconWrap, isSelected && styles.commuteIconWrapSelected]}>
                                                    <Ionicons
                                                        name={mode.icon}
                                                        size={20}
                                                        color={isSelected ? '#FFFFFF' : '#111827'}
                                                    />
                                                </View>
                                                <Text style={[styles.commuteOptionLabel, isSelected && styles.commuteOptionLabelSelected]}>
                                                    {mode.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* STEP 4: PRIORITIES */}
                        {currentStep === 4 && (
                            <View style={styles.stepPane}>
                                <Text style={styles.stepTitle}>What matters most?</Text>
                                <Text style={styles.stepSubtitle}>
                                    Select all factors that are essential for your stay
                                </Text>

                                <View style={styles.prioritiesWrap}>
                                    {MATTERS_OPTIONS.map((matter) => {
                                        const isSelected = priorities.includes(matter.id);
                                        return (
                                            <TouchableOpacity
                                                key={matter.id}
                                                style={[styles.priorityChip, isSelected && styles.priorityChipSelected]}
                                                onPress={() => togglePriority(matter.id)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons
                                                    name={isSelected ? 'checkmark-circle' : matter.icon}
                                                    size={16}
                                                    color={isSelected ? '#FFFFFF' : '#374151'}
                                                    style={{ marginRight: 8 }}
                                                />
                                                <Text style={[styles.priorityChipLabel, isSelected && styles.priorityChipLabelSelected]}>
                                                    {matter.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Bottom CTA Row */}
                    <View style={styles.actionRow}>
                        {currentStep > 1 ? (
                            <TouchableOpacity
                                style={styles.backBtn}
                                onPress={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                                accessibilityRole="button"
                                accessibilityLabel="Previous step"
                            >
                                <Ionicons name="arrow-back" size={16} color="#111827" style={{ marginRight: 6 }} />
                                <Text style={styles.backBtnText}>Back</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 80 }} />
                        )}

                        {currentStep < 4 ? (
                            <TouchableOpacity
                                style={[styles.nextBtn, currentStep === 1 && !destination && styles.btnDisabled]}
                                onPress={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
                                disabled={currentStep === 1 && !destination}
                                accessibilityRole="button"
                                accessibilityLabel="Next step"
                            >
                                <Text style={styles.nextBtnText}>Next</Text>
                                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.showAreasBtn}
                                onPress={handleShowAreas}
                                accessibilityRole="button"
                                accessibilityLabel="Show Areas"
                            >
                                <Text style={styles.showAreasBtnText}>SHOW AREAS</Text>
                                <Ionicons name="map" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.40)',
    },
    backdropDismissArea: {
        flex: 1,
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
        ...SHADOWS.floating,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#D1D5DB',
        alignSelf: 'center',
        marginBottom: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    stepIndicatorPill: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    stepIndicatorText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepContentContainer: {
        marginBottom: 8,
    },
    stepPane: {
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    stepSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 12,
    },

    // Step 1: Destination
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: 12,
        height: 42,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
        paddingVertical: 0,
    },
    predictionsList: {
        maxHeight: 160,
    },
    predictionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    predictionText: {
        flex: 1,
        fontSize: 13,
        color: '#111827',
    },
    selectedDestinationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: BORDER_RADIUS.md,
        padding: 12,
        marginBottom: 14,
    },
    destinationIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedDestinationLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    selectedDestinationName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    selectedDestinationLandmark: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    changeDestinationBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    changeDestinationText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        textDecorationLine: 'underline',
    },
    validationNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    validationNoticeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
        flex: 1,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
    },
    quickChipsScroll: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 2,
    },
    quickChipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quickChipSelected: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    quickChipText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    quickChipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },

    // Step 2: Budget
    budgetChipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginVertical: 6,
    },
    budgetChip: {
        width: '48%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
    },
    budgetChipSelected: {
        borderColor: '#111827',
        backgroundColor: '#111827',
    },
    budgetChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    budgetChipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },

    // Step 3: Commute
    commuteGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    commuteOption: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    commuteOptionSelected: {
        borderColor: '#111827',
        backgroundColor: '#F9FAFB',
    },
    commuteIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    commuteIconWrapSelected: {
        backgroundColor: '#111827',
    },
    commuteOptionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        flex: 1,
    },
    commuteOptionLabelSelected: {
        color: '#111827',
        fontWeight: '700',
    },

    // Step 4: Priorities
    prioritiesWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    priorityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    priorityChipSelected: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    priorityChipLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    priorityChipLabelSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },

    // Action Row
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        marginTop: 10,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    backBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: '#111827',
    },
    nextBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    btnDisabled: {
        opacity: 0.4,
    },
    showAreasBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: '#111827',
    },
    showAreasBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
});
