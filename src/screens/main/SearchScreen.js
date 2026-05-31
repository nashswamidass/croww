import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { SERVICE_CATEGORIES } from '../../constants/services';
import { userService } from '../../services/userService';
import { getDistanceFromLatLonInKm, formatDistance } from '../../utils/distance';
import LocationSelectorModal, { AVAILABLE_CITIES } from '../../components/LocationSelectorModal';
import { locationService } from '../../services/locationService';

// Mock User Location (Bengaluru Center) - Still needed for distance calculation if GPS is off
const MOCK_USER_LOCATION = { latitude: 12.9716, longitude: 77.5946 };

const CITY_COORDINATES = {
    'Bengaluru': { latitude: 12.9716, longitude: 77.5946 },
    'Trivandrum': { latitude: 8.5241, longitude: 76.9366 },
    'Mumbai': { latitude: 19.0760, longitude: 72.8777 },
    'Delhi': { latitude: 28.7041, longitude: 77.1025 },
    'Bangalore': { latitude: 12.9716, longitude: 77.5946 },
    'Hyderabad': { latitude: 17.3850, longitude: 78.4867 },
    'Ahmedabad': { latitude: 23.0225, longitude: 72.5714 },
    'Chennai': { latitude: 13.0827, longitude: 80.2707 },
    'Kolkata': { latitude: 22.5726, longitude: 88.3639 },
    'Surat': { latitude: 21.1702, longitude: 72.8311 },
    'Pune': { latitude: 18.5204, longitude: 73.8567 },
    'Jaipur': { latitude: 26.9124, longitude: 75.7873 },
    'Goa': { latitude: 15.2993, longitude: 74.1240 },
    'Kochi': { latitude: 9.9312, longitude: 76.2673 },
};

const SearchScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [sortByDistance, setSortByDistance] = useState(true);
    const [activeTab, setActiveTab] = useState('services'); // 'services' or 'venues'
    const [providers, setProviders] = useState([]);
    const [filteredProviders, setFilteredProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enabledCategories, setEnabledCategories] = useState({});
    const [userLocation, setUserLocation] = useState(MOCK_USER_LOCATION);
    const [locationName, setLocationName] = useState('Bengaluru'); // Default display name
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [showCityUnavailableModal, setShowCityUnavailableModal] = useState(false);
    const [unavailableCityName, setUnavailableCityName] = useState('');

    useEffect(() => {
        const initializeMarketplace = async () => {
            try {
                // Fetch settings and user profile for location
                const [settings, userData] = await Promise.all([
                    userService.getMarketplaceSettings(),
                    userService.getUser()
                ]);

                if (settings?.categories) {
                    setEnabledCategories(settings.categories);
                }

                if (userData) {
                    setCurrentUser(userData);
                    if (userData.coordinates) {
                        setUserLocation(userData.coordinates);
                        setLocationName(userData.location || 'Your Location');
                    } else {
                        // Background detection if user has no saved coordinates
                        const detect = async () => {
                            const { coords, cityName: detectedCity } = await locationService.getLocation();
                            if (coords) setUserLocation(coords);
                            if (detectedCity) setLocationName(detectedCity);
                        };
                        detect();
                    }
                } else {
                    // Not logged in or no profile - detect once
                    const { coords, cityName: detectedCity } = await locationService.getLocation();
                    if (coords) setUserLocation(coords);
                    if (detectedCity) setLocationName(detectedCity);
                }

                const data = await userService.getServiceProviders();
                setProviders(data);
                setFilteredProviders(data);
            } catch (error) {
                console.error("Error initializing marketplace:", error);
            } finally {
                setLoading(false);
            }
        };
        initializeMarketplace();
    }, []);

    const visibleCategories = SERVICE_CATEGORIES.filter(cat => {
        const isEnabled = enabledCategories[cat.id] !== false;
        if (activeTab === 'venues') {
            return cat.type === 'business' && isEnabled;
        }
        return cat.type === 'provider' && isEnabled;
    });

    useEffect(() => {
        let results = providers.filter(p => {
            // Filter by Tab
            if (activeTab === 'venues' && p.userType !== 'business') return false;
            if (activeTab === 'services' && p.userType !== 'provider') return false;

            const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category?.toLowerCase().includes(searchQuery.toLowerCase());

            // Check if provider's category is enabled globally
            // Add legacy mapping for "DJ" and "Photo" to prevent vanishing
            const providerCategory = p.category === 'DJ' ? 'Music/DJ' : (p.category === 'Photo' ? 'Photography' : p.category);
            const categoryData = SERVICE_CATEGORIES.find(c => c.name === providerCategory);
            const isCategoryEnabled = categoryData ? enabledCategories[categoryData.id] !== false : true;

            const matchesCategory = !selectedCategory || providerCategory === selectedCategory;
            return matchesSearch && matchesCategory && isCategoryEnabled;
        });

        if (sortByDistance) {
            results = [...results].sort((a, b) => {
                const hasA = a.coordinates?.latitude && a.coordinates?.longitude;
                const hasB = b.coordinates?.latitude && b.coordinates?.longitude;
                // Push providers without coordinates to the bottom
                if (!hasA && !hasB) return 0;
                if (!hasA) return 1;
                if (!hasB) return -1;
                const distA = getDistanceFromLatLonInKm(
                    userLocation.latitude, userLocation.longitude,
                    a.coordinates.latitude, a.coordinates.longitude
                );
                const distB = getDistanceFromLatLonInKm(
                    userLocation.latitude, userLocation.longitude,
                    b.coordinates.latitude, b.coordinates.longitude
                );
                return distA - distB;
            });
        }

        setFilteredProviders(results);
    }, [searchQuery, selectedCategory, sortByDistance, providers, activeTab, userLocation]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedCategory(null); // Reset category filter when switching tabs
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <Typography variant="h2" style={styles.pageTitle}>Marketplace</Typography>

                {/* Search Bar - More action-oriented */}
                <NotionInput
                    placeholder={activeTab === 'services' ? "What service are you looking for?" : "Find the perfect venue or space..."}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    leftIcon="search"
                />

                {/* Tabs - Sleek segmented control */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'services' && styles.activeTab]}
                        onPress={() => handleTabChange('services')}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={activeTab === 'services' ? "flash" : "flash-outline"}
                            size={16}
                            color={activeTab === 'services' ? COLORS.accent : COLORS.secondary}
                            style={{ marginRight: 6 }}
                        />
                        <Typography variant="body" style={[styles.tabText, activeTab === 'services' && styles.activeTabText]}>
                            Services
                        </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'venues' && styles.activeTab]}
                        onPress={() => handleTabChange('venues')}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={activeTab === 'venues' ? "business" : "business-outline"}
                            size={16}
                            color={activeTab === 'venues' ? COLORS.accent : COLORS.secondary}
                            style={{ marginRight: 6 }}
                        />
                        <Typography variant="body" style={[styles.tabText, activeTab === 'venues' && styles.activeTabText]}>
                            Venues
                        </Typography>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {visibleCategories.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Typography variant="h3">Categories</Typography>
                            {selectedCategory && (
                                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                                    <Typography variant="small" style={{ color: COLORS.accent }}>Clear</Typography>
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ paddingHorizontal: SPACING.m }}>
                            {visibleCategories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.categoryButton,
                                        selectedCategory === cat.name && styles.categoryButtonActive
                                    ]}
                                    onPress={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                                >
                                    <View style={[
                                        styles.iconCircle,
                                        selectedCategory === cat.name && styles.iconCircleActive
                                    ]}>
                                        <Ionicons
                                            name={cat.icon}
                                            size={24}
                                            color={selectedCategory === cat.name ? COLORS.background : COLORS.primary}
                                        />
                                    </View>
                                    <Typography
                                        variant="small"
                                        style={[
                                            styles.categoryText,
                                            selectedCategory === cat.name && styles.categoryTextActive
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {cat.name}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Filter Row - Pill shaped filters */}
                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() => setShowLocationModal(true)}
                    >
                        <Ionicons name="location" size={14} color={COLORS.accent} />
                        {AVAILABLE_CITIES.includes(locationName) && (
                            <View style={styles.liveDotChip} />
                        )}
                        <Typography variant="small" numberOfLines={1} style={[styles.filterChipText, { flex: 1 }]}>
                            {locationName}
                        </Typography>
                        <Ionicons name="chevron-down" size={12} color={COLORS.secondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterChip, sortByDistance && styles.filterChipActive]}
                        onPress={() => setSortByDistance(!sortByDistance)}
                    >
                        <Ionicons
                            name="swap-vertical"
                            size={16}
                            color={sortByDistance ? COLORS.background : COLORS.accent}
                        />
                        <Typography
                            variant="small"
                            style={[styles.filterChipText, sortByDistance && styles.filterChipTextActive]}
                        >
                            Nearest First
                        </Typography>
                    </TouchableOpacity>
                </View>

                {filteredProviders.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <View style={styles.emptyStateIcon}>
                            <Ionicons name="search-outline" size={60} color={COLORS.surfaceHighlight} />
                        </View>
                        <Typography variant="h2" style={{ marginTop: SPACING.l, textAlign: 'center' }}>
                            No {activeTab} found nearby
                        </Typography>
                        <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.s, textAlign: 'center', paddingHorizontal: SPACING.xl }}>
                            Try adjusting your search or category filters to find what you need.
                        </Typography>

                        <View style={styles.emptyStateActions}>
                            <TouchableOpacity
                                style={styles.emptyStateButton}
                                onPress={() => navigation.navigate('Map')}
                            >
                                <Ionicons name="map" size={18} color={COLORS.background} />
                                <Typography variant="body" style={styles.emptyStateButtonText}>Search Area Map</Typography>
                            </TouchableOpacity>

                            {(currentUser?.userType === 'provider' || currentUser?.userType === 'business') && (
                                <TouchableOpacity
                                    style={[styles.emptyStateButton, styles.emptyStateButtonSecondary]}
                                    onPress={() => navigation.navigate('Profile')}
                                >
                                    <Ionicons name="add-circle" size={18} color={COLORS.accent} />
                                    <Typography variant="body" style={[styles.emptyStateButtonText, { color: COLORS.accent }]}>List Your Service</Typography>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ) : (
                    filteredProviders.map((item) => {
                        const hasCoords = item.coordinates?.latitude && item.coordinates?.longitude;
                        const distance = hasCoords
                            ? getDistanceFromLatLonInKm(
                                userLocation.latitude, userLocation.longitude,
                                item.coordinates.latitude, item.coordinates.longitude
                            )
                            : null;

                        return (
                            <NotionCard
                                key={item.id}
                                style={styles.resultCard}
                                onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}
                            >
                                <View style={styles.row}>
                                    <View style={[styles.avatar, { backgroundColor: COLORS.surfaceHighlight, overflow: 'hidden' }]}>
                                        {(item.photoURL || item.avatar) ? (
                                            <Image
                                                source={{ uri: item.photoURL || item.avatar }}
                                                style={{ width: '100%', height: '100%' }}
                                            />
                                        ) : (
                                            <Ionicons
                                                name={item.userType === 'business' ? "business" : "person"}
                                                size={20}
                                                color={COLORS.secondary}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.info}>
                                        <View style={styles.nameRow}>
                                            <Typography variant="h3">{item.name}</Typography>
                                            <View style={styles.categoryBadge}>
                                                <Typography variant="small" style={styles.categoryBadgeText}>
                                                    {item.category || (item.userType === 'business' ? 'Venue' : 'Service')}
                                                </Typography>
                                            </View>
                                        </View>
                                        <Typography variant="caption" color={COLORS.secondary}>
                                            {item.role || item.category} • {item.location}
                                        </Typography>
                                        <Typography variant="caption" color={COLORS.accent} style={{ marginTop: 4 }}>
                                            📍 {distance != null ? `${formatDistance(distance)} away` : 'No location set'}
                                        </Typography>
                                    </View>
                                    <View style={styles.meta}>
                                        {item.packages && item.packages.length > 0 ? (
                                            <Typography variant="h3" style={{ color: COLORS.primary }}>
                                                ₹{item.price}{item.priceUnit || '/hr'}
                                            </Typography>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.enquireButton}
                                                onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}
                                                activeOpacity={0.8}
                                            >
                                                <Typography variant="small" style={styles.enquireButtonText}>Enquire Now</Typography>
                                            </TouchableOpacity>
                                        )}
                                        <View style={styles.ratingRow}>
                                            <Ionicons name="star" size={14} color="#FFD700" />
                                            <Typography variant="caption" style={{ marginLeft: 4 }}>{item.rating || 'New'}</Typography>
                                        </View>
                                    </View>
                                </View>
                            </NotionCard>
                        );
                    })
                )}
            </ScrollView>

            <LocationSelectorModal
                visible={showLocationModal}
                onClose={() => setShowLocationModal(false)}
                currentCity={locationName}
                onSelect={async (city, isAvailable) => {
                    if (city === null) {
                        // "Use Current Location" — attempt detection via service
                        setLoading(true);
                        try {
                            const { coords, cityName: detectedCity } = await locationService.getLocation();
                            if (coords) {
                                setUserLocation(coords);
                                const detected = detectedCity || 'Current Location';
                                const detectedIsAvailable = AVAILABLE_CITIES.some(
                                    c => c.toLowerCase() === detected.toLowerCase()
                                );
                                if (!detectedIsAvailable) {
                                    setUnavailableCityName(detected);
                                    setShowCityUnavailableModal(true);
                                } else {
                                    setLocationName(detected);
                                }
                            }
                        } catch (e) {
                            console.warn('Location detection failed:', e);
                        } finally {
                            setLoading(false);
                        }
                        return;
                    }

                    if (!isAvailable) {
                        // City is not yet live — show coming soon popup
                        setUnavailableCityName(city);
                        setShowCityUnavailableModal(true);
                        return;
                    }

                    // Available city — switch to it
                    setLocationName(city);
                    if (CITY_COORDINATES[city]) {
                        setUserLocation(CITY_COORDINATES[city]);
                    }
                }}
            />

            {/* City Unavailable Modal */}
            <Modal
                visible={showCityUnavailableModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCityUnavailableModal(false)}
            >
                <View style={styles.unavailableOverlay}>
                    <View style={styles.unavailableCard}>
                        <View style={styles.unavailableIconCircle}>
                            <Ionicons name="rocket-outline" size={36} color={COLORS.accent} />
                        </View>
                        <Typography variant="h2" style={styles.unavailableTitle}>
                            Coming Soon to {unavailableCityName}!
                        </Typography>
                        <Typography variant="body" color={COLORS.secondary} style={styles.unavailableSubtitle}>
                            Croww is currently available in{' '}
                            <Typography variant="body" style={{ color: COLORS.primary, fontWeight: '700' }}>Bengaluru</Typography>
                            {' '}and{' '}
                            <Typography variant="body" style={{ color: COLORS.primary, fontWeight: '700' }}>Trivandrum</Typography>.
                            {' '}We're expanding soon! Meanwhile, explore amazing events and services in Bengaluru.
                        </Typography>
                        <TouchableOpacity
                            style={styles.unavailablePrimaryBtn}
                            onPress={() => {
                                setShowCityUnavailableModal(false);
                                setLocationName('Bengaluru');
                                setUserLocation(CITY_COORDINATES['Bengaluru']);
                            }}
                        >
                            <Ionicons name="map-outline" size={18} color={COLORS.background} style={{ marginRight: 6 }} />
                            <Typography variant="body" style={styles.unavailablePrimaryBtnText}>
                                Browse Events in Bengaluru
                            </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.unavailableSecondaryBtn}
                            onPress={() => setShowCityUnavailableModal(false)}
                        >
                            <Typography variant="body" style={styles.unavailableSecondaryBtnText}>
                                Maybe Later
                            </Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.m,
        paddingBottom: SPACING.s,
    },
    pageTitle: {
        textAlign: 'center',
        marginBottom: SPACING.s,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        padding: 4,
        marginBottom: SPACING.m,
        marginTop: SPACING.s,
    },
    tab: {
        flex: 1,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.s,
    },
    activeTab: {
        backgroundColor: COLORS.surface,
        ...SHADOWS.soft,
    },
    tabText: {
        color: COLORS.secondary,
        fontWeight: '600',
        fontSize: 13,
    },
    activeTabText: {
        color: COLORS.primary,
    },
    content: {
        paddingHorizontal: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    section: {
        marginBottom: SPACING.m,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    categoryScroll: {
        marginTop: SPACING.s,
        marginHorizontal: -SPACING.m,
    },
    categoryButton: {
        alignItems: 'center',
        marginHorizontal: SPACING.xs,
        minWidth: 80,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconCircleActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    categoryText: {
        fontSize: 11,
        textAlign: 'center',
        color: COLORS.secondary,
        fontWeight: '500',
    },
    categoryTextActive: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.s,
        marginBottom: SPACING.m,
        marginTop: SPACING.xs,
    },
    filterChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.s,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 6,
    },
    filterChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    filterChipText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: COLORS.background,
    },
    resultCard: {
        marginBottom: SPACING.m,
        padding: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: SPACING.m,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    categoryBadge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    categoryBadgeText: {
        fontSize: 8,
        color: COLORS.secondary,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    meta: {
        alignItems: 'flex-end',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    enquireButton: {
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.s,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    enquireButtonText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 11,
    },
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginTop: SPACING.m,
    },
    emptyStateIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateActions: {
        width: '100%',
        paddingHorizontal: SPACING.xl,
        marginTop: SPACING.l,
        gap: SPACING.s,
    },
    emptyStateButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.accent,
        paddingVertical: 12,
        borderRadius: BORDER_RADIUS.m,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    emptyStateButtonSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    emptyStateButtonText: {
        color: COLORS.background,
        fontWeight: '700',
        fontSize: 14,
    },
    liveDotChip: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00C853',
        marginRight: 2,
    },
    unavailableOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.m,
    },
    unavailableCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        padding: SPACING.xl,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    unavailableIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.accent + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    unavailableTitle: {
        textAlign: 'center',
        marginBottom: SPACING.m,
    },
    unavailableSubtitle: {
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xl,
    },
    unavailablePrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingVertical: 14,
        paddingHorizontal: SPACING.l,
        borderRadius: BORDER_RADIUS.m,
        width: '100%',
        justifyContent: 'center',
        marginBottom: SPACING.s,
    },
    unavailablePrimaryBtnText: {
        color: COLORS.background,
        fontWeight: '700',
        fontSize: 15,
    },
    unavailableSecondaryBtn: {
        paddingVertical: 12,
        width: '100%',
        alignItems: 'center',
    },
    unavailableSecondaryBtnText: {
        color: COLORS.secondary,
        fontWeight: '500',
    },
})

export default SearchScreen;
