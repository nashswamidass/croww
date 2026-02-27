import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

import { userService } from '../../services/userService';
import { ticketService } from '../../services/ticketService';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { showAlert } from '../../utils/showAlert';
import SuccessOverlay from '../../components/SuccessOverlay';

const MyTicketsScreen = ({ navigation, route }) => {
    const [groupedTickets, setGroupedTickets] = React.useState({});
    const [loading, setLoading] = React.useState(true);
    const [showSuccess, setShowSuccess] = React.useState(false);
    const [verifiedOrderId, setVerifiedOrderId] = React.useState(null);

    // Subscribe to tickets in real-time
    React.useEffect(() => {
        let unsubscribe = () => { };

        userService.getUser().then(user => {
            if (user) {
                unsubscribe = ticketService.subscribeTicketsByUser(user.id, (tickets) => {
                    // Filter out pending payments to only show issued tickets
                    const issuedTickets = tickets.filter(t => t.status !== 'PENDING_PAYMENT');

                    // Group by Event ID
                    const grouped = issuedTickets.reduce((acc, ticket) => {
                        const eventId = ticket.eventId;
                        if (!acc[eventId]) {
                            acc[eventId] = [];
                        }
                        acc[eventId].push(ticket);
                        return acc;
                    }, {});

                    setGroupedTickets(grouped);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        }).catch(err => {
            console.error("User fetch error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Handle Payment Return (Web)
    React.useEffect(() => {
        if (route.params?.order_id) {
            verifyPaymentReturn(route.params.order_id);
            // Clear params to prevent re-verification
            navigation.setParams({ order_id: null });
        }
    }, [route.params?.order_id]);

    const verifyPaymentReturn = async (orderId) => {
        if (!orderId) return;
        setLoading(true);

        try {
            console.log('Verifying payment return for:', orderId);
            const result = await paymentService.verifyPayment(orderId);

            if (result && result.status === 'PAID') {
                // Finalize any pending tickets or bookings for this Order ID
                try {
                    await ticketService.finalizePendingTickets(orderId);
                    await bookingService.finalizePendingBooking(orderId);
                } catch (finalizeError) {
                    console.warn('Finalization error:', finalizeError);
                }

                setVerifiedOrderId(orderId);
                setShowSuccess(true);
                // No need to manually loadTickets(), the listener will catch it!
            } else {
                showAlert('Payment Pending', 'Your payment is being processed. Please check back later.');
            }
        } catch (error) {
            console.error('Verify return error:', error);
            showAlert('Payment Status', 'Could not verify payment automatically. Please check your tickets list or refresh.');
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
        // Find the newly issued tickets for the verified order
        if (verifiedOrderId) {
            // Flatten grouped tickets to find the one matching verifiedOrderId
            let targetEventId = null;
            let targetTickets = null;

            Object.entries(groupedTickets).forEach(([eventId, tickets]) => {
                if (tickets.some(t => t.cashfreeOrderId === verifiedOrderId)) {
                    targetEventId = eventId;
                    targetTickets = tickets;
                }
            });

            if (targetTickets) {
                handleEventPress(targetEventId, targetTickets);
            }
            setVerifiedOrderId(null);
        }
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2" style={{ marginLeft: SPACING.s }}>My Tickets</Typography>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : Object.keys(groupedTickets).length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="ticket-outline" size={64} color={COLORS.border} />
                        <Typography variant="h3" style={{ marginTop: SPACING.l }}>No Tickets Yet</Typography>
                        <Typography
                            variant="body"
                            style={{ color: COLORS.secondary, textAlign: 'center', marginTop: SPACING.s }}
                        >
                            You haven't purchased any tickets or joined any events yet.
                        </Typography>
                        <AntigravityButton
                            title="Explore Events"
                            style={{ marginTop: SPACING.xl }}
                            onPress={() => navigation.navigate('EventList', { title: 'Upcoming Events', filter: 'upcoming' })}
                        />
                    </View>
                ) : (
                    Object.entries(groupedTickets).map(([eventId, tickets]) => {
                        const firstTicket = tickets[0];
                        const ticketCount = tickets.length;

                        return (
                            <TouchableOpacity
                                key={eventId}
                                activeOpacity={0.8}
                                onPress={() => handleEventPress(eventId, tickets)}
                            >
                                <NotionCard style={styles.ticketCard}>
                                    <View style={styles.ticketMain}>
                                        <Image source={{ uri: firstTicket.image }} style={styles.eventImage} />
                                        <View style={styles.ticketDetails}>
                                            <Typography variant="h3" numberOfLines={1}>{firstTicket.eventTitle}</Typography>

                                            <View style={styles.infoRow}>
                                                <Ionicons name="calendar-outline" size={14} color={COLORS.secondary} />
                                                <Typography variant="caption" style={styles.infoText}>
                                                    {firstTicket.date}
                                                </Typography>
                                            </View>

                                            <View style={styles.infoRow}>
                                                <Ionicons name="location-outline" size={14} color={COLORS.secondary} />
                                                <Typography variant="caption" style={styles.infoText} numberOfLines={1}>
                                                    {firstTicket.location}
                                                </Typography>
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
                    })
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Success Animation Overlay - Rendered last for highest Z-index stack */}
            <SuccessOverlay
                visible={showSuccess}
                onAnimationComplete={handleSuccessComplete}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        padding: 4,
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
    statusBadge: {
        backgroundColor: COLORS.accent + '20',
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: SPACING.xs,
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
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.m,
        borderStyle: 'dashed',
    },
    ticketFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight + '50',
    },
    viewButton: {
        height: 36,
        paddingHorizontal: SPACING.m,
        minWidth: 100,
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
});

export default MyTicketsScreen;
