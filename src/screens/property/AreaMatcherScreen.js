import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Platform,
    SafeAreaView,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../../components/Typography';
import CrowwAreaIntelligenceIcon from '../../components/icons/CrowwAreaIntelligenceIcon';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { localityMatcherService } from '../../services/intelligence/localityMatcherService';
import {
    COMMUTE_MODE_CONFIG,
    MATTERS_CONFIG,
    POPULAR_CHENNAI_DESTINATIONS,
    BUDGET_PRESETS,
} from '../../domain/areaScore/localityMatcher';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function AreaMatcherScreen({ navigation }) {
    // 1. Destination
    const [destination, setDestination] = useState(POPULAR_CHENNAI_DESTINATIONS[0]); // Default Tidel Park
    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // 2. Budget
    const [selectedBudget, setSelectedBudget] = useState(BUDGET_PRESETS[1]); // ₹8,000 – ₹12,000

    // 3. Commute Mode
    const [commuteMode, setCommuteMode] = useState('transit'); // Any public transport

    // 4. Priorities ("What matters?")
    const [priorities, setPriorities] = useState(['short_commute', 'low_rent']);

    // 5. Results
    const [results, setResults] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);

    // Toggle a priority
    const togglePriority = (priorityId) => {
        setPriorities((prev) => {
            if (prev.includes(priorityId)) {
                return prev.filter((p) => p !== priorityId);
            }
            return [...prev, priorityId];
        });
    };

    // Run matching analysis
    const runAnalysis = useCallback(async () => {
        if (!destination?.latitude) return;
        setAnalyzing(true);
        try {
            const matches = await localityMatcherService.findMatches({
                destination,
                budget: selectedBudget,
                commuteMode,
                priorities,
                city: 'Chennai',
            });
            setResults(matches);
        } catch (err) {
            console.warn('[AreaMatcherScreen] Analysis error:', err);
        } finally {
            setAnalyzing(false);
        }
    }, [destination, selectedBudget, commuteMode, priorities]);

    // Re-run whenever inputs change
    useEffect(() => {
        runAnalysis();
    }, [runAnalysis]);

    // Handle Google Places Autocomplete search for destinations
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
                    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${API_KEY}&components=country:in`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.status === 'OK' && Array.isArray(data.predictions)) {
                        setPredictions(data.predictions);
                        setSearchLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.warn('[AreaMatcher] Places fetch error:', e?.message);
            }

            // Fallback: match against popular destinations
            const matches = POPULAR_CHENNAI_DESTINATIONS.filter((p) =>
                p.name.toLowerCase().includes(query.toLowerCase())
            );
            setPredictions(matches.map((m) => ({
                place_id: m.id,
                description: m.name,
                isPreset: true,
                point: m,
            })));
            setSearchLoading(false);
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const selectPrediction = async (item) => {
        if (item.isPreset && item.point) {
            setDestination(item.point);
            setSearchQuery('');
            setIsSearching(false);
            return;
        }

        // Fetch place details
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
                    setIsSearching(false);
                    return;
                }
            } catch (err) {
                console.warn('[AreaMatcher] Place details error:', err?.message);
            }
        }

        setDestination({
            id: item.place_id || 'custom',
            name: item.description?.split(',')[0] || item.description,
            landmark: item.description,
            latitude: 12.9890,
            longitude: 80.2483,
        });
        setSearchQuery('');
        setIsSearching(false);
    };

    const handleExploreLocality = (locality) => {
        navigation.navigate('Explore', {
            localityId: locality.localityId,
            localityName: locality.localityName,
            city: locality.city || 'Chennai',
        });
    };

    const handleLocalityDetails = (locality) => {
        navigation.navigate('Locality', {
            localityId: locality.localityId,
            name: locality.localityName,
        });
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.topHeader}>
                <View style={styles.headerTopRow}>
                    <TouchableOpacity
                        onPress={() => {
                            if (navigation.canGoBack()) {
                                navigation.goBack();
                            } else {
                                navigation.navigate('Explore');
                            }
                        }}
                        style={styles.backBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Image
                        source={require('../../../assets/croww-logo.png')}
                        style={styles.brandLogo}
                        resizeMode="contain"
                        accessibilityLabel="Croww"
                    />
                    <View style={styles.brandDivider} />
                    <Text style={styles.screenCategoryTag}>AREAS</Text>
                </View>
                <Typography variant="h2" style={styles.headerTitle}>
                    Where should I live?
                </Typography>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* SECTION 1: DESTINATION */}
                <View style={styles.card}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepNumber}>1</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h3" style={styles.sectionTitle}>
                                Where do you work or study?
                            </Typography>
                            <Typography variant="caption" style={styles.sectionSubtitle}>
                                We calculate exact commute times to this location
                            </Typography>
                        </View>
                    </View>

                    {/* Selected Destination Card */}
                    {destination ? (
                        <View style={styles.selectedDestinationCard}>
                            <View style={styles.destPinCircle}>
                                <Ionicons name="business" size={20} color={COLORS.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.selectedDestLabel}>Selected destination</Text>
                                <Text style={styles.selectedDestName}>{destination.name}</Text>
                                {destination.landmark ? (
                                    <Text style={styles.selectedDestSub}>{destination.landmark}</Text>
                                ) : null}
                            </View>
                            <TouchableOpacity
                                style={styles.changeDestBtn}
                                onPress={() => setIsSearching(!isSearching)}
                                accessibilityRole="button"
                                accessibilityLabel="Change destination"
                            >
                                <Text style={styles.changeDestText}>Change</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {/* Search Input (Expandable) */}
                    {(!destination || isSearching) ? (
                        <View style={styles.searchContainer}>
                            <View style={styles.searchBar}>
                                <Ionicons name="search" size={18} color={COLORS.secondary} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search a place, office, college..."
                                    placeholderTextColor={COLORS.tertiary}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus={isSearching}
                                />
                                {searchLoading ? (
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                ) : searchQuery ? (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color={COLORS.tertiary} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {/* Autocomplete Suggestions */}
                            {predictions.length > 0 ? (
                                <View style={styles.predictionsDropdown}>
                                    {predictions.map((p, index) => (
                                        <TouchableOpacity
                                            key={p.place_id || index}
                                            style={styles.predictionRow}
                                            onPress={() => selectPrediction(p)}
                                        >
                                            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                                            <Text style={styles.predictionText} numberOfLines={1}>
                                                {p.description}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    {/* Popular Destination Chips */}
                    <Text style={styles.presetHeading}>Popular hubs:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                        {POPULAR_CHENNAI_DESTINATIONS.map((dest) => {
                            const isSelected = destination?.id === dest.id;
                            return (
                                <TouchableOpacity
                                    key={dest.id}
                                    style={[
                                        styles.presetChip,
                                        isSelected && styles.presetChipSelected,
                                    ]}
                                    onPress={() => {
                                        setDestination(dest);
                                        setIsSearching(false);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.presetChipText,
                                            isSelected && styles.presetChipTextSelected,
                                        ]}
                                    >
                                        {dest.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* SECTION 2: BUDGET */}
                <View style={styles.card}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepNumber}>2</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h3" style={styles.sectionTitle}>
                                Budget
                            </Typography>
                            <Typography variant="caption" style={styles.sectionSubtitle}>
                                Monthly rent preference for room or bed
                            </Typography>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetPillsRow}>
                        {BUDGET_PRESETS.map((b) => {
                            const isSelected = selectedBudget.id === b.id;
                            return (
                                <TouchableOpacity
                                    key={b.id}
                                    style={[styles.budgetPill, isSelected && styles.budgetPillSelected]}
                                    onPress={() => setSelectedBudget(b)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.budgetPillText, isSelected && styles.budgetPillTextSelected]}>
                                        {b.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* SECTION 3: COMMUTE MODE */}
                <View style={styles.card}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepNumber}>3</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h3" style={styles.sectionTitle}>
                                How do you commute?
                            </Typography>
                            <Typography variant="caption" style={styles.sectionSubtitle}>
                                We calculate routes matching your transport style
                            </Typography>
                        </View>
                    </View>

                    <View style={styles.chipsGrid}>
                        {Object.entries(COMMUTE_MODE_CONFIG).map(([modeKey, config]) => {
                            const isSelected = commuteMode === modeKey;
                            return (
                                <TouchableOpacity
                                    key={modeKey}
                                    style={[styles.gridChip, isSelected && styles.gridChipSelected]}
                                    onPress={() => setCommuteMode(modeKey)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={config.icon}
                                        size={18}
                                        color={isSelected ? '#FFFFFF' : COLORS.primary}
                                    />
                                    <Text style={[styles.gridChipText, isSelected && styles.gridChipTextSelected]}>
                                        {config.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* SECTION 4: WHAT MATTERS? */}
                <View style={styles.card}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepNumber}>4</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h3" style={styles.sectionTitle}>
                                What matters?
                            </Typography>
                            <Typography variant="caption" style={styles.sectionSubtitle}>
                                Choose your lifestyle priorities to weight area scores
                            </Typography>
                        </View>
                    </View>

                    <View style={styles.chipsGrid}>
                        {Object.entries(MATTERS_CONFIG).map(([priorityKey, config]) => {
                            const isSelected = priorities.includes(priorityKey);
                            return (
                                <TouchableOpacity
                                    key={priorityKey}
                                    style={[styles.gridChip, isSelected && styles.priorityChipSelected]}
                                    onPress={() => togglePriority(priorityKey)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={config.icon}
                                        size={18}
                                        color={isSelected ? '#FFFFFF' : COLORS.primary}
                                    />
                                    <Text style={[styles.gridChipText, isSelected && styles.gridChipTextSelected]}>
                                        {config.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* SECTION 5: ANALYSIS & RESULTS */}
                <View style={styles.resultsSection}>
                    <View style={styles.resultsHeader}>
                        <View style={styles.resultsHeaderTopRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <CrowwAreaIntelligenceIcon size={18} color={COLORS.primary} />
                                <Typography variant="h3" style={[styles.sectionTitle, { marginLeft: 8 }]}>
                                    Croww Locality Matches
                                </Typography>
                            </View>
                            <TouchableOpacity
                                style={styles.viewMapHeaderBtn}
                                onPress={() => navigation.navigate('Explore', {
                                    intelligenceMode: true,
                                    city: 'Chennai',
                                })}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel="View Area Intelligence Map"
                            >
                                <Ionicons name="map-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={styles.viewMapHeaderBtnText}>View Map</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.resultsSubtitle}>
                            Ranked for {destination?.name || 'your destination'} · {selectedBudget.label}
                        </Text>
                    </View>

                    {analyzing ? (
                        <View style={styles.analyzingCard}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.analyzingText}>
                                Croww analyzes all available localities...
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.resultsList}>
                            {results.map((item, index) => {
                                const rank = index + 1;
                                return (
                                    <View key={item.localityId} style={styles.resultCard}>
                                        <View style={styles.cardTopRow}>
                                            <View style={styles.localityNameContainer}>
                                                <View style={styles.rankBadge}>
                                                    <Text style={styles.rankNumber}>#{rank}</Text>
                                                </View>
                                                <Text style={styles.localityName}>{item.localityName}</Text>
                                            </View>
                                            <View style={styles.scoreBadge}>
                                                <Text style={styles.scoreBadgeLabel}>Score</Text>
                                                <Text style={styles.scoreBadgeValue}>{item.matchScore}</Text>
                                            </View>
                                        </View>

                                        {/* Metrics Row */}
                                        <View style={styles.metricsRow}>
                                            <View style={[styles.metricPill, item.inBudget ? styles.rentPillInBudget : styles.rentPill]}>
                                                <Ionicons name="pricetag" size={13} color={item.inBudget ? COLORS.success : COLORS.secondary} />
                                                <Text style={[styles.metricPillText, item.inBudget && { color: COLORS.success, fontWeight: '700' }]}>
                                                    {item.typicalRentFormatted} typical rent
                                                </Text>
                                            </View>

                                            <View style={styles.metricPill}>
                                                <Ionicons name="time-outline" size={14} color={COLORS.secondary} />
                                                <Text style={styles.metricPillText}>
                                                    {item.commute.travelMinutes} min transit
                                                </Text>
                                            </View>

                                            <View style={styles.metricPill}>
                                                <Ionicons name="subway-outline" size={13} color={COLORS.secondary} />
                                                <Text style={styles.metricPillText}>
                                                    {item.commute.modeTag}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Highlights Chips */}
                                        {item.highlights.length > 0 ? (
                                            <View style={styles.highlightsContainer}>
                                                {item.highlights.map((h, hIdx) => (
                                                    <View key={hIdx} style={styles.highlightBadge}>
                                                        <Text style={styles.highlightText}>✓ {h}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ) : null}

                                        {/* Action CTAs */}
                                        <View style={styles.cardActions}>
                                            <TouchableOpacity
                                                style={styles.exploreStaysBtn}
                                                onPress={() => handleExploreLocality(item)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.exploreStaysText}>
                                                    Explore spaces in {item.localityName} →
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.areaMapBtn}
                                                onPress={() => navigation.navigate('Explore', {
                                                    intelligenceMode: true,
                                                    localityId: item.localityId,
                                                    city: item.city || 'Chennai',
                                                })}
                                                activeOpacity={0.8}
                                                accessibilityRole="button"
                                                accessibilityLabel={`View ${item.localityName} on Area Intelligence Map`}
                                            >
                                                <Ionicons name="map-outline" size={15} color={COLORS.primary} />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.areaDetailsBtn}
                                                onPress={() => handleLocalityDetails(item)}
                                                activeOpacity={0.8}
                                                accessibilityRole="button"
                                                accessibilityLabel={`View ${item.localityName} details`}
                                            >
                                                <Ionicons name="stats-chart" size={14} color={COLORS.secondary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    topHeader: {
        paddingHorizontal: SPACING.l,
        paddingTop: Platform.OS === 'android' ? 36 : 12,
        paddingBottom: SPACING.m,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
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
    screenCategoryTag: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        color: '#6B7280',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.3,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: SPACING.l,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        padding: SPACING.l,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    stepBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.s,
    },
    stepNumber: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: COLORS.secondary,
        marginTop: 2,
    },
    selectedDestinationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    destPinCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.m,
    },
    selectedDestLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.secondary,
        textTransform: 'uppercase',
    },
    selectedDestName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.primary,
        marginTop: 1,
    },
    selectedDestSub: {
        fontSize: 12,
        color: COLORS.secondary,
        marginTop: 2,
    },
    changeDestBtn: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    changeDestText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    searchContainer: {
        marginBottom: SPACING.m,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        height: 46,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        height: 46,
        paddingHorizontal: SPACING.s,
        fontSize: 14,
        color: COLORS.primary,
    },
    predictionsDropdown: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginTop: SPACING.xs,
        overflow: 'hidden',
        ...SHADOWS.md,
    },
    predictionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
    },
    predictionText: {
        fontSize: 13,
        color: COLORS.primary,
        marginLeft: SPACING.s,
        flex: 1,
    },
    presetHeading: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.secondary,
        marginBottom: SPACING.s,
    },
    presetScroll: {
        flexDirection: 'row',
    },
    presetChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: SPACING.s,
    },
    presetChipSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    presetChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    presetChipTextSelected: {
        color: '#FFFFFF',
    },
    budgetPillsRow: {
        flexDirection: 'row',
        marginTop: SPACING.xs,
    },
    budgetPill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: SPACING.s,
    },
    budgetPillSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    budgetPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
    budgetPillTextSelected: {
        color: '#FFFFFF',
    },
    chipsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: SPACING.xs,
    },
    gridChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 6,
    },
    gridChipSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    priorityChipSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    gridChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
    gridChipTextSelected: {
        color: '#FFFFFF',
    },
    resultsSection: {
        marginTop: SPACING.s,
    },
    resultsHeader: {
        marginBottom: SPACING.m,
    },
    resultsHeaderTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    viewMapHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.pill,
        ...SHADOWS.subtle,
    },
    viewMapHeaderBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    resultsSubtitle: {
        fontSize: 13,
        color: COLORS.secondary,
        marginTop: 4,
    },
    analyzingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: SPACING.l,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 12,
    },
    analyzingText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    resultsList: {
        gap: 12,
    },
    resultCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        padding: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.m,
    },
    localityNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankBadge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 8,
    },
    rankNumber: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.secondary,
    },
    localityName: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.primary,
    },
    scoreBadge: {
        backgroundColor: '#FFFFFF',
        borderColor: COLORS.primary,
        borderWidth: 1.5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    scoreBadgeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    scoreBadgeValue: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.primary,
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: SPACING.m,
    },
    metricPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 5,
    },
    rentPill: {
        backgroundColor: '#F3F4F6',
    },
    rentPillInBudget: {
        backgroundColor: COLORS.successMuted,
    },
    metricPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    highlightsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: SPACING.m,
    },
    highlightBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    highlightText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderSubtle,
    },
    exploreStaysBtn: {
        flex: 1,
        backgroundColor: COLORS.primary,
        paddingVertical: 10,
        paddingHorizontal: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exploreStaysText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    areaMapBtn: {
        width: 38,
        height: 38,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    areaDetailsBtn: {
        width: 38,
        height: 38,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
});
