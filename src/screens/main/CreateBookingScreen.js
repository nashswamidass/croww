import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, TextInput } from 'react-native';
import { showAlert } from '../../utils/showAlert';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { bookingService } from '../../services/bookingService';
import { userService } from '../../services/userService';
import { paymentService } from '../../services/paymentService';
import { formatDateToKey, parseKeyToDate, getTodayKey } from '../../utils/dateUtils';

// Only import DateTimePicker on native (it doesn't work on web)
let DateTimePicker = null;
if (Platform.OS !== 'web') {
    try {
        DateTimePicker = require('@react-native-community/datetimepicker').default;
    } catch (e) {
        console.warn('DateTimePicker not available:', e);
    }
}


const CreateBookingScreen = ({ route, navigation }) => {
    const { providerId, providerName, serviceName, packageData } = route.params;
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [eventType, setEventType] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [availability, setAvailability] = useState({});
    const [markedDates, setMarkedDates] = useState({});
    const [initLoading, setInitLoading] = useState(true);

    // For web time input
    const formatTimeForInput = (d) => {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    };

    const handleDateChange = (day) => {
        // Extra safety: reject past dates even if calendar allows it
        const today = getTodayKey();
        if (day.dateString < today) {
            showAlert("Invalid Date", "You cannot select a past date.");
            return;
        }
        // Reject blocked dates
        if (markedDates[day.dateString]?.disabled) {
            showAlert("Unavailable", "This date is not available for booking.");
            return;
        }
        const selectedDate = parseKeyToDate(day.dateString);
        setDate(selectedDate);
    };

    const handleTimePickerChange = (event, selectedTime) => {
        // On Android the picker is a one-shot dialog — always hide it
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
        // On iOS it's inline, keep it visible
        // Only update time if user pressed "OK" (not dismissed)
        if (event.type !== 'dismissed' && selectedTime) {
            setTime(selectedTime);
        }
    };

    const handleWebTimeChange = (value) => {
        if (!value) return;
        const [h, m] = value.split(':').map(Number);
        const newTime = new Date(time);
        newTime.setHours(h);
        newTime.setMinutes(m);
        setTime(newTime);
    };

    // Fetch Provider Availability on Mount
    useEffect(() => {
        const fetchProviderData = async () => {
            try {
                const provider = await userService.getUserById(providerId);
                if (provider && provider.availability) {
                    setAvailability(provider.availability);

                    const marks = {};
                    Object.keys(provider.availability).forEach(dateKey => {
                        if (provider.availability[dateKey] === false) {
                            marks[dateKey] = { disabled: true, disableTouchEvent: true, selectedColor: COLORS.border };
                        }
                    });
                    setMarkedDates(marks);
                }
            } catch (error) {
                console.error("Error fetching provider data:", error);
            } finally {
                setInitLoading(false);
            }
        };

        fetchProviderData();
    }, [providerId]);

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
            if (!user) {
                showAlert("Error", "User session not found. Please log in again.");
                return;
            }

            // Combine date and time
            const bookingDateTime = new Date(date);
            bookingDateTime.setHours(time.getHours());
            bookingDateTime.setMinutes(time.getMinutes());

            const bookingDetails = {
                eventDate: bookingDateTime.toISOString(), // Use ISO string for consistency
                eventType,
                notes: notes || "",
                providerName,
                providerAvatar: providerData?.avatar || "", // Include avatar
                serviceName,
                customerName: user.name || "User",
                customerAvatar: user.photoURL || user.avatar || "",
                paymentStatus: paymentStatus || (packageData?.price > 0 ? 'PENDING_VERIFICATION' : 'N/A'),
                packageDetails: packageData ? {
                    id: packageData.id,
                    title: packageData.title,
                    price: packageData.price
                } : null
            };

            console.log("Creating final booking:", bookingDetails);
            await bookingService.createBooking(user.id, providerId, bookingDetails);

            showAlert(
                "Request Sent",
                "Your booking request has been sent to the provider. They will review it shortly.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error("Booking/Payment error:", error);
            showAlert("Error", "Failed to process request: " + (error.message || "Unknown error"));
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
            if (!user) {
                showAlert("Error", "You must be logged in to book.");
                setLoading(false);
                return;
            }

            const price = packageData?.price || 0;

            if (packageData && price > 0) {
                // PART 1: Create Order on Backend
                const orderData = await paymentService.createOrder(
                    price,
                    user.id,
                    user.phone || '9999999999',
                    user.name || 'User',
                    user.email || 'customer@example.com',
                    paymentService.environment // Pass environment explicitly
                );

                console.log("Order Data received:", orderData);

                if (!orderData || !orderData.orderId || !orderData.sessionId) {
                    console.error("Order creation failed or returned incomplete data:", orderData);
                    throw new Error("Failed to create valid payment order: Missing Order ID or Session ID");
                }

                // PART 2: Start SDK Checkout
                if (Platform.OS === 'web') {
                    // PRE-EMPTIVE: Create the booking in PENDING_PAYMENT status
                    const bookingDateTime = new Date(date);
                    bookingDateTime.setHours(time.getHours());
                    bookingDateTime.setMinutes(time.getMinutes());

                    const bookingDetails = {
                        eventDate: bookingDateTime.toISOString(),
                        eventType,
                        notes: notes || "",
                        providerName,
                        providerAvatar: providerData?.avatar || "", // Include avatar
                        serviceName,
                        customerName: user.name || "User",
                        customerAvatar: user.photoURL || user.avatar || "",
                        paymentStatus: 'PENDING_PAYMENT',
                        cashfreeOrderId: orderData.orderId,
                        packageDetails: {
                            id: packageData.id,
                            title: packageData.title,
                            price: price
                        }
                    };

                    console.log("Creating pre-emptive web booking:", bookingDetails);
                    await bookingService.createBooking(user.id, providerId, bookingDetails);

                    console.log("Navigating to WebPayment with:", {
                        paymentSessionId: orderData.sessionId,
                        orderId: orderData.orderId
                    });

                    // FINAL VADLIDATION: Don't navigate if session ID is fundamentally broken
                    if (!orderData.sessionId || String(orderData.sessionId).length < 10) {
                        throw new Error("Received an invalid or truncated session ID from the payment gateway. Please try again.");
                    }

                    navigation.navigate('WebPayment', {
                        paymentSessionId: String(orderData.sessionId).trim(),
                        orderId: String(orderData.orderId).trim()
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
            showAlert("Error", "Failed to initiate booking: " + (error.message || "Please try again."));
        } finally {
            setLoading(false);
        }
    };

    // Build final marked dates with selected date highlight
    const selectedDateKey = formatDateToKey(date);
    const finalMarkedDates = {
        ...markedDates,
        [selectedDateKey]: {
            ...(markedDates[selectedDateKey] || {}),
            selected: true,
            selectedColor: COLORS.accent,
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

                <View style={[styles.formGroup, { backgroundColor: COLORS.surfaceHighlight, padding: SPACING.s, borderRadius: BORDER_RADIUS.m }]}>
                    <Typography variant="caption" style={styles.label}>Select Date</Typography>
                    <Calendar
                        onDayPress={handleDateChange}
                        markedDates={finalMarkedDates}
                        theme={{
                            calendarBackground: 'transparent',
                            textSectionTitleColor: COLORS.secondary,
                            selectedDayBackgroundColor: COLORS.accent,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: COLORS.accent,
                            dayTextColor: COLORS.primary,
                            textDisabledColor: COLORS.border,
                            arrowColor: COLORS.accent,
                            monthTextColor: COLORS.primary,
                        }}
                        minDate={getTodayKey()}
                        style={{ height: 320 }}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Typography variant="caption" style={styles.label}>Event Time</Typography>

                    {Platform.OS === 'web' ? (
                        /* Web: use React Native TextInputs for hour and minute */
                        <View style={styles.webTimePickerContainer}>
                            <View style={styles.dateButton}>
                                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                                <TextInput
                                    style={styles.timeInput}
                                    value={String(time.getHours() % 12 || 12).padStart(2, '0')}
                                    onChangeText={(text) => {
                                        const h = parseInt(text) || 0;
                                        if (h >= 1 && h <= 12) {
                                            const newTime = new Date(time);
                                            const isPM = time.getHours() >= 12;
                                            newTime.setHours(isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h));
                                            setTime(newTime);
                                        }
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    placeholder="HH"
                                />
                                <Typography variant="h3" style={{ marginHorizontal: 2 }}>:</Typography>
                                <TextInput
                                    style={styles.timeInput}
                                    value={String(time.getMinutes()).padStart(2, '0')}
                                    onChangeText={(text) => {
                                        const m = parseInt(text) || 0;
                                        if (m >= 0 && m <= 59) {
                                            const newTime = new Date(time);
                                            newTime.setMinutes(m);
                                            setTime(newTime);
                                        }
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    placeholder="MM"
                                />
                                <View style={styles.ampmContainer}>
                                    <TouchableOpacity
                                        style={[styles.ampmButton, time.getHours() < 12 && styles.ampmButtonActive]}
                                        onPress={() => {
                                            if (time.getHours() >= 12) {
                                                const newTime = new Date(time);
                                                newTime.setHours(time.getHours() - 12);
                                                setTime(newTime);
                                            }
                                        }}
                                    >
                                        <Typography variant="caption" style={[{ fontWeight: '600' }, time.getHours() < 12 && { color: '#fff' }]}>AM</Typography>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.ampmButton, time.getHours() >= 12 && styles.ampmButtonActive]}
                                        onPress={() => {
                                            if (time.getHours() < 12) {
                                                const newTime = new Date(time);
                                                newTime.setHours(time.getHours() + 12);
                                                setTime(newTime);
                                            }
                                        }}
                                    >
                                        <Typography variant="caption" style={[{ fontWeight: '600' }, time.getHours() >= 12 && { color: '#fff' }]}>PM</Typography>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ) : (
                        /* Native: use DateTimePicker */
                        <>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                                <Typography variant="body" style={{ marginLeft: SPACING.s }}>
                                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </TouchableOpacity>
                            {showTimePicker && DateTimePicker && (
                                <DateTimePicker
                                    value={time}
                                    mode="time"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={handleTimePickerChange}
                                />
                            )}
                            {/* iOS: show a Done button to dismiss the inline picker */}
                            {showTimePicker && Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={styles.doneButton}
                                    onPress={() => setShowTimePicker(false)}
                                >
                                    <Typography variant="body" color={COLORS.accent} style={{ fontWeight: '600' }}>Done</Typography>
                                </TouchableOpacity>
                            )}
                        </>
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
    doneButton: {
        alignSelf: 'flex-end',
        paddingVertical: SPACING.s,
        paddingHorizontal: SPACING.m,
        marginTop: SPACING.xs,
    },
    packageSummary: {
        backgroundColor: COLORS.surfaceHighlight,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    webTimePickerContainer: {
        marginBottom: SPACING.xs,
    },
    timeInput: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        width: 44,
        paddingVertical: 4,
        paddingHorizontal: 2,
        marginHorizontal: 4,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.accent,
        color: COLORS.primary,
    },
    ampmContainer: {
        flexDirection: 'row',
        marginLeft: SPACING.m,
        borderRadius: BORDER_RADIUS.s,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    ampmButton: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 6,
        backgroundColor: COLORS.surface,
    },
    ampmButtonActive: {
        backgroundColor: COLORS.accent,
    },
});

export default CreateBookingScreen;
