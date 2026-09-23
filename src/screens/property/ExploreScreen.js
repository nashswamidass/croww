import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import PropertyMap from '../../components/property/PropertyMap';
import PropertySearchBar from '../../components/property/PropertySearchBar';
import PropertyFilters from '../../components/property/PropertyFilters';
import PropertyResultCard from '../../components/property/PropertyResultCard';
import SaveSearchModal from '../../components/property/saved/SaveSearchModal';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import { useAuth } from '../../context/AuthContext';
import { useExplore, DEFAULT_EXPLORE_FILTERS } from '../../context/ExploreContext';
import { useExploreLocation } from '../../hooks/useExploreLocation';
import { useExploreDiscovery } from '../../hooks/useExploreDiscovery';
import { savedSearchService } from '../../services/property';
import { showAlert } from '../../utils/showAlert';
import { LAUNCH_VIEWPORT } from '../../constants/explore';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS, FONT_SIZES } from '../../constants/theme';
import CrowwRive from '../../components/rive/CrowwRive';
import { EMPTY_STATES_RIVE_SPEC } from '../../components/rive/specs/emptyStates.spec';
import { useTaxonomy } from '../../hooks/useTaxonomy';
import AreaIntelligenceOverlay, { INTELLIGENCE_PHASES } from '../../components/intelligence/AreaIntelligenceOverlay';
import AreaQuestionnaireSheet from '../../components/intelligence/AreaQuestionnaireSheet';
import LocalityDetailSheet from '../../components/intelligence/LocalityDetailSheet';
import { localityMatcherService } from '../../services/intelligence/localityMatcherService';
import { getFloatingNavbarClearance } from '../../constants/layout';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import DesktopRightPanel from '../../components/desktop/DesktopRightPanel';
import DesktopAreaIntelligencePanel from '../../components/desktop/DesktopAreaIntelligencePanel';
import CrowwAreaIntelligenceIcon from '../../components/icons/CrowwAreaIntelligenceIcon';

const CARD_WIDTH = 220;
const CARD_GAP = 10;
const CARD_SNAP = CARD_WIDTH + CARD_GAP; // 230

const SAMPLE_PREVIEW_LISTINGS = [
    {
        listingId: 'preview_egmore_stay',
        id: 'preview_egmore_stay',
        title: 'Central 1 BHK Private Stay in Egmore',
        category: 'stay_private_room',
        subtype: 'Private Room',
        bedrooms: 1,
        bathrooms: 1,
        carpetAreaSqFt: 240,
        rentAmountMonthly: 17500,
        price: 17500,
        currency: '₹',
        transactionType: 'rent',
        localityName: 'Egmore',
        city: 'Chennai',
        latitude: 13.0780,
        longitude: 80.2600,
        mapCoordinate: { latitude: 13.0780, longitude: 80.2600 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
    {
        listingId: 'preview_anna_nagar_room',
        id: 'preview_anna_nagar_room',
        title: 'Premium Independent Room in Anna Nagar',
        category: 'stay_private_room',
        subtype: 'Private Room',
        bedrooms: 1,
        bathrooms: 1,
        carpetAreaSqFt: 280,
        rentAmountMonthly: 28000,
        price: 28000,
        currency: '₹',
        transactionType: 'rent',
        localityName: 'Anna Nagar',
        city: 'Chennai',
        latitude: 13.0850,
        longitude: 80.2100,
        mapCoordinate: { latitude: 13.0850, longitude: 80.2100 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
    {
        listingId: 'preview_t_nagar_shared',
        id: 'preview_t_nagar_shared',
        title: 'Spacious 2 BHK Shared Space in T Nagar',
        category: 'stay_shared_room',
        subtype: 'Shared Room',
        bedrooms: 2,
        bathrooms: 2,
        carpetAreaSqFt: 350,
        rentAmountMonthly: 12000,
        price: 12000,
        currency: '₹',
        transactionType: 'rent',
        localityName: 'T Nagar',
        city: 'Chennai',
        latitude: 13.0418,
        longitude: 80.2341,
        mapCoordinate: { latitude: 13.0418, longitude: 80.2341 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
    {
        listingId: 'preview_adyar_private_room',
        id: 'preview_adyar_private_room',
        title: 'Furnished Private Room in Adyar',
        category: 'stay_private_room',
        subtype: 'Private Room',
        bedrooms: 1,
        bathrooms: 1,
        carpetAreaSqFt: 220,
        rentAmountMonthly: 8000,
        price: 8000,
        currency: '₹',
        transactionType: 'rent',
        localityName: 'Adyar',
        city: 'Chennai',
        latitude: 13.0012,
        longitude: 80.2565,
        mapCoordinate: { latitude: 13.0012, longitude: 80.2565 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
    {
        listingId: 'preview_adyar_coliving',
        id: 'preview_adyar_coliving',
        title: 'Modern Co-living Suite in Adyar',
        category: 'stay_coliving',
        subtype: 'Co-living',
        bedrooms: 1,
        bathrooms: 1,
        carpetAreaSqFt: 310,
        rentAmountMonthly: 21000,
        price: 21000,
        currency: '₹',
        transactionType: 'rent',
        localityName: 'Adyar',
        city: 'Chennai',
        latitude: 13.0060,
        longitude: 80.2520,
        mapCoordinate: { latitude: 13.0060, longitude: 80.2520 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
    {
        listingId: 'preview_thiruvanmiyur_studio',
        id: 'preview_thiruvanmiyur_studio',
        title: 'Coastal Studio Stay in Thiruvanmiyur',
        category: 'stay_private_room',
        subtype: 'Private Room',
        bedrooms: 1,
        bathrooms: 1,
        carpetAreaSqFt: 260,
        rentAmountMonthly: 50000,
        price: 50000,
        currency: '₹',
        transactionType: 'rent',
        localityName: 'Thiruvanmiyur',
        city: 'Chennai',
        latitude: 12.9850,
        longitude: 80.2600,
        mapCoordinate: { latitude: 12.9850, longitude: 80.2600 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
    {
        listingId: 'preview_velachery_flat',
        id: 'preview_velachery_flat',
        title: 'Bed Space in Velachery Connected Hub',
        category: 'stay_bed',
        subtype: 'Bed',
        bedrooms: 1,
        bathrooms: 1,
        carpetAreaSqFt: 180,
        rentAmountMonthly: 100000,
        price: 100000,
        currency: '₹',
        transactionType: 'rent',
        localityName: 'Velachery',
        city: 'Chennai',
        latitude: 12.9750,
        longitude: 80.2200,
        mapCoordinate: { latitude: 12.9750, longitude: 80.2200 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
    {
        listingId: 'preview_omr_coliving',
        id: 'preview_omr_coliving',
        title: 'Luxury Villa on OMR Corridor',
        category: 'sale_villa',
        subtype: 'Villa',
        bedrooms: 4,
        bathrooms: 4,
        carpetAreaSqFt: 2900,
        price: 20000000,
        currency: '₹',
        transactionType: 'sale',
        localityName: 'OMR',
        city: 'Chennai',
        latitude: 12.8950,
        longitude: 80.2280,
        mapCoordinate: { latitude: 12.8950, longitude: 80.2280 },
        coverThumbnailUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&auto=format&fit=crop&q=80',
        coverUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&auto=format&fit=crop&q=80',
        verified: true,
        verificationStatus: 'VERIFIED',
    },
];

// Preview inventory is strictly allowed ONLY in development (__DEV__) or explicit QA/production-preview builds.
// In a normal production build, this evaluates to false at compile/bundle time, completely eliminating synthetic listings and preview UI.
const IS_PREVIEW_ENV = Boolean(
    __DEV__ ||
    process.env.EXPO_PUBLIC_APP_ENV === 'production-preview' ||
    process.env.EXPO_PUBLIC_APP_ENV === 'qa'
);

const ExploreScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const route = useRoute();
    const { isDesktop, isTablet, isMobile } = useResponsiveLayout();
    const desktopListRef = useRef(null);
    const {
        viewport,
        setViewport,
        filters,
        setFilters,
        selectedListingId,
        setSelectedListingId,
        setSearchLocation,
        searchLocation,
        city,
        setCity,
        selectCity,
        localityId,
        focusLocality,
        focusRegion,
        isIntelligenceMode,
        setIntelligenceMode,
        areasDrawerOpen,
        setAreasDrawerOpen,
        areasDestination,
        setAreasDestination,
    } = useExplore();
    const { consumerCategories } = useTaxonomy();
    const { userLocation, requestLocation, status: _locationStatus } = useExploreLocation();
    const { results, error, loading, refreshing } = useExploreDiscovery();
    const [query, setQuery] = useState('');
    const [followRegion, setFollowRegion] = useState(null);
    const { user } = useAuth();
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [areasMatcherRan, setAreasMatcherRan] = useState(false);

    // Carousel & View Mode state
    const carouselRef = useRef(null);
    const isProgrammaticScrollRef = useRef(false);
    const scrollTimeoutRef = useRef(null);
    const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
    const setSelectedListingIdRef = useRef(setSelectedListingId);
    setSelectedListingIdRef.current = setSelectedListingId;

    // Area Intelligence state
    const [intelligencePhase, setIntelligencePhase] = useState(INTELLIGENCE_PHASES.INTRO);
    const [scoredLocalities, setScoredLocalities] = useState([]);
    const [selectedLocality, setSelectedLocality] = useState(null);
    const [selectedLocalityData, setSelectedLocalityData] = useState(null);
    const [isAreaDetailOpen, setIsAreaDetailOpen] = useState(false);
    const [areasInputs, setAreasInputs] = useState({
        destination: null,
        budget: null,
        commuteMode: 'transit',
        priorities: ['short_commute', 'low_rent'],
    });

    const canSaveSearch = savedSearchService.isMeaningful({
        city,
        localityId,
        searchLocation,
        viewport,
        filters,
    });
    const draftSearch = savedSearchService.canonicalizeFromExplore({
        city,
        localityId,
        searchLocation,
        viewport,
        filters,
    });

    useEffect(() => {
        if (route.params?.city && route.params.city !== city) {
            selectCity(route.params.city);
        }
        if (route.params?.intelligenceMode) {
            setIntelligenceMode(true);
            setIntelligencePhase(INTELLIGENCE_PHASES.MAP);
        }
        if (route.params?.localityId) {
            focusLocality({
                id: route.params.localityId,
                name: route.params.localityName || route.params.locality,
                viewport: route.params.viewport,
                city: route.params.city,
            });
        } else if (route.params?.localityName || route.params?.locality) {
            setQuery(route.params.localityName || route.params.locality);
        }
    }, [route.params, selectCity, focusLocality, city, setIntelligenceMode]);

    useEffect(() => {
        if (!focusRegion) return;
        setFollowRegion({
            latitude: focusRegion.latitude,
            longitude: focusRegion.longitude,
            latitudeDelta: focusRegion.latitudeDelta,
            longitudeDelta: focusRegion.longitudeDelta,
        });
    }, [focusRegion]);

    const initialRegion = viewport || LAUNCH_VIEWPORT;

    const [qaPreviewEnabled, setQaPreviewEnabled] = useState(IS_PREVIEW_ENV);
    const brandTapCountRef = useRef(0);
    const brandTapTimeoutRef = useRef(null);

    const handleBrandPress = useCallback(() => {
        if (!IS_PREVIEW_ENV) return;
        brandTapCountRef.current += 1;
        if (brandTapTimeoutRef.current) clearTimeout(brandTapTimeoutRef.current);
        if (brandTapCountRef.current >= 5) {
            brandTapCountRef.current = 0;
            setQaPreviewEnabled((prev) => !prev);
        } else {
            brandTapTimeoutRef.current = setTimeout(() => {
                brandTapCountRef.current = 0;
            }, 1500);
        }
    }, []);

    const displayedResults = useMemo(() => {
        const remoteListings = results || [];
        const combined = [...remoteListings];
        // Production safety: preview inventory is strictly gated by build/environment flag (IS_PREVIEW_ENV).
        // In a normal production build, IS_PREVIEW_ENV is false, ensuring ZERO synthetic listings or backdoor injection.
        if (IS_PREVIEW_ENV && qaPreviewEnabled && (!city || city === 'Chennai')) {
            SAMPLE_PREVIEW_LISTINGS.forEach((preview) => {
                if (!combined.some((item) => (item.id === preview.id || item.listingId === preview.listingId))) {
                    combined.push(preview);
                }
            });
        }
        let base = combined;
        if (filters.category) {
            base = base.filter((l) => l.category === filters.category);
        }
        if (!query || !query.trim()) return base;
        const q = query.trim().toLowerCase();
        return base.filter((r) =>
            (r.title && r.title.toLowerCase().includes(q))
            || (r.localityName && r.localityName.toLowerCase().includes(q))
            || (r.cityName && r.cityName.toLowerCase().includes(q))
            || (r.address && r.address.toLowerCase().includes(q))
        );
    }, [results, city, filters, query, qaPreviewEnabled]);

    const userCoordinate = useMemo(() => {
        if (!userLocation || userLocation.method === 'launch-city') return null;
        return { latitude: userLocation.latitude, longitude: userLocation.longitude };
    }, [userLocation]);

    const onRegionChangeComplete = useCallback((region) => {
        if (!region) return;
        setViewport((prev) => {
            if (prev
                && Math.abs(prev.latitude - region.latitude) < 0.0004
                && Math.abs(prev.longitude - region.longitude) < 0.0004
                && Math.abs(prev.latitudeDelta - region.latitudeDelta) < 0.004
                && Math.abs(prev.longitudeDelta - region.longitudeDelta) < 0.004
            ) {
                return prev;
            }
            return {
                latitude: region.latitude,
                longitude: region.longitude,
                latitudeDelta: region.latitudeDelta,
                longitudeDelta: region.longitudeDelta,
            };
        });
    }, [setViewport]);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    const getItemLayout = useCallback((_, index) => ({
        length: CARD_SNAP,
        offset: CARD_SNAP * index,
        index,
    }), []);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 60,
        waitForInteraction: true,
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (isProgrammaticScrollRef.current) return;
        if (viewableItems && viewableItems.length > 0) {
            const centerItem = viewableItems[0]?.item;
            if (centerItem?.listingId) {
                setSelectedListingIdRef.current(centerItem.listingId);
            }
        }
    }).current;

    const openListing = useCallback((item) => {
        setSelectedListingId(item.listingId);
        navigation.navigate('Listing', { listingId: item.listingId, initialListing: item });
    }, [navigation, setSelectedListingId]);

    const onSelectMarker = useCallback((item) => {
        if (!item?.listingId) return;
        setSelectedListingId(item.listingId);
        const index = displayedResults.findIndex(r => r.listingId === item.listingId);
        if (index !== -1) {
            if (isDesktop && desktopListRef.current) {
                try {
                    desktopListRef.current.scrollToIndex({
                        index,
                        animated: true,
                        viewPosition: 0.1,
                    });
                } catch (_err) {
                    desktopListRef.current.scrollToOffset({
                        offset: index * 240,
                        animated: true,
                    });
                }
            } else if (carouselRef.current) {
                isProgrammaticScrollRef.current = true;
                if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
                try {
                    carouselRef.current.scrollToIndex({
                        index,
                        animated: true,
                        viewPosition: 0.5,
                    });
                } catch (_err) {
                    carouselRef.current.scrollToOffset({
                        offset: index * CARD_SNAP,
                        animated: true,
                    });
                }
                scrollTimeoutRef.current = setTimeout(() => {
                    isProgrammaticScrollRef.current = false;
                }, 350);
            }
        }
    }, [displayedResults, isDesktop, setSelectedListingId]);

    const onSelectCard = useCallback((item) => {
        setSelectedListingId(item.listingId);
        if (item.mapCoordinate) {
            setFollowRegion({
                ...item.mapCoordinate,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            });
        }
    }, [setSelectedListingId]);

    const onSearchPlace = useCallback((place) => {
        setSearchLocation(place);
        const next = {
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
        };
        setViewport(next);
        setFollowRegion(next);
        setSelectedListingId(null);
    }, [setSearchLocation, setViewport, setSelectedListingId]);

    const goToMe = useCallback(async () => {
        const coords = await requestLocation();
        if (coords?.latitude) {
            const next = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
            };
            setViewport(next);
            setFollowRegion(next);
        }
    }, [requestLocation, setViewport]);

    const onSaveSearch = useCallback(async ({ name, alertEnabled }) => {
        setSaveBusy(true);
        setSaveError(null);
        try {
            const result = await savedSearchService.createFromExplore({
                city,
                localityId,
                searchLocation,
                viewport,
                filters,
                name,
                alertEnabled,
            });
            if (result.status === 'duplicate') {
                setSaveOpen(false);
                showAlert('Search already saved', 'You already saved these filters.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Open',
                        onPress: () => navigation.navigate('SavedSearch', {
                            searchId: result.search.id,
                            search: result.search,
                        }),
                    },
                ]);
                return;
            }
            setSaveOpen(false);
            showAlert('Search saved', alertEnabled
                ? 'Alerts are on for newly published matches.'
                : 'Saved. You can turn on alerts later.');
        } catch (err) {
            setSaveError(err?.message || 'Could not save search.');
        } finally {
            setSaveBusy(false);
        }
    }, [city, localityId, searchLocation, viewport, filters, navigation]);



    const handleRunAreasMatcher = useCallback(async (inputs) => {
        if (!inputs) return;
        setAreasInputs(inputs);
        try {
            const matches = await localityMatcherService.findMatches({
                destination: inputs.destination,
                budget: inputs.budget,
                commuteMode: inputs.commuteMode,
                priorities: inputs.priorities,
                city: city || 'Chennai',
            });

            const candidates = matches.map((m) => ({
                locality: {
                    id: m.localityId,
                    name: m.localityName,
                    city: m.city,
                    latitude: m.latitude,
                    longitude: m.longitude,
                    boundaries: m.boundaries || null,
                    staysCount: m.staysCount ?? null,
                    intelligence: m.intelligence || null,
                    publishedScore: m.publishedScore || (m.areaScore != null ? { overallScore: m.areaScore } : null) || m.intelligence?.publishedScore || null,
                },
                score: m.areaScore ?? null,
                areaScore: m.areaScore ?? null,
                matchScore: m.matchScore ?? null,
                typicalRentFormatted: m.typicalRentFormatted,
                typicalRent: m.typicalRent,
                inBudget: m.inBudget,
                commute: m.commute,
                highlights: m.highlights,
                result: m,
            }));

            setScoredLocalities(candidates);
            setIntelligencePhase(INTELLIGENCE_PHASES.MAP);
            setAreasDrawerOpen(false);
            setAreasMatcherRan(true);

            if (candidates.length > 0) {
                const targetId = route.params?.localityId;
                const match = targetId ? candidates.find((s) => s.locality?.id === targetId) : null;
                const top = match || candidates[0];
                setSelectedLocality(top.locality);
                setSelectedLocalityData(top);
                setIsAreaDetailOpen(false);

                if (top.locality.latitude && top.locality.longitude) {
                    setFollowRegion({
                        latitude: top.locality.latitude,
                        longitude: top.locality.longitude,
                        latitudeDelta: 0.045,
                        longitudeDelta: 0.045,
                    });
                }
            } else {
                setSelectedLocality(null);
                setSelectedLocalityData(null);
                setIsAreaDetailOpen(false);
            }
        } catch (err) {
            console.warn('[ExploreScreen] handleRunAreasMatcher failed', err);
        }
    }, [city, route.params?.localityId, setAreasDrawerOpen]);

    useEffect(() => {
        if (isIntelligenceMode && scoredLocalities.length === 0 && !areasDrawerOpen && !areasMatcherRan) {
            setAreasDrawerOpen(true);
        }
    }, [isIntelligenceMode, scoredLocalities.length, areasDrawerOpen, areasMatcherRan, setAreasDrawerOpen]);

    useEffect(() => {
        if (route.params?.intelligenceMode && !isIntelligenceMode) {
            setIntelligenceMode(true);
            setAreasDrawerOpen(true);
        }
    }, [route.params?.intelligenceMode, isIntelligenceMode, setIntelligenceMode, setAreasDrawerOpen]);

    const handleSelectLocality = useCallback((locality, item) => {
        setSelectedLocality(locality);
        const matchData = item || scoredLocalities.find((s) => s.locality?.id === locality?.id) || null;
        setSelectedLocalityData(matchData);
        setIsAreaDetailOpen(false);
        if (locality?.latitude && locality?.longitude) {
            setFollowRegion({
                latitude: locality.latitude,
                longitude: locality.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            });
        }
    }, [scoredLocalities]);

    const handleExploreLocality = useCallback((locality) => {
        if (!locality) return;
        const targetCity = locality.city || city || 'Chennai';
        setCity(targetCity);
        setQuery(locality.name || '');
        focusLocality({
            id: locality.id,
            name: locality.name,
            city: targetCity,
            viewport: {
                latitude: locality.latitude,
                longitude: locality.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            },
        });
        if (locality.latitude && locality.longitude) {
            const next = {
                latitude: locality.latitude,
                longitude: locality.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            };
            setViewport(next);
            setFollowRegion(next);
        }
        setSelectedLocality(null);
        setSelectedLocalityData(null);
        setIntelligenceMode(false);
    }, [focusLocality, city, setCity, setViewport, setIntelligenceMode]);

    const renderDesktopLocalityCard = useCallback(({ item, index }) => {
        const isSelected = item.locality?.id === selectedLocality?.id;
        const score = item.score != null ? item.score : item.areaScore;
        const matchPct = item.matchScore != null ? item.matchScore : null;

        return (
            <TouchableOpacity
                style={[styles.desktopLocalityCard, isSelected && styles.desktopLocalityCardSelected]}
                onPress={() => {
                    handleSelectLocality(item.locality, item);
                    setSelectedLocalityData(item);
                }}
                activeOpacity={0.85}
            >
                <View style={styles.locCardTopRow}>
                    <View style={styles.locCardRankBadge}>
                        <Text style={styles.locCardRankText}>#{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text style={styles.locCardName} numberOfLines={1}>{item.locality?.name}</Text>
                        <Text style={styles.locCardCity}>{item.locality?.city || 'Chennai'}</Text>
                    </View>
                    {score != null && (
                        <View style={styles.locCardScoreBadge}>
                            <Text style={styles.locCardScoreValue}>{score}</Text>
                            <Text style={styles.locCardScoreLabel}>Area Score</Text>
                        </View>
                    )}
                </View>

                {/* Metrics Row: Commute + Rent + Personal Match */}
                <View style={styles.locCardMetricsRow}>
                    {matchPct != null && (
                        <View style={styles.locMetricPill}>
                            <Ionicons name="sparkles" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                            <Text style={styles.locMetricText}>{matchPct}% Match</Text>
                        </View>
                    )}
                    {item.commute?.durationMinutes != null && (
                        <View style={styles.locMetricPill}>
                            <Ionicons name="time-outline" size={12} color={COLORS.secondary} style={{ marginRight: 4 }} />
                            <Text style={styles.locMetricText}>~{item.commute.durationMinutes} min</Text>
                        </View>
                    )}
                    {item.typicalRentFormatted && (
                        <View style={styles.locMetricPill}>
                            <Ionicons name="wallet-outline" size={12} color={COLORS.secondary} style={{ marginRight: 4 }} />
                            <Text style={styles.locMetricText}>{item.typicalRentFormatted}</Text>
                        </View>
                    )}
                </View>

                {/* Highlights */}
                {Array.isArray(item.highlights) && item.highlights.length > 0 && (
                    <Text style={styles.locCardHighlights} numberOfLines={2}>
                        {item.highlights.join(' · ')}
                    </Text>
                )}

                {/* Actions */}
                <View style={styles.locCardActionsRow}>
                    <TouchableOpacity
                        style={styles.locDetailsBtn}
                        onPress={() => {
                            handleSelectLocality(item.locality, item);
                            setSelectedLocalityData(item);
                            setIsAreaDetailOpen(true);
                        }}
                    >
                        <Text style={styles.locDetailsBtnText}>View Area Intelligence</Text>
                        <Ionicons name="arrow-forward" size={13} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.locExploreBtn}
                        onPress={() => handleExploreLocality(item.locality)}
                    >
                        <Text style={styles.locExploreBtnText}>Explore Stays</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    }, [handleSelectLocality, handleExploreLocality, selectedLocality?.id]);

    const mapLocalityProperties = useMemo(() => {
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
            locality: item.locality,
            score: item.score,
            result: item.result,
        }));
    }, [scoredLocalities]);

    const emptyMessage = error
        ? error
        : loading
            ? null
            : displayedResults.length === 0
                ? (filters.category || filters.bhk || filters.minPrice || query.trim()
                    ? 'No properties match these filters in view.'
                    : `No published properties in this part of ${city || 'the city'} yet.`)
                : null;

    const cardCarouselBottom = getFloatingNavbarClearance(insets, 12);
    const floatingControlsBottom = cardCarouselBottom + (emptyMessage ? 175 : 205);

    return (
        <ScreenWrapper edges={isDesktop ? [] : ['top']}>
            <View style={[styles.root, isDesktop && styles.desktopRoot]}>
                {/* 1. Map Canvas */}
                <View style={[styles.mapCanvas, isDesktop && styles.desktopMapContainer]}>
                    <PropertyMap
                        initialRegion={initialRegion}
                        followRegion={followRegion}
                        listings={isIntelligenceMode && intelligencePhase === INTELLIGENCE_PHASES.MAP ? mapLocalityProperties : displayedResults}
                        selectedId={isIntelligenceMode ? selectedLocality?.id : selectedListingId}
                        userCoordinate={userCoordinate}
                        onSelect={isIntelligenceMode ? (item) => handleSelectLocality(item?.locality || item, item) : onSelectMarker}
                        onRegionChangeComplete={onRegionChangeComplete}
                        onMapPress={() => {
                            if (isIntelligenceMode) {
                                setSelectedLocality(null);
                                setSelectedLocalityData(null);
                                setIsAreaDetailOpen(false);
                            } else {
                                setSelectedListingId(null);
                            }
                        }}
                        intelligenceMode={isIntelligenceMode}
                        localityRegions={scoredLocalities}
                    />

                    {/* Floating Map Controls on Desktop (recenter & save) */}
                    {isDesktop && (
                        <View style={styles.desktopFloatingControls} pointerEvents="box-none">
                            {refreshing ? (
                                <View style={styles.refreshBadge}>
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                    <Typography variant="micro" style={styles.refreshText}>Updating</Typography>
                                </View>
                            ) : null}

                            {canSaveSearch ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        if (!user) {
                                            setAuthModalVisible(true);
                                            return;
                                        }
                                        setSaveError(null);
                                        setSaveOpen(true);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Save search"
                                    style={styles.floatingSaveBtn}
                                    hitSlop={TOUCH_TARGETS.hitSlop}
                                >
                                    <Ionicons name="bookmark-outline" size={18} color={COLORS.primary} />
                                    <Typography variant="caption" style={styles.floatingSaveText}>Save</Typography>
                                </TouchableOpacity>
                            ) : null}

                            <TouchableOpacity
                                style={styles.recenterBtn}
                                onPress={goToMe}
                                accessibilityRole="button"
                                accessibilityLabel="Center on my location"
                                hitSlop={TOUCH_TARGETS.hitSlop}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="locate" size={22} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Desktop Contextual Right Panel */}
                {isDesktop && (
                    <DesktopRightPanel
                        width={460}
                        title={
                            isIntelligenceMode
                                ? (isAreaDetailOpen && selectedLocality ? selectedLocality.name : 'Area Intelligence')
                                : `${displayedResults.length} Verified Stays`
                        }
                        subtitle={
                            isIntelligenceMode
                                ? (isAreaDetailOpen && selectedLocality ? (selectedLocality.city || city || 'Chennai') : `Ranked for ${areasInputs.destination?.name || 'Chennai'}`)
                                : (filters?.category ? `Filtered by ${filters.category}` : `Verified homes in ${city || 'Chennai'}`)
                        }
                        headerRight={
                            isIntelligenceMode && !areasDrawerOpen && scoredLocalities.length > 0 ? (
                                <TouchableOpacity
                                    style={styles.desktopTuneBtn}
                                    onPress={() => setAreasDrawerOpen(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Tune Area Intelligence Preferences"
                                >
                                    <Ionicons name="options-outline" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                                    <Text style={styles.desktopTuneBtnText}>Tune</Text>
                                </TouchableOpacity>
                            ) : null
                        }
                        onClose={
                            isIntelligenceMode
                                ? (isAreaDetailOpen ? () => setIsAreaDetailOpen(false) : () => setIntelligenceMode(false))
                                : null
                        }
                    >
                        {isIntelligenceMode ? (
                            areasDrawerOpen || scoredLocalities.length === 0 ? (
                                <DesktopAreaIntelligencePanel
                                    initialDestination={areasInputs.destination}
                                    initialBudget={areasInputs.budget}
                                    initialCommuteMode={areasInputs.commuteMode}
                                    initialPriorities={areasInputs.priorities}
                                    onComplete={handleRunAreasMatcher}
                                    onClose={scoredLocalities.length > 0 ? () => setAreasDrawerOpen(false) : null}
                                />
                            ) : isAreaDetailOpen && selectedLocality ? (
                                <LocalityDetailSheet
                                    locality={selectedLocality}
                                    scoreResult={selectedLocalityData?.result || selectedLocalityData}
                                    onExplore={handleExploreLocality}
                                    onClose={() => setIsAreaDetailOpen(false)}
                                    isDesktop
                                />
                            ) : (
                                <FlatList
                                    data={scoredLocalities}
                                    keyExtractor={(item) => item.locality?.id || String(item.score)}
                                    renderItem={renderDesktopLocalityCard}
                                    contentContainerStyle={styles.desktopListContent}
                                    showsVerticalScrollIndicator={false}
                                />
                            )
                        ) : (
                            <View style={styles.desktopExploreRightContent}>
                                <View style={styles.desktopFiltersWrapper}>
                                    <PropertyFilters
                                        filters={filters}
                                        onChange={setFilters}
                                        resultCount={displayedResults.length}
                                    />
                                </View>

                                {displayedResults.length === 0 ? (
                                    <View style={styles.desktopEmptyState}>
                                        <CrowwRive
                                            artboard={EMPTY_STATES_RIVE_SPEC.artboards.discovery}
                                            artboardName={EMPTY_STATES_RIVE_SPEC.artboards.discovery}
                                            stateMachineName={EMPTY_STATES_RIVE_SPEC.stateMachine}
                                            inputs={{ isActive: true }}
                                            fallbackType="empty-discovery"
                                            fallbackSize={48}
                                            style={{ width: 48, height: 48, marginBottom: 8 }}
                                        />
                                        <Typography variant="titleSmall" style={styles.emptyTitle}>
                                            No spaces match these filters
                                        </Typography>
                                        <Typography variant="caption" style={styles.emptySubtitle}>
                                            Try adjusting category or rent range to discover verified homes.
                                        </Typography>
                                        <TouchableOpacity
                                            onPress={() => setFilters(DEFAULT_EXPLORE_FILTERS)}
                                            style={styles.switchCityBtn}
                                        >
                                            <Typography variant="bodyMedium" style={styles.switchCityText}>
                                                Reset Filters
                                            </Typography>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <FlatList
                                        ref={desktopListRef}
                                        data={displayedResults}
                                        keyExtractor={(item) => item.listingId}
                                        renderItem={({ item }) => (
                                            <View style={styles.desktopListItemWrapper}>
                                                <PropertyResultCard
                                                    item={item}
                                                    layout="list"
                                                    selected={item.listingId === selectedListingId}
                                                    onPress={() => {
                                                        onSelectCard(item);
                                                        openListing(item);
                                                    }}
                                                />
                                            </View>
                                        )}
                                        contentContainerStyle={styles.desktopListContent}
                                        showsVerticalScrollIndicator={false}
                                    />
                                )}
                            </View>
                        )}
                    </DesktopRightPanel>
                )}

                {/* Mobile Overlays: Only rendered when !isDesktop */}
                {!isDesktop && (
                    <>
                        {/* Areas Mode Overlay (Croww | Areas header + Tune/Exit + Corner Legend + Compact Card + Gated Detail Sheet) */}
                        {isIntelligenceMode ? (
                    <AreaIntelligenceOverlay
                        scoredLocalities={scoredLocalities}
                        selectedLocality={selectedLocality}
                        selectedLocalityData={selectedLocalityData}
                        isDetailOpen={isAreaDetailOpen}
                        matcherRan={areasMatcherRan}
                        city={city}
                        onResetPreferences={() => {
                            setAreasMatcherRan(false);
                            setAreasDrawerOpen(true);
                        }}
                        onSelectLocality={handleSelectLocality}
                        onOpenLocalityDetail={() => setIsAreaDetailOpen(true)}
                        onCloseLocalityDetail={() => setIsAreaDetailOpen(false)}
                        onExploreLocality={handleExploreLocality}
                        onClose={() => {
                            setIntelligenceMode(false);
                            setAreasDrawerOpen(false);
                            setAreasMatcherRan(false);
                            setSelectedLocality(null);
                            setSelectedLocalityData(null);
                            setIsAreaDetailOpen(false);
                        }}
                        onDismissLocality={() => {
                            setSelectedLocality(null);
                            setSelectedLocalityData(null);
                            setIsAreaDetailOpen(false);
                        }}
                    />
                ) : (
                    <>
                        {/* 2. Floating Top Search & Refinement Island */}
                        <View style={styles.floatingTop} pointerEvents="box-none">
                            {/* Brand & City / Notification Row */}
                            <View style={styles.brandRow}>
                                {IS_PREVIEW_ENV ? (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={handleBrandPress}
                                        style={styles.brandBadge}
                                        accessibilityRole="button"
                                        accessibilityLabel="Croww brand preview toggle"
                                    >
                                        <Image
                                            source={require('../../../assets/croww-logo.png')}
                                            style={styles.brandLogo}
                                            resizeMode="contain"
                                            accessibilityLabel="Croww"
                                        />
                                        <View style={[styles.brandDot, qaPreviewEnabled && { backgroundColor: COLORS.accent }]} />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.brandBadge}>
                                        <Image
                                            source={require('../../../assets/croww-logo.png')}
                                            style={styles.brandLogo}
                                            resizeMode="contain"
                                            accessibilityLabel="Croww"
                                        />
                                        <View style={styles.brandDot} />
                                    </View>
                                )}

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const nextCity = (city === 'Chennai') ? 'Bengaluru' : 'Chennai';
                                            selectCity(nextCity);
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Current city: ${city}. Tap to switch.`}
                                        style={styles.cityPill}
                                        hitSlop={TOUCH_TARGETS.hitSlop}
                                    >
                                        <Ionicons name="location-sharp" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
                                        <Typography variant="caption" style={styles.cityPillText}>
                                            {city || 'Chennai'} ▾
                                        </Typography>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('Settings')}
                                        accessibilityRole="button"
                                        accessibilityLabel="Settings"
                                        style={styles.profileBtn}
                                        hitSlop={TOUCH_TARGETS.hitSlop}
                                    >
                                        <Ionicons name="settings-outline" size={18} color={COLORS.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.searchRow}>
                                <View style={{ flex: 1 }}>
                                    <PropertySearchBar
                                        value={query}
                                        onChangeText={setQuery}
                                        onSelectPlace={onSearchPlace}
                                        placeholder="Search area, locality or landmark"
                                        city={city || 'Chennai'}
                                    />
                                </View>
                            </View>

                            {/* Commute & Locality Matcher Banner */}
                            <View style={styles.commuteMatcherBanner}>
                                <TouchableOpacity
                                    style={styles.commuteMatcherBannerTouch}
                                    onPress={() => navigation.navigate('AreaMatcher')}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel="Where do you work or study? Find the best areas for your commute and budget"
                                >
                                    <View style={styles.commuteBannerIconCircle}>
                                        <Ionicons name="compass-outline" size={16} color="#FFFFFF" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.commuteBannerTitle} numberOfLines={1}>
                                            Where do you work or study?
                                        </Text>
                                        <Text style={styles.commuteBannerSubtitle} numberOfLines={1}>
                                            Match areas by your commute & rent budget
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.commuteBannerMapBtn}
                                    onPress={() => {
                                        setIntelligenceMode(true);
                                        setIntelligencePhase(INTELLIGENCE_PHASES.MAP);
                                    }}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityLabel="Open Area Intelligence Map"
                                >
                                    <Ionicons name="map-outline" size={16} color={COLORS.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* Dynamic Stay Category Chips & Filters */}
                            <PropertyFilters
                                filters={filters}
                                onChange={setFilters}
                                resultCount={displayedResults.length}
                            />
                        </View>

                        {/* 3. Floating Map Controls (Locate Me & Save Alert) */}
                        <View style={[styles.floatingControls, { bottom: floatingControlsBottom }]} pointerEvents="box-none">
                            {refreshing ? (
                                <View style={styles.refreshBadge}>
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                    <Typography variant="micro" style={styles.refreshText}>Updating</Typography>
                                </View>
                            ) : null}

                            {canSaveSearch ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        if (!user) {
                                            setAuthModalVisible(true);
                                            return;
                                        }
                                        setSaveError(null);
                                        setSaveOpen(true);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Save search"
                                    style={styles.floatingSaveBtn}
                                    hitSlop={TOUCH_TARGETS.hitSlop}
                                >
                                    <Ionicons name="bookmark-outline" size={18} color={COLORS.primary} />
                                    <Typography variant="caption" style={styles.floatingSaveText}>Save</Typography>
                                </TouchableOpacity>
                            ) : null}

                            <TouchableOpacity
                                style={styles.recenterBtn}
                                onPress={goToMe}
                                accessibilityRole="button"
                                accessibilityLabel="Center on my location"
                                hitSlop={TOUCH_TARGETS.hitSlop}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="locate" size={22} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>

                        {/* 4. Floating Bottom Property Card Carousel */}
                        <View style={[styles.floatingBottom, { bottom: cardCarouselBottom }]} pointerEvents="box-none">
                            {emptyMessage ? (
                                <View style={styles.emptyCard} pointerEvents="auto">
                                    <CrowwRive
                                        artboard={EMPTY_STATES_RIVE_SPEC.artboards.discovery}
                                        artboardName={EMPTY_STATES_RIVE_SPEC.artboards.discovery}
                                        stateMachineName={EMPTY_STATES_RIVE_SPEC.stateMachine}
                                        inputs={{ isActive: true }}
                                        fallbackType="empty-discovery"
                                        fallbackSize={48}
                                        style={{ width: 48, height: 48, marginBottom: 6 }}
                                    />
                                    <Typography variant="titleSmall" style={styles.emptyTitle}>
                                        {emptyMessage}
                                    </Typography>
                                    <Typography variant="caption" style={styles.emptySubtitle}>
                                        Pan the map or switch city to discover verified homes.
                                    </Typography>
                                    <View style={styles.emptyActionRow}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const nextCity = (city === 'Chennai') ? 'Bengaluru' : 'Chennai';
                                                selectCity(nextCity);
                                            }}
                                            style={styles.switchCityBtn}
                                            hitSlop={TOUCH_TARGETS.hitSlop}
                                        >
                                            <Typography variant="bodyMedium" style={styles.switchCityText}>
                                                Explore {city === 'Chennai' ? 'Bengaluru' : 'Chennai'}
                                            </Typography>
                                        </TouchableOpacity>
                                        {IS_PREVIEW_ENV && !qaPreviewEnabled ? (
                                            <TouchableOpacity
                                                onPress={() => setQaPreviewEnabled(true)}
                                                style={{ marginTop: 8, paddingVertical: 4, alignItems: 'center' }}
                                                accessibilityLabel="Preview Sample Map Inventory"
                                            >
                                                <Typography variant="caption" style={{ color: COLORS.primary, fontWeight: '600' }}>
                                                    Preview Sample Map Inventory
                                                </Typography>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.carouselContainer} pointerEvents="box-none">
                                    <View style={styles.carouselHeaderRow}>
                                        <View style={styles.carouselCountBadge}>
                                            <Typography variant="caption" style={styles.carouselCountText}>
                                                {displayedResults.length} {displayedResults.length === 1 ? 'stay' : 'stays'} in view
                                            </Typography>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setViewMode('list')}
                                            style={styles.viewAllButton}
                                            activeOpacity={0.8}
                                            hitSlop={TOUCH_TARGETS.hitSlop}
                                            accessibilityRole="button"
                                            accessibilityLabel={`View all ${displayedResults.length} stays as list`}
                                        >
                                            <Typography variant="caption" style={styles.viewAllButtonText}>
                                                View All
                                            </Typography>
                                            <Ionicons name="list-outline" size={14} color="#111827" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    </View>
                                    <FlatList
                                        ref={carouselRef}
                                        horizontal
                                        data={displayedResults}
                                        keyExtractor={(item) => item.listingId}
                                        renderItem={({ item }) => (
                                            <PropertyResultCard
                                                item={item}
                                                layout="carousel"
                                                selected={item.listingId === selectedListingId}
                                                onDismiss={() => setSelectedListingId(null)}
                                                onPress={() => {
                                                    onSelectCard(item);
                                                    openListing(item);
                                                }}
                                            />
                                        )}
                                        getItemLayout={getItemLayout}
                                        onScrollToIndexFailed={(info) => {
                                            carouselRef.current?.scrollToOffset({
                                                offset: info.index * CARD_SNAP,
                                                animated: true,
                                            });
                                        }}
                                        onViewableItemsChanged={onViewableItemsChanged}
                                        viewabilityConfig={viewabilityConfig}
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.cardsList}
                                        extraData={selectedListingId}
                                        snapToInterval={CARD_SNAP}
                                        snapToAlignment="start"
                                        decelerationRate="fast"
                                    />
                                </View>
                            )}
                        </View>
                    </>
                )}

                {/* Progressive 4-Step Areas Questionnaire Drawer */}
                {isIntelligenceMode && (
                    <AreaQuestionnaireSheet
                        visible={areasDrawerOpen}
                        onClose={() => setAreasDrawerOpen(false)}
                        onComplete={handleRunAreasMatcher}
                        initialDestination={areasInputs.destination}
                        initialBudget={areasInputs.budget}
                        initialCommuteMode={areasInputs.commuteMode}
                        initialPriorities={areasInputs.priorities}
                    />
                )}
                    </>
                )}
            </View>

            <SaveSearchModal
                visible={saveOpen}
                defaultName={draftSearch.name}
                busy={saveBusy}
                error={saveError}
                onClose={() => setSaveOpen(false)}
                onSave={onSaveSearch}
            />

            {/* List Results Mode (View All) - Mobile Only */}
            {viewMode === 'list' && !isDesktop ? (
                <View style={styles.listRootContainer}>
                    {/* List Header */}
                    <View style={[styles.listHeader, { paddingTop: insets.top + SPACING.s }]}>
                        <View style={styles.listHeaderTopRow}>
                            <TouchableOpacity
                                onPress={() => setViewMode('map')}
                                style={styles.listBackBtn}
                                hitSlop={TOUCH_TARGETS.hitSlop}
                                accessibilityRole="button"
                                accessibilityLabel="Back to map"
                            >
                                <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                            </TouchableOpacity>
                            <View style={styles.listTitleContainer}>
                                <Typography variant="titleMedium" style={styles.listTitleText}>
                                    {displayedResults.length} {displayedResults.length === 1 ? 'Stay' : 'Stays'} in {city || 'Chennai'}
                                </Typography>
                                <Typography variant="caption" style={styles.listSubtitleText}>
                                    {filters?.category ? `Filtered by ${filters.category}` : 'All verified stays'}
                                </Typography>
                            </View>
                            <TouchableOpacity
                                onPress={() => setViewMode('map')}
                                style={styles.listMapToggleBtn}
                                accessibilityRole="button"
                                accessibilityLabel="View map"
                            >
                                <Ionicons name="map-outline" size={16} color={COLORS.primary} />
                                <Typography variant="caption" style={styles.listMapToggleText}>Map</Typography>
                            </TouchableOpacity>
                        </View>

                        {/* Reusable PropertyFilters */}
                        <View style={styles.listFiltersWrapper}>
                            <PropertyFilters
                                filters={filters}
                                onChange={setFilters}
                                resultCount={displayedResults.length}
                            />
                        </View>
                    </View>

                    {/* Results or Clean Empty State */}
                    {displayedResults.length === 0 ? (
                        <View style={styles.listEmptyContainer}>
                            <Typography variant="titleMedium" style={styles.listEmptyTitle}>
                                No spaces match these filters.
                            </Typography>
                            <Typography variant="bodyMedium" style={styles.listEmptySubtitle}>
                                Try clearing your category or budget filters to see more homes.
                            </Typography>
                            <TouchableOpacity
                                onPress={() => setFilters(DEFAULT_EXPLORE_FILTERS)}
                                style={styles.listResetFiltersBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Change filters"
                            >
                                <Typography variant="bodyMedium" style={styles.listResetFiltersText}>
                                    Change filters
                                </Typography>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={displayedResults}
                            keyExtractor={(item) => item.listingId}
                            renderItem={({ item }) => (
                                <View style={styles.listItemWrapper}>
                                    <PropertyResultCard
                                        item={item}
                                        layout="list"
                                        selected={item.listingId === selectedListingId}
                                        onPress={() => {
                                            setSelectedListingId(item.listingId);
                                            openListing(item);
                                        }}
                                    />
                                </View>
                            )}
                            contentContainerStyle={[
                                styles.verticalListContent,
                                { paddingBottom: insets.bottom + getFloatingNavbarClearance(insets, 40) }
                            ]}
                            showsVerticalScrollIndicator={false}
                        />
                    )}

                    {/* Floating pill to switch back to Map */}
                    <View style={[styles.floatingMapSwitchContainer, { bottom: insets.bottom + getFloatingNavbarClearance(insets, 14) }]} pointerEvents="box-none">
                        <TouchableOpacity
                            onPress={() => setViewMode('map')}
                            style={styles.floatingMapSwitchBtn}
                            activeOpacity={0.88}
                            accessibilityRole="button"
                            accessibilityLabel="Switch to Map view"
                        >
                            <Ionicons name="map" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Typography variant="bodyMedium" style={styles.floatingMapSwitchText}>
                                Map
                            </Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            <AuthPromptModal
                visible={authModalVisible}
                onClose={() => setAuthModalVisible(false)}
                navigation={navigation}
                title="Save this search"
                subtitle="Sign in to save your search filters and receive instant alerts for new listings."
                icon="bookmark-outline"
                actionContext="save_search"
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        position: 'relative',
        backgroundColor: COLORS.background,
    },
    mapCanvas: {
        ...Platform.select({
            web: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
            default: StyleSheet.absoluteFillObject,
        }),
    },
    floatingTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        paddingTop: SPACING.s,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        marginBottom: 8,
    },
    brandBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    brandLogo: {
        width: 66,
        height: 22,
    },
    brandDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
        marginLeft: 4,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        gap: SPACING.s,
    },
    cityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        height: 36,
        paddingHorizontal: SPACING.m,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    cityPillText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 12,
    },
    profileBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    floatingControls: {
        position: 'absolute',
        right: SPACING.l,
        zIndex: 20,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: SPACING.s,
    },
    recenterBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.floating,
    },
    floatingSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.round,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 6,
        ...SHADOWS.soft,
    },
    floatingSaveText: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    refreshBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.round,
        gap: 6,
        ...SHADOWS.subtle,
    },
    refreshText: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    floatingBottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 25,
    },
    carouselContainer: {
        paddingVertical: SPACING.xs,
    },
    cardsList: {
        paddingHorizontal: SPACING.l,
        gap: SPACING.m,
    },
    emptyCard: {
        marginHorizontal: SPACING.l,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.m,
        alignItems: 'center',
        textAlign: 'center',
        ...SHADOWS.floating,
    },
    emptyTitle: {
        color: COLORS.primary,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: SPACING.xs,
        marginBottom: 2,
    },
    emptySubtitle: {
        color: COLORS.secondary,
        textAlign: 'center',
        marginBottom: SPACING.m,
    },
    emptyActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    switchCityBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.round,
        minHeight: 44,
        justifyContent: 'center',
    },
    switchCityText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    commuteMatcherBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        paddingLeft: SPACING.m,
        paddingRight: SPACING.s,
        paddingVertical: 7,
        marginTop: SPACING.xs,
        marginBottom: 2,
        ...SHADOWS.floating,
    },
    commuteMatcherBannerTouch: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    commuteBannerMapBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    commuteBannerIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commuteBannerTitle: {
        fontSize: FONT_SIZES.bodySmall,
        fontWeight: '700',
        color: COLORS.primary,
    },
    commuteBannerSubtitle: {
        fontSize: FONT_SIZES.micro,
        color: COLORS.secondary,
        marginTop: 1,
    },
    carouselHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        marginBottom: 6,
    },
    carouselCountBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    carouselCountText: {
        color: '#111827',
        fontSize: 11,
        fontWeight: '700',
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: '#111827',
        ...SHADOWS.subtle,
    },
    viewAllButtonText: {
        color: '#111827',
        fontSize: 11,
        fontWeight: '700',
    },
    listRootContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.background,
        zIndex: 50,
    },
    listHeader: {
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingBottom: 4,
    },
    listHeaderTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        marginBottom: 6,
        gap: SPACING.s,
    },
    listBackBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    listTitleContainer: {
        flex: 1,
    },
    listTitleText: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    listSubtitleText: {
        color: COLORS.secondary,
    },
    listMapToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 4,
    },
    listMapToggleText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 12,
    },
    listFiltersWrapper: {
        paddingBottom: 2,
    },
    verticalListContent: {
        paddingTop: SPACING.m,
        paddingHorizontal: SPACING.m,
        gap: SPACING.m,
    },
    listItemWrapper: {
        width: '100%',
    },
    listEmptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
    },
    listEmptyTitle: {
        color: COLORS.primary,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: SPACING.xs,
    },
    listEmptySubtitle: {
        color: COLORS.secondary,
        textAlign: 'center',
        marginBottom: SPACING.l,
    },
    listResetFiltersBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.round,
    },
    listResetFiltersText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    floatingMapSwitchContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 60,
    },
    floatingMapSwitchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.pill,
        ...SHADOWS.floating,
    },
    floatingMapSwitchText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13,
    },
    desktopRoot: {
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
    },
    desktopMapContainer: {
        position: 'relative',
        flex: 1,
        height: '100%',
        width: 'auto',
    },
    desktopFloatingControls: {
        position: 'absolute',
        right: 20,
        bottom: 24,
        zIndex: 20,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: SPACING.s,
    },
    desktopTuneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.pill,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    desktopTuneBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    desktopExploreRightContent: {
        flex: 1,
    },
    desktopFiltersWrapper: {
        paddingVertical: SPACING.s,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    desktopEmptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    desktopListItemWrapper: {
        marginBottom: SPACING.m,
    },
    desktopListContent: {
        padding: SPACING.m,
        paddingBottom: 40,
    },
    desktopLocalityCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.medium,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        ...SHADOWS.subtle,
    },
    desktopLocalityCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surfaceHighlight,
    },
    locCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locCardRankBadge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    locCardRankText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primary,
    },
    locCardName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.primary,
    },
    locCardCity: {
        fontSize: 12,
        color: COLORS.secondary,
    },
    locCardScoreBadge: {
        alignItems: 'flex-end',
    },
    locCardScoreValue: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.primary,
    },
    locCardScoreLabel: {
        fontSize: 10,
        color: COLORS.secondary,
        textTransform: 'uppercase',
    },
    locCardMetricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    locMetricPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.pill,
    },
    locMetricText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    locCardHighlights: {
        fontSize: 12,
        color: COLORS.secondary,
        marginTop: 8,
        lineHeight: 16,
    },
    locCardActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    locDetailsBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.round,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    locDetailsBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    locExploreBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.primary,
    },
    locExploreBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default ExploreScreen;
