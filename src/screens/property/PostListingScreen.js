import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import GooglePlacesInput from '../../components/GooglePlacesInput';
import PostProgress from '../../components/property/post/PostProgress';
import PostChoiceChips from '../../components/property/post/PostChoiceChips';
import PostPinMap from '../../components/property/post/PostPinMap';
import PropertyMiniMap from '../../components/property/PropertyMiniMap';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getPropertyRoles } from '../../navigation/propertyCapabilities';
import { inventoryService } from '../../services/property';
import {
    InventoryError,
    MAX_POST_PHOTOS,
    PRECISION_COPY,
    LOCATION_VISIBILITY_COPY,
    SUBTYPE_LABELS,
    amenityOptions,
    bhkValueFromChoice,
    buildListingCreateInput,
    buildListingUpdatePatch,
    buildPropertyCreateInput,
    canRequestPublish,
    canSaveDraft,
    inventoryErrorMessage,
    listerStatusCopy,
    numericField,
    postingActorChoices,
    propertyFieldVisibility,
    slugLocalityId,
    subtypeOptions,
    validatePostListing,
    validatePostProperty,
    visibleSteps,
} from '../../domain/property';
import { formatInrCompact } from '../../utils/propertyFormat';
import { showAlert } from '../../utils/showAlert';

const BHK_OPTIONS = [
    { value: 1, label: '1 BHK' },
    { value: 2, label: '2 BHK' },
    { value: 3, label: '3 BHK' },
    { value: 4, label: '4 BHK' },
    { value: 5, label: '5+' },
];

const STEP_TITLES = {
    actor: 'Who is listing?',
    source: 'Which property?',
    transaction: 'What are you listing?',
    category: 'Property type',
    property: 'Property details',
    location: 'Location',
    listing: 'Listing details',
    media: 'Photos',
    review: 'Review',
};

function emptyForm() {
    return {
        listedByRole: null,
        existingPropertyId: null,
        propertyId: null,
        listingId: null,
        transactionType: null,
        category: null,
        subtype: null,
        bedrooms: null,
        bathrooms: null,
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
        city: '',
        state: '',
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
        listedByRole: listing.listedByRole,
        existingPropertyId: listing.propertyId,
        propertyId: listing.propertyId,
        listingId: listing.id,
        transactionType: listing.transactionType,
        category: property?.category || null,
        subtype: property?.subtype || null,
        bedrooms: property?.bedrooms ?? null,
        bathrooms: property?.bathrooms ?? null,
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
        city: property?.city || property?.address?.city || '',
        state: property?.state || property?.address?.state || '',
        localityId: property?.localityId || '',
        localityName: property?.localityId || '',
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
    const { user } = useAuth();
    const roles = getPropertyRoles(user);
    const actorChoices = useMemo(() => postingActorChoices(roles), [roles]);
    const listingIdParam = route.params?.listingId || null;

    const [form, setForm] = useState(emptyForm);
    const [stepKey, setStepKey] = useState('actor');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(!!listingIdParam);
    const [error, setError] = useState('');
    const [duplicates, setDuplicates] = useState([]);
    const [myProperties, setMyProperties] = useState([]);
    const [localities, setLocalities] = useState([]);
    const [dirty, setDirty] = useState(false);

    const patch = useCallback((partial) => {
        setDirty(true);
        setForm((prev) => ({ ...prev, ...partial }));
    }, []);

    const steps = visibleSteps(form);
    const stepIndex = Math.max(0, steps.indexOf(stepKey));
    const vis = propertyFieldVisibility(form.category, form.subtype);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!listingIdParam) return;
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
                setStepKey('review');
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

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (!dirty || busy) return;
            event.preventDefault();
            showAlert(
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

    const loadMine = useCallback(async () => {
        try {
            const rows = await inventoryService.listMyProperties();
            setMyProperties(Array.isArray(rows) ? rows : []);
        } catch {
            setMyProperties([]);
        }
    }, []);

    useEffect(() => {
        if (stepKey === 'source') loadMine();
    }, [stepKey, loadMine]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (stepKey !== 'location' || !form.city) {
                setLocalities([]);
                return;
            }
            const rows = await inventoryService.listLocalitiesForCity(form.city);
            if (!cancelled) setLocalities(Array.isArray(rows) ? rows : []);
        })();
        return () => { cancelled = true; };
    }, [stepKey, form.city]);

    const goNext = () => {
        setError('');
        const current = steps[stepIndex];
        if (current === 'actor' && !form.listedByRole) {
            setError('Choose how you are listing.');
            return;
        }
        if (current === 'transaction' && !form.transactionType) {
            setError('Choose Buy or Rent.');
            return;
        }
        if (current === 'category' && (!form.category || !form.subtype)) {
            setError('Choose a property type.');
            return;
        }
        if (current === 'location') {
            const issues = validatePostProperty(form);
            if (issues.length) {
                setError(issues[0].message);
                return;
            }
        }
        if (current === 'listing') {
            const issues = validatePostListing(form);
            if (issues.length) {
                setError(issues[0].message);
                return;
            }
        }
        const next = steps[stepIndex + 1];
        if (next) setStepKey(next);
    };

    const goBack = () => {
        setError('');
        const prev = steps[stepIndex - 1];
        if (prev) setStepKey(prev);
        else navigation.goBack();
    };

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
                    projectName: propertyInput.projectName,
                    bedrooms: propertyInput.bedrooms,
                    bathrooms: propertyInput.bathrooms,
                    carpetAreaSqft: propertyInput.carpetAreaSqft,
                    builtUpAreaSqft: propertyInput.builtUpAreaSqft,
                    plotAreaSqft: propertyInput.plotAreaSqft,
                    floor: propertyInput.floor,
                    totalFloors: propertyInput.totalFloors,
                    furnishing: propertyInput.furnishing,
                    parking: propertyInput.parking,
                    constructionYear: propertyInput.constructionYear,
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
        if (!propertyId) {
            const created = await inventoryService.createProperty(buildPropertyCreateInput(form), { allowDuplicates });
            propertyId = created.property.id;
            patch({
                propertyId,
                publicLatitude: created.property.latitude,
                publicLongitude: created.property.longitude,
            });
        }
        const createdListing = await inventoryService.createListing({
            ...listingInput,
            propertyId,
        });
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

    const onSaveDraft = async ({ allowDuplicates = false } = {}) => {
        if (!canSaveDraft(form)) {
            setError('Add the property location and a listing title before saving a draft.');
            return null;
        }
        setBusy(true);
        setError('');
        try {
            const result = await persistDraft({ allowDuplicates });
            setDuplicates([]);
            setDirty(false);
            showAlert('Draft saved', 'You can leave and finish this listing later. It is not live.');
            return result;
        } catch (err) {
            if (err instanceof InventoryError && err.code === 'POTENTIAL_DUPLICATE') {
                setDuplicates(Array.isArray(err.details?.candidates) ? err.details.candidates : []);
                setError(inventoryErrorMessage('POTENTIAL_DUPLICATE'));
                return null;
            }
            setError(inventoryErrorMessage(err?.code, err?.message));
            return null;
        } finally {
            setBusy(false);
        }
    };

    const onRequestReview = async () => {
        if (!canRequestPublish(form)) {
            const issues = validatePostListing(form, { forPublish: true });
            setError(issues[0]?.message || 'Add a valid price before requesting review.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const saved = await persistDraft();
            if (!saved?.listingId) return;
            const result = await inventoryService.requestPublish(saved.listingId);
            patch({
                listingId: saved.listingId,
                reviewRequestedAt: true,
                status: result?.status || 'DRAFT',
            });
            setDirty(false);
            showAlert(
                'Submitted for review',
                'Your listing will be reviewed before going live. It is not published yet.'
            );
        } catch (err) {
            if (err instanceof InventoryError && err.code === 'POTENTIAL_DUPLICATE') {
                setDuplicates(Array.isArray(err.details?.candidates) ? err.details.candidates : []);
                setError(inventoryErrorMessage('POTENTIAL_DUPLICATE'));
                return;
            }
            setError(inventoryErrorMessage(err?.code, err?.message));
        } finally {
            setBusy(false);
        }
    };

    const pickPhotos = async () => {
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

    const mapCoordinate = form.exactLatitude != null && form.exactLongitude != null
        ? { latitude: form.exactLatitude, longitude: form.exactLongitude }
        : null;

    const reviewMapCoordinate = form.locationPrecision === 'exact'
        ? (mapCoordinate || (
            Number.isFinite(form.publicLatitude) && Number.isFinite(form.publicLongitude)
                ? { latitude: form.publicLatitude, longitude: form.publicLongitude }
                : null
        ))
        : null;

    const renderStep = () => {
        if (stepKey === 'actor') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>How are you listing?</Typography>
                    {actorChoices.map((choice) => (
                        <NotionCard
                            key={choice.role}
                            style={[
                                styles.optionCard,
                                form.listedByRole === choice.role && styles.optionCardActive,
                                !choice.allowed && styles.optionCardLocked,
                            ]}
                            onPress={() => {
                                if (choice.allowed) patch({ listedByRole: choice.role });
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: form.listedByRole === choice.role, disabled: !choice.allowed }}
                            accessibilityLabel={choice.title}
                        >
                            <Typography variant="h3">{choice.title}</Typography>
                            <Typography variant="body" style={styles.muted}>{choice.body}</Typography>
                            {choice.lockedHint ? (
                                <Typography variant="caption" style={styles.warn}>{choice.lockedHint}</Typography>
                            ) : null}
                        </NotionCard>
                    ))}
                </>
            );
        }
        if (stepKey === 'source') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>Identify the property</Typography>
                    <PostChoiceChips
                        accessibilityLabel="New or existing property"
                        value={form.existingPropertyId ? 'existing' : 'new'}
                        onChange={(value) => {
                            if (value === 'new') patch({ existingPropertyId: null });
                        }}
                        options={[
                            { value: 'new', label: 'New property' },
                            { value: 'existing', label: 'One I already added', disabled: myProperties.length === 0 },
                        ]}
                    />
                    {myProperties.length === 0 ? (
                        <Typography variant="body" style={styles.muted}>
                            You don’t have a saved property yet. We’ll create one with this listing.
                        </Typography>
                    ) : myProperties.map((property) => (
                        <NotionCard
                            key={property.id}
                            style={[
                                styles.optionCard,
                                form.existingPropertyId === property.id && styles.optionCardActive,
                            ]}
                            onPress={() => patch({
                                existingPropertyId: property.id,
                                propertyId: property.id,
                                category: property.category,
                                subtype: property.subtype,
                                city: property.city,
                                localityId: property.localityId,
                                locationPrecision: property.locationPrecision,
                                publicLatitude: property.latitude,
                                publicLongitude: property.longitude,
                            })}
                            accessibilityLabel={`Use existing ${property.subtype || 'property'} in ${property.city || 'this city'}`}
                        >
                            <Typography variant="h3">
                                {SUBTYPE_LABELS[property.subtype] || property.subtype} · {property.city}
                            </Typography>
                            <Typography variant="caption" style={styles.muted}>
                                {property.locationPrecision} location · your property
                            </Typography>
                        </NotionCard>
                    ))}
                </>
            );
        }
        if (stepKey === 'transaction') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>Buy or rent?</Typography>
                    <PostChoiceChips
                        accessibilityLabel="Listing type"
                        value={form.transactionType}
                        onChange={(transactionType) => patch({ transactionType })}
                        options={[
                            { value: 'buy', label: 'Buy', hint: 'Sale listing' },
                            { value: 'rent', label: 'Rent', hint: 'Monthly rent' },
                        ]}
                    />
                </>
            );
        }
        if (stepKey === 'category') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>What kind of property?</Typography>
                    <PostChoiceChips
                        accessibilityLabel="Property category"
                        value={form.category}
                        onChange={(category) => patch({ category, subtype: null, amenities: [] })}
                        options={[
                            { value: 'residential', label: 'Residential' },
                            { value: 'commercial', label: 'Commercial' },
                            { value: 'land', label: 'Land' },
                        ]}
                    />
                    {form.category ? (
                        <PostChoiceChips
                            accessibilityLabel="Property subtype"
                            value={form.subtype}
                            onChange={(subtype) => patch({ subtype })}
                            options={subtypeOptions(form.category)}
                        />
                    ) : null}
                </>
            );
        }
        if (stepKey === 'property') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>Describe the property</Typography>
                    {vis.bedrooms ? (
                        <PostChoiceChips
                            accessibilityLabel="BHK"
                            value={form.bedrooms}
                            onChange={(value) => patch({ bedrooms: bhkValueFromChoice(value) })}
                            options={BHK_OPTIONS}
                        />
                    ) : null}
                    {vis.bathrooms ? (
                        <NotionInput
                            label="Bathrooms"
                            value={form.bathrooms == null ? '' : String(form.bathrooms)}
                            onChangeText={(text) => patch({ bathrooms: numericField(text) })}
                            keyboardType="number-pad"
                            placeholder="e.g. 2"
                            accessibilityLabel="Bathrooms"
                        />
                    ) : null}
                    {vis.carpetArea ? (
                        <NotionInput
                            label="Carpet area (sq ft)"
                            value={form.carpetAreaSqft == null ? '' : String(form.carpetAreaSqft)}
                            onChangeText={(text) => patch({ carpetAreaSqft: numericField(text) })}
                            keyboardType="decimal-pad"
                            placeholder="Square feet"
                            accessibilityLabel="Carpet area in square feet"
                        />
                    ) : null}
                    {vis.builtUpArea ? (
                        <NotionInput
                            label="Built-up area (sq ft)"
                            value={form.builtUpAreaSqft == null ? '' : String(form.builtUpAreaSqft)}
                            onChangeText={(text) => patch({ builtUpAreaSqft: numericField(text) })}
                            keyboardType="decimal-pad"
                            placeholder="Square feet"
                            accessibilityLabel="Built-up area in square feet"
                        />
                    ) : null}
                    {vis.plotArea ? (
                        <NotionInput
                            label="Plot area (sq ft)"
                            value={form.plotAreaSqft == null ? '' : String(form.plotAreaSqft)}
                            onChangeText={(text) => patch({ plotAreaSqft: numericField(text) })}
                            keyboardType="decimal-pad"
                            placeholder="Square feet"
                            accessibilityLabel="Plot area in square feet"
                        />
                    ) : null}
                    {vis.floor ? (
                        <NotionInput
                            label="Floor"
                            value={form.floor == null ? '' : String(form.floor)}
                            onChangeText={(text) => patch({ floor: numericField(text) })}
                            keyboardType="number-pad"
                            accessibilityLabel="Floor number"
                        />
                    ) : null}
                    {vis.totalFloors ? (
                        <NotionInput
                            label="Total floors"
                            value={form.totalFloors == null ? '' : String(form.totalFloors)}
                            onChangeText={(text) => patch({ totalFloors: numericField(text) })}
                            keyboardType="number-pad"
                            accessibilityLabel="Total floors"
                        />
                    ) : null}
                    {vis.furnishing ? (
                        <PostChoiceChips
                            accessibilityLabel="Furnishing"
                            value={form.furnishing}
                            onChange={(furnishing) => patch({ furnishing })}
                            options={[
                                { value: 'unfurnished', label: 'Unfurnished' },
                                { value: 'semi', label: 'Semi' },
                                { value: 'fully', label: 'Fully' },
                            ]}
                        />
                    ) : null}
                    {vis.parking ? (
                        <NotionInput
                            label="Parking (count)"
                            value={form.parking == null ? '' : String(form.parking)}
                            onChangeText={(text) => patch({ parking: numericField(text) })}
                            keyboardType="number-pad"
                            accessibilityLabel="Parking count"
                        />
                    ) : null}
                    {vis.constructionYear ? (
                        <NotionInput
                            label="Year built"
                            value={form.constructionYear == null ? '' : String(form.constructionYear)}
                            onChangeText={(text) => patch({ constructionYear: numericField(text) })}
                            keyboardType="number-pad"
                            placeholder="e.g. 2018"
                            accessibilityLabel="Construction year"
                        />
                    ) : null}
                    {vis.projectName ? (
                        <NotionInput
                            label="Building / project name (optional)"
                            value={form.projectName}
                            onChangeText={(projectName) => patch({ projectName })}
                            accessibilityLabel="Project name"
                        />
                    ) : null}
                    {vis.amenities ? (
                        <>
                            <Typography variant="caption" style={styles.fieldLabel}>Amenities</Typography>
                            <PostChoiceChips
                                accessibilityLabel="Amenities"
                                value={null}
                                onChange={(amenity) => {
                                    const selected = form.amenities.includes(amenity)
                                        ? form.amenities.filter((item) => item !== amenity)
                                        : [...form.amenities, amenity];
                                    patch({ amenities: selected });
                                }}
                                options={amenityOptions(form.category).map((item) => ({
                                    value: item,
                                    label: form.amenities.includes(item) ? `✓ ${item}` : item,
                                }))}
                            />
                        </>
                    ) : null}
                    <NotionInput
                        label="About the property (optional)"
                        value={form.propertyDescription}
                        onChangeText={(propertyDescription) => patch({ propertyDescription })}
                        multiline
                        placeholder="Physical details: facing, condition, building"
                        accessibilityLabel="Property description"
                    />
                </>
            );
        }
        if (stepKey === 'location') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>Where is it?</Typography>
                    <GooglePlacesInput
                        label="Search address"
                        placeholder="Search a place in India"
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
                    <PostPinMap
                        coordinate={mapCoordinate}
                        onPick={(coordinate) => patch({
                            exactLatitude: coordinate.latitude,
                            exactLongitude: coordinate.longitude,
                        })}
                    />
                    <Typography variant="caption" style={styles.muted}>
                        Search or tap the map. Croww stores the exact pin privately and derives the public map pin from your visibility setting.
                    </Typography>
                    <NotionInput
                        label="City"
                        value={form.city}
                        onChangeText={(city) => patch({
                            city,
                            localityId: slugLocalityId(city, form.localityName || form.localityId),
                        })}
                        accessibilityLabel="City"
                    />
                    <NotionInput
                        label="Locality / neighborhood"
                        value={form.localityName}
                        onChangeText={(localityName) => patch({
                            localityName,
                            localityId: slugLocalityId(form.city, localityName),
                        })}
                        accessibilityLabel="Locality"
                    />
                    {localities.length ? (
                        <PostChoiceChips
                            accessibilityLabel="Known localities"
                            value={form.localityId}
                            onChange={(localityId) => {
                                const hit = localities.find((row) => row.id === localityId);
                                patch({
                                    localityId,
                                    localityName: hit?.name || form.localityName,
                                    localityCoordinate: hit
                                        ? { latitude: hit.latitude, longitude: hit.longitude }
                                        : null,
                                    city: hit?.city || form.city,
                                });
                            }}
                            options={localities.slice(0, 12).map((row) => ({
                                value: row.id,
                                label: row.name,
                            }))}
                        />
                    ) : (
                        <Typography variant="caption" style={styles.muted}>
                            No Croww neighborhood catalog for this city yet. Your neighborhood name is still saved on the listing.
                        </Typography>
                    )}
                    <NotionInput
                        label="Street address"
                        value={form.addressLine1}
                        onChangeText={(addressLine1) => patch({ addressLine1 })}
                        accessibilityLabel="Street address"
                    />
                    <Typography variant="caption" style={styles.fieldLabel}>Location visibility</Typography>
                    {Object.keys(LOCATION_VISIBILITY_COPY).map((key) => (
                        <NotionCard
                            key={key}
                            style={[
                                styles.optionCard,
                                form.locationPrecision === key && styles.optionCardActive,
                            ]}
                            onPress={() => patch({ locationPrecision: key })}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: form.locationPrecision === key }}
                            accessibilityLabel={LOCATION_VISIBILITY_COPY[key].label}
                        >
                            <Typography variant="h3">{LOCATION_VISIBILITY_COPY[key].label}</Typography>
                            <Typography variant="body" style={styles.muted}>{LOCATION_VISIBILITY_COPY[key].hint}</Typography>
                        </NotionCard>
                    ))}
                </>
            );
        }
        if (stepKey === 'listing') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>The offering</Typography>
                    <NotionInput
                        label="Listing title"
                        value={form.title}
                        onChangeText={(title) => patch({ title })}
                        placeholder={form.transactionType === 'rent' ? '3 BHK for rent in Adyar' : '3 BHK for sale in Adyar'}
                        accessibilityLabel="Listing title"
                    />
                    <NotionInput
                        label="Listing description (optional)"
                        value={form.listingDescription}
                        onChangeText={(listingDescription) => patch({ listingDescription })}
                        multiline
                        placeholder="Price context, availability, who it’s for. Property facts are already captured."
                        accessibilityLabel="Listing description"
                    />
                    {form.transactionType === 'buy' ? (
                        <NotionInput
                            label="Asking price (₹)"
                            value={form.askingPriceText}
                            onChangeText={(askingPriceText) => patch({ askingPriceText })}
                            keyboardType="decimal-pad"
                            placeholder="e.g. 1.35 Cr or 13500000"
                            accessibilityLabel="Asking price"
                        />
                    ) : (
                        <>
                            <NotionInput
                                label="Monthly rent (₹)"
                                value={form.rentMonthlyText}
                                onChangeText={(rentMonthlyText) => patch({ rentMonthlyText })}
                                keyboardType="decimal-pad"
                                placeholder="e.g. 42000"
                                accessibilityLabel="Monthly rent"
                            />
                            <NotionInput
                                label="Deposit (optional)"
                                value={form.depositText}
                                onChangeText={(depositText) => patch({ depositText })}
                                keyboardType="decimal-pad"
                                accessibilityLabel="Security deposit"
                            />
                            <NotionInput
                                label="Maintenance / month (optional)"
                                value={form.maintenanceText}
                                onChangeText={(maintenanceText) => patch({ maintenanceText })}
                                keyboardType="decimal-pad"
                                accessibilityLabel="Monthly maintenance"
                            />
                        </>
                    )}
                    <PostChoiceChips
                        accessibilityLabel="Negotiable"
                        value={form.negotiable ? 'yes' : 'no'}
                        onChange={(value) => patch({ negotiable: value === 'yes' })}
                        options={[
                            { value: 'yes', label: 'Negotiable' },
                            { value: 'no', label: 'Fixed' },
                        ]}
                    />
                </>
            );
        }
        if (stepKey === 'media') {
            return (
                <>
                    <Typography variant="h2" style={styles.heading}>Photos</Typography>
                    <Typography variant="body" style={styles.muted}>
                        Photos upload when you save the draft. Documents and ID proofs are not allowed here.
                        A 3D tour is optional and can be added later from inventory — it is not required to list.
                    </Typography>
                    <View style={styles.photoGrid}>
                        {form.photos.map((photo) => {
                            const isCover = form.coverLocalId === photo.localId;
                            return (
                                <TouchableOpacity
                                    key={photo.localId}
                                    style={[styles.photoWrap, isCover && styles.photoCover]}
                                    onPress={() => patch({ coverLocalId: photo.localId })}
                                    accessibilityLabel={isCover ? 'Cover photo' : 'Set as cover photo'}
                                >
                                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                                    {isCover ? (
                                        <Typography variant="caption" style={styles.coverBadge}>Cover</Typography>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <AntigravityButton
                        title="Add photos"
                        icon="images-outline"
                        variant="secondary"
                        onPress={pickPhotos}
                        accessibilityLabel="Add photos"
                    />
                </>
            );
        }
        const price = form.transactionType === 'rent'
            ? formatInrCompact(buildListingCreateInput(form).rentMonthly)
            : formatInrCompact(buildListingCreateInput(form).askingPrice);
        return (
            <>
                <Typography variant="h2" style={styles.heading}>Review before submitting</Typography>
                <Typography variant="caption" style={styles.status}>
                    {listerStatusCopy(form)}
                </Typography>
                <NotionCard style={styles.reviewCard}>
                    <Typography variant="h3">Property</Typography>
                    <Typography variant="body" style={styles.muted}>
                        {SUBTYPE_LABELS[form.subtype] || form.subtype}
                        {form.bedrooms ? ` · ${form.bedrooms >= 5 ? '5+' : form.bedrooms} BHK` : ''}
                        {form.builtUpAreaSqft ? ` · ${form.builtUpAreaSqft} sq ft` : ''}
                        {form.plotAreaSqft ? ` · ${form.plotAreaSqft} sq ft plot` : ''}
                    </Typography>
                    <Typography variant="body" style={styles.muted}>
                        {form.localityName || form.localityId}, {form.city}
                    </Typography>
                </NotionCard>
                <NotionCard style={styles.reviewCard}>
                    <Typography variant="h3">Listing</Typography>
                    <Typography variant="body">{form.title}</Typography>
                    <Typography variant="body" style={styles.muted}>
                        {form.transactionType === 'rent' ? 'Rent' : 'Buy'}
                        {price ? ` · ${price}${form.transactionType === 'rent' ? ' / month' : ''}` : ''}
                        {form.negotiable ? ' · Negotiable' : ''}
                    </Typography>
                </NotionCard>
                <NotionCard style={styles.reviewCard}>
                    <Typography variant="h3">Location visibility</Typography>
                    <Typography variant="body" style={styles.muted}>
                        {PRECISION_COPY[form.locationPrecision]?.label}: {PRECISION_COPY[form.locationPrecision]?.hint}
                    </Typography>
                    {reviewMapCoordinate ? (
                        <View style={{ marginTop: SPACING.s }}>
                            <PropertyMiniMap
                                coordinate={reviewMapCoordinate}
                                accessibilityLabel="Public exact location map"
                            />
                        </View>
                    ) : (
                        <Typography variant="caption" style={styles.muted}>
                            The public map pin is derived when you save. Exact coordinates are not shown here.
                        </Typography>
                    )}
                </NotionCard>
                <NotionCard style={styles.reviewCard}>
                    <Typography variant="h3">Photos</Typography>
                    <Typography variant="body" style={styles.muted}>
                        {form.photos.length ? `${form.photos.length} photo${form.photos.length === 1 ? '' : 's'}` : 'No photos yet'}
                    </Typography>
                </NotionCard>
                <Typography variant="body" style={styles.muted}>
                    Requesting review does not publish the listing. Croww will review it before it appears on Explore.
                </Typography>
                {duplicates.length ? (
                    <NotionCard style={styles.reviewCard}>
                        <Typography variant="h3">Possible existing property</Typography>
                        <Typography variant="body" style={styles.muted}>
                            We found a similar {form.subtype || 'property'} in this neighborhood. This is not a merge. Continue only if this is a different property.
                        </Typography>
                        <AntigravityButton
                            title="Save anyway"
                            variant="secondary"
                            onPress={() => onSaveDraft({ allowDuplicates: true })}
                            accessibilityLabel="Save draft despite possible duplicate"
                        />
                    </NotionCard>
                ) : null}
            </>
        );
    };

    if (loading) {
        return (
            <ScreenWrapper edges={['top', 'bottom']}>
                <View style={styles.centered}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Typography variant="h3">{STEP_TITLES[stepKey]}</Typography>
                    <View style={{ width: 24 }} />
                </View>
                <PostProgress
                    stepIndex={stepIndex}
                    stepCount={steps.length}
                    label={`${STEP_TITLES[stepKey]} · ${stepIndex + 1} of ${steps.length}`}
                />
                <ScrollView
                    contentContainerStyle={styles.body}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderStep()}
                    {error ? <Typography variant="body" style={styles.error}>{error}</Typography> : null}
                </ScrollView>
                <View style={styles.footer}>
                    {stepKey === 'review' ? (
                        <>
                            <AntigravityButton
                                title="Save draft"
                                variant="secondary"
                                loading={busy}
                                onPress={() => onSaveDraft()}
                                accessibilityLabel="Save draft"
                            />
                            <AntigravityButton
                                title="Request review"
                                loading={busy}
                                onPress={onRequestReview}
                                accessibilityLabel="Request publication review"
                            />
                        </>
                    ) : (
                        <AntigravityButton
                            title="Next"
                            onPress={goNext}
                            accessibilityLabel="Next step"
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.s,
    },
    body: {
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.xl,
    },
    heading: {
        marginBottom: SPACING.m,
    },
    muted: {
        color: COLORS.secondary,
        marginTop: 4,
    },
    warn: {
        color: COLORS.warning,
        marginTop: SPACING.s,
    },
    error: {
        color: COLORS.error,
        marginTop: SPACING.m,
    },
    status: {
        color: COLORS.accent,
        marginBottom: SPACING.m,
    },
    optionCard: {
        marginBottom: SPACING.m,
    },
    optionCardActive: {
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    optionCardLocked: {
        opacity: 0.7,
    },
    fieldLabel: {
        color: COLORS.secondary,
        marginBottom: SPACING.s,
        fontWeight: '600',
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        marginVertical: SPACING.m,
    },
    photoWrap: {
        width: 96,
        height: 96,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    photoCover: {
        borderColor: COLORS.accent,
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    coverBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        color: COLORS.accent,
        fontWeight: '700',
    },
    reviewCard: {
        marginBottom: SPACING.m,
    },
    footer: {
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.m,
        gap: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default PostListingScreen;
