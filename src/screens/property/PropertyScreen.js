import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Share,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import PropertyMediaGallery from '../../components/property/PropertyMediaGallery';
import PropertyFacts from '../../components/property/PropertyFacts';
import PropertyLocation from '../../components/property/PropertyLocation';
import PropertyAmenities from '../../components/property/PropertyAmenities';
import PropertyFreshness from '../../components/property/PropertyFreshness';
import PropertyVerification from '../../components/property/PropertyVerification';
import Property3DSection from '../../components/property/Property3DSection';
import { propertyDetailService } from '../../services/property';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING } from '../../constants/theme';
import AntigravityButton from '../../components/AntigravityButton';
import { formatOfferPrice, formatSubtype } from '../../utils/propertyFormat';
import { buildPropertyShare, formatPublicLocation } from '../../utils/propertyDetailView';
import { effectiveVerificationStatus } from '../../domain/verification';
import { useSavedItems } from '../../context/SavedItemsContext';
import SaveButton from '../../components/property/saved/SaveButton';

const PropertyScreen = ({ route, navigation }) => {
    const propertyId = route.params?.propertyId || route.params?.id || null;
    const { width } = useWindowDimensions();
    const split = width >= 900;
    const { user } = useAuth();
    const currentUid = user?.id || user?.uid || null;
    const { isPropertySaved, saveProperty, unsaveProperty } = useSavedItems();

    const [status, setStatus] = useState(propertyId ? 'loading' : 'missing');
    const [errorMessage, setErrorMessage] = useState(null);
    const [property, setProperty] = useState(null);
    const [media, setMedia] = useState([]);
    const [locality, setLocality] = useState(null);
    const [publishedListings, setPublishedListings] = useState([]);
    const [mapCoordinate, setMapCoordinate] = useState(null);
    const [locationPrecision, setLocationPrecision] = useState('exact');

    const goBack = useCallback(() => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Tabs', { screen: 'Explore' });
    }, [navigation]);

    useEffect(() => {
        let cancelled = false;
        if (!propertyId) {
            setStatus('missing');
            return undefined;
        }
        (async () => {
            setStatus('loading');
            setErrorMessage(null);
            try {
                const result = await propertyDetailService.loadPropertyDetail(propertyId);
                if (cancelled) return;
                if (result.kind === 'not_found' || !result.property) {
                    setProperty(null);
                    setStatus('missing');
                    return;
                }
                setProperty(result.property);
                setMedia(result.media);
                setLocality(result.locality);
                setPublishedListings(result.publishedListings || []);
                setMapCoordinate(result.mapCoordinate);
                setLocationPrecision(result.locationPrecision);
                setStatus(result.kind === 'inactive' ? 'inactive' : 'ready');
            } catch (error) {
                if (cancelled) return;
                setErrorMessage(error?.message || 'Could not load this property.');
                setStatus('error');
            }
        })();
        return () => { cancelled = true; };
    }, [propertyId]);

    const location = formatPublicLocation({
        precision: locationPrecision,
        city: property?.city,
        state: property?.state,
        localityName: locality?.name,
        address: locationPrecision === 'exact' ? property?.address : null,
    });

    const onShare = useCallback(async () => {
        const payload = buildPropertyShare({
            propertyId,
            headline: [formatSubtype(property?.subtype), location.headline].filter(Boolean).join(' · '),
        });
        if (!payload) return;
        try {
            await Share.share({ message: payload.message, url: payload.url, title: payload.title });
        } catch (error) {
            console.warn('Share failed', error?.message);
        }
    }, [location.headline, property?.subtype, propertyId]);

    const details = property ? (
        <View style={split ? styles.detailsPane : null}>
            {status === 'inactive' ? (
                <View style={styles.banner} accessibilityRole="alert">
                    <Typography variant="body" style={styles.bannerText}>
                        This property is not active inventory.
                    </Typography>
                </View>
            ) : null}
            <View style={styles.section}>
                <Typography variant="h1">
                    {formatSubtype(property.subtype) || 'Property'}
                </Typography>
                {property.projectName ? (
                    <Typography variant="body" style={styles.muted}>{property.projectName}</Typography>
                ) : null}
            </View>
            <PropertyVerification property={property} />
            {currentUid && (property.ownerUid === currentUid || property.createdByUid === currentUid)
                && effectiveVerificationStatus(property.verification?.property) === 'PENDING' ? (
                <Typography variant="caption" style={styles.muted}>Property verification pending</Typography>
            ) : null}
            {currentUid && (property.ownerUid === currentUid || property.createdByUid === currentUid) ? (
                <View style={styles.section}>
                    <AntigravityButton
                        title="Submit verification"
                        variant="secondary"
                        onPress={() => navigation.navigate('SubmitVerification', {
                            type: 'PROPERTY',
                            subjectId: property.id,
                            propertyId: property.id,
                            evidenceType: 'PROPERTY_DOCUMENT',
                        })}
                        accessibilityLabel="Submit property verification"
                    />
                </View>
            ) : null}
            <PropertyFreshness property={property} />
            <PropertyFacts property={property} />
            <Property3DSection
                propertyId={property.id}
                posterUrl={media?.[0]?.thumbnailUrl || media?.[0]?.url}
                canManage={Boolean(currentUid && (property.ownerUid === currentUid || property.createdByUid === currentUid))}
                onAddTour={() => navigation.navigate('SpatialTour', { propertyId: property.id })}
                onViewPhotos={() => {}}
            />
            <PropertyLocation
                precision={locationPrecision}
                city={property.city}
                state={property.state}
                localityName={locality?.name}
                address={locationPrecision === 'exact' ? property.address : null}
                mapCoordinate={mapCoordinate}
                localityId={property.localityId}
                onPressLocality={(id) => navigation.navigate('Locality', { localityId: id })}
            />
            {property.description ? (
                <View style={styles.section}>
                    <Typography variant="h3">About this property</Typography>
                    <Typography variant="body" style={styles.copy}>{property.description}</Typography>
                </View>
            ) : null}
            <PropertyAmenities amenities={property.amenities} />
            {publishedListings.length ? (
                <View style={styles.section}>
                    <Typography variant="h3">Current listings</Typography>
                    {publishedListings.map((item) => {
                        const price = formatOfferPrice(item);
                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => navigation.navigate('Listing', { listingId: item.id })}
                                style={styles.listingRow}
                                accessibilityRole="button"
                                accessibilityLabel={`${item.title || 'Listing'}, ${price.primary}`}
                            >
                                <View style={{ flex: 1 }}>
                                    <Typography variant="body" numberOfLines={1}>
                                        {item.title || (item.transactionType === 'rent' ? 'For rent' : 'For sale')}
                                    </Typography>
                                    <Typography variant="caption" style={styles.muted}>{price.primary}</Typography>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : (
                <Typography variant="caption" style={styles.muted}>No published listings right now.</Typography>
            )}
        </View>
    ) : null;

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={goBack}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={styles.headerTitle}>Property</Typography>
                <SaveButton
                    saved={isPropertySaved(propertyId)}
                    disabled={!property}
                    onToggle={async () => {
                        if (isPropertySaved(propertyId)) await unsaveProperty(propertyId);
                        else await saveProperty(property, { localityName: locality?.name });
                    }}
                />
                <TouchableOpacity
                    onPress={onShare}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Share property"
                    disabled={!property}
                >
                    <Ionicons name="share-outline" size={22} color={property ? COLORS.primary : COLORS.secondary} />
                </TouchableOpacity>
            </View>

            {status === 'loading' ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={COLORS.accent} />
                    <Typography variant="body" style={styles.muted}>Loading property…</Typography>
                </View>
            ) : null}

            {status === 'missing' ? (
                <View style={styles.centered}>
                    <Typography variant="h2">Property not found</Typography>
                    <Typography variant="body" style={styles.muted}>
                        This property is inactive, archived, or the link is invalid.
                    </Typography>
                </View>
            ) : null}

            {status === 'error' ? (
                <View style={styles.centered}>
                    <Typography variant="h2">Couldn’t load property</Typography>
                    <Typography variant="body" style={styles.muted}>{errorMessage}</Typography>
                </View>
            ) : null}

            {(status === 'ready' || status === 'inactive') && property ? (
                <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
                    {split ? (
                        <View style={styles.split}>
                            <View style={styles.mediaPane}>
                                <PropertyMediaGallery media={media} />
                            </View>
                            {details}
                        </View>
                    ) : (
                        <>
                            <PropertyMediaGallery media={media} />
                            {details}
                        </>
                    )}
                </ScrollView>
            ) : null}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
        minHeight: 48,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    iconBtn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        gap: SPACING.m,
    },
    muted: {
        color: COLORS.secondary,
        textTransform: 'none',
        marginTop: 4,
        paddingHorizontal: SPACING.l,
        textAlign: 'center',
    },
    split: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    mediaPane: {
        flex: 1.1,
        minWidth: 320,
    },
    detailsPane: {
        flex: 1,
        minWidth: 320,
    },
    banner: {
        marginHorizontal: SPACING.l,
        marginTop: SPACING.m,
        padding: SPACING.m,
        borderRadius: 10,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    bannerText: {
        color: COLORS.warning,
    },
    section: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        gap: SPACING.s,
    },
    copy: {
        color: COLORS.secondary,
        lineHeight: 22,
    },
    listingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: SPACING.s,
    },
});

export default PropertyScreen;
