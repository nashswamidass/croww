import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Share, Image, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/showAlert';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import BuddyActionCard from '../../components/BuddyActionCard';
import { useAuth } from '../../context/AuthContext';
import VerificationBadge from '../../components/VerificationBadge';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { locationService } from '../../services/locationService';
import { calculateFees, formatINR } from '../../utils/feeCalculator';
import { getDistanceFromLatLonInKm, formatDistance } from '../../utils/distance';
import { formatIndianDate } from '../../utils/localization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ticketService } from '../../services/ticketService';
import { auth, db } from '../../services/firebaseConfig';
import { eventService } from '../../services/eventService';
import { paymentService } from '../../services/paymentService';
import { userService } from '../../services/userService';
import { getBuddyRequests } from '../../services/buddyService';
import { getAvatarSource } from '../../utils/avatarHelper';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';
import SEO from '../../components/SEO';

const EventDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { event, id: routeId } = route.params || {};
    const [eventData, setEventData] = useState(event || null);
    const [userLocation, setUserLocation] = useState(null);
    const [buddyGroups, setBuddyGroups] = useState([]);
    const [buddyLeaders, setBuddyLeaders] = useState([]);
    const [totalBuddyCount, setTotalBuddyCount] = useState(0);
    const [loading, setLoading] = useState(!event);

    React.useEffect(() => {
        (async () => {
            const cached = await locationService.getCachedLocation();
            if (cached.coords) setUserLocation(cached.coords);

            const { coords } = await locationService.getLocation();
            if (coords) setUserLocation(coords);
        })();
    }, []);

    // Load Event Data if missing (Deep Linking)
    useEffect(() => {
        const loadEvent = async () => {
            if (!eventData && (routeId || event?.id)) {
                const id = routeId || event?.id;
                try {
                    setLoading(true);
                    const data = await eventService.getEventById(id);
                    if (data) {
                        setEventData(data);
                    } else {
                        showAlert("Not Found", "This event no longer exists.");
                        navigation.goBack();
                    }
                } catch (error) {
                    console.error("Failed to load event:", error);
                    showAlert("Error", "Failed to load event details.");
                } finally {
                    setLoading(false);
                }
            }
        };
        loadEvent();
    }, [routeId, event]);

    // Load Buddies
    useEffect(() => {
        const loadBuddies = async () => {
            if (eventData?.id) {
                try {
                    const requests = await getBuddyRequests(eventData.id);
                    setBuddyGroups(requests);

                    // Extract unique leaders for display
                    const leaders = requests.map(r => ({
                        id: r.userId,
                        name: r.userName,
                        avatar: r.userAvatar
                    }));
                    setBuddyLeaders(leaders);

                    // Calculate total people involved in buddy groups
                    const total = requests.reduce((acc, r) => acc + (r.joinedUsers?.length || 1), 0);
                    setTotalBuddyCount(total);
                } catch (error) {
                    console.error("Failed to load buddies", error);
                }
            }
        };
        loadBuddies();
    }, [eventData]);


    // Mock State
    const [isGoing, setIsGoing] = useState(false);
    const [ticketCount, setTicketCount] = useState(1);

    // Register Payment Callbacks on Mount
    useEffect(() => {
        paymentService.setCallback(
            // onVerify: Payment SDK Success callback
            async (orderId) => {
                console.log('Payment SDK callback for Event Order:', orderId);
                setLoading(true);
                try {
                    // SECURE: Verify with backend before issuing tickets
                    const result = await paymentService.verifyPayment(orderId);
                    if (result && result.status === 'PAID') {
                        await finalizeTicketPurchase(orderId);
                    } else {
                        showAlert("Verification Failed", "Payment could not be verified. Please contact support.");
                    }
                } catch (error) {
                    showAlert("Error", "Failed to verify payment status.");
                    console.error("Verification error:", error);
                } finally {
                    setLoading(false);
                }
            },
            // onError: Payment Failure
            (error, orderId) => {
                console.log('Payment Failed:', error);
                showAlert("Payment Failed", "Please try again. " + (error?.message || ""));
                setLoading(false);
            }
        );

        return () => {
            paymentService.removeCallback();
        };
    }, []);

    const finalizeTicketPurchase = async (orderId) => {
        try {
            const userData = await userService.getUser();
            const userId = userData?.id || auth.currentUser?.uid;
            if (!userId) throw new Error('User not found. Please login again.');
            for (let i = 0; i < ticketCount; i++) {
                await ticketService.issueTicket(userId, eventData.id, eventData);
            }
            setIsGoing(true);
            showAlert('Success', `${ticketCount} ticket${ticketCount > 1 ? 's' : ''} booked! Check "My Tickets" for details.`);
        } catch (error) {
            console.error("Finalization Error:", error);
            showAlert('Error', `Failed to issue tickets: ${error.message}`);
        }
    };

    // Use static placeholder if no data yet (Skeleton behavior handled by returning early if loading)
    if (loading && !eventData) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!eventData) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="body">Event not found</Typography>
                <AntigravityButton title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />
            </View>
        );
    }

    const eventSchema = Platform.OS === 'web' ? {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": eventData.title,
        "description": eventData.description,
        "startDate": eventData.date,
        "image": eventData.imageUri,
        "location": {
            "@type": "Place",
            "name": eventData.locationName || "Venue",
            "address": eventData.address
        },
        "offers": eventData.isPaid ? {
            "@type": "Offer",
            "price": eventData.price,
            "priceCurrency": "INR"
        } : null
    } : null;

    const getDistanceText = () => {
        if (!userLocation || !eventData.coordinate) return 'Distance unknown';
        const dist = getDistanceFromLatLonInKm(
            userLocation.latitude,
            userLocation.longitude,
            eventData.coordinate?.latitude || 0,
            eventData.coordinate?.longitude || 0
        );
        return `${formatDistance(dist)} away`;
    };

    const handleShare = async () => {
        try {
            const priceInfo = eventData.isPaid ? `\n💰 Entry: ₹${eventData.price}` : '\n🎟️ Free Entry';
            const ticketsInfo = eventData.remainingTickets > 0 ? `\n🎫 ${eventData.remainingTickets} tickets left` : '';
            const locationInfo = eventData.locationName ? `\n📍 ${eventData.locationName}` : '';

            const shareMessage = `🎉 *${eventData.title}*\n` +
                `📅 ${formatIndianDate(eventData.date)}` +
                locationInfo +
                priceInfo +
                ticketsInfo +
                `\n\n${eventData.description || ''}` +
                (eventData.imageUri ? `\n\n${eventData.imageUri}` : '') +
                `\n\n— Shared via Croww App`;

            await Share.share({
                message: shareMessage,
                url: eventData.imageUri || undefined, // iOS uses this to attach the image
            });
        } catch (error) {
            console.log(error.message);
        }
    };

    const toggleRSVP = () => {
        setIsGoing(!isGoing);
    };

    const handleJoin = async () => {
        const userData = await userService.getUser();
        const currentUser = auth.currentUser;
        if (!userData && !currentUser) {
            showAlert('Login Required', 'Please login to join this event', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Login', onPress: () => navigation.navigate('Login') }
            ]);
            return;
        }

        const userId = userData?.id || currentUser?.uid;

        if (eventData.isPaid) {
            // Calculate full fee breakdown
            const fees = calculateFees(eventData.price, ticketCount);
            setLoading(true);
            try {
                // PART 1: Create Order on Backend (charge user the TOTAL payable incl. convenience fee)
                const sanitizedPhone = (userData?.phone || '9999999999').replace(/\D/g, '');

                const orderData = await paymentService.createOrder(
                    fees.totalPayable,
                    userId,
                    sanitizedPhone,
                    userData?.name || 'User',
                    userData?.email || auth.currentUser?.email
                );

                // PART 2: Start SDK Checkout / Web Redirect
                if (Platform.OS === 'web' || !paymentService.isNativeAvailable()) {
                    // PRE-EMPTIVE: Create the tickets in PENDING_PAYMENT status first (with full fee breakdown)
                    for (let i = 0; i < ticketCount; i++) {
                        const singleTicketFees = calculateFees(eventData.price, 1);
                        await ticketService.issueTicket(userId, eventData.id, eventData, 'PENDING_PAYMENT', orderData.orderId, singleTicketFees);
                    }

                    navigation.navigate('WebPayment', {
                        paymentSessionId: orderData.sessionId,
                        orderId: orderData.orderId,
                        feeBreakdown: fees
                    });
                } else {
                    await paymentService.doPayment(orderData.sessionId, orderData.orderId);
                }
                if (Platform.OS !== 'web') setLoading(false);

            } catch (error) {
                console.error("Ticket purchase error:", error);
                showAlert('Error', 'Failed to initiate payment: ' + error.message);
                setLoading(false);
            }
        } else {
            try {
                for (let i = 0; i < ticketCount; i++) {
                    await ticketService.issueTicket(userId, eventData.id, eventData);
                }
                setIsGoing(true);
                showAlert('Success', `You've joined this event with ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}!`);
            } catch (error) {
                console.error("Joining Error:", error);
                showAlert('Error', `Failed to join event: ${error.message}`);
            }
        }
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <SEO
                title={eventData.title}
                description={eventData.description}
                image={eventData.imageUri}
                url={`/event/${eventData.id}`}
                type="event"
                schemaData={eventSchema}
            />
            <ScrollView contentContainerStyle={styles.content}>
                {/* Event Image */}
                {getValidImageUri(eventData.imageUri) ? (
                    <Image
                        source={{ uri: getValidImageUri(eventData.imageUri) }}
                        style={styles.eventImage}
                        accessibilityLabel={`Event banner for ${eventData.title}`}
                    />
                ) : eventData.imageUri ? (
                    <Image
                        source={{ uri: DEFAULT_EVENT_IMAGE }}
                        style={styles.eventImage}
                        accessibilityLabel="Default event banner"
                    />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons name="image-outline" size={48} color={COLORS.secondary} />
                    </View>
                )}

                <View style={styles.header}>
                    <View style={styles.tagRow}>
                        {eventData.isOfficial && (
                            <View style={[styles.tag, { backgroundColor: COLORS.surfaceHighlight, marginRight: SPACING.s }]}>
                                <Typography variant="small" style={{ color: COLORS.primary, fontWeight: 'bold' }}>OFFICIAL</Typography>
                            </View>
                        )}
                        <View style={[styles.tag, { backgroundColor: COLORS.surfaceHighlight }]}>
                            <Typography variant="small" style={{ color: COLORS.primary }}>{eventData.category}</Typography>
                        </View>
                        <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: SPACING.s }}>
                            {eventData.isPublic ? '🌍 Public' : '🔒 Private'}
                        </Typography>
                    </View>

                    <Typography variant="h1">{eventData.title}</Typography>

                    {eventData.isOfficial && (
                        <TouchableOpacity
                            style={styles.organizerLink}
                            onPress={() => {
                                if (eventData.organizerId) {
                                    navigation.navigate('ServiceDetail', { serviceId: eventData.organizerId });
                                } else {
                                    showAlert('Venue Profile', `View ${eventData.organizerName || 'the organizer'}'s profile`);
                                }
                            }}
                        >
                            <Ionicons name="business" size={14} color={COLORS.secondary} />
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: 4, fontWeight: '600' }}>
                                Hosted by {eventData.organizerName || 'Verified Venue'}
                            </Typography>
                        </TouchableOpacity>
                    )}

                    {!eventData.isOfficial && eventData.organizerName && (
                        <TouchableOpacity
                            style={styles.organizerLink}
                            onPress={() => {
                                if (eventData.organizerId) {
                                    navigation.navigate('ServiceDetail', { serviceId: eventData.organizerId });
                                }
                            }}
                            disabled={!eventData.organizerId}
                        >
                            <Ionicons name="business" size={14} color={COLORS.secondary} />
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: 4, fontWeight: '600' }}>
                                Hosted by {eventData.organizerName}
                            </Typography>
                        </TouchableOpacity>
                    )}

                    {(eventData.movieName || eventData.screenName) && (
                        <NotionCard style={styles.movieDetailsCard}>
                            <View style={styles.movieInfoRow}>
                                <Ionicons name="film-outline" size={20} color={COLORS.secondary} />
                                <Typography variant="h3" style={{ marginLeft: SPACING.s }}>
                                    {eventData.movieName || 'Movie TBD'}
                                </Typography>
                            </View>
                            {eventData.screenName && (
                                <View style={[styles.movieInfoRow, { marginTop: 4 }]}>
                                    <Ionicons name="videocam-outline" size={18} color={COLORS.secondary} />
                                    <Typography variant="body" style={{ marginLeft: SPACING.s, color: COLORS.secondary }}>
                                        {eventData.screenName}
                                    </Typography>
                                </View>
                            )}
                        </NotionCard>
                    )}

                    {eventData.isPaid && (
                        <View style={[styles.priceTag, { marginTop: SPACING.s }]}>
                            <Typography variant="h3" style={{ color: COLORS.accent }}>
                                ₹{eventData.price}
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: SPACING.s }}>
                                {eventData.remainingTickets > 0
                                    ? `${eventData.remainingTickets} tickets left`
                                    : 'Sold Out'}
                            </Typography>
                        </View>
                    )}

                    <View style={styles.row}>
                        <Ionicons name="time-outline" size={20} color={COLORS.secondary} />
                        <Typography variant="body" style={styles.metaText}>{formatIndianDate(eventData.date)}</Typography>
                    </View>
                    <View style={styles.row}>
                        <Ionicons name="location-outline" size={20} color={COLORS.secondary} />
                        <Typography variant="body" style={styles.metaText}>{getDistanceText()}</Typography>
                    </View>
                </View>

                {/* Ticket Quantity Selector */}
                {!isGoing && (
                    <View style={styles.quantitySection}>
                        <Typography variant="body" style={{ fontWeight: '600' }}>Tickets</Typography>
                        <View style={styles.quantitySelector}>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => setTicketCount(Math.max(1, ticketCount - 1))}
                                disabled={ticketCount <= 1}
                            >
                                <Ionicons name="remove" size={20} color={ticketCount <= 1 ? COLORS.border : COLORS.primary} />
                            </TouchableOpacity>
                            <Typography variant="h3" style={styles.quantityText}>{ticketCount}</Typography>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => {
                                    const max = eventData.remainingTickets || 10;
                                    setTicketCount(Math.min(max, ticketCount + 1));
                                }}
                                disabled={ticketCount >= (eventData.remainingTickets || 10)}
                            >
                                <Ionicons name="add" size={20} color={ticketCount >= (eventData.remainingTickets || 10) ? COLORS.border : COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                        {eventData.isPaid && (
                            <Typography variant="body" style={{ color: COLORS.secondary, fontWeight: '700' }}>
                                {formatINR(eventData.price * ticketCount)}
                            </Typography>
                        )}
                    </View>
                )}

                {/* Price Breakdown Card (shown only for paid events, before purchase) */}
                {eventData.isPaid && !isGoing && (() => {
                    const fees = calculateFees(eventData.price, ticketCount);
                    return (
                        <NotionCard style={styles.breakdownCard}>
                            <Typography variant="body" style={styles.breakdownTitle}>Price Breakdown</Typography>
                            <View style={styles.breakdownRow}>
                                <Typography variant="body" style={styles.breakdownLabel}>Ticket Subtotal ({ticketCount}x)</Typography>
                                <Typography variant="body" style={styles.breakdownValue}>{formatINR(fees.subtotal)}</Typography>
                            </View>
                            <View style={styles.breakdownRow}>
                                <Typography variant="caption" style={styles.breakdownLabel}>Convenience Fee (2%)</Typography>
                                <Typography variant="caption" style={styles.breakdownValue}>{formatINR(fees.convenienceFee)}</Typography>
                            </View>
                            <View style={styles.breakdownRow}>
                                <Typography variant="caption" style={styles.breakdownLabel}>GST on Convenience Fee (18%)</Typography>
                                <Typography variant="caption" style={styles.breakdownValue}>{formatINR(fees.convenienceFeeGST)}</Typography>
                            </View>
                            <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                                <Typography variant="body" style={{ fontWeight: '700', color: COLORS.primary }}>Total Payable</Typography>
                                <Typography variant="body" style={{ fontWeight: '700', color: COLORS.accent }}>{formatINR(fees.totalPayable)}</Typography>
                            </View>
                        </NotionCard>
                    );
                })()}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    <AntigravityButton
                        title={loading ? "Processing..." : (isGoing
                            ? "Going ✓"
                            : (eventData.isPaid
                                ? `Pay ${formatINR(calculateFees(eventData.price, ticketCount).totalPayable)}`
                                : "Join Event"))
                        }
                        variant={isGoing ? "secondary" : "primary"}
                        style={{ flex: 1, marginRight: SPACING.s }}
                        onPress={loading ? null : handleJoin}
                        disabled={(!isGoing && eventData.remainingTickets <= 0 && eventData.isPaid) || loading}
                    />
                    <AntigravityButton
                        title="Invite Friends"
                        variant="secondary"
                        style={{ flex: 1, marginLeft: SPACING.s }}
                        onPress={handleShare}
                    />
                </View>

                <View style={styles.section}>
                    <Typography variant="h3">About</Typography>
                    <Typography variant="body" style={styles.description}>
                        {eventData.description}
                    </Typography>
                </View>

                {/* Find Event Buddies Section */}
                <BuddyActionCard
                    onPress={() => navigation.navigate('EventBuddy', { event: eventData })}
                    requestCount={buddyGroups.length}
                    avatars={buddyLeaders.map(b => ({ url: b.avatar }))}
                />

                {/* Who's Coming Section (Buddies) */}
                {buddyLeaders.length > 0 && (
                    <View style={styles.section}>
                        <Typography variant="h3">Event Buddies</Typography>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('EventBuddy', { event: eventData })}
                        >
                            <NotionCard style={styles.attendeesCard}>
                                <View style={styles.avatarRow}>
                                    {buddyGroups.slice(0, 5).map((group, i) => (
                                        <TouchableOpacity
                                            key={group.id || i}
                                            onPress={() => {
                                                if (group.userId) {
                                                    navigation.navigate('ServiceDetail', { serviceId: group.userId });
                                                } else {
                                                    navigation.navigate('BuddyRequestDetail', {
                                                        requestId: group.id,
                                                        event: eventData
                                                    });
                                                }
                                            }}
                                        >
                                            <View style={[styles.avatar, { overflow: 'hidden' }]}>
                                                <Image
                                                    source={getAvatarSource(group.userAvatar, 'individual')}
                                                    style={{ width: '100%', height: '100%' }}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                    {buddyGroups.length > 5 && (
                                        <View style={[styles.avatar, styles.moreAvatar]}>
                                            <Typography variant="small" style={{ color: COLORS.primary }}>+{totalBuddyCount - 5}</Typography>
                                        </View>
                                    )}
                                </View>
                                <Typography variant="caption" style={{ marginTop: SPACING.s }}>
                                    {buddyLeaders[0].name} {buddyLeaders.length > 1 ? `and ${totalBuddyCount - 1} other buddies` : 'is looking for a buddy!'}
                                </Typography>
                            </NotionCard>
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
            {/* Close Button Overlay */}
            <AntigravityButton
                title="✕"
                variant="secondary"
                style={styles.closeButton}
                onPress={() => navigation.goBack()}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingBottom: 100, // Reduced bottom padding
    },
    eventImage: {
        width: '100%',
        height: 400, // Slightly shorter
        resizeMode: 'cover',
    },
    imagePlaceholder: {
        width: '100%',
        height: 250,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        padding: SPACING.l,
        marginBottom: SPACING.m,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap', // Allow tags to wrap
        marginBottom: SPACING.m,
        gap: SPACING.s, // Use gap for spacing
    },
    tag: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.s,
    },
    metaText: {
        marginLeft: SPACING.s,
        color: COLORS.secondary,
        fontSize: 15,
    },
    organizerLink: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
        padding: SPACING.s,
        backgroundColor: COLORS.surfaceHighlight, // Changed to surface highlight
        borderRadius: BORDER_RADIUS.m,
        alignSelf: 'flex-start',
    },
    actionRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.l,
        marginBottom: SPACING.xl,
        gap: SPACING.m, // Use gap
    },
    priceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    breakdownCard: {
        marginHorizontal: SPACING.l,
        marginBottom: SPACING.m,
        padding: SPACING.m,
    },
    breakdownTitle: {
        fontWeight: '700',
        marginBottom: SPACING.s,
        color: COLORS.primary,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    breakdownLabel: {
        color: COLORS.secondary,
    },
    breakdownValue: {
        color: COLORS.secondary,
    },
    breakdownTotal: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        marginTop: SPACING.s,
        paddingTop: SPACING.s,
    },
    quantitySection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l, // Larger radius
        padding: SPACING.m,
        marginHorizontal: SPACING.l, // Add horizontal margin matches padding
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small, // Add shadow
    },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight, // Background for selector
        borderRadius: 20,
        padding: 4,
    },
    quantityButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surface, // White/Surface button
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.small,
    },
    quantityText: {
        marginHorizontal: SPACING.m,
        minWidth: 20,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 16,
    },
    section: {
        marginBottom: SPACING.xl,
        paddingHorizontal: SPACING.l,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.m,
    },
    buddyBadge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    description: {
        lineHeight: 24,
        color: COLORS.text,
        fontSize: 15,
    },
    attendeesCard: {
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 0,
    },
    avatarRow: {
        flexDirection: 'row',
        marginBottom: SPACING.s,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        borderWidth: 2,
        borderColor: COLORS.surfaceHighlight,
        marginRight: -12,
    },
    moreAvatar: {
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    closeButton: {
        position: 'absolute',
        top: 50, // Hardcoded for safer top area typically, or utilize insets
        right: SPACING.m,
        width: 36,
        minWidth: 36,
        height: 36,
        paddingHorizontal: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 18, // Circular
        borderWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    movieDetailsCard: {
        marginTop: SPACING.m,
        padding: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.m,
    },
    movieInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default EventDetailScreen;
