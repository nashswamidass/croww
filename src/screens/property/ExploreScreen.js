import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
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
import { useExplore } from '../../context/ExploreContext';
import { useExploreLocation } from '../../hooks/useExploreLocation';
import { useExploreDiscovery } from '../../hooks/useExploreDiscovery';
import { savedSearchService } from '../../services/property';
import { showAlert } from '../../utils/showAlert';
import { LAUNCH_VIEWPORT } from '../../constants/explore';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import CrowwRive from '../../components/rive/CrowwRive';
import { EMPTY_STATES_RIVE_SPEC } from '../../components/rive/specs/emptyStates.spec';
import { useTaxonomy } from '../../hooks/useTaxonomy';
import AreaIntelligenceOverlay, { INTELLIGENCE_PHASES } from '../../components/intelligence/AreaIntelligenceOverlay';
import { localityService } from '../../services/property/localityService';
import { areaScoreService } from '../../services/intelligence/areaScoreService';
import { areaScorePreferenceService } from '../../services/intelligence/areaScorePreferenceService';
import { getFloatingNavbarClearance } from '../../constants/layout';

const FALLBACK_CHENNAI_LOCALITIES = [
    { id: 'adyar', name: 'Adyar', city: 'Chennai', latitude: 13.0012, longitude: 80.2565, intelligence: { flood: { class: 'MINIMAL' }, transport: { metro: { available: true } } }, staysCount: 23 },
    { id: 'thiruvanmiyur', name: 'Thiruvanmiyur', city: 'Chennai', latitude: 12.9850, longitude: 80.2600, intelligence: { flood: { class: 'LOW' }, transport: { metro: { available: true } } }, staysCount: 18 },
    { id: 't_nagar', name: 'T Nagar', city: 'Chennai', latitude: 13.0418, longitude: 80.2341, intelligence: { flood: { class: 'LOW' }, transport: { metro: { available: true } } }, staysCount: 31 },
    { id: 'velachery', name: 'Velachery', city: 'Chennai', latitude: 12.9750, longitude: 80.2200, intelligence: { flood: { class: 'MODERATE' }, transport: { metro: { available: true } } }, staysCount: 27 },
    { id: 'anna_nagar', name: 'Anna Nagar', city: 'Chennai', latitude: 13.0850, longitude: 80.2100, intelligence: { flood: { class: 'LOW' }, transport: { metro: { available: true } } }, staysCount: 24 },
    { id: 'omr', name: 'OMR', city: 'Chennai', latitude: 12.8950, longitude: 80.2280, intelligence: { flood: { class: 'LOW' }, transport: { metro: { available: false } } }, staysCount: 42 },
];

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

const ExploreScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const route = useRoute();
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

    // Area Intelligence state
    const [intelligencePhase, setIntelligencePhase] = useState(INTELLIGENCE_PHASES.INTRO);
    const [stepIndex, setStepIndex] = useState(0);
    const [answers, setAnswers] = useState({
        0: ['stay_private_room'],
        1: ['12k_20k'],
        2: ['omr'],
        3: ['metro'],
        4: ['flood', 'transport'],
    });
    const [scoredLocalities, setScoredLocalities] = useState([]);
    const [selectedLocality, setSelectedLocality] = useState(null);
    const [selectedLocalityData, setSelectedLocalityData] = useState(null);

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
        if (route.params?.localityId) {
            focusLocality({
                id: route.params.localityId,
                name: route.params.localityName,
                viewport: route.params.viewport,
                city: route.params.city,
            });
        }
    }, [route.params, selectCity, focusLocality, city]);

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

    const displayedResults = useMemo(() => {
        let base = results;
        if ((!base || base.length === 0) && (!city || city === 'Chennai') && !filters.bhk && !filters.minPrice) {
            if (filters.category) {
                base = SAMPLE_PREVIEW_LISTINGS.filter((l) => l.category === filters.category);
            } else {
                base = SAMPLE_PREVIEW_LISTINGS;
            }
        }
        if (!query || !query.trim()) return base;
        const q = query.trim().toLowerCase();
        return base.filter((r) =>
            (r.title && r.title.toLowerCase().includes(q))
            || (r.localityName && r.localityName.toLowerCase().includes(q))
            || (r.cityName && r.cityName.toLowerCase().includes(q))
            || (r.address && r.address.toLowerCase().includes(q))
        );
    }, [results, city, filters, query]);

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

    const openListing = useCallback((item) => {
        setSelectedListingId(item.listingId);
        navigation.navigate('Listing', { listingId: item.listingId });
    }, [navigation, setSelectedListingId]);

    const onSelectMarker = useCallback((item) => {
        setSelectedListingId(item.listingId);
    }, [setSelectedListingId]);

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

    // Dynamic Step Options for Area Intelligence
    const stepOptions = useMemo(() => {
        const taxonomyOptions = (consumerCategories && consumerCategories.length > 0)
            ? consumerCategories.map((cat) => {
                let icon = cat.icon || 'bed-outline';
                if (icon === 'sparkles-outline' || icon === 'sparkles') {
                    icon = 'people-circle-outline';
                }
                return {
                    id: cat.typeId || cat.id,
                    label: cat.displayName,
                    description: cat.shortDescription || cat.displayName,
                    icon,
                };
            })
            : [
                { id: 'stay_bed', label: 'Bed', description: 'Single bed space in a shared room or hostel', icon: 'bed-outline' },
                { id: 'stay_shared_room', label: 'Shared Room', description: 'Shared bedroom with 1 or 2 roommates', icon: 'people-outline' },
                { id: 'stay_private_room', label: 'Private Room', description: 'Independent private bedroom in an apartment or house', icon: 'key-outline' },
                { id: 'stay_pg', label: 'PG', description: 'Paying guest accommodation with food & housekeeping', icon: 'business-outline' },
                { id: 'stay_coliving', label: 'Co-living', description: 'Fully managed with food, WiFi, and housekeeping', icon: 'people-circle-outline' },
                { id: 'stay_roommate', label: 'Roommate Replacement', description: 'Take over an existing shared lease spot', icon: 'person-add-outline' },
            ];

        return [
            {
                title: 'What are you looking for?',
                subtitle: 'Select the home format that matches your stay.',
                isMulti: false,
                options: taxonomyOptions,
            },
            {
                title: 'What is your budget?',
                subtitle: 'Target monthly rent excluding deposit.',
                isMulti: false,
                options: [
                    { id: 'under_12k', label: 'Under ₹12,000 / month', description: 'Budget & shared stays', icon: 'wallet-outline' },
                    { id: '12k_20k', label: '₹12,000 – ₹20,000 / month', description: 'Standard 1BHK / premium private rooms', icon: 'cash-outline' },
                    { id: '20k_35k', label: '₹20,000 – ₹35,000 / month', description: '2BHK / gated communities', icon: 'trending-up-outline' },
                    { id: 'above_35k', label: '₹35,000+ / month', description: 'Luxury 3BHK & premium stays', icon: 'diamond-outline' },
                ],
            },
            {
                title: 'Where do you work or study?',
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
            {
                title: 'What matters most?',
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
    }, [consumerCategories]);

    const computeWeightsFromAnswers = useCallback((userAnswers) => {
        const priorities = userAnswers[4] || [];
        const commute = userAnswers[3]?.[0];

        return {
            affordability: priorities.includes('affordability') ? 0.35 : 0.15,
            transport: commute === 'metro' || priorities.includes('transport') ? 0.35 : 0.15,
            flood: priorities.includes('flood') ? 0.40 : 0.15,
            schools: priorities.includes('schools') ? 0.25 : 0.05,
            healthcare: priorities.includes('healthcare') ? 0.25 : 0.05,
            airport: priorities.includes('airport') ? 0.25 : 0.05,
            connectivity: 0.15,
            marketFit: 0.10,
        };
    }, []);

    const loadAndScoreLocalities = useCallback(async (weights) => {
        try {
            const targetCity = city || 'Chennai';
            let list = await localityService.listActiveByCity(targetCity).catch(() => []);
            if (!list || list.length === 0) {
                list = FALLBACK_CHENNAI_LOCALITIES;
            }

            const scored = list
                .filter((loc) => loc.latitude && loc.longitude)
                .map((locality) => {
                    const result = areaScoreService.calculate({
                        snapshot: locality.intelligence,
                        city: targetCity,
                        weights,
                    });
                    const score = result?.score != null ? result.score : (locality.id === 'adyar' ? 92 : locality.id === 'thiruvanmiyur' ? 88 : locality.id === 't_nagar' ? 85 : 80);
                    return {
                        locality,
                        score,
                        result,
                    };
                })
                .sort((a, b) => b.score - a.score);

            setScoredLocalities(scored);
            if (scored.length > 0) {
                setSelectedLocality(scored[0].locality);
                setSelectedLocalityData(scored[0]);
            }
        } catch (e) {
            console.warn('[ExploreScreen] loadAndScoreLocalities failed', e);
        }
    }, [city]);

    useEffect(() => {
        if (isIntelligenceMode && scoredLocalities.length === 0) {
            const weights = computeWeightsFromAnswers(answers);
            loadAndScoreLocalities(weights);
        }
    }, [isIntelligenceMode, scoredLocalities.length, computeWeightsFromAnswers, loadAndScoreLocalities, answers]);

    const handleToggleIntelligenceOption = useCallback((optionId) => {
        const currentStep = stepOptions[stepIndex];
        const currentSelected = answers[stepIndex] || [];

        if (currentStep?.isMulti) {
            if (currentSelected.includes(optionId)) {
                setAnswers((prev) => ({
                    ...prev,
                    [stepIndex]: currentSelected.filter((id) => id !== optionId),
                }));
            } else if (currentSelected.length < 3) {
                setAnswers((prev) => ({
                    ...prev,
                    [stepIndex]: [...currentSelected, optionId],
                }));
            }
        } else {
            setAnswers((prev) => ({
                ...prev,
                [stepIndex]: [optionId],
            }));
        }
    }, [stepOptions, stepIndex, answers]);

    const handleContinueIntelligenceStep = useCallback(async () => {
        if (stepIndex < stepOptions.length - 1) {
            setStepIndex((prev) => prev + 1);
        } else {
            const weights = computeWeightsFromAnswers(answers);
            try {
                await areaScorePreferenceService.save(weights);
            } catch (_) {}
            await loadAndScoreLocalities(weights);
            setIntelligencePhase(INTELLIGENCE_PHASES.MAP);
        }
    }, [stepIndex, stepOptions.length, computeWeightsFromAnswers, answers, loadAndScoreLocalities]);

    const handleBackIntelligenceStep = useCallback(() => {
        if (stepIndex > 0) {
            setStepIndex((prev) => prev - 1);
        } else {
            setIntelligencePhase(INTELLIGENCE_PHASES.INTRO);
        }
    }, [stepIndex]);

    const handleSelectLocality = useCallback((locality, item) => {
        setSelectedLocality(locality);
        setSelectedLocalityData(item);
        if (locality.latitude && locality.longitude) {
            setFollowRegion({
                latitude: locality.latitude,
                longitude: locality.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            });
        }
    }, []);

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
        <ScreenWrapper edges={['top']}>
            <View style={styles.root}>
                {/* 1. Map Canvas occupying 75-80% viewport */}
                <View style={styles.mapCanvas}>
                    <PropertyMap
                        initialRegion={initialRegion}
                        followRegion={followRegion}
                        listings={isIntelligenceMode && intelligencePhase === INTELLIGENCE_PHASES.MAP ? mapLocalityProperties : displayedResults}
                        selectedId={selectedListingId}
                        userCoordinate={userCoordinate}
                        onSelect={isIntelligenceMode ? (item) => handleSelectLocality(item?.locality || item) : onSelectMarker}
                        onRegionChangeComplete={onRegionChangeComplete}
                        onMapPress={() => {
                            if (isIntelligenceMode) {
                                setSelectedLocality(null);
                            } else {
                                setSelectedListingId(null);
                            }
                        }}
                        intelligenceMode={isIntelligenceMode && intelligencePhase === INTELLIGENCE_PHASES.MAP}
                        localityRegions={scoredLocalities}
                    />
                </View>

                {/* Intelligence Overlay (Intro / Preferences / Map Overlay with top bar & detail sheet) */}
                {isIntelligenceMode ? (
                    <AreaIntelligenceOverlay
                        phase={intelligencePhase}
                        stepIndex={stepIndex}
                        answers={answers}
                        stepOptions={stepOptions}
                        scoredLocalities={scoredLocalities}
                        selectedLocality={selectedLocality}
                        selectedLocalityData={selectedLocalityData}
                        onStart={() => setIntelligencePhase(INTELLIGENCE_PHASES.PREFERENCES)}
                        onSkip={() => setIntelligenceMode(false)}
                        onToggleOption={handleToggleIntelligenceOption}
                        onContinueStep={handleContinueIntelligenceStep}
                        onBackStep={handleBackIntelligenceStep}
                        onResetPreferences={() => {
                            setStepIndex(0);
                            setIntelligencePhase(INTELLIGENCE_PHASES.PREFERENCES);
                        }}
                        onSelectLocality={handleSelectLocality}
                        onCloseLocalityDetail={() => {
                            setSelectedLocality(null);
                            setSelectedLocalityData(null);
                        }}
                        onExploreLocality={handleExploreLocality}
                        onClose={() => setIntelligenceMode(false)}
                    />
                ) : (
                    <>
                        {/* 2. Floating Top Search & Refinement Island */}
                        <View style={styles.floatingTop} pointerEvents="box-none">
                            {/* Brand & City / Notification Row */}
                            <View style={styles.brandRow}>
                                <View style={styles.brandBadge}>
                                    <Text style={styles.brandTitle}>Croww</Text>
                                    <View style={styles.brandDot} />
                                </View>

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
                                        <Ionicons name="location-sharp" size={13} color={COLORS.accent} style={{ marginRight: 4 }} />
                                        <Typography variant="caption" style={styles.cityPillText}>
                                            {city || 'Chennai'} ▾
                                        </Typography>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            navigation.navigate(user ? 'ProfileTab' : 'Login');
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Notifications and profile"
                                        style={styles.profileBtn}
                                        hitSlop={TOUCH_TARGETS.hitSlop}
                                    >
                                        <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
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
                                    <ActivityIndicator size="small" color={COLORS.accent} />
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
                                    <Ionicons name="bookmark-outline" size={18} color={COLORS.accent} />
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
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.carouselContainer} pointerEvents="box-none">
                                    <FlatList
                                        horizontal
                                        data={displayedResults}
                                        keyExtractor={(item) => item.listingId}
                                        renderItem={({ item }) => (
                                            <PropertyResultCard
                                                item={item}
                                                selected={item.listingId === selectedListingId}
                                                onDismiss={() => setSelectedListingId(null)}
                                                onPress={() => {
                                                    onSelectCard(item);
                                                    openListing(item);
                                                }}
                                            />
                                        )}
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.cardsList}
                                        extraData={selectedListingId}
                                        snapToAlignment="center"
                                        decelerationRate="fast"
                                    />
                                </View>
                            )}
                        </View>
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
    brandTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: COLORS.primary,
        letterSpacing: -0.4,
    },
    brandDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.accent,
        marginLeft: 3,
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
        color: COLORS.accent,
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
        color: COLORS.accent,
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
        backgroundColor: COLORS.accent,
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
});

export default ExploreScreen;
