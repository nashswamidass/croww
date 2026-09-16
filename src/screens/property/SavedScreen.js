import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../../components/Typography';
import ScreenWrapper from '../../components/ScreenWrapper';
import AntigravityButton from '../../components/AntigravityButton';
import FloatingCard from '../../components/FloatingCard';
import CrowwEmptyState from '../../components/rive/CrowwEmptyState';
import SavedListingCard from '../../components/property/saved/SavedListingCard';
import SavedPropertyCard from '../../components/property/saved/SavedPropertyCard';
import SavedSearchCard from '../../components/property/saved/SavedSearchCard';
import { saveService, savedSearchService } from '../../services/property';
import { useAuth } from '../../context/AuthContext';
import { useExplore } from '../../context/ExploreContext';
import { useSavedItems } from '../../context/SavedItemsContext';
import { showAlert } from '../../utils/showAlert';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';

const SavedScreen = ({ navigation }) => {
    const { user } = useAuth();
    const { applySavedSearch } = useExplore();
    const { unsaveListing, unsaveProperty, refresh: refreshIds } = useSavedItems();
    const [section, setSection] = useState('listings');
    const [listings, setListings] = useState([]);
    const [properties, setProperties] = useState([]);
    const [searches, setSearches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async (isRefresh = false) => {
        if (!user) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const [savedListings, savedProperties, savedSearches] = await Promise.all([
                saveService.listSavedListings(),
                saveService.listSavedProperties(),
                savedSearchService.list(),
            ]);
            setListings(savedListings);
            setProperties(savedProperties);
            setSearches(savedSearches);
            await refreshIds();
        } catch (err) {
            setError(err?.message || 'Could not load saved items.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [refreshIds]);

    useFocusEffect(useCallback(() => {
        load();
    }, [load]));

    const openSearch = useCallback((search) => {
        applySavedSearch(search);
        navigation.navigate('Tabs', { screen: 'Explore' });
    }, [applySavedSearch, navigation]);

    const toggleAlerts = useCallback(async (search) => {
        try {
            await savedSearchService.setAlertsEnabled(search.id, !search.alertEnabled);
            await load(true);
        } catch (err) {
            showAlert('Alerts', err?.message || 'Could not update alerts.');
        }
    }, [load]);

    const deleteSearch = useCallback((search) => {
        showAlert('Delete search', 'Remove this saved search?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await savedSearchService.remove(search.id);
                        await load(true);
                    } catch (err) {
                        showAlert('Delete search', err?.message || 'Could not delete.');
                    }
                },
            },
        ]);
    }, [load]);

    const sections = [
        { id: 'listings', label: 'Listings', count: listings.length },
        { id: 'properties', label: 'Properties', count: properties.length },
        { id: 'searches', label: 'Searches & Alerts', count: searches.length },
    ];

    if (!user) {
        return (
            <ScreenWrapper edges={['top']}>
                <View style={styles.header}>
                    <Typography variant="display" style={styles.title}>Saved</Typography>
                    <Typography variant="bodyLarge" style={styles.subtitle}>
                        Properties, listings, and publication alert monitors.
                    </Typography>
                </View>

                <View style={styles.unauthContainer}>
                    <FloatingCard style={styles.unauthCard}>
                        <View style={styles.unauthIconWrapper}>
                            <Ionicons name="bookmark-outline" size={40} color={COLORS.accent} />
                        </View>
                        <Typography variant="titleLarge" style={styles.unauthTitle}>
                            Keep track of homes you like
                        </Typography>
                        <Typography variant="bodyMedium" style={styles.unauthSubtitle}>
                            Sign in to save listings, follow properties, and get instant notifications when new matches are published.
                        </Typography>
                        <AntigravityButton
                            title="Sign in to Croww"
                            onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
                            size="large"
                            style={styles.unauthButton}
                        />
                    </FloatingCard>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <Typography variant="display" style={styles.title}>Saved</Typography>
                <Typography variant="bodyLarge" style={styles.subtitle}>
                    Properties, listings, and publication alert monitors.
                </Typography>
            </View>

            {/* Segmented Filter Pills */}
            <View style={styles.chipsRow}>
                {sections.map((item) => {
                    const selected = item.id === section;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => setSection(item.id)}
                            style={[styles.chip, selected && styles.chipActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${item.label} (${item.count})`}
                            hitSlop={TOUCH_TARGETS.hitSlop}
                        >
                            <Typography
                                variant="caption"
                                style={[styles.chipText, selected && styles.chipTextActive]}
                            >
                                {item.label}
                            </Typography>
                            {item.count > 0 ? (
                                <View style={[styles.badge, selected && styles.badgeActive]}>
                                    <Typography variant="micro" style={[styles.badgeText, selected && styles.badgeTextActive]}>
                                        {item.count}
                                    </Typography>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={COLORS.accent} size="large" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.body}
                    refreshControl={(
                        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />
                    )}
                >
                    {error ? <Typography variant="caption" style={styles.error}>{error}</Typography> : null}

                    {section === 'listings' ? (
                        listings.length ? listings.map((item) => (
                            <SavedListingCard
                                key={item.id}
                                item={item}
                                onPress={() => {
                                    const listingId = item.listingId || item.id;
                                    if (item.missing && item.propertyId) {
                                        navigation.navigate('Property', { propertyId: item.propertyId });
                                        return;
                                    }
                                    navigation.navigate('Listing', { listingId });
                                }}
                                onUnsave={async () => {
                                    await unsaveListing(item.listingId || item.id);
                                    setListings((prev) => prev.filter((row) => row.id !== item.id));
                                }}
                            />
                        )) : (
                            <CrowwEmptyState
                                type="saved"
                                title="No saved listings yet"
                                subtitle="Bookmark interesting offerings directly while exploring on the map."
                                actionTitle="Explore Listings"
                                actionIcon="compass-outline"
                                onAction={() => navigation.navigate('Tabs', { screen: 'Explore' })}
                            />
                        )
                    ) : null}

                    {section === 'properties' ? (
                        properties.length ? properties.map((item) => (
                            <SavedPropertyCard
                                key={item.id}
                                item={item}
                                onPress={() => navigation.navigate('Property', { propertyId: item.propertyId || item.id })}
                                onUnsave={async () => {
                                    await unsaveProperty(item.propertyId || item.id);
                                    setProperties((prev) => prev.filter((row) => row.id !== item.id));
                                }}
                            />
                        )) : (
                            <CrowwEmptyState
                                type="saved"
                                title="No saved properties"
                                subtitle="Save underlying physical property records from listing detail pages."
                                actionTitle="Discover Properties"
                                actionIcon="search"
                                onAction={() => navigation.navigate('Tabs', { screen: 'Explore' })}
                            />
                        )
                    ) : null}

                    {section === 'searches' ? (
                        searches.length ? searches.map((search) => (
                            <SavedSearchCard
                                key={search.id}
                                search={search}
                                onOpen={() => openSearch(search)}
                                onEdit={() => navigation.navigate('SavedSearch', { searchId: search.id, search })}
                                onToggleAlerts={() => toggleAlerts(search)}
                                onDelete={() => deleteSearch(search)}
                            />
                        )) : (
                            <CrowwEmptyState
                                type="discovery"
                                title="No search alerts"
                                subtitle="Save a search on the Explore map to receive instant notifications when new matching properties are published."
                                actionTitle="Start a Search"
                                actionIcon="map-outline"
                                onAction={() => navigation.navigate('Tabs', { screen: 'Explore' })}
                            />
                        )
                    ) : null}
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        paddingBottom: SPACING.s,
    },
    title: {
        color: COLORS.primary,
        fontWeight: '900',
        letterSpacing: -1,
    },
    subtitle: {
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    chipsRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.s,
        gap: SPACING.s,
        flexWrap: 'wrap',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        minHeight: 42,
        borderRadius: BORDER_RADIUS.round,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surfaceElevated || COLORS.surface,
        ...SHADOWS.subtle,
    },
    chipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    chipText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    chipTextActive: {
        color: COLORS.background,
        fontWeight: '700',
    },
    badge: {
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        marginLeft: 6,
    },
    badgeActive: {
        backgroundColor: COLORS.background,
    },
    badgeText: {
        color: COLORS.textSecondary,
        fontWeight: '700',
    },
    badgeTextActive: {
        color: COLORS.accent,
        fontWeight: '800',
    },
    body: {
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.xxl,
        gap: SPACING.m,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCard: {
        padding: SPACING.xl,
        alignItems: 'center',
        textAlign: 'center',
        marginTop: SPACING.m,
    },
    emptyTitle: {
        color: COLORS.primary,
        fontWeight: '800',
        textAlign: 'center',
    },
    emptySubtitle: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 20,
    },
    error: {
        color: COLORS.error,
        marginBottom: SPACING.m,
        textTransform: 'none',
    },
    unauthContainer: {
        flex: 1,
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
    },
    unauthCard: {
        padding: SPACING.xl,
        alignItems: 'center',
        textAlign: 'center',
        marginTop: SPACING.m,
    },
    unauthIconWrapper: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: (COLORS.accent || '#E05A47') + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.m,
    },
    unauthTitle: {
        color: COLORS.primary,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: SPACING.xs,
    },
    unauthSubtitle: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xl,
        maxWidth: 380,
    },
    unauthButton: {
        width: '100%',
        maxWidth: 320,
        height: 52,
        borderRadius: 14,
    },
});

export default SavedScreen;

