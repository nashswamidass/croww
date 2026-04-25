import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Share, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AntigravityButton from '../../components/AntigravityButton';
import { userService } from '../../services/userService';
import { bookingService } from '../../services/bookingService';
import { showAlert } from '../../utils/showAlert';

const BookingDetailScreen = ({ route, navigation }) => {
    const { booking: initialBooking } = route.params;
    const [booking, setBooking] = useState(initialBooking);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [providerMsg, setProviderMsg] = useState('');
    const [showMsgInput, setShowMsgInput] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null); // 'accepted' or 'rejected'

    useEffect(() => {
        const init = async () => {
            try {
                const user = await userService.getUser();
                setCurrentUser(user);

                // If we only have an ID (e.g. from notification), fetch the full booking
                if (initialBooking?.id && Object.keys(initialBooking).length === 1) {
                    setLoading(true);
                    const fullBooking = await bookingService.getBookingById(initialBooking.id);
                    if (fullBooking) {
                        setBooking(fullBooking);
                    } else {
                        showAlert("Error", "Booking not found.");
                        navigation.goBack();
                    }
                }
            } catch (err) {
                console.error("Initialization error:", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [initialBooking?.id]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Booking for ${booking.serviceName} with ${booking.providerName}!\n📅 ${new Date(booking.eventDate).toLocaleDateString()}\nStatus: ${booking.status}\n— Shared via Croww App`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    }

    const isProvider = currentUser?.id === booking.providerId || currentUser?.uid === booking.providerId;
    const isSender = currentUser?.id === booking.senderId || currentUser?.uid === booking.senderId;

    const recipientId = isProvider ? booking.senderId : booking.providerId;
    const recipientName = isProvider ? (booking.customerName || 'Customer') : booking.providerName;

    const handleUpdateStatus = async (status) => {
        setPendingStatus(status);
        setShowMsgInput(true);
        // Default messages
        if (status === 'accepted') {
            setProviderMsg('I look forward to working with you!');
        } else {
            setProviderMsg('Sorry, I am unavailable at this time.');
        }
    };

    const confirmStatusUpdate = async () => {
        if (!pendingStatus) return;

        setActionLoading(true);
        try {
            await bookingService.updateBookingStatusDetailed(booking, pendingStatus, providerMsg);

            // Update local state
            const updatedBooking = { ...booking, status: pendingStatus, providerMessage: providerMsg };
            setBooking(updatedBooking);

            // Reset UI state immediately
            setShowMsgInput(false);
            setPendingStatus(null);

            showAlert(
                "Booking Updated",
                `The request has been ${pendingStatus} and a message sent to the customer.`,
                [{ text: "OK" }]
            );
        } catch (error) {
            console.error("Status update error:", error);
            showAlert("Error", "Failed to update booking status. Please try again.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelBooking = async () => {
        showAlert(
            "Cancel Booking",
            "Are you sure you want to cancel this booking? This action cannot be undone.",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const success = await bookingService.cancelBooking(booking.id, currentUser.id, currentUser.name);
                            if (success) {
                                setBooking(prev => ({ ...prev, status: 'cancelled' }));
                                showAlert("Success", "Booking cancelled successfully.");
                            }
                        } catch (error) {
                            console.error("Cancellation error:", error);
                            showAlert("Error", "Failed to cancel booking.");
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
            </ScreenWrapper>
        );
    }

    const isPending = booking.status === 'pending';
    const isAccepted = booking.status === 'accepted';
    const isRejected = booking.status === 'rejected';

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={(e) => {
                        if (Platform.OS === 'web' && e?.target?.blur) e.target.blur();
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.replace('Tabs');
                        }
                    }} 
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Booking Details</Typography>
                <TouchableOpacity onPress={handleShare}>
                    <Ionicons name="share-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <NotionCard style={styles.card}>
                    <View style={styles.statusSection}>
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: isAccepted ? COLORS.success + '20' : isRejected ? COLORS.error + '20' : COLORS.accent + '20' }
                        ]}>
                            <Typography variant="h3" style={{
                                color: isAccepted ? COLORS.success : isRejected ? COLORS.error : COLORS.accent,
                                textTransform: 'uppercase'
                            }}>
                                {booking.status}
                            </Typography>
                        </View>
                        {isPending && (
                            <Typography variant="body" color={COLORS.secondary} style={styles.statusSubtext}>
                                {isProvider ? "Review the request below" : "Awaiting provider response"}
                            </Typography>
                        )}
                    </View>

                    <View style={styles.infoSection}>
                        <Typography variant="h1" style={styles.serviceName}>{booking.serviceName}</Typography>
                        <Typography variant="body" color={COLORS.secondary} style={styles.providerName}>
                            {isProvider ? `Customer: ${booking.customerName}` : `with ${booking.providerName}`}
                        </Typography>

                        <View style={styles.divider} />

                        <View style={styles.detailRow}>
                            <Ionicons name="calendar-outline" size={20} color={COLORS.secondary} />
                            <View style={styles.detailTexts}>
                                <Typography variant="caption" color={COLORS.secondary}>Date & Time</Typography>
                                <Typography variant="body">
                                    {new Date(booking.eventDate?.seconds * 1000 || booking.eventDate).toLocaleDateString()} at {new Date(booking.eventDate?.seconds * 1000 || booking.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </View>
                        </View>

                        <View style={styles.detailRow}>
                            <Ionicons name="pricetag-outline" size={20} color={COLORS.secondary} />
                            <View style={styles.detailTexts}>
                                <Typography variant="caption" color={COLORS.secondary}>Package</Typography>
                                <Typography variant="body">{booking.packageDetails?.title || 'Custom Request'}</Typography>
                                <Typography variant="h3" color={COLORS.accent}>₹{booking.packageDetails?.price || 0}</Typography>
                            </View>
                        </View>

                        {(booking.notes || booking.providerMessage) && (
                            <View style={styles.detailRow}>
                                <Ionicons name="document-text-outline" size={20} color={COLORS.secondary} />
                                <View style={styles.detailTexts}>
                                    {booking.notes && (
                                        <>
                                            <Typography variant="caption" color={COLORS.secondary}>Customer Notes</Typography>
                                            <Typography variant="body" style={{ marginBottom: 8 }}>{booking.notes}</Typography>
                                        </>
                                    )}
                                    {booking.providerMessage && (
                                        <>
                                            <Typography variant="caption" color={COLORS.secondary}>Provider Message</Typography>
                                            <Typography variant="body" style={{ color: COLORS.primary, fontWeight: '500' }}>{booking.providerMessage}</Typography>
                                        </>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>

                    {isPending && !isProvider && (
                        <View style={styles.refundNotice}>
                            <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
                            <Typography variant="caption" style={styles.refundText}>
                                If the provider does not accept your request within 24 hours, your payment will be automatically refunded.
                            </Typography>
                        </View>
                    )}

                    {isRejected && !isProvider && (
                        <View style={[styles.refundNotice, { backgroundColor: COLORS.error + '10' }]}>
                            <Ionicons name="alert-circle-outline" size={20} color={COLORS.error} />
                            <Typography variant="caption" style={[styles.refundText, { color: COLORS.error }]}>
                                This request was declined. Your refund will be processed back to your original payment method within 48 hours.
                            </Typography>
                        </View>
                    )}
                </NotionCard>

                {isProvider && isPending && !showMsgInput && (
                    <View style={styles.actionContainer}>
                        <AntigravityButton
                            title="Accept Request"
                            onPress={() => handleUpdateStatus('accepted')}
                            style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                        />
                        <AntigravityButton
                            title="Decline"
                            variant="outline"
                            onPress={() => handleUpdateStatus('rejected')}
                            style={[styles.actionBtn, { borderColor: COLORS.error }]}
                            textStyle={{ color: COLORS.error }}
                        />
                    </View>
                )}

                {isPending && showMsgInput && (
                    <NotionCard style={styles.messageInputCard}>
                        <Typography variant="h3" style={{ marginBottom: SPACING.s }}>
                            {pendingStatus === 'accepted' ? "Add a Welcome Message" : "Reason for Rejection"}
                        </Typography>
                        <Typography variant="caption" color={COLORS.secondary} style={{ marginBottom: SPACING.m }}>
                            This message will be sent to the customer chat.
                        </Typography>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Enter your message..."
                            multiline
                            numberOfLines={4}
                            value={providerMsg}
                            onChangeText={setProviderMsg}
                        />
                        {pendingStatus === 'rejected' && (
                            <Typography variant="small" style={{ color: COLORS.error, marginTop: 8 }}>
                                Note: Declining will trigger an automatic refund.
                            </Typography>
                        )}
                        <View style={styles.confirmActions}>
                            <AntigravityButton
                                title={actionLoading ? "Processing..." : `Confirm ${pendingStatus === 'accepted' ? 'Acceptance' : 'Rejection'}`}
                                onPress={confirmStatusUpdate}
                                disabled={actionLoading}
                                style={{ flex: 1, marginRight: 10 }}
                            />
                            <TouchableOpacity onPress={() => setShowMsgInput(false)} style={styles.cancelLink}>
                                <Typography variant="body" color={COLORS.secondary}>Cancel</Typography>
                            </TouchableOpacity>
                        </View>
                    </NotionCard>
                )}

                <AntigravityButton
                    title={`Message ${isProvider ? 'Customer' : 'Provider'}`}
                    variant="outline"
                    onPress={(e) => {
                        if (Platform.OS === 'web' && e?.target?.blur) e.target.blur();
                        navigation.navigate('Chat', { recipientId, recipientName });
                    }}
                    style={{ marginTop: SPACING.l }}
                />

                {isSender && (isPending || isAccepted) && (
                    <AntigravityButton
                        title={actionLoading ? "Cancelling..." : "Cancel Booking"}
                        variant="secondary"
                        onPress={handleCancelBooking}
                        disabled={actionLoading}
                        style={{ marginTop: SPACING.m, backgroundColor: COLORS.error + '20' }}
                        textStyle={{ color: COLORS.error }}
                    />
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: SPACING.m,
        paddingBottom: 40,
    },
    card: {
        padding: 0,
        overflow: 'hidden',
    },
    statusSection: {
        padding: SPACING.xl,
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight + '30',
    },
    statusBadge: {
        paddingHorizontal: SPACING.l,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.s,
    },
    statusSubtext: {
        textAlign: 'center',
    },
    infoSection: {
        padding: SPACING.l,
    },
    serviceName: {
        marginBottom: 4,
    },
    providerName: {
        marginBottom: SPACING.l,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.l,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.l,
    },
    detailTexts: {
        marginLeft: SPACING.m,
        flex: 1,
    },
    refundNotice: {
        flexDirection: 'row',
        padding: SPACING.l,
        backgroundColor: COLORS.accent + '10',
        alignItems: 'flex-start',
    },
    refundText: {
        marginLeft: SPACING.s,
        color: COLORS.accent,
        flex: 1,
        lineHeight: 18,
    },
    actionContainer: {
        marginTop: SPACING.l,
        gap: 12,
    },
    actionBtn: {
        height: 50,
    },
    messageInputCard: {
        marginTop: SPACING.l,
        padding: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.accent + '30',
    },
    textInput: {
        backgroundColor: COLORS.surfaceHighlight + '30',
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        minHeight: 100,
        textAlignVertical: 'top',
        color: COLORS.primary,
        fontSize: 16,
    },
    confirmActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.l,
    },
    cancelLink: {
        padding: 10,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
});

export default BookingDetailScreen;
