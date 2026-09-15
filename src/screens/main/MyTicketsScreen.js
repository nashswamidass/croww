import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { getAuth } from 'firebase/auth';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

import { userService } from '../../services/userService';
import { ticketService } from '../../services/ticketService';
import { bookingService } from '../../services/bookingService';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../services/paymentService';
import { showAlert } from '../../utils/showAlert';
import { formatDateToKey } from '../../utils/dateUtils';
import SuccessOverlay from '../../components/SuccessOverlay';

const MyTicketsScreen = ({ navigation, route }) => {
    const [groupedTickets, setGroupedTickets] = React.useState({});
    const [bookings, setBookings] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState('all'); // 'all', 'tickets', or 'bookings'
    const [loading, setLoading] = React.useState(true);
    const [showSuccess, setShowSuccess] = React.useState(false);
    const [verifiedOrderId, setVerifiedOrderId] = React.useState(null);
    const { user } = useAuth();
    const [currentUserId, setCurrentUserId] = React.useState('Loading...');

    // Robust Loading Tracker
    const [ticketsLoaded, setTicketsLoaded] = React.useState(false);
    const [bookingsLoaded, setBookingsLoaded] = React.useState(false);

    // Subscribe to tickets & bookings in real-time
    React.useEffect(() => {
        let unsubTickets = () => { };
        let unsubBookings = () => { };

        if (user) {
            const userId = user.id || user.uid;
            setCurrentUserId(userId);

            // Subscribe Tickets
            unsubTickets = ticketService.subscribeTicketsByUser(userId, (tickets) => {
                console.log(`MyTickets: Received ${tickets.length} total tickets`);
                const validTickets = tickets.filter(t => t.status !== 'PENDING_PAYMENT');

                const grouped = validTickets.reduce((acc, ticket) => {
                    const eventId = ticket.eventId;
                    if (!acc[eventId]) acc[eventId] = [];
                    acc[eventId].push(ticket);
                    return acc;
                }, {});

                setGroupedTickets(grouped);
                setTicketsLoaded(true);
            });

            // Subscribe Bookings
            unsubBookings = bookingService.subscribeBookingsByUser(userId, (userBookings) => {
                console.log(`MyTickets: Received ${userBookings.length} total bookings`);
                const validBookings = userBookings.filter(b => {
                    const pStatus = (b.paymentStatus || '').toUpperCase();
                    return pStatus === 'PAID' || pStatus === 'SUCCESS' || (b.packageDetails?.price || 0) === 0 || pStatus === 'PENDING_PAYMENT';
                });

                setBookings(validBookings);
                setBookingsLoaded(true);
            });
        } else {
            setCurrentUserId('Not Logged In');
            setGroupedTickets({});
            setBookings([]);
            setLoading(false);
            setTicketsLoaded(true);
            setBookingsLoaded(true);
        }

        return () => {
            unsubTickets();
            unsubBookings();
        };
    }, [user?.id, user?.uid]);

    // Check for payment return in route params
    React.useEffect(() => {
        const orderId = route.params?.order_id;
        if (orderId) {
            console.log("MyTickets: Payment return detected via route params:", orderId);
            verifyPaymentReturn(orderId);
            // Clear params to avoid re-triggering on rotation/refresh
            navigation.setParams({ order_id: undefined });
        }
    }, [route.params?.order_id]);

    // Global loading sync
    React.useEffect(() => {
        if (ticketsLoaded && bookingsLoaded) {
            setLoading(false);
        }
    }, [ticketsLoaded, bookingsLoaded]);

    const verifyPaymentReturn = async (orderId) => {
        if (!orderId) return;
        setLoading(true);

        try {
            const result = await paymentService.verifyPayment(orderId);
            if (result && result.status === 'PAID') {
                await ticketService.finalizePendingTickets(orderId);
                await bookingService.finalizePendingBooking(orderId);
                setVerifiedOrderId(orderId);
                setShowSuccess(true);
            } else {
                showAlert('Payment Pending', 'Your payment is being processed. Please check back later.');
            }
        } catch (error) {
            console.error('Verify return error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEventPress = (eventId, tickets) => {
        const eventTitle = tickets[0]?.eventTitle || 'Event Tickets';
        navigation.navigate('EventTickets', { tickets, eventTitle });
    };

    const handleSuccessComplete = () => {
        setShowSuccess(false);
        if (verifiedOrderId) {
            let targetEventId = null;
            let targetTickets = null;

            Object.entries(groupedTickets).forEach(([eventId, tickets]) => {
                if (tickets.some(t => t.cashfreeOrderId === verifiedOrderId)) {
                    targetEventId = eventId;
                    targetTickets = tickets;
                }
            });

            if (targetTickets) {
                setActiveTab('tickets');
                handleEventPress(targetEventId, targetTickets);
                setVerifiedOrderId(null);
                return;
            }

            const targetBooking = bookings.find(b => b.cashfreeOrderId === verifiedOrderId);
            if (targetBooking) {
                setActiveTab('bookings');
                navigation.navigate('BookingDetail', { booking: targetBooking });
                setVerifiedOrderId(null);
                return;
            }
            setVerifiedOrderId(null);
        }
    };

    const getUnifiedList = () => {
        const list = [];

        Object.entries(groupedTickets).forEach(([eventId, tickets]) => {
            const firstTicket = tickets[0];
            let sortDate = new Date();
            if (firstTicket.createdAt?.seconds) {
                sortDate = new Date(firstTicket.createdAt.seconds * 1000);
            } else if (firstTicket.date) {
                sortDate = new Date(firstTicket.date);
            }

            list.push({
                id: `event-${eventId}`,
                type: 'ticket',
                eventId,
                tickets,
                sortDate,
                dateDisplay: firstTicket.date,
                title: firstTicket.eventTitle,
                image: firstTicket.image || firstTicket.eventImage || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop', // Provide a premium default
                subtitle: firstTicket.location
            });
        });

        bookings.forEach(booking => {
            let sortDate = new Date();
            if (booking.createdAt?.seconds) {
                sortDate = new Date(booking.createdAt.seconds * 1000);
            } else if (booking.eventDate) {
                const rawDate = booking.eventDate?.seconds ? (booking.eventDate.seconds * 1000) : booking.eventDate;
                sortDate = new Date(rawDate);
            }

            list.push({
                id: `booking-${booking.id}`,
                type: 'booking',
                booking,
                sortDate,
                dateDisplay: formatDateToKey(new Date(booking.eventDate?.seconds * 1000 || booking.eventDate)),
                title: booking.serviceName,
                image: booking.providerAvatar || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop',
                subtitle: `with ${booking.providerName}`,
                status: booking.status
            });
        });

        return list.sort((a, b) => b.sortDate - a.sortDate);
    };

    const renderUnifiedCard = (item) => {
        if (item.type === 'ticket') {
            const { eventId, tickets, title, dateDisplay, image, subtitle } = item;
            const ticketCount = tickets.length;

            return (
                <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={(e) => {
                    if (Platform.OS === 'web' && e?.target?.blur) e.target.blur();
                    handleEventPress(eventId, tickets);
                }}>
                    <NotionCard style={styles.ticketCard}>
                        <View style={styles.ticketMain}>
                            <Image source={{ uri: image }} style={styles.eventImage} />
                            <View style={styles.ticketDetails}>
                                <View style={styles.typeRow}>
                                    <View style={styles.typeBadge}>
                                        <Typography variant="small" style={{ color: COLORS.secondary, fontWeight: 'bold' }}>EVENT</Typography>
                                    </View>
                                </View>
                                <Typography variant="h3" numberOfLines={1}>{title}</Typography>
                                <View style={styles.infoRow}>
                                    <Ionicons name="calendar-outline" size={14} color={COLORS.secondary} />
                                    <Typography variant="caption" style={styles.infoText}>{dateDisplay}</Typography>
                                </View>
                                <View style={styles.infoRow}>
                                    <Ionicons name="location-outline" size={14} color={COLORS.secondary} />
                                    <Typography variant="caption" style={styles.infoText} numberOfLines={1}>{subtitle}</Typography>
                                </View>
                                <View style={styles.countBadge}>
                                    <Ionicons name="ticket" size={12} color={COLORS.primary} />
                                    <Typography variant="small" style={{ color: COLORS.primary, marginLeft: 4, fontWeight: 'bold' }}>
                                        {ticketCount} Ticket{ticketCount > 1 ? 's' : ''}
                                    </Typography>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={COLORS.border} style={{ alignSelf: 'center' }} />
                        </View>
                    </NotionCard>
                </TouchableOpacity>
            );
        } else {
            const { booking, title, subtitle, dateDisplay, image, status } = item;
            return (
                <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={(e) => {
                    if (Platform.OS === 'web' && e?.target?.blur) e.target.blur();
                    navigation.navigate('BookingDetail', { booking });
                }}>
                    <NotionCard style={styles.ticketCard}>
                        <View style={styles.ticketMain}>
                            <Image source={{ uri: image }} style={styles.eventImage} />
                            <View style={styles.ticketDetails}>
                                <View style={styles.statusRow}>
                                    <View style={[styles.typeBadge, { marginRight: 8, backgroundColor: COLORS.surfaceHighlight }]}>
                                        <Typography variant="small" style={{ color: COLORS.secondary, fontWeight: 'bold' }}>BOOKING</Typography>
                                    </View>
                                    <View style={[
                                        styles.statusBadge,
                                        { backgroundColor: status === 'accepted' ? COLORS.success + '20' : COLORS.accent + '20' }
                                    ]}>
                                        <Typography variant="small" style={{
                                            color: status === 'accepted' ? COLORS.success : COLORS.accent,
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase'
                                        }}>
                                            {status}
                                        </Typography>
                                    </View>
                                </View>
                                <Typography variant="h3" numberOfLines={1}>{title}</Typography>
                                <Typography variant="caption" color={COLORS.secondary} style={{ marginBottom: 4 }}>{subtitle}</Typography>
                                <View style={styles.infoRow}>
                                    <Ionicons name="calendar-outline" size={14} color={COLORS.secondary} />
                                    <Typography variant="caption" style={styles.infoText}>{dateDisplay}</Typography>
                                </View>
                                <View style={[styles.countBadge, { backgroundColor: COLORS.surfaceHighlight }]}>
                                    <Typography variant="small" style={{ color: COLORS.primary, fontWeight: 'bold' }}>
                                        {booking.packageDetails?.title || 'Custom'}
                                    </Typography>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={COLORS.border} style={{ alignSelf: 'center' }} />
                        </View>
                    </NotionCard>
                </TouchableOpacity>
            );
        }
    };



    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Typography variant="h2">My Tickets</Typography>
                </View>

            </View>

            <View style={styles.tabContainer}>
                {[
                    { id: 'all', label: 'All' },
                    { id: 'tickets', label: 'Events' },
                    { id: 'bookings', label: 'Bookings' }
                ].map(t => (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.tab, activeTab === t.id && styles.activeTab]}
                        onPress={() => setActiveTab(t.id)}
                    >
                        <Typography variant="body" style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>
                            {t.label}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <>
                        {activeTab === 'all' && (
                            getUnifiedList().length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="albums-outline" size={64} color={COLORS.border} />
                                    <Typography variant="h3" style={{ marginTop: SPACING.l }}>Nothing Yet</Typography>
                                    <Typography variant="body" style={{ color: COLORS.secondary, textAlign: 'center', marginTop: SPACING.s }}>
                                        Your tickets and bookings will appear here.
                                    </Typography>
                                </View>
                            ) : (
                                getUnifiedList().map(item => renderUnifiedCard(item))
                            )
                        )}

                        {activeTab === 'tickets' && (
                            getUnifiedList().filter(i => i.type === 'ticket').length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="ticket-outline" size={64} color={COLORS.border} />
                                    <Typography variant="h3" style={{ marginTop: SPACING.l }}>No Tickets Yet</Typography>
                                    <AntigravityButton
                                        title="Explore Events"
                                        style={{ marginTop: SPACING.xl }}
                                        onPress={() => navigation.navigate('EventList', { title: 'Upcoming Events', filter: 'upcoming' })}
                                    />
                                </View>
                            ) : (
                                getUnifiedList().filter(i => i.type === 'ticket').map(item => renderUnifiedCard(item))
                            )
                        )}

                        {activeTab === 'bookings' && (
                            bookings.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="calendar-outline" size={64} color={COLORS.border} />
                                    <Typography variant="h3" style={{ marginTop: SPACING.l }}>No Bookings Yet</Typography>
                                    <AntigravityButton
                                        title="Find Services"
                                        style={{ marginTop: SPACING.xl }}
                                        onPress={() => navigation.navigate('Search')}
                                    />
                                </View>
                            ) : (
                                getUnifiedList().filter(i => i.type === 'booking').map(item => renderUnifiedCard(item))
                            )
                        )}
                    </>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            <SuccessOverlay visible={showSuccess} onAnimationComplete={handleSuccessComplete} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    tabContainer: {
        flexDirection: 'row',
        padding: SPACING.s,
        backgroundColor: COLORS.surfaceHighlight + '30',
        marginHorizontal: SPACING.m,
        marginTop: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.s,
    },
    activeTab: {
        backgroundColor: COLORS.surfaceHighlight,
    },
    tabText: {
        color: COLORS.secondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: COLORS.accent,
    },
    typeRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginBottom: 4,
    },
    content: {
        padding: SPACING.m,
    },
    ticketCard: {
        padding: 0,
        marginBottom: SPACING.m,
        overflow: 'hidden',
    },
    ticketMain: {
        flexDirection: 'row',
        padding: SPACING.m,
    },
    eventImage: {
        width: 80,
        height: 100,
        borderRadius: BORDER_RADIUS.m,
        marginRight: SPACING.m,
    },
    ticketDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    typeBadge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    statusBadge: {
        backgroundColor: COLORS.accent + '20',
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    infoText: {
        color: COLORS.secondary,
        marginLeft: 4,
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.s,
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
        alignSelf: 'flex-start',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: SPACING.xl,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    }
});

export default MyTicketsScreen;
