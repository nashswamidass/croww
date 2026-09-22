import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getPropertyRoles } from '../../navigation/propertyCapabilities';
import { inventoryDashboardService, locationShareService } from '../../services/property';
import {
    ANALYTICS_UNAVAILABLE_COPY,
    DASHBOARD_FILTERS,
    DASHBOARD_FILTER_LABELS,
    availableDashboardActions,
    completenessWarnings,
    dashboardAttention,
    dashboardCopy,
    formatInventoryRatio,
    inventoryErrorMessage,
    inventoryLocalityLabel,
    listingCompleteness,
    listingMatchesQuery,
    listerStatusCopy,
    propertyInventoryTitle,
} from '../../domain/property';
import ManageVacancyModal from '../../components/property/ManageVacancyModal';
import { freshnessLines } from '../../utils/propertyDetailView';
import { dashboardVerificationLabel } from '../../domain/verification';
import { dashboardSpatialLabel } from '../../domain/spatial';
import { formatInrCompact } from '../../utils/propertyFormat';
import { showAlert } from '../../utils/showAlert';

const TABS = [
    { id: 'listings', label: 'Listings' },
    { id: 'properties', label: 'Properties' },
    { id: 'inquiries', label: 'Inquiries' },
];

function priceLabel(listing) {
    const amount = listing?.transactionType === 'rent' ? listing.rentMonthly : listing.askingPrice;
    const formatted = formatInrCompact(amount);
    if (!formatted) return listing?.transactionType === 'rent' ? 'Rent' : 'Buy';
    return listing?.transactionType === 'rent' ? `${formatted} / mo` : formatted;
}

function Metric({ label, value }) {
    if (value == null) return null;
    return (
        <View style={styles.metric} accessibilityLabel={`${label} ${value}`}>
            <Typography variant="h2">{String(value)}</Typography>
            <Typography variant="caption" style={styles.muted}>{label}</Typography>
        </View>
    );
}

const InventoryDashboardScreen = ({ navigation }) => {
    const { user } = useAuth();
    const roles = getPropertyRoles(user);
    const copy = dashboardCopy(roles);
    const { width } = useWindowDimensions();
    const wide = width >= 900;

    const [tab, setTab] = useState('listings');
    const [filter, setFilter] = useState('all');
    const [queryText, setQueryText] = useState('');
    const [summary, setSummary] = useState(null);
    const [listings, setListings] = useState([]);
    const [listingCursor, setListingCursor] = useState(null);
    const [listingHasMore, setListingHasMore] = useState(false);
    const [properties, setProperties] = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [pendingShares, setPendingShares] = useState([]);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [vacancyListing, setVacancyListing] = useState(null);

    const load = useCallback(async ({ append = false, nextCursor = null } = {}) => {
        setError('');
        try {
            const [nextSummary, listingPage, propertyPage, inquiryPage, incomingShares] = await Promise.all([
                inventoryDashboardService.loadSummary(),
                inventoryDashboardService.loadListings({
                    filter,
                    cursor: append ? nextCursor : null,
                }),
                inventoryDashboardService.loadProperties(),
                inventoryDashboardService.loadInquiries(),
                locationShareService.listIncomingPendingRequests().catch(() => []),
            ]);
            setSummary(nextSummary);
            setListings((prev) => (append ? [...prev, ...(listingPage.items || [])] : (listingPage.items || [])));
            setListingCursor(listingPage.cursor || null);
            setListingHasMore(Boolean(listingPage.hasMore));
            setProperties(propertyPage.items || []);
            setInquiries(inquiryPage.items || []);
            setPendingShares(incomingShares || []);
        } catch (err) {
            if (!append) {
                setListings([]);
                setProperties([]);
                setInquiries([]);
                setPendingShares([]);
            }
            setError(inventoryErrorMessage(err?.code, err?.message));
        }
    }, [filter]);

    const handleApproveShare = (share) => {
        showAlert('Share Exact Location', 'Allow this viewer to view the exact property location for 30 days?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Share',
                onPress: async () => {
                    try {
                        await locationShareService.approveShare({
                            propertyId: share.propertyId,
                            viewerUid: share.viewerUid,
                            listingId: share.listingId,
                        });
                        showAlert('Shared', 'Exact location has been shared with the viewer.');
                        await load();
                    } catch (err) {
                        showAlert('Error', err?.message || 'Could not approve location share');
                    }
                },
            },
        ]);
    };

    const handleDeclineShare = (share) => {
        showAlert('Decline Request', 'Decline this viewer’s request to view the exact property location?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Decline',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await locationShareService.declineShare({
                            propertyId: share.propertyId,
                            viewerUid: share.viewerUid,
                        });
                        showAlert('Declined', 'Location request declined.');
                        await load();
                    } catch (err) {
                        showAlert('Error', err?.message || 'Could not decline request');
                    }
                },
            },
        ]);
    };

    useFocusEffect(useCallback(() => {
        load();
    }, [load]));

    const visibleListings = useMemo(
        () => listings.filter((row) => listingMatchesQuery(row, null, queryText)),
        [listings, queryText]
    );

    const goBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Tabs', { screen: 'Post' });
    };

    const openListing = (listing, mode) => {
        if (!listing?.id) return;
        if (mode === 'edit' || mode === 'continue_edit' || listing.status === 'DRAFT' || listing.status === 'PAUSED') {
            navigation.navigate('PostListing', { listingId: listing.id });
            return;
        }
        navigation.navigate('Listing', { listingId: listing.id, initialListing: listing });
    };

    const runAction = (listing, action) => {
        if (action.kind === 'navigate') {
            if (action.id === 'media') {
                navigation.navigate('InventoryMedia', { listingId: listing.id });
                return;
            }
            openListing(listing, action.id);
            return;
        }

        const confirmTitle = action.label;
        const confirmBody = action.kind === 'request_review'
            ? 'Croww still has to publish this listing. It will not be live until status is Published.'
            : `Apply “${action.label}” to this listing?`;

        showAlert(confirmTitle, confirmBody, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    try {
                        await inventoryDashboardService.applyListingAction(listing.id, action.id);
                        await load();
                    } catch (err) {
                        showAlert('Inventory', inventoryErrorMessage(err?.code, err?.message));
                    }
                },
            },
        ]);
    };

    const renderListing = ({ item }) => {
        const listing = item;
        const status = listerStatusCopy(listing);
        const locality = inventoryLocalityLabel(listing);
        const lines = freshnessLines(listing);
        const actions = availableDashboardActions(listing);
        const statusActions = actions.filter((row) => row.kind !== 'navigate' || row.id === 'media' || row.id === 'continue_edit' || row.id === 'edit');
        const quality = completenessWarnings(listingCompleteness(listing));
        const attention = dashboardAttention(listing);
        return (
            <NotionCard style={styles.card}>
                <TouchableOpacity
                    onPress={() => openListing(listing)}
                    accessibilityRole="button"
                    accessibilityLabel={`${listing.title || 'Listing'}, ${status}`}
                >
                    <View style={styles.listingRow}>
                        {listing.coverThumbnailUrl ? (
                            <Image source={{ uri: listing.coverThumbnailUrl }} style={styles.cover} />
                        ) : (
                            <View style={[styles.cover, styles.coverEmpty]} accessibilityLabel="No cover photo">
                                <Ionicons name="image-outline" size={22} color={COLORS.secondary} />
                            </View>
                        )}
                        <View style={styles.cardText}>
                            <Typography variant="h3">{listing.title || 'Untitled listing'}</Typography>
                            <Typography variant="caption" style={styles.muted}>
                                {status}
                                {' · '}
                                {listing.transactionType === 'rent' ? 'Rent' : 'Buy'}
                                {' · '}
                                {priceLabel(listing)}
                            </Typography>
                            {formatInventoryRatio(listing.availability) ? (
                                <Typography variant="caption" style={styles.availabilityLine}>
                                    Availability: {formatInventoryRatio(listing.availability)}
                                </Typography>
                            ) : null}
                            {locality ? (
                                <Typography variant="caption" style={styles.muted}>{locality}</Typography>
                            ) : null}
                            {lines.map((line) => (
                                <Typography key={line.key} variant="caption" style={styles.muted}>{line.text}</Typography>
                            ))}
                            {quality.slice(0, 2).map((text) => (
                                <Typography key={text} variant="caption" style={styles.warning}>{text}</Typography>
                            ))}
                            {attention.map((row) => (
                                <Typography key={row.key} variant="caption" style={styles.warning}>{row.label}</Typography>
                            ))}
                            <Typography variant="caption" style={styles.muted}>
                                Verification: {dashboardVerificationLabel(null, listing)}
                            </Typography>
                            <Typography variant="caption" style={styles.muted}>
                                3D: {dashboardSpatialLabel({ spatialTourAvailable: listing.spatialTourAvailable })}
                            </Typography>
                            <Typography variant="caption" style={styles.muted}>
                                Location: {listing.locationPrecision === 'exact' ? 'Exact public' : listing.locationPrecision === 'approximate' ? 'Approximate' : 'On request'}
                            </Typography>
                        </View>
                    </View>
                </TouchableOpacity>
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        onPress={() => setVacancyListing(listing)}
                        style={[styles.actionChip, styles.vacancyChip]}
                        accessibilityRole="button"
                        accessibilityLabel={`Manage vacancy for ${listing.title || 'listing'}`}
                    >
                        <Typography variant="caption" style={styles.vacancyChipText}>Manage Vacancy</Typography>
                    </TouchableOpacity>
                    {statusActions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            onPress={() => runAction(listing, action)}
                            style={styles.actionChip}
                            accessibilityRole="button"
                            accessibilityLabel={action.accessibilityLabel}
                        >
                            <Typography variant="caption">{action.label}</Typography>
                        </TouchableOpacity>
                    ))}
                </View>
            </NotionCard>
        );
    };

    const renderProperty = ({ item }) => (
        <NotionCard style={styles.card}>
            <TouchableOpacity
                onPress={() => item.id && navigation.navigate('Property', { propertyId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={propertyInventoryTitle(item, item.listings)}
            >
                <Typography variant="h3">{propertyInventoryTitle(item, item.listings)}</Typography>
                <Typography variant="caption" style={styles.muted}>
                    {[item.category, item.subtype, inventoryLocalityLabel(item.listings?.[0], item)]
                        .filter(Boolean)
                        .join(' · ')}
                </Typography>
                <Typography variant="caption" style={styles.muted}>
                    {item.listingCount === 1 ? '1 listing' : `${item.listingCount || 0} listings`}
                </Typography>
                <Typography variant="caption" style={styles.muted}>
                    Verification: {dashboardVerificationLabel(item, item.listings?.[0])}
                </Typography>
                <Typography variant="caption" style={styles.muted}>
                    3D: {dashboardSpatialLabel({ spatialTourAvailable: item.spatialTourAvailable || item.listings?.[0]?.spatialTourAvailable })}
                </Typography>
                {(item.listings || []).map((listing) => (
                    <Typography key={listing.id} variant="caption" style={styles.muted}>
                        {listing.transactionType === 'rent' ? 'Rent' : 'Sale'}
                        {' — '}
                        {priceLabel(listing)}
                        {' · '}
                        {listerStatusCopy(listing)}
                    </Typography>
                ))}
            </TouchableOpacity>
        </NotionCard>
    );

    const renderInquiry = ({ item }) => {
        const listing = item.listing;
        const chat = item.chat;
        const unread = chat?.unreadCounts?.[user?.uid || user?.id] || 0;
        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('Chat', { chatId: chat.id })}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation about ${listing?.title || 'listing'}`}
            >
                <NotionCard style={styles.card}>
                    <Typography variant="h3">{listing?.title || 'Listing inquiry'}</Typography>
                    <Typography variant="caption" style={styles.muted}>
                        Listing: {listing ? `${listing.transactionType === 'rent' ? 'Rent' : 'Buy'} · ${priceLabel(listing)}` : 'Listing'}
                        {listing?.city ? ` · ${listing.city}` : ''}
                    </Typography>
                    {chat?.lastMessage ? (
                        <Typography variant="caption" style={styles.muted} numberOfLines={2}>
                            {chat.lastMessage}
                        </Typography>
                    ) : null}
                    <Typography variant="caption" style={styles.muted}>
                        {unread > 0 ? `${unread} unread · ` : ''}Open conversation
                    </Typography>
                </NotionCard>
            </TouchableOpacity>
        );
    };

    const emptyCopy = tab === 'inquiries'
        ? 'No inquiries yet.'
        : tab === 'properties'
            ? 'You haven’t added any properties yet.'
            : filter === 'draft'
                ? 'No drafts to continue.'
                : 'You haven’t added any listings yet.';

    const data = tab === 'listings' ? visibleListings : tab === 'properties' ? properties : inquiries;
    const renderItem = tab === 'listings' ? renderListing : tab === 'properties' ? renderProperty : renderInquiry;

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Typography variant="h2">{copy.title}</Typography>
                    {copy.actorLabel ? (
                        <Typography variant="caption" style={styles.muted}>{copy.actorLabel}</Typography>
                    ) : null}
                </View>
                <View style={styles.iconBtn} />
            </View>
            <FlatList
                data={data}
                keyExtractor={(item) => item.id || item.listing?.id || item.chat?.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => {
                            setRefreshing(true);
                            await load();
                            setRefreshing(false);
                        }}
                        tintColor={COLORS.accent}
                    />
                )}
                onEndReached={() => {
                    if (tab !== 'listings' || !listingHasMore || loadingMore || !listingCursor) return;
                    setLoadingMore(true);
                    load({ append: true, nextCursor: listingCursor }).finally(() => setLoadingMore(false));
                }}
                ListHeaderComponent={(
                    <View>
                        <Typography variant="body" style={styles.subtitle}>{copy.subtitle}</Typography>
                        <AntigravityButton
                            title="Add listing"
                            icon="add"
                            onPress={() => navigation.navigate('PostListing')}
                            accessibilityLabel="Add listing"
                            style={styles.addBtn}
                        />
                        {error ? <Typography variant="body" style={styles.error}>{error}</Typography> : null}
                        <View style={[styles.metrics, wide && styles.metricsWide]}>
                            <Metric label="Active" value={summary?.published} />
                            <Metric label="Drafts" value={summary?.draft} />
                            <Metric label="Under review" value={summary?.underReview} />
                            <Metric label="Paused" value={summary?.paused} />
                            <Metric label="Sold/Rented" value={summary?.soldRented} />
                            <Metric label="Archived" value={summary?.archived} />
                        </View>
                        <Typography variant="caption" style={styles.muted}>{ANALYTICS_UNAVAILABLE_COPY}</Typography>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                            {TABS.map((row) => (
                                <TouchableOpacity
                                    key={row.id}
                                    onPress={() => setTab(row.id)}
                                    style={[styles.chip, tab === row.id && styles.chipOn]}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: tab === row.id }}
                                    accessibilityLabel={row.label}
                                >
                                    <Typography variant="caption">{row.label}</Typography>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {tab === 'listings' ? (
                            <>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                                    {DASHBOARD_FILTERS.map((id) => (
                                        <TouchableOpacity
                                            key={id}
                                            onPress={() => setFilter(id)}
                                            style={[styles.chip, filter === id && styles.chipOn]}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: filter === id }}
                                            accessibilityLabel={DASHBOARD_FILTER_LABELS[id]}
                                        >
                                            <Typography variant="caption">{DASHBOARD_FILTER_LABELS[id]}</Typography>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TextInput
                                    value={queryText}
                                    onChangeText={setQueryText}
                                    placeholder="Search this page"
                                    placeholderTextColor={COLORS.secondary}
                                    style={styles.search}
                                    accessibilityLabel="Search listings on this page"
                                />
                            </>
                        ) : null}
                        {tab === 'inquiries' && pendingShares.length > 0 ? (
                            <View style={{ marginTop: SPACING.m, marginBottom: SPACING.s }}>
                                <Typography variant="h3" style={{ marginBottom: SPACING.s }}>
                                    Location Requests ({pendingShares.length})
                                </Typography>
                                {pendingShares.map((share) => (
                                    <NotionCard key={share.id} style={[styles.card, { borderColor: COLORS.accent, borderWidth: 1 }]}>
                                        <Typography variant="body" style={{ fontWeight: '600' }}>
                                            Viewer requested exact property location
                                        </Typography>
                                        <Typography variant="caption" style={styles.muted}>
                                            Property ID: {share.propertyId}
                                        </Typography>
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACING.m }}>
                                            <TouchableOpacity
                                                onPress={() => handleApproveShare(share)}
                                                style={[styles.actionChip, { backgroundColor: COLORS.primary }]}
                                                accessibilityRole="button"
                                                accessibilityLabel="Share exact location"
                                            >
                                                <Typography variant="caption" style={{ color: '#fff', fontWeight: '600' }}>Share exact location</Typography>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeclineShare(share)}
                                                style={styles.actionChip}
                                                accessibilityRole="button"
                                                accessibilityLabel="Decline location request"
                                            >
                                                <Typography variant="caption">Decline</Typography>
                                            </TouchableOpacity>
                                        </View>
                                    </NotionCard>
                                ))}
                            </View>
                        ) : null}
                    </View>
                )}
                ListEmptyComponent={(
                    <Typography variant="body" style={styles.empty}>{emptyCopy}</Typography>
                )}
            />
            <ManageVacancyModal
                visible={Boolean(vacancyListing)}
                listing={vacancyListing}
                onClose={() => setVacancyListing(null)}
                onSaved={async () => {
                    await load();
                }}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.s,
    },
    headerText: {
        flex: 1,
        alignItems: 'center',
    },
    iconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitle: {
        color: COLORS.secondary,
        marginBottom: SPACING.m,
    },
    addBtn: {
        marginBottom: SPACING.m,
    },
    list: {
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.xl,
    },
    metrics: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.l,
        marginBottom: SPACING.m,
    },
    metricsWide: {
        gap: SPACING.xl,
    },
    metric: {
        minWidth: 72,
    },
    chips: {
        gap: SPACING.s,
        paddingVertical: SPACING.s,
    },
    chip: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.l,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        backgroundColor: COLORS.surface,
    },
    chipOn: {
        borderColor: COLORS.accent,
    },
    search: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        color: COLORS.primary,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        marginBottom: SPACING.m,
        backgroundColor: COLORS.surface,
    },
    card: {
        marginBottom: SPACING.m,
    },
    listingRow: {
        flexDirection: 'row',
        gap: SPACING.m,
    },
    cover: {
        width: 72,
        height: 72,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    coverEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: {
        flex: 1,
    },
    muted: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    warning: {
        color: COLORS.warning,
        marginTop: 2,
    },
    actionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        marginTop: SPACING.m,
    },
    actionChip: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.s,
        paddingVertical: 6,
    },
    vacancyChip: {
        backgroundColor: '#F3F4F6',
        borderColor: COLORS.primary,
    },
    vacancyChipText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    availabilityLine: {
        color: COLORS.primary,
        fontWeight: '600',
        marginTop: 2,
    },
    empty: {
        color: COLORS.secondary,
        marginTop: SPACING.l,
    },
    error: {
        color: COLORS.error,
        marginBottom: SPACING.s,
    },
});

export default InventoryDashboardScreen;
