import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import {
    POPULAR_CHENNAI_DESTINATIONS,
} from '../../domain/areaScore/localityMatcher';
import {
    COMPACT_BUDGET_CHIPS,
    COMMUTE_OPTIONS,
    MATTERS_OPTIONS,
} from '../intelligence/AreaQuestionnaireSheet';
import CrowwAreaIntelligenceIcon from '../icons/CrowwAreaIntelligenceIcon';
import { useGooglePlacesAutocomplete } from '../GooglePlacesInput';

export default function DesktopAreaIntelligencePanel({
    initialDestination,
    initialBudget,
    initialCommuteMode = 'transit',
    initialPriorities = ['short_commute', 'low_rent'],
    onComplete,
    onClose,
    loading = false,
}) {
    // 1. Destination
    const [destination, setDestination] = useState(initialDestination || POPULAR_CHENNAI_DESTINATIONS[0]);

    const {
        query: searchQuery,
        setQuery: setSearchQuery,
        suggestions: predictions,
        loading: searchLoading,
        showSuggestions,
        setShowSuggestions,
        handleSelect,
    } = useGooglePlacesAutocomplete({
        onSelect: (place) => {
            setDestination({
                id: place.place_id || place.placeId || `dest_${Date.now()}`,
                name: place.name?.split(',')[0] || place.name,
                landmark: place.formatted_address || place.name,
                latitude: place.latitude ?? place.coordinate?.latitude ?? 12.989,
                longitude: place.longitude ?? place.coordinate?.longitude ?? 80.2483,
            });
        },
    });

    // 2. Budget
    const [selectedBudget, setSelectedBudget] = useState(initialBudget || COMPACT_BUDGET_CHIPS[1]);

    // 3. Commute
    const [commuteMode, setCommuteMode] = useState(initialCommuteMode);

    // 4. Priorities
    const [priorities, setPriorities] = useState(initialPriorities);

    const handleSelectPrediction = (item) => {
        handleSelect(item.place_id, item.description);
    };

    const handleSelectHub = (hub) => {
        setDestination(hub);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const togglePriority = (priorityId) => {
        setPriorities((prev) =>
            prev.includes(priorityId)
                ? prev.filter((id) => id !== priorityId)
                : [...prev, priorityId]
        );
    };

    const handleShowAreas = useCallback(() => {
        if (!destination) return;
        onComplete?.({
            destination,
            budget: selectedBudget,
            commuteMode,
            priorities,
        });
    }, [destination, selectedBudget, commuteMode, priorities, onComplete]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <CrowwAreaIntelligenceIcon size={20} color={COLORS.primary} focused />
                    <Text style={styles.headerTitle}>Area Intelligence</Text>
                </View>
                {onClose && (
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close Area Intelligence"
                    >
                        <Ionicons name="close" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Destination */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>1. Daily Destination / Workplace</Text>
                    {destination && (
                        <View style={styles.selectedDestCard}>
                            <Ionicons name="location" size={16} color={COLORS.primary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.destName}>{destination.name}</Text>
                                {destination.landmark && (
                                    <Text style={styles.destLandmark} numberOfLines={1}>
                                        {destination.landmark}
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={15} color={COLORS.secondary} style={{ marginRight: 6 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Change workplace, office, or hub..."
                            placeholderTextColor={COLORS.tertiary}
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                setShowSuggestions(true);
                            }}
                        />
                        {searchLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
                    </View>

                    {showSuggestions && predictions.length > 0 && (
                        <View style={styles.predictionsList}>
                            {predictions.slice(0, 5).map((item) => (
                                <TouchableOpacity
                                    key={item.place_id || item.description}
                                    style={styles.predictionItem}
                                    onPress={() => handleSelectPrediction(item)}
                                >
                                    <Ionicons name="pin-outline" size={14} color={COLORS.secondary} style={{ marginRight: 8 }} />
                                    <Text style={styles.predictionText} numberOfLines={1}>
                                        {item.description}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <Text style={styles.quickHubsLabel}>Popular Hubs:</Text>
                    <View style={styles.quickHubsRow}>
                        {POPULAR_CHENNAI_DESTINATIONS.slice(0, 4).map((hub) => {
                            const isSelected = destination?.id === hub.id;
                            return (
                                <TouchableOpacity
                                    key={hub.id}
                                    style={[styles.hubChip, isSelected && styles.hubChipActive]}
                                    onPress={() => handleSelectHub(hub)}
                                >
                                    <Text style={[styles.hubChipText, isSelected && styles.hubChipTextActive]}>
                                        {hub.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 2. Budget */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>2. Monthly Rent Budget</Text>
                    <View style={styles.chipsGrid}>
                        {COMPACT_BUDGET_CHIPS.map((chip) => {
                            const isSelected = selectedBudget?.id === chip.id;
                            return (
                                <TouchableOpacity
                                    key={chip.id}
                                    style={[styles.budgetChip, isSelected && styles.budgetChipActive]}
                                    onPress={() => setSelectedBudget(chip)}
                                >
                                    <Text style={[styles.budgetChipText, isSelected && styles.budgetChipTextActive]}>
                                        {chip.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 3. Commute Mode */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>3. Preferred Commute</Text>
                    <View style={styles.chipsGrid}>
                        {COMMUTE_OPTIONS.map((opt) => {
                            const isSelected = commuteMode === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[styles.commuteChip, isSelected && styles.commuteChipActive]}
                                    onPress={() => setCommuteMode(opt.id)}
                                >
                                    <Ionicons
                                        name={opt.icon || 'bus-outline'}
                                        size={16}
                                        color={isSelected ? '#FFFFFF' : COLORS.primary}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[styles.commuteChipText, isSelected && styles.commuteChipTextActive]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 4. Priorities */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>4. What Matters Most?</Text>
                    <View style={styles.chipsWrap}>
                        {MATTERS_OPTIONS.map((item) => {
                            const isSelected = priorities.includes(item.id);
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.priorityChip, isSelected && styles.priorityChipActive]}
                                    onPress={() => togglePriority(item.id)}
                                >
                                    <Ionicons
                                        name={item.icon || 'star-outline'}
                                        size={14}
                                        color={isSelected ? '#FFFFFF' : COLORS.secondary}
                                        style={{ marginRight: 5 }}
                                    />
                                    <Text style={[styles.priorityChipText, isSelected && styles.priorityChipTextActive]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom CTA */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleShowAreas}
                    disabled={loading || !destination}
                    activeOpacity={0.88}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <CrowwAreaIntelligenceIcon size={18} color="#FFFFFF" focused />
                            <Text style={styles.submitButtonText}>Show Areas on Map</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.surface,
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: SPACING.l,
        gap: SPACING.l,
    },
    section: {
        gap: SPACING.s,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    selectedDestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: COLORS.surfaceHighlight,
        padding: 10,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    destName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
    },
    destLandmark: {
        fontSize: 12,
        color: COLORS.secondary,
        marginTop: 2,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.input || 12,
        paddingHorizontal: 12,
        height: 38,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: COLORS.primary,
        paddingVertical: 0,
        outlineStyle: 'none',
    },
    predictionsList: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        marginTop: 4,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
    },
    predictionText: {
        fontSize: 12,
        color: COLORS.primary,
        flex: 1,
    },
    quickHubsLabel: {
        fontSize: 11,
        color: COLORS.secondary,
        fontWeight: '600',
        marginTop: 4,
    },
    quickHubsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    hubChip: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    hubChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    hubChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    hubChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    chipsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    budgetChip: {
        flex: 1,
        minWidth: '45%',
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    budgetChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    budgetChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    budgetChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    commuteChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minWidth: '45%',
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    commuteChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    commuteChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    commuteChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    chipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
    },
    priorityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    priorityChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    priorityChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    priorityChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    footer: {
        padding: SPACING.l,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        paddingVertical: 13,
        borderRadius: BORDER_RADIUS.button || 14,
        ...SHADOWS.card,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
