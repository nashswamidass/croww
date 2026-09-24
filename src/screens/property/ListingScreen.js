import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Share,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import PropertyMediaGallery from '../../components/property/PropertyMediaGallery';
import PropertySummary from '../../components/property/PropertySummary';
import PropertyFacts from '../../components/property/PropertyFacts';
import PropertyLocation from '../../components/property/PropertyLocation';
import PropertyAmenities from '../../components/property/PropertyAmenities';
import ListingActorCard from '../../components/property/ListingActorCard';
import PropertyFreshness from '../../components/property/PropertyFreshness';
import PropertyVerification from '../../components/property/PropertyVerification';
import Property3DSection from '../../components/property/Property3DSection';
import PropertyMap from '../../components/property/PropertyMap';
import { propertyDetailService, locationShareService } from '../../services/property';
import { useAuth } from '../../context/AuthContext';
import { useSavedItems } from '../../context/SavedItemsContext';
import SaveButton from '../../components/property/saved/SaveButton';
import { ListingDetailSkeleton, MotionView } from '../../components/motion';
import { COLORS, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants/theme';
import { showAlert } from '../../utils/showAlert';
import { formatOfferPrice } from '../../utils/propertyFormat';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import {
    buildListingShare,
    canContactListing,
    contactCtaLabel,
    listingOfferState,
    listingStatusLabel,
    splitDescriptions,
} from '../../utils/propertyDetailView';

const ListingScreen = ({ route, navigation }) => {
    const listingId = route.params?.listingId || route.params?.id || null;
    const initialListing = route.params?.initialListing || null;
    const { user } = useAuth();
    const currentUid = user?.id || user?.uid || null;
    const { isListingSaved, saveListing, unsaveListing } = useSavedItems();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { isDesktop } = useResponsiveLayout();
    const split = width >= 900;

    const [status, setStatus] = useState(initialListing ? 'ready' : (listingId ? 'loading' : 'missing'));
    const [errorMessage, setErrorMessage] = useState(null);
    const [listing, setListing] = useState(initialListing);
    const [property, setProperty] = useState(null);
    const [propertyAccess, setPropertyAccess] = useState('missing');
    const [media, setMedia] = useState([]);
    const [actor, setActor] = useState(null);
    const [locality, setLocality] = useState(null);
    const [mapCoordinate, setMapCoordinate] = useState(null);
    const [locationPrecision, setLocationPrecision] = useState('exact');
    const [isExactShared, setIsExactShared] = useState(false);
    const [shareStatus, setShareStatus] = useState('NONE');
    const [requestingShare, setRequestingShare] = useState(false);
    const [contextReady, setContextReady] = useState(false);
    const [authModal, setAuthModal] = useState({
        visible: false,
        title: 'Create your Croww account',
        subtitle: "You're one step away from continuing this action.",
        icon: 'person-circle-outline',
        actionContext: null,
    });

    const goBack = useCallback(() => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Tabs', { screen: 'Explore' });
    }, [navigation]);

    useEffect(() => {
        let cancelled = false;
        if (!listingId) {
            setStatus('missing');
            return undefined;
        }

        (async () => {
            if (!initialListing) {
                setStatus('loading');
                setErrorMessage(null);
                setListing(null);
                setProperty(null);
                setMedia([]);
                setActor(null);
                setLocality(null);
                setMapCoordinate(null);
                setIsExactShared(false);
                setShareStatus('NONE');
                setContextReady(false);
                setPropertyAccess('missing');
            }
            try {
                const row = initialListing || await propertyDetailService.getListing(listingId);
                if (cancelled) return;
                if (!row) {
                    setListing(null);
                    setStatus('missing');
                    return;
                }
                setListing(row);
                setStatus('ready');
                setContextReady(false);
                try {
                    const extra = await propertyDetailService.loadListingContext(row);
                    if (cancelled) return;
                    setProperty(extra.property);
                    setPropertyAccess(extra.propertyAccess);
                    setMedia(extra.media);
                    setActor(extra.actor);
                    setLocality(extra.locality);
                    setMapCoordinate(extra.mapCoordinate);
                    setLocationPrecision(extra.locationPrecision);
                    setIsExactShared(Boolean(extra.isExactShared));
                    setShareStatus(extra.shareStatus || 'NONE');
                } catch (contextError) {
                    console.warn('Listing context failed', contextError?.message);
                } finally {
                    if (!cancelled) setContextReady(true);
                }
            } catch (error) {
                if (cancelled) return;
                setErrorMessage(error?.message || 'Could not load this listing.');
                setStatus('error');
            }
        })();

        return () => { cancelled = true; };
    }, [listingId]);

    const offerState = listingOfferState(listing);
    const inactiveProperty = propertyAccess === 'inactive' || propertyAccess === 'hidden'
        || (property && property.status && property.status !== 'ACTIVE');
    const showContact = contextReady && canContactListing({
        listing,
        property: inactiveProperty ? { status: 'INACTIVE' } : property,
        currentUid,
    });
    const descriptions = splitDescriptions(listing?.description, property?.description);
    const price = formatOfferPrice(listing || {});
    const banner = useMemo(() => {
        if (!listing) return null;
        if (offerState !== 'published') return listingStatusLabel(listing);
        if (inactiveProperty) return 'This property is no longer active. The offering is shown for context only.';
        return null;
    }, [listing, offerState, inactiveProperty]);

    const mapRegion = useMemo(() => {
        if (mapCoordinate?.latitude && mapCoordinate?.longitude) {
            return {
                latitude: mapCoordinate.latitude,
                longitude: mapCoordinate.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
            };
        }
        return null;
    }, [mapCoordinate]);

    const mapListingItem = useMemo(() => {
        if (!listing || !mapCoordinate) return [];
        return [{
            ...listing,
            listingId: listing.id || listing.listingId,
            mapCoordinate,
            latitude: mapCoordinate.latitude,
            longitude: mapCoordinate.longitude,
        }];
    }, [listing, mapCoordinate]);

    const onShare = useCallback(async () => {
        const payload = buildListingShare({
            listingId,
            title: listing?.title,
            city: listing?.city || property?.city,
            priceText: price.primary !== 'Price on request' ? price.primary : null,
        });
        if (!payload) return;
        try {
            await Share.share({ message: payload.message, url: payload.url, title: payload.title });
        } catch (error) {
            console.warn('Share failed', error?.message);
        }
    }, [listing, listingId, price.primary, property?.city]);

    const onContact = useCallback(() => {
        if (!currentUid) {
            setAuthModal({
                visible: true,
                title: 'Create your Croww account',
                subtitle: "You're one step away from contacting the owner.",
                icon: 'chatbubble-ellipses-outline',
                actionContext: 'contact',
            });
            return;
        }
        if (!showContact || !listing?.listedByUid) return;
        navigation.navigate('Chat', {
            recipientId: listing.listedByUid,
            recipientName: actor?.displayName || 'Lister',
            listingId: listing.id,
            propertyId: listing.propertyId || null,
        });
    }, [actor?.displayName, currentUid, listing, navigation, showContact]);

    const openLocality = useCallback((localityId) => {
        navigation.navigate('Locality', { localityId });
    }, [navigation]);

    const openProperty = useCallback(() => {
        if (!listing?.propertyId) return;
        navigation.navigate('Property', { propertyId: listing.propertyId });
    }, [listing?.propertyId, navigation]);

    const handleRequestExactLocation = useCallback(async () => {
        if (!currentUid) {
            setAuthModal({
                visible: true,
                title: 'Request exact location',
                subtitle: 'Sign in to request the exact property location from the owner.',
                icon: 'location-outline',
                actionContext: 'exact_location',
            });
            return;
        }
        if (!property?.id) return;
        setRequestingShare(true);
        try {
            const res = await locationShareService.requestLocationShare({
                propertyId: property.id,
                listingId: listing?.id,
                ownerUid: property.ownerUid || property.createdByUid,
                propertyTitle: listing?.title || 'Property',
            });
            if (res.ok) {
                setShareStatus(res.status);
                if (res.status === 'APPROVED') {
                    setIsExactShared(true);
                    const refreshed = await propertyDetailService.loadListingContext(listing);
                    setMapCoordinate(refreshed.mapCoordinate);
                } else {
                    showAlert('Request Sent', 'The owner has been notified of your request to view the exact property location.');
                }
            }
        } catch (err) {
            showAlert('Could not request location', err?.message);
        } finally {
            setRequestingShare(false);
        }
    }, [currentUid, property, listing]);

    const details = (
        <View style={split ? styles.detailsPane : null}>
            {banner ? (
                <View style={styles.banner} accessibilityRole="alert">
                    <Typography variant="body" style={styles.bannerText}>{banner}</Typography>
                </View>
            ) : null}
            <PropertySummary listing={listing} property={property} localityName={locality?.name} />
            <PropertyVerification property={property} listing={listing} actorTrust={actor?.trust} />
            <PropertyFreshness listing={listing} property={property} />
            <PropertyFacts property={property || listing} listing={listing} />
            <Property3DSection
                propertyId={listing?.propertyId}
                listingId={listing?.id}
                spatialTourAvailable={Boolean(listing?.spatialTourAvailable || property?.spatialTourAvailable)}
                posterUrl={listing?.coverThumbnailUrl || media?.[0]?.thumbnailUrl || media?.[0]?.url}
                canManage={Boolean(currentUid && (listing?.listedByUid === currentUid || property?.ownerUid === currentUid || property?.createdByUid === currentUid))}
                onAddTour={() => navigation.navigate('SpatialTour', {
                    propertyId: listing?.propertyId,
                    listingId: listing?.id,
                })}
                onViewPhotos={() => {}}
            />
            <PropertyLocation
                precision={locationPrecision}
                city={listing?.city || property?.city}
                state={property?.state}
                localityName={locality?.name}
                address={locationPrecision === 'exact' || isExactShared ? property?.address : null}
                mapCoordinate={mapCoordinate}
                localityId={listing?.localityId || property?.localityId}
                onPressLocality={openLocality}
                isExactShared={isExactShared}
                shareStatus={shareStatus}
                isOwner={Boolean(currentUid && (property?.ownerUid === currentUid || property?.createdByUid === currentUid))}
                onRequestExactLocation={handleRequestExactLocation}
                isRequestingLocation={requestingShare}
            />
            {descriptions.listing ? (
                <View style={styles.section}>
                    <Typography variant="h3">The offer</Typography>
                    <Typography variant="body" style={styles.copy}>{descriptions.listing}</Typography>
                </View>
            ) : null}
            {descriptions.property ? (
                <View style={styles.section}>
                    <Typography variant="h3">The property</Typography>
                    <Typography variant="body" style={styles.copy}>{descriptions.property}</Typography>
                </View>
            ) : null}
            <PropertyAmenities amenities={property?.amenities} />
            <ListingActorCard role={listing?.listedByRole} actor={actor} />
            {currentUid && listing?.listedByUid === currentUid && (listing.listedByRole === 'agent' || listing.listedByRole === 'builder') ? (
                <View style={styles.section}>
                    <AntigravityButton
                        title="Submit representation evidence"
                        variant="secondary"
                        onPress={() => navigation.navigate('SubmitVerification', {
                            type: 'REPRESENTATION',
                            subjectId: listing.id,
                            listingId: listing.id,
                            propertyId: listing.propertyId,
                            evidenceType: 'AUTHORIZATION_DOCUMENT',
                        })}
                        accessibilityLabel="Submit representation verification"
                    />
                </View>
            ) : null}
            {listing?.propertyId ? (
                <TouchableOpacity
                    onPress={openProperty}
                    style={styles.propertyLink}
                    accessibilityRole="link"
                    accessibilityLabel="View property details"
                >
                    <Typography variant="body" style={styles.link}>View property details</Typography>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
                </TouchableOpacity>
            ) : null}
            {contextReady ? null : (
                <Typography variant="caption" style={styles.muted}>Loading details…</Typography>
            )}
        </View>
    );

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
                <Typography variant="h3" numberOfLines={1} style={styles.headerTitle}>
                    {listing?.transactionType === 'rent' ? 'Rent' : 'Listing'}
                </Typography>
                <SaveButton
                    saved={isListingSaved(listingId)}
                    disabled={!listing}
                    onToggle={async () => {
                        if (!currentUid) {
                            setAuthModal({
                                visible: true,
                                title: 'Save this home',
                                subtitle: 'Sign in to save listings and track updates.',
                                icon: 'bookmark-outline',
                                actionContext: 'save',
                            });
                            return;
                        }
                        if (isListingSaved(listingId)) await unsaveListing(listingId);
                        else await saveListing(listing, { localityName: locality?.name });
                    }}
                />
                <TouchableOpacity
                    onPress={onShare}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Share listing"
                    disabled={!listing}
                >
                    <Ionicons name="share-outline" size={22} color={listing ? COLORS.primary : COLORS.secondary} />
                </TouchableOpacity>
            </View>

            {status === 'loading' ? (
                <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xl }} showsVerticalScrollIndicator={false}>
                    <ListingDetailSkeleton />
                </ScrollView>
            ) : null}

            {status === 'missing' ? (
                <View style={styles.centered}>
                    <Typography variant="h2">Listing not found</Typography>
                    <Typography variant="body" style={styles.muted}>
                        This listing is unavailable, unpublished, or the link is invalid.
                    </Typography>
                </View>
            ) : null}

            {status === 'error' ? (
                <View style={styles.centered}>
                    <Typography variant="h2">Couldn’t load listing</Typography>
                    <Typography variant="body" style={styles.muted}>{errorMessage}</Typography>
                </View>
            ) : null}

            {status === 'ready' && listing ? (
                <MotionView fadeOnly duration={180} style={{ flex: 1 }}>
                    {isDesktop ? (
                        <View style={styles.desktopSplitRoot}>
                            <View style={styles.desktopLeftMapPane}>
                                {mapRegion ? (
                                    <PropertyMap
                                        initialRegion={mapRegion}
                                        followRegion={mapRegion}
                                        listings={mapListingItem}
                                        selectedId={listing?.id}
                                    />
                                ) : (
                                    <View style={styles.desktopMapFallback}>
                                        <Ionicons name="map-outline" size={48} color={COLORS.secondary} />
                                        <Typography variant="body" style={styles.muted}>
                                            {locality?.name ? `${locality.name}, ${listing?.city || 'Chennai'}` : 'Location map unavailable'}
                                        </Typography>
                                    </View>
                                )}
                                <View style={styles.desktopMapOverlayPill}>
                                    <Ionicons name="location-sharp" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                                    <Typography variant="caption" style={styles.desktopMapOverlayText}>
                                        {locality?.name || listing?.city || 'Verified Location'} · {locationPrecision === 'exact' || isExactShared ? 'Exact Pin' : 'Approximate Area'}
                                    </Typography>
                                </View>
                            </View>
                            <View style={styles.desktopRightDetailsPane}>
                                <ScrollView
                                    contentContainerStyle={{
                                        paddingBottom: (showContact ? 88 : SPACING.xl) + insets.bottom,
                                    }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <PropertyMediaGallery media={media} />
                                    {details}
                                </ScrollView>
                                {showContact ? (
                                    <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, SPACING.m) }]}>
                                        <AntigravityButton
                                            title={contactCtaLabel(listing.listedByRole)}
                                            size="large"
                                            icon="chatbubble-outline"
                                            onPress={onContact}
                                            accessibilityLabel={contactCtaLabel(listing.listedByRole)}
                                        />
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    ) : (
                        <>
                            <ScrollView
                                contentContainerStyle={{
                                    paddingBottom: (showContact ? 88 : SPACING.xl) + insets.bottom,
                                }}
                            >
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
                            {showContact ? (
                                <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, SPACING.m) }]}>
                                    <AntigravityButton
                                        title={contactCtaLabel(listing.listedByRole)}
                                        size="large"
                                        icon="chatbubble-outline"
                                        onPress={onContact}
                                        accessibilityLabel={contactCtaLabel(listing.listedByRole)}
                                    />
                                </View>
                            ) : null}
                        </>
                    )}
                </MotionView>
            ) : null}

            <AuthPromptModal
                visible={authModal.visible}
                onClose={() => setAuthModal(prev => ({ ...prev, visible: false }))}
                navigation={navigation}
                title={authModal.title}
                subtitle={authModal.subtitle}
                icon={authModal.icon}
                actionContext={authModal.actionContext}
            />
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
        minWidth: 48,
        minHeight: 48,
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
        textAlign: 'center',
        marginTop: SPACING.s,
        paddingHorizontal: SPACING.l,
        textTransform: 'none',
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
    propertyLink: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        gap: 4,
    },
    link: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    cta: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        backgroundColor: COLORS.surfaceElevated || COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        ...SHADOWS.card,
    },
    desktopSplitRoot: {
        flex: 1,
        flexDirection: 'row',
        height: '100%',
        overflow: 'hidden',
    },
    desktopLeftMapPane: {
        flex: 1.1,
        height: '100%',
        position: 'relative',
        backgroundColor: COLORS.surfaceHighlight,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
    },
    desktopRightDetailsPane: {
        flex: 1,
        height: '100%',
        position: 'relative',
        backgroundColor: COLORS.background,
    },
    desktopMapFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    desktopMapOverlayPill: {
        position: 'absolute',
        top: SPACING.m,
        left: SPACING.m,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    desktopMapOverlayText: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 12,
    },
});

export default ListingScreen;
