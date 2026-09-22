import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import GooglePlacesInput from '../../components/GooglePlacesInput';
import PostPinMap from '../../components/property/post/PostPinMap';
import {
    BORDER_RADIUS,
    COLORS,
    FONT_SIZES,
    SHADOWS,
    SPACING,
    TOUCH_TARGETS,
} from '../../constants/theme';
import { inventoryService } from '../../services/property';
import { mapTaxonomyToLegacy } from '../../domain/taxonomy';
import {
    InventoryError,
    MAX_POST_PHOTOS,
    SUBTYPE_LABELS,
    buildListingCreateInput,
    buildListingUpdatePatch,
    buildPropertyCreateInput,
    canSaveDraft,
    getCategoryAdditionalFeatures,
    getCategoryOccupancyOptions,
    getCategoryQuickFeatures,
    inventoryErrorMessage,
    slugLocalityId,
    validatePostListing,
    validatePostProperty,
} from '../../domain/property';
import { showAlert } from '../../utils/showAlert';

function getCategoryIcon(subtype) {
    const s = (subtype || '').toLowerCase().replace(/^stay_/, '');
    if (s.includes('bed')) return 'bed-outline';
    if (s.includes('shared')) return 'people-outline';
    if (s.includes('private')) return 'person-outline';
    if (s.includes('pg')) return 'business-outline';
    if (s.includes('coliving')) return 'people-circle-outline';
    if (s.includes('roommate')) return 'swap-horizontal-outline';
    return 'home-outline';
}

function emptyForm(initialType = null) {
    const legacy = initialType ? mapTaxonomyToLegacy(initialType) : null;
    const subtype = legacy?.subtype || (typeof initialType === 'string' ? initialType.replace(/^stay_/, '') : 'private_room');
    const defaultOcc = subtype === 'shared_room' ? 'double' : 'single';
    return {
        listedByRole: 'owner',
        existingPropertyId: null,
        propertyId: null,
        listingId: null,
        transactionType: 'rent',
        category: 'residential',
        subtype,
        listingTypeId: initialType || 'stay_private_room',
        taxonomyId: initialType || 'stay_private_room',
        bedrooms: legacy?.defaultBedrooms || 1,
        bathrooms: 1,
        carpetAreaSqft: null,
        builtUpAreaSqft: null,
        plotAreaSqft: null,
        floor: null,
        totalFloors: null,
        furnishing: 'unknown',
        parking: null,
        constructionYear: null,
        amenities: [],
        propertyDescription: '',
        projectName: '',
        city: 'Chennai',
        state: 'Tamil Nadu',
        localityId: '',
        localityName: '',
        localityCoordinate: null,
        addressLine1: '',
        pincode: '',
        exactLatitude: null,
        exactLongitude: null,
        locationPrecision: 'approximate_on_request',
        title: '',
        listingDescription: '',
        askingPriceText: '',
        rentMonthlyText: '',
        depositText: '',
        maintenanceText: '',
        negotiable: true,
        availableFrom: 'immediate',
        occupancy: defaultOcc,
        foodIncluded: false,
        attachedBathroom: false,
        genderPreference: 'any',
        photos: [],
        coverLocalId: null,
        status: 'DRAFT',
        reviewRequestedAt: null,
        publicLatitude: null,
        publicLongitude: null,
    };
}

function hydrateForm({ listing, property, media }) {
    const photos = (media || []).map((item, index) => ({
        localId: item.id || `remote-${index}`,
        uri: item.thumbnailUrl || item.url,
        mediaId: item.id,
    }));
    return {
        ...emptyForm(),
        listedByRole: listing.listedByRole || 'owner',
        existingPropertyId: listing.propertyId,
        propertyId: listing.propertyId,
        listingId: listing.id,
        transactionType: listing.transactionType || 'rent',
        category: property?.category || 'residential',
        subtype: property?.subtype || 'private_room',
        listingTypeId: listing.taxonomyId || listing.listingTypeId || property?.subtype || null,
        taxonomyId: listing.taxonomyId || null,
        bedrooms: property?.bedrooms ?? 1,
        bathrooms: property?.bathrooms ?? 1,
        carpetAreaSqft: property?.carpetAreaSqft ?? null,
        builtUpAreaSqft: property?.builtUpAreaSqft ?? null,
        plotAreaSqft: property?.plotAreaSqft ?? null,
        floor: property?.floor ?? null,
        totalFloors: property?.totalFloors ?? null,
        furnishing: property?.furnishing || 'unknown',
        parking: property?.parking ?? null,
        constructionYear: property?.constructionYear ?? null,
        amenities: Array.isArray(property?.amenities) ? property.amenities : [],
        propertyDescription: property?.description || '',
        projectName: property?.projectName || '',
        city: property?.city || 'Chennai',
        state: property?.state || 'Tamil Nadu',
        localityId: property?.localityId || '',
        localityName: property?.localityId ? property.localityId.split('__')[1] || property.localityId : '',
        addressLine1: property?.address?.line1 || '',
        pincode: property?.address?.pincode || '',
        exactLatitude: null,
        exactLongitude: null,
        locationPrecision: property?.locationPrecision || 'approximate_on_request',
        title: listing.title || '',
        listingDescription: listing.description || '',
        askingPriceText: listing.askingPrice != null ? String(listing.askingPrice) : '',
        rentMonthlyText: listing.rentMonthly != null ? String(listing.rentMonthly) : '',
        depositText: listing.deposit != null ? String(listing.deposit) : '',
        maintenanceText: listing.maintenanceMonthly != null ? String(listing.maintenanceMonthly) : '',
        negotiable: listing.negotiable !== false,
        availableFrom: listing.availableFrom || 'immediate',
        occupancy: listing.occupancy || 'single',
        foodIncluded: Boolean(listing.foodIncluded),
        attachedBathroom: Boolean(listing.attachedBathroom),
        genderPreference: listing.genderPreference || 'any',
        photos,
        coverLocalId: photos[0]?.localId || null,
        status: listing.status || 'DRAFT',
        reviewRequestedAt: listing.reviewRequestedAt || null,
        publicLatitude: property?.latitude ?? listing.latitude ?? null,
        publicLongitude: property?.longitude ?? listing.longitude ?? null,
    };
}

function parsePlace(selection) {
    const name = selection?.name || '';
    const parts = name.split(',').map((part) => part.trim()).filter(Boolean);
    const pinMatch = name.match(/\b(\d{6})\b/);
    let city = '';
    if (parts.length >= 3) city = parts[parts.length - 3] || parts[parts.length - 2];
    else if (parts.length >= 2) city = parts[parts.length - 2];
    const localityGuess = parts.length >= 4 ? parts[1] : (parts[0] || '');
    return {
        addressLine1: name,
        city: city.replace(/\b\d{6}\b/, '').trim(),
        pincode: pinMatch ? pinMatch[1] : '',
        localityName: localityGuess,
        latitude: selection?.coordinate?.latitude ?? null,
        longitude: selection?.coordinate?.longitude ?? null,
    };
}

const PostListingScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const insets = useSafeAreaInsets();

    const initialTypeParam = route.params?.initialType;
    const listingIdParam = route.params?.listingId;

    const scrollRef = useRef(null);
    const [form, setForm] = useState(() => emptyForm(initialTypeParam));
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(Boolean(listingIdParam));
    const [error, setError] = useState('');
    const [duplicates, setDuplicates] = useState([]);
    const [additionalModalVisible, setAdditionalModalVisible] = useState(false);

    const patch = useCallback((updates) => {
        setDirty(true);
        setError('');
        setForm((prev) => ({ ...prev, ...updates }));
    }, []);

    // Load existing draft if editing
    useEffect(() => {
        if (!listingIdParam) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const loaded = await inventoryService.loadForEdit(listingIdParam);
                if (cancelled) return;
                if (loaded.listing.status && loaded.listing.status !== 'DRAFT' && loaded.listing.status !== 'PAUSED') {
                    showAlert('Cannot edit', 'Only drafts can be edited here. Open the public listing to view live inventory.');
                    navigation.goBack();
                    return;
                }
                setForm(hydrateForm(loaded));
                setDirty(false);
            } catch (err) {
                if (!cancelled) {
                    setError(inventoryErrorMessage(err?.code, err?.message));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [listingIdParam, navigation]);

    // Prompt before leaving if changes unsaved
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (!dirty || busy) return;
            event.preventDefault();
            Alert.alert(
                'Leave listing?',
                'Unsaved changes will be lost. Save a draft first if you want to continue later.',
                [
                    { text: 'Stay', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
                ]
            );
        });
        return unsubscribe;
    }, [navigation, dirty, busy]);

    // Photo actions
    const pickFromLibrary = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission needed', 'Allow photo library access to add listing photos.');
            return;
        }
        const remaining = MAX_POST_PHOTOS - form.photos.length;
        if (remaining <= 0) {
            showAlert('Photo limit', `You can add up to ${MAX_POST_PHOTOS} photos.`);
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            quality: 0.8,
        });
        if (result.canceled) return;
        const next = (result.assets || []).map((asset, index) => ({
            localId: `${Date.now()}-${index}-${asset.uri}`,
            uri: asset.uri,
        }));
        const photos = [...form.photos, ...next].slice(0, MAX_POST_PHOTOS);
        patch({
            photos,
            coverLocalId: form.coverLocalId || photos[0]?.localId,
        });
    };

    const takePhotoWithCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission needed', 'Allow camera access to take a listing photo.');
            return;
        }
        const remaining = MAX_POST_PHOTOS - form.photos.length;
        if (remaining <= 0) {
            showAlert('Photo limit', `You can add up to ${MAX_POST_PHOTOS} photos.`);
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const asset = result.assets[0];
        const newPhoto = {
            localId: `${Date.now()}-${asset.uri}`,
            uri: asset.uri,
        };
        const photos = [...form.photos, newPhoto].slice(0, MAX_POST_PHOTOS);
        patch({
            photos,
            coverLocalId: form.coverLocalId || photos[0]?.localId,
        });
    };

    const showPhotoOptions = () => {
        Alert.alert(
            'Add Photos',
            'Choose photos showing the room, washroom, and common spaces.',
            [
                { text: 'Take Photo', onPress: takePhotoWithCamera },
                { text: 'Choose from Gallery', onPress: pickFromLibrary },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const removePhoto = (localId) => {
        const nextPhotos = form.photos.filter((p) => p.localId !== localId);
        let nextCover = form.coverLocalId;
        if (nextCover === localId) {
            nextCover = nextPhotos[0]?.localId || null;
        }
        patch({ photos: nextPhotos, coverLocalId: nextCover });
    };

    const setAsCoverPhoto = (localId) => {
        patch({ coverLocalId: localId });
    };

    // Quick Title suggestion
    const generateTitleSuggestion = () => {
        const categoryName = SUBTYPE_LABELS[form.subtype] || 'Space';
        const loc = form.localityName || form.city || 'Bangalore';
        const features = [];
        if (form.attachedBathroom) features.push('Attached Bath');
        if (form.amenities.includes('ac')) features.push('AC');
        if (form.amenities.includes('balcony')) features.push('Balcony');
        const extra = features.length > 0 ? ` with ${features.slice(0, 2).join(' & ')}` : '';
        return `Bright ${categoryName} in ${loc}${extra}`;
    };

    const applySuggestedTitle = () => {
        patch({ title: generateTitleSuggestion() });
    };

    // Feature toggles
    const quickFeatures = useMemo(() => getCategoryQuickFeatures(form.subtype), [form.subtype]);
    const additionalFeatures = useMemo(() => getCategoryAdditionalFeatures(form.subtype), [form.subtype]);
    const occupancyOptions = useMemo(() => getCategoryOccupancyOptions(form.subtype), [form.subtype]);

    const toggleFeature = (featureId) => {
        const currentAmenities = form.amenities || [];
        const isSelected = currentAmenities.includes(featureId);
        let nextAmenities = isSelected
            ? currentAmenities.filter((id) => id !== featureId)
            : [...currentAmenities, featureId];

        const updates = { amenities: nextAmenities };

        // Synchronize with core schema boolean properties
        if (featureId === 'attached_bathroom') {
            updates.attachedBathroom = !isSelected;
        } else if (featureId === 'shared_bathroom') {
            updates.attachedBathroom = false;
        } else if (featureId === 'food_included' || featureId === 'food') {
            updates.foodIncluded = !isSelected;
        } else if (featureId === 'furnished') {
            updates.furnishing = !isSelected ? 'fully' : 'unknown';
        }

        patch(updates);
    };

    // Group additional features by group
    const additionalGroups = useMemo(() => {
        const groups = {};
        additionalFeatures.forEach((feat) => {
            const g = feat.group || 'More Features';
            if (!groups[g]) groups[g] = [];
            groups[g].push(feat);
        });
        return groups;
    }, [additionalFeatures]);

    // Secondary features currently active
    const selectedSecondaryFeatures = useMemo(() => {
        const quickIds = new Set(quickFeatures.map((f) => f.id));
        return (form.amenities || [])
            .filter((id) => !quickIds.has(id))
            .map((id) => {
                const found = additionalFeatures.find((f) => f.id === id);
                return { id, label: found ? found.label : id.replace(/_/g, ' ') };
            });
    }, [form.amenities, quickFeatures, additionalFeatures]);

    // Submission logic
    const persistDraft = async ({ allowDuplicates = false } = {}) => {
        const listingInput = buildListingCreateInput(form);

        if (form.listingId) {
            await inventoryService.updateListing(form.listingId, buildListingUpdatePatch(form));
            if (form.propertyId && form.exactLatitude != null && form.exactLongitude != null) {
                const propertyInput = buildPropertyCreateInput(form);
                await inventoryService.updateProperty(form.propertyId, {
                    locationPrecision: propertyInput.locationPrecision,
                    latitude: propertyInput.latitude,
                    longitude: propertyInput.longitude,
                    localityCoordinate: propertyInput.localityCoordinate,
                    address: propertyInput.address,
                    description: propertyInput.description,
                    bedrooms: propertyInput.bedrooms,
                    bathrooms: propertyInput.bathrooms,
                    furnishing: propertyInput.furnishing,
                    amenities: propertyInput.amenities,
                });
            }
            if (form.photos.some((photo) => photo.uri && !photo.mediaId && !String(photo.uri).startsWith('http'))) {
                const attached = await inventoryService.attachLocalPhotos({
                    propertyId: form.propertyId,
                    listingId: form.listingId,
                    photos: form.photos,
                    coverUri: form.coverLocalId,
                });
                patch({ photos: attached, coverLocalId: attached[0]?.localId || form.coverLocalId });
            }
            return { listingId: form.listingId, propertyId: form.propertyId };
        }

        let propertyId = form.existingPropertyId || form.propertyId;
        let createdNewProperty = false;
        if (!propertyId) {
            const created = await inventoryService.createProperty(buildPropertyCreateInput(form), { allowDuplicates });
            propertyId = created.property.id;
            createdNewProperty = true;
            patch({
                propertyId,
                publicLatitude: created.property.latitude,
                publicLongitude: created.property.longitude,
            });
        }

        let createdListing;
        try {
            createdListing = await inventoryService.createListing({
                ...listingInput,
                propertyId,
            });
        } catch (listingError) {
            if (createdNewProperty && propertyId) {
                try {
                    await inventoryService.updateProperty(propertyId, { status: 'INACTIVE' });
                } catch (rollbackErr) {
                    console.warn('[PostListingScreen] Property rollback failed:', rollbackErr);
                }
            }
            throw listingError;
        }

        const listingId = createdListing.listing.id;
        let photos = form.photos;
        if (photos.length) {
            photos = await inventoryService.attachLocalPhotos({
                propertyId,
                listingId,
                photos,
                coverUri: form.coverLocalId,
            });
        }
        patch({
            propertyId,
            listingId,
            photos,
            status: 'DRAFT',
            existingPropertyId: propertyId,
        });
        return { listingId, propertyId };
    };

    const handleSaveDraft = async ({ allowDuplicates = false } = {}) => {
        if (!canSaveDraft(form)) {
            const propIssues = validatePostProperty(form);
            let msg = 'Add the space location and a title before saving a draft.';
            if (propIssues.length) {
                msg = (propIssues[0].field === 'latitude' || propIssues[0].field === 'longitude')
                    ? 'Please drop a pin on the map or select an address for your space.'
                    : propIssues[0].message;
            }
            setError(msg);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            showAlert('Draft Incomplete', msg);
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result = await persistDraft({ allowDuplicates });
            setDirty(false);
            showAlert('Draft saved', 'Your listing draft has been saved to your inventory.', [
                {
                    text: 'View in Inventory',
                    onPress: () => navigation.replace('InventoryDashboard'),
                },
                { text: 'Keep Editing', style: 'cancel' },
            ]);
            return result;
        } catch (err) {
            console.warn('[PostListingScreen.handleSaveDraft] error:', err);
            if (err instanceof InventoryError && err.code === 'POTENTIAL_DUPLICATE') {
                setDuplicates(Array.isArray(err.details?.candidates) ? err.details.candidates : []);
                setError(inventoryErrorMessage('POTENTIAL_DUPLICATE'));
                showAlert(
                    'Potential Duplicate',
                    inventoryErrorMessage('POTENTIAL_DUPLICATE'),
                    [
                        { text: 'Review Space', style: 'cancel' },
                        {
                            text: 'Save Anyway',
                            onPress: () => handleSaveDraft({ allowDuplicates: true }),
                        },
                    ]
                );
                return;
            }
            const msg = inventoryErrorMessage(err?.code, err?.message);
            setError(msg);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            showAlert('Could not save draft', msg);
        } finally {
            setBusy(false);
        }
    };

    const handlePostSpace = async ({ allowDuplicates = false } = {}) => {
        const issues = validatePostListing(form, { forPublish: true });
        if (issues.length) {
            const msg = issues[0]?.message || 'Please complete required fields before posting.';
            setError(msg);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            showAlert('Missing Information', msg);
            return;
        }
        const propIssues = validatePostProperty(form);
        if (propIssues.length && !form.existingPropertyId && !form.propertyId) {
            const first = propIssues[0];
            const msg = (first?.field === 'latitude' || first?.field === 'longitude')
                ? 'Please drop a pin on the map or select an address for your space.'
                : (first?.message || 'Please specify the location of the space.');
            setError(msg);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            showAlert('Location Required', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            const saved = await persistDraft({ allowDuplicates });
            if (!saved?.listingId) return;
            const result = await inventoryService.requestPublish(saved.listingId);
            patch({
                listingId: saved.listingId,
                reviewRequestedAt: true,
                status: result?.status || 'DRAFT',
            });
            setDirty(false);
            showAlert(
                'Space Posted!',
                'Your space has been submitted for review. It will be live once verified by our team.',
                [
                    {
                        text: 'Go to Inventory',
                        onPress: () => navigation.replace('InventoryDashboard'),
                    },
                ]
            );
        } catch (err) {
            console.warn('[PostListingScreen.handlePostSpace] error:', err);
            if (err instanceof InventoryError && err.code === 'POTENTIAL_DUPLICATE') {
                setDuplicates(Array.isArray(err.details?.candidates) ? err.details.candidates : []);
                setError(inventoryErrorMessage('POTENTIAL_DUPLICATE'));
                showAlert(
                    'Potential Duplicate',
                    inventoryErrorMessage('POTENTIAL_DUPLICATE'),
                    [
                        { text: 'Review Space', style: 'cancel' },
                        {
                            text: 'Submit Anyway',
                            onPress: () => handlePostSpace({ allowDuplicates: true }),
                        },
                    ]
                );
                return;
            }
            const msg = inventoryErrorMessage(err?.code, err?.message);
            setError(msg);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            showAlert('Could not post space', msg);
        } finally {
            setBusy(false);
        }
    };

    const mapCoordinate = form.exactLatitude != null && form.exactLongitude != null
        ? { latitude: form.exactLatitude, longitude: form.exactLongitude }
        : null;

    const categoryTitle = SUBTYPE_LABELS[form.subtype] || 'Space';

    if (loading) {
        return (
            <ScreenWrapper edges={['top']}>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Typography variant="bodyMedium" style={{ marginTop: SPACING.m, color: COLORS.secondary }}>
                        Loading space details...
                    </Typography>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            {/* 1. Header with category badge & Save Draft */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
                </TouchableOpacity>

                <View style={styles.categoryBadge}>
                    <Ionicons name={getCategoryIcon(form.subtype)} size={15} color={COLORS.primary} />
                    <Text style={styles.categoryBadgeText}>{categoryTitle}</Text>
                </View>

                <TouchableOpacity
                    style={styles.saveDraftBtn}
                    onPress={handleSaveDraft}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Save draft"
                >
                    <Text style={styles.saveDraftText}>Save Draft</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: Math.max(insets.bottom, 16) + 110 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Error Banner */}
                    {error ? (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {duplicates.length > 0 ? (
                        <View style={[styles.errorBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', flexDirection: 'column', alignItems: 'flex-start' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="information-circle" size={18} color="#B45309" />
                                <Text style={[styles.errorText, { color: '#92400E', flex: 1 }]}>
                                    {duplicates.length} potential matching listing(s) found in this locality.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#D97706', borderRadius: 6 }}
                                onPress={() => handlePostSpace({ allowDuplicates: true })}
                                activeOpacity={0.8}
                            >
                                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>Continue & Submit Space</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {/* SECTION 1: PHOTOS FIRST */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <View>
                                <Typography variant="h2" style={styles.sectionTitle}>
                                    Show people the place
                                </Typography>
                                <Typography variant="caption" style={styles.sectionSubtitle}>
                                    High quality photos get 5x more responses. ({form.photos.length}/{MAX_POST_PHOTOS})
                                </Typography>
                            </View>
                            <TouchableOpacity
                                style={styles.addPhotosPill}
                                activeOpacity={0.8}
                                onPress={showPhotoOptions}
                                accessibilityRole="button"
                                accessibilityLabel="Add photos"
                            >
                                <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.addPhotosPillText}>+ Add Photos</Text>
                            </TouchableOpacity>
                        </View>

                        {form.photos.length === 0 ? (
                            <TouchableOpacity
                                style={styles.photoUploadPlaceholder}
                                activeOpacity={0.78}
                                onPress={showPhotoOptions}
                                accessibilityRole="button"
                                accessibilityLabel="Add photos from camera or gallery"
                            >
                                <View style={styles.photoUploadIconCircle}>
                                    <Ionicons name="images-outline" size={28} color={COLORS.primary} />
                                </View>
                                <Text style={styles.photoUploadTitle}>Tap to add photos</Text>
                                <Text style={styles.photoUploadHint}>Camera or photo library · Up to 12 images</Text>
                            </TouchableOpacity>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.photosHorizontalList}
                            >
                                {form.photos.map((item, index) => {
                                    const isCover = (form.coverLocalId || form.photos[0]?.localId) === item.localId;
                                    return (
                                        <TouchableOpacity
                                            key={item.localId || index}
                                            style={[styles.photoCard, isCover && styles.photoCardCover]}
                                            activeOpacity={0.85}
                                            onPress={() => setAsCoverPhoto(item.localId)}
                                        >
                                            <Image source={{ uri: item.uri }} style={styles.photoThumb} />
                                            {isCover && (
                                                <View style={styles.coverBadge}>
                                                    <Text style={styles.coverBadgeText}>Cover</Text>
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={styles.photoDeleteBtn}
                                                onPress={() => removePhoto(item.localId)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                accessibilityRole="button"
                                                accessibilityLabel="Remove photo"
                                            >
                                                <Ionicons name="close" size={14} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    );
                                })}

                                {form.photos.length < MAX_POST_PHOTOS && (
                                    <TouchableOpacity
                                        style={styles.photoAddMoreCard}
                                        onPress={showPhotoOptions}
                                        activeOpacity={0.78}
                                    >
                                        <Ionicons name="add" size={26} color={COLORS.secondary} />
                                        <Text style={styles.photoAddMoreText}>Add more</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}
                    </View>

                    {/* SECTION 2: TITLE & DESCRIPTION */}
                    <View style={styles.section}>
                        <View style={styles.labelRowWithAction}>
                            <Typography variant="h3" style={styles.inputLabel}>
                                Title
                            </Typography>
                            <TouchableOpacity
                                style={styles.suggestBtn}
                                onPress={applySuggestedTitle}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="bulb-outline" size={13} color={COLORS.primary} />
                                <Text style={styles.suggestBtnText}>Suggest title</Text>
                            </TouchableOpacity>
                        </View>
                        <NotionInput
                            value={form.title}
                            onChangeText={(title) => patch({ title })}
                            placeholder={`e.g. Bright ${categoryTitle} in ${form.localityName || 'Adyar'}`}
                            accessibilityLabel="Listing title"
                        />

                        <Typography variant="h3" style={[styles.inputLabel, { marginTop: SPACING.m }]}>
                            Tell people about the place
                        </Typography>
                        <NotionInput
                            value={form.listingDescription}
                            onChangeText={(listingDescription) => patch({ listingDescription })}
                            multiline
                            numberOfLines={4}
                            placeholder="Describe flatmates, vibe, amenities, house rules, or commute highlights..."
                            accessibilityLabel="Listing description"
                        />
                    </View>

                    {/* SECTION 3: RENT & DEPOSIT */}
                    <View style={styles.section}>
                        <Typography variant="h2" style={styles.sectionTitle}>
                            Rent & Costs
                        </Typography>

                        <View style={styles.twoColumnRow}>
                            <View style={styles.columnHalf}>
                                <Typography variant="h3" style={styles.inputLabel}>
                                    ₹ Monthly rent *
                                </Typography>
                                <NotionInput
                                    value={form.rentMonthlyText}
                                    onChangeText={(rentMonthlyText) => patch({ rentMonthlyText })}
                                    keyboardType="numeric"
                                    placeholder="e.g. 12000"
                                    accessibilityLabel="Monthly rent in rupees"
                                />
                            </View>

                            <View style={styles.columnHalf}>
                                <View style={styles.labelRowWithAction}>
                                    <Typography variant="h3" style={styles.inputLabel}>
                                        ₹ Deposit *
                                    </Typography>
                                    <TouchableOpacity
                                        style={styles.zeroDepositChip}
                                        onPress={() => patch({ depositText: '0' })}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.zeroDepositText}>Zero dep</Text>
                                    </TouchableOpacity>
                                </View>
                                <NotionInput
                                    value={form.depositText}
                                    onChangeText={(depositText) => patch({ depositText })}
                                    keyboardType="numeric"
                                    placeholder="e.g. 20000"
                                    accessibilityLabel="Security deposit in rupees"
                                />
                            </View>
                        </View>

                        <View style={styles.twoColumnRow}>
                            <View style={styles.columnHalf}>
                                <Typography variant="h3" style={styles.inputLabel}>
                                    ₹ Maintenance (optional)
                                </Typography>
                                <NotionInput
                                    value={form.maintenanceText}
                                    onChangeText={(maintenanceText) => patch({ maintenanceText })}
                                    keyboardType="numeric"
                                    placeholder="e.g. 1500"
                                    accessibilityLabel="Maintenance in rupees"
                                />
                            </View>

                            <View style={[styles.columnHalf, { justifyContent: 'center', paddingTop: 18 }]}>
                                <TouchableOpacity
                                    style={[styles.togglePill, form.negotiable && styles.togglePillActive]}
                                    onPress={() => patch({ negotiable: !form.negotiable })}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={form.negotiable ? 'checkbox' : 'square-outline'}
                                        size={18}
                                        color={form.negotiable ? COLORS.primary : COLORS.secondary}
                                    />
                                    <Text style={[styles.togglePillText, form.negotiable && styles.togglePillTextActive]}>
                                        Rent is negotiable
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* SECTION 4: AVAILABILITY & OCCUPANCY */}
                    <View style={styles.section}>
                        <Typography variant="h2" style={styles.sectionTitle}>
                            Availability & Occupancy
                        </Typography>

                        <Typography variant="caption" style={styles.fieldSubLabel}>
                            Available from
                        </Typography>
                        <View style={styles.chipsRow}>
                            {[
                                { id: 'immediate', label: 'Immediately / Today' },
                                { id: 'next_month', label: '1st of next month' },
                                { id: '15_days', label: 'Within 15 days' },
                            ].map((opt) => {
                                const selected = (form.availableFrom || 'immediate') === opt.id;
                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[styles.chipPill, selected && styles.chipPillActive]}
                                        onPress={() => patch({ availableFrom: opt.id })}
                                        activeOpacity={0.78}
                                    >
                                        <Text style={[styles.chipPillText, selected && styles.chipPillTextActive]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Typography variant="caption" style={[styles.fieldSubLabel, { marginTop: SPACING.m }]}>
                            Occupancy / Room format
                        </Typography>
                        <View style={styles.chipsRow}>
                            {occupancyOptions.map((opt) => {
                                const selected = (form.occupancy || 'single') === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[styles.chipPill, selected && styles.chipPillActive]}
                                        onPress={() => patch({ occupancy: opt.value })}
                                        activeOpacity={0.78}
                                    >
                                        <Text style={[styles.chipPillText, selected && styles.chipPillTextActive]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Gender Preference */}
                        <Typography variant="caption" style={[styles.fieldSubLabel, { marginTop: SPACING.m }]}>
                            Preferred tenant / flatmate
                        </Typography>
                        <View style={styles.chipsRow}>
                            {[
                                { value: 'any', label: 'Any / All welcome' },
                                { value: 'female', label: 'Female only' },
                                { value: 'male', label: 'Male only' },
                            ].map((opt) => {
                                const selected = (form.genderPreference || 'any') === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[styles.chipPill, selected && styles.chipPillActive]}
                                        onPress={() => patch({ genderPreference: opt.value })}
                                        activeOpacity={0.78}
                                    >
                                        <Text style={[styles.chipPillText, selected && styles.chipPillTextActive]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* SECTION 5: LOCATION */}
                    <View style={styles.section}>
                        <Typography variant="h2" style={styles.sectionTitle}>
                            Location
                        </Typography>
                        <Typography variant="caption" style={styles.sectionSubtitle}>
                            Your exact pin stays private. Croww displays an approximate locality to seekers.
                        </Typography>

                        <GooglePlacesInput
                            label="Search address or area"
                            placeholder="e.g. Koramangala 4th Block, Indiranagar, Adyar..."
                            initialValue={form.addressLine1}
                            onSelect={(selection) => {
                                const parsed = parsePlace(selection);
                                const localityName = parsed.localityName || form.localityName;
                                patch({
                                    addressLine1: parsed.addressLine1,
                                    city: parsed.city || form.city,
                                    pincode: parsed.pincode || form.pincode,
                                    localityName,
                                    localityId: slugLocalityId(parsed.city || form.city, localityName),
                                    exactLatitude: parsed.latitude,
                                    exactLongitude: parsed.longitude,
                                });
                            }}
                        />

                        {/* Interactive Pin Adjuster */}
                        <View style={styles.mapWrap}>
                            <PostPinMap
                                coordinate={mapCoordinate}
                                onPick={(coordinate) => patch({
                                    exactLatitude: coordinate.latitude,
                                    exactLongitude: coordinate.longitude,
                                })}
                            />
                        </View>

                        <View style={styles.twoColumnRow}>
                            <View style={styles.columnHalf}>
                                <NotionInput
                                    label="Locality / Area"
                                    value={form.localityName}
                                    onChangeText={(localityName) => patch({
                                        localityName,
                                        localityId: slugLocalityId(form.city, localityName),
                                    })}
                                    placeholder="e.g. HSR Layout"
                                    accessibilityLabel="Locality name"
                                />
                            </View>
                            <View style={styles.columnHalf}>
                                <NotionInput
                                    label="City"
                                    value={form.city}
                                    onChangeText={(city) => patch({ city })}
                                    placeholder="e.g. Bangalore"
                                    accessibilityLabel="City"
                                />
                            </View>
                        </View>
                    </View>

                    {/* SECTION 6: CATEGORY-SPECIFIC QUICK FEATURES */}
                    <View style={styles.section}>
                        <Typography variant="h2" style={styles.sectionTitle}>
                            Key Features
                        </Typography>
                        <Typography variant="caption" style={styles.sectionSubtitle}>
                            Tap to highlight what is included in this {categoryTitle.toLowerCase()}.
                        </Typography>

                        <View style={styles.featuresGrid}>
                            {quickFeatures.map((feat) => {
                                const isSelected = (form.amenities || []).includes(feat.id)
                                    || (feat.id === 'attached_bathroom' && form.attachedBathroom)
                                    || (feat.id === 'food_included' && form.foodIncluded)
                                    || (feat.id === 'furnished' && form.furnishing === 'fully');

                                return (
                                    <TouchableOpacity
                                        key={feat.id}
                                        style={[styles.featureCard, isSelected && styles.featureCardSelected]}
                                        onPress={() => toggleFeature(feat.id)}
                                        activeOpacity={0.78}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: isSelected }}
                                        accessibilityLabel={feat.label}
                                    >
                                        <Ionicons
                                            name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                                            size={17}
                                            color={isSelected ? COLORS.primary : COLORS.secondary}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text
                                            style={[styles.featureCardText, isSelected && styles.featureCardTextSelected]}
                                            numberOfLines={1}
                                        >
                                            {feat.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Selected Secondary Features as Chips */}
                        {selectedSecondaryFeatures.length > 0 && (
                            <View style={styles.secondarySelectedWrap}>
                                <Typography variant="caption" style={styles.secondarySelectedTitle}>
                                    Additional added:
                                </Typography>
                                <View style={styles.chipsRow}>
                                    {selectedSecondaryFeatures.map((feat) => (
                                        <View key={feat.id} style={styles.selectedSecondaryChip}>
                                            <Text style={styles.selectedSecondaryChipText}>{feat.label}</Text>
                                            <TouchableOpacity
                                                onPress={() => toggleFeature(feat.id)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                style={{ marginLeft: 4 }}
                                            >
                                                <Ionicons name="close-circle" size={14} color={COLORS.secondary} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* + Add Additional Features Trigger */}
                        <TouchableOpacity
                            style={styles.moreFeaturesBtn}
                            onPress={() => setAdditionalModalVisible(true)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Add additional features"
                        >
                            <Ionicons name="options-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.moreFeaturesBtnText}>+ Add Additional Features</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* STICKY BOTTOM POST CTA */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                <TouchableOpacity
                    style={[styles.primarySubmitBtn, busy && styles.primarySubmitBtnDisabled]}
                    onPress={handlePostSpace}
                    disabled={busy}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Post your space"
                >
                    {busy ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            <Text style={styles.primarySubmitBtnText}>Post your space</Text>
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* ADDITIONAL FEATURES MODAL / BOTTOM SHEET */}
            <Modal
                visible={additionalModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setAdditionalModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Typography variant="h2" style={styles.modalTitle}>
                                    Additional Features
                                </Typography>
                                <Typography variant="caption" style={styles.modalSubtitle}>
                                    Select rules, facilities, and amenities for this {categoryTitle.toLowerCase()}.
                                </Typography>
                            </View>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setAdditionalModalVisible(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={22} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {Object.entries(additionalGroups).map(([groupName, items]) => (
                                <View key={groupName} style={styles.modalGroup}>
                                    <Text style={styles.modalGroupTitle}>{groupName}</Text>
                                    <View style={styles.chipsRow}>
                                        {items.map((feat) => {
                                            const isSelected = (form.amenities || []).includes(feat.id);
                                            return (
                                                <TouchableOpacity
                                                    key={feat.id}
                                                    style={[styles.chipPill, isSelected && styles.chipPillActive]}
                                                    onPress={() => toggleFeature(feat.id)}
                                                    activeOpacity={0.78}
                                                >
                                                    <Ionicons
                                                        name={isSelected ? 'checkmark' : 'add'}
                                                        size={14}
                                                        color={isSelected ? '#FFFFFF' : COLORS.secondary}
                                                        style={{ marginRight: 4 }}
                                                    />
                                                    <Text style={[styles.chipPillText, isSelected && styles.chipPillTextActive]}>
                                                        {feat.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.modalDoneBtn}
                            onPress={() => setAdditionalModalVisible(false)}
                            activeOpacity={0.88}
                        >
                            <Text style={styles.modalDoneBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    backBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 18,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accentMuted,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.full,
        gap: 6,
    },
    categoryBadgeText: {
        fontSize: FONT_SIZES.bodySmall,
        fontWeight: '700',
        color: COLORS.accent,
    },
    saveDraftBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    saveDraftText: {
        fontSize: FONT_SIZES.bodySmall,
        fontWeight: '600',
        color: COLORS.accent,
    },
    scrollContent: {
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.s,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#F87171',
        borderRadius: BORDER_RADIUS.m,
        padding: 12,
        marginBottom: SPACING.m,
        gap: 8,
    },
    errorText: {
        color: '#991B1B',
        fontSize: FONT_SIZES.bodySmall,
        fontWeight: '500',
        flex: 1,
    },
    section: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.s,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
    },
    sectionSubtitle: {
        color: COLORS.secondary,
        marginTop: 2,
        marginBottom: SPACING.s,
    },
    addPhotosPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: BORDER_RADIUS.full,
        gap: 5,
    },
    addPhotosPillText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: FONT_SIZES.caption,
    },
    photoUploadPlaceholder: {
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        borderRadius: BORDER_RADIUS.m,
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
    photoUploadIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.accentMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    photoUploadTitle: {
        fontSize: FONT_SIZES.bodyMedium,
        fontWeight: '600',
        color: COLORS.primary,
    },
    photoUploadHint: {
        fontSize: FONT_SIZES.caption,
        color: COLORS.secondary,
        marginTop: 4,
    },
    photosHorizontalList: {
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 6,
    },
    photoCard: {
        width: 100,
        height: 100,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: COLORS.border,
        position: 'relative',
    },
    photoCardCover: {
        borderColor: COLORS.accent,
        borderWidth: 2,
    },
    photoThumb: {
        width: '100%',
        height: '100%',
    },
    coverBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: COLORS.accent,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.s,
    },
    coverBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    photoDeleteBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.65)',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoAddMoreCard: {
        width: 80,
        height: 100,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    photoAddMoreText: {
        fontSize: 11,
        color: COLORS.secondary,
        marginTop: 4,
        fontWeight: '500',
    },
    labelRowWithAction: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
    suggestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.s,
        backgroundColor: COLORS.accentMuted,
    },
    suggestBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.accent,
    },
    twoColumnRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 6,
    },
    columnHalf: {
        flex: 1,
    },
    zeroDepositChip: {
        backgroundColor: COLORS.surfaceMuted,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    zeroDepositText: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    togglePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
    },
    togglePillActive: {},
    togglePillText: {
        fontSize: 13,
        color: COLORS.secondary,
        fontWeight: '500',
    },
    togglePillTextActive: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    fieldSubLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.secondary,
        marginBottom: 8,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full,
    },
    chipPillActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent,
    },
    chipPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    chipPillTextActive: {
        color: '#FFFFFF',
    },
    mapWrap: {
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginVertical: SPACING.s,
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.m,
        width: '48%',
    },
    featureCardSelected: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accentMuted,
    },
    featureCardText: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.primary,
        flex: 1,
    },
    featureCardTextSelected: {
        fontWeight: '700',
        color: COLORS.accent,
    },
    secondarySelectedWrap: {
        marginTop: SPACING.m,
        paddingTop: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    secondarySelectedTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.secondary,
        marginBottom: 6,
    },
    selectedSecondaryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceMuted,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    selectedSecondaryChipText: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '500',
    },
    moreFeaturesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingVertical: 12,
        marginTop: SPACING.m,
        backgroundColor: COLORS.background,
    },
    moreFeaturesBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingHorizontal: SPACING.m,
        paddingTop: 12,
        ...SHADOWS.lifted,
    },
    primarySubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.m,
        paddingVertical: 14,
        minHeight: TOUCH_TARGETS.minimum,
    },
    primarySubmitBtnDisabled: {
        opacity: 0.6,
    },
    primarySubmitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.m,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
    },
    modalSubtitle: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBody: {
        paddingVertical: SPACING.m,
    },
    modalGroup: {
        marginBottom: SPACING.m,
    },
    modalGroupTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.secondary,
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    modalDoneBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.m,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    modalDoneBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});

export default PostListingScreen;
