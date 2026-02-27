import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { showAlert } from '../../utils/showAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { bookingService } from '../../services/bookingService';
import { userService } from '../../services/userService';
import { paymentService } from '../../services/paymentService';

const CreateBookingScreen = ({ route, navigation }) => {
    const { providerId, providerName, serviceName, packageData } = route.params;
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [eventType, setEventType] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) setDate(selectedDate);
    };

    const handleTimeChange = (event, selectedTime) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedTime) setTime(selectedTime);
    };

    // Register Payment Callbacks on Mount
    useEffect(() => {
        paymentService.setCallback(
            // onVerify: Payment SDK Success callback
            async (orderId) => {
                console.log('Payment SDK callback for Order:', orderId);
                setLoading(true);
                try {
                    // SECURE: Verify with backend before finalizing
                    const result = await paymentService.verifyPayment(orderId);
                    if (result && result.status === 'PAID') {
                        await finalizeBooking(orderId);
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

        return () => paymentService.removeCallback();
    }, []);

    const finalizeBooking = async (paymentStatus) => {
        try {
            const user = await userService.getUser();

            // Combine date and time
            const bookingDateTime = new Date(date);
            bookingDateTime.setHours(time.getHours());
            bookingDateTime.setMinutes(time.getMinutes());

            const bookingDetails = {
                eventDate: bookingDateTime,
                eventType,
                notes,
                providerName,
                serviceName,
                customerName: user.name,
                customerAvatar: user.photoURL || user.avatar,
                paymentStatus: paymentStatus || (packageData?.price > 0 ? 'PENDING_VERIFICATION' : 'N/A'),
                packageDetails: packageData ? {
                    id: packageData.id,
                    title: packageData.title,
                    price: packageData.price
                } : null
            };

            await bookingService.createBooking(user.id, providerId, bookingDetails);

            showAlert(
                "Request Sent",
                "Your booking request has been sent to the provider. They will review it shortly.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error("Booking/Payment error:", error);
            showAlert("Error", "Failed to process request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!eventType) {
            showAlert("Error", "Please enter the type of event.");
            return;
        }

        setLoading(true);
        try {
            const user = await userService.getUser();

            if (packageData && packageData.price > 0) {
                // PART 1: Create Order on Backend
                const orderData = await paymentService.createOrder(
                    packageData.price,
                    user.id,
                    user.phone || '9999999999', // Fallback for testing
                    user.name || 'User',
                    user.email || 'customer@example.com'
                );

                // PART 2: Start SDK Checkout
                if (Platform.OS === 'web') {
                    // PRE-EMPTIVE: Create the booking in PENDING_PAYMENT status
                    const user = await userService.getUser();
                    const bookingDateTime = new Date(date);
                    bookingDateTime.setHours(time.getHours());
                    bookingDateTime.setMinutes(time.getMinutes());

                    const bookingDetails = {
                        eventDate: bookingDateTime,
                        eventType,
                        notes,
                        providerName,
                        serviceName,
                        customerName: user.name,
                        customerAvatar: user.photoURL || user.avatar,
                        paymentStatus: 'PENDING_PAYMENT',
                        cashfreeOrderId: orderData.orderId,
                        packageDetails: packageData ? {
                            id: packageData.id,
                            title: packageData.title,
                            price: packageData.price
                        } : null
                    };

                    await bookingService.createBooking(user.id, providerId, bookingDetails);

                    navigation.navigate('WebPayment', {
                        paymentSessionId: orderData.sessionId,
                        orderId: orderData.orderId
                    });
                } else {
                    await paymentService.doPayment(orderData.sessionId, orderData.orderId);
                }
            } else {
                // Free service or no package selected
                await finalizeBooking('N/A');
            }
        } catch (error) {
            console.error("Booking Error:", error);
            showAlert("Error", "Failed to initiate booking. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Request Booking</Typography>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="body" color={COLORS.secondary} style={{ marginBottom: SPACING.l }}>
                    Booking <Typography variant="body" style={{ fontWeight: 'bold' }}>{providerName}</Typography>
                </Typography>

                {packageData && (
                    <View style={styles.packageSummary}>
                        <Typography variant="caption" style={{ marginBottom: 4 }}>Selected Package</Typography>
                        <Typography variant="h3">{packageData.title}</Typography>
                        <Typography variant="h2" color={COLORS.accent}>₹{packageData.price.toLocaleString()}</Typography>
                    </View>
                )}

                <View style={styles.formGroup}>
                    <Typography variant="caption" style={styles.label}>Event Date</Typography>
                    <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                        <Typography variant="body" style={{ marginLeft: SPACING.s }}>
                            {date.toLocaleDateString()}
                        </Typography>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                            minimumDate={new Date()}
                        />
                    )}
                </View>

                <View style={styles.formGroup}>
                    <Typography variant="caption" style={styles.label}>Event Time</Typography>
                    <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowTimePicker(true)}
                    >
                        <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                        <Typography variant="body" style={{ marginLeft: SPACING.s }}>
                            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                    </TouchableOpacity>
                    {showTimePicker && (
                        <DateTimePicker
                            value={time}
                            mode="time"
                            display="default"
                            onChange={handleTimeChange}
                        />
                    )}
                </View>

                <NotionInput
                    label="Event Type"
                    placeholder="e.g., Wedding, Birthday, Corporate"
                    value={eventType}
                    onChangeText={setEventType}
                />

                <NotionInput
                    label="Notes / Requirements"
                    placeholder="Describe your needs..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    style={{ height: 100, textAlignVertical: 'top' }}
                />

                <AntigravityButton
                    title={loading ? "Sending..." : "Send Request"}
                    onPress={handleSubmit}
                    disabled={loading}
                    style={{ marginTop: SPACING.l }}
                />
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
    content: {
        padding: SPACING.m,
    },
    formGroup: {
        marginBottom: SPACING.m,
    },
    label: {
        marginBottom: SPACING.xs,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surface,
    },
    packageSummary: {
        backgroundColor: COLORS.surfaceHighlight,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
});

export default CreateBookingScreen;
