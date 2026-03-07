import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { bookingService } from '../../services/bookingService';
import { userService } from '../../services/userService';
import { db } from '../../services/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { formatDateToKey, parseKeyToDate, getTodayKey } from '../../utils/dateUtils';


const ProviderBookingsScreen = ({ navigation }) => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(getTodayKey());
    const [markedDates, setMarkedDates] = useState({});
    const [availability, setAvailability] = useState({}); // { 'YYYY-MM-DD': true/false }
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserId, setCurrentUserId] = useState('Loading...');

    // Multi-date blocking state
    const [blockMode, setBlockMode] = useState(false);
    const [selectedBlockDates, setSelectedBlockDates] = useState([]);

    const buildMarkedDates = (avail, providerBookings, selDate, isBlockMode, blockDates) => {
        const marks = {};

        // Mark availability
        Object.keys(avail || {}).forEach(dateKey => {
            const isAvailable = avail[dateKey];
            if (!isAvailable) {
                marks[dateKey] = {
                    customStyles: {
                        container: { backgroundColor: COLORS.error + '20', borderRadius: 6 },
                        text: { color: COLORS.error, fontWeight: '600' }
                    }
                };
            }
        });

        // Mark bookings (dots)
        (providerBookings || []).forEach(booking => {
            const dateKey = formatDateToKey(new Date(booking.eventDate?.seconds * 1000 || booking.eventDate));
            marks[dateKey] = {
                ...(marks[dateKey] || {}),
                marked: true,
                dotColor: booking.status === 'accepted' ? COLORS.success : COLORS.accent,
                customStyles: {
                    ...(marks[dateKey]?.customStyles || {}),
                    container: {
                        ...(marks[dateKey]?.customStyles?.container || {}),
                        borderWidth: 1.5,
                        borderColor: booking.status === 'accepted' ? COLORS.success : COLORS.accent,
                        borderRadius: 6,
                    }
                }
            };
        });

        // If in block mode, highlight pending block/unblock selections
        if (isBlockMode && blockDates.length > 0) {
            blockDates.forEach(dateKey => {
                marks[dateKey] = {
                    ...(marks[dateKey] || {}),
                    customStyles: {
                        container: { backgroundColor: '#FF6B3520', borderRadius: 6, borderWidth: 2, borderColor: '#FF6B35' },
                        text: { color: '#FF6B35', fontWeight: 'bold' }
                    }
                };
            });
        }

        // Highlight selected date (unless in block mode)
        if (!isBlockMode) {
            marks[selDate] = {
                ...(marks[selDate] || {}),
                selected: true,
                selectedColor: COLORS.accent,
                customStyles: {
                    ...(marks[selDate]?.customStyles || {}),
                    container: { backgroundColor: COLORS.accent, borderRadius: 6 },
                    text: { color: '#ffffff', fontWeight: 'bold' }
                }
            };
        }

        return marks;
    };

    useEffect(() => {
        let unsubscribe = () => { };

        const init = async () => {
            try {
                const user = await userService.getUser();
                const userId = user?.id || user?.uid;
                setCurrentUser(user);
                setCurrentUserId(userId || 'Not Logged In');

                if (userId) {
                    // Get initial availability
                    try {
                        const userDetails = await userService.getUserById(userId);
                        if (userDetails) setAvailability(userDetails.availability || {});
                    } catch (e) {
                        console.warn("Could not fetch provider availability:", e);
                    }

                    // Subscribe to real-time updates
                    unsubscribe = bookingService.subscribeBookingsForProvider(userId, (providerBookings) => {
                        console.log(`Provider: Received ${providerBookings.length} bookings`);
                        setBookings(providerBookings);
                        setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error("Init ProviderBookings error:", error);
                setLoading(false);
            }
        };

        init();
        return () => unsubscribe();
    }, []);

    // Update marked dates when bookings or availability change
    useEffect(() => {
        const marks = buildMarkedDates(availability, bookings, selectedDate, blockMode, selectedBlockDates);
        setMarkedDates(marks);
    }, [availability, bookings, selectedDate, blockMode, selectedBlockDates]);

    const handleDayPress = (day) => {
        if (blockMode) {
            const dateStr = day.dateString;
            setSelectedBlockDates(prev =>
                prev.includes(dateStr)
                    ? prev.filter(d => d !== dateStr)
                    : [...prev, dateStr]
            );
        } else {
            setSelectedDate(day.dateString);
        }
    };

    const toggleBlockMode = () => {
        if (blockMode) {
            // Cancel mode
            setBlockMode(false);
            setSelectedBlockDates([]);
        } else {
            setBlockMode(true);
        }
    };

    const saveBlockStatus = async (isAvailable) => {
        if (selectedBlockDates.length === 0) return;

        setLoading(true);
        try {
            const userId = currentUser?.id || currentUser?.uid;
            const updates = {};
            selectedBlockDates.forEach(date => {
                updates[`availability.${date}`] = isAvailable;
            });

            await userService.updateProfile(userId, updates);

            // Local update for immediate feedback
            const nextAvail = { ...availability };
            selectedBlockDates.forEach(date => {
                nextAvail[date] = isAvailable;
            });
            setAvailability(nextAvail);

            Alert.alert("Success", `Selected dates marked as ${isAvailable ? 'available' : 'unavailable'}.`);
            setBlockMode(false);
            setSelectedBlockDates([]);
        } catch (error) {
            console.error("Save availability error:", error);
            Alert.alert("Error", "Failed to update availability.");
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Typography variant="h2">My Bookings</Typography>
                <Typography variant="small" color={COLORS.accent} numberOfLines={1}>
                    v1.2-diag • Cache: {currentUserId} • Auth: {getAuth().currentUser?.uid || 'N/A'}
                </Typography>
            </View>
        </View>
    );

    const pendingRequests = bookings.filter(b => b.status === 'pending');
    const selectedDateBookings = bookings.filter(b => {
        const bookingDate = formatDateToKey(new Date(b.eventDate?.seconds * 1000 || b.eventDate));
        return bookingDate === selectedDate && b.status !== 'pending';
    });

    return (
        <ScreenWrapper edges={['top']}>
            {renderHeader()}

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.calendarSection}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h3">Schedule</Typography>
                        <TouchableOpacity onPress={toggleBlockMode} style={[styles.blockBtn, blockMode && styles.blockBtnActive]}>
                            <Ionicons name={blockMode ? "close-circle" : "calendar-outline"} size={16} color={blockMode ? COLORS.error : COLORS.accent} />
                            <Typography variant="small" style={{ marginLeft: 4, color: blockMode ? COLORS.error : COLORS.accent, fontWeight: 'bold' }}>
                                {blockMode ? "Cancel" : "Manage Availability"}
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {blockMode && (
                        <View style={styles.blockControls}>
                            <Typography variant="caption" color={COLORS.secondary} style={{ marginBottom: 10 }}>
                                Select dates on the calendar to change their availability status.
                            </Typography>
                            <View style={styles.blockActions}>
                                <AntigravityButton
                                    title={`Mark Available (${selectedBlockDates.length})`}
                                    onPress={() => saveBlockStatus(true)}
                                    disabled={selectedBlockDates.length === 0}
                                    style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                                />
                                <AntigravityButton
                                    title={`Mark Unavailable (${selectedBlockDates.length})`}
                                    onPress={() => saveBlockStatus(false)}
                                    disabled={selectedBlockDates.length === 0}
                                    style={[styles.actionBtn, { backgroundColor: COLORS.error }]}
                                />
                            </View>
                        </View>
                    )}

                    <Calendar
                        onDayPress={handleDayPress}
                        markedDates={markedDates}
                        markingType={'custom'}
                        theme={{
                            calendarBackground: COLORS.surface,
                            textSectionTitleColor: COLORS.secondary,
                            selectedDayBackgroundColor: COLORS.accent,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: COLORS.accent,
                            dayTextColor: COLORS.primary,
                            textDisabledColor: COLORS.border,
                            dotColor: COLORS.accent,
                            arrowColor: COLORS.primary,
                            monthTextColor: COLORS.primary,
                            textDayFontWeight: '500',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '600',
                        }}
                    />
                </View>

                {pendingRequests.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Typography variant="h3">Pending Requests</Typography>
                            <View style={styles.badge}>
                                <Typography variant="small" style={{ color: '#fff', fontWeight: 'bold' }}>{pendingRequests.length}</Typography>
                            </View>
                        </View>
                        {pendingRequests.map(booking => (
                            <TouchableOpacity
                                key={booking.id}
                                onPress={() => navigation.navigate('BookingDetail', { booking })}
                            >
                                <NotionCard style={styles.bookingCard}>
                                    <View style={styles.bookingInfo}>
                                        <Typography variant="h4">{booking.serviceName}</Typography>
                                        <Typography variant="body" color={COLORS.secondary}>Customer: {booking.customerName}</Typography>
                                        <Typography variant="caption" style={{ marginTop: 4 }}>
                                            Date: {new Date(booking.eventDate?.seconds * 1000 || booking.eventDate).toLocaleDateString()}
                                        </Typography>
                                    </View>
                                    <View style={styles.statusBadgePending}>
                                        <Typography variant="small" style={{ color: COLORS.accent, fontWeight: 'bold' }}>PENDING</Typography>
                                    </View>
                                </NotionCard>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={[styles.section, { marginTop: SPACING.l }]}>
                    <Typography variant="h3" style={{ marginBottom: SPACING.m }}>
                        Bookings for {new Date(selectedDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Typography>

                    {selectedDateBookings.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Typography variant="body" color={COLORS.secondary}>No bookings for this date.</Typography>
                        </View>
                    ) : (
                        selectedDateBookings.map(booking => (
                            <TouchableOpacity
                                key={booking.id}
                                onPress={() => navigation.navigate('BookingDetail', { booking })}
                            >
                                <NotionCard style={styles.bookingCard}>
                                    <View style={styles.bookingInfo}>
                                        <Typography variant="h4">{booking.serviceName}</Typography>
                                        <Typography variant="body" color={COLORS.secondary}>{booking.customerName}</Typography>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: booking.status === 'accepted' ? COLORS.success + '20' : COLORS.accent + '20' }]}>
                                        <Typography variant="small" style={{
                                            color: booking.status === 'accepted' ? COLORS.success : COLORS.accent,
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase'
                                        }}>
                                            {booking.status}
                                        </Typography>
                                    </View>
                                </NotionCard>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </ScrollView>
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
    content: {
        padding: SPACING.m,
    },
    calendarSection: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    blockBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: COLORS.surfaceHighlight,
    },
    blockBtnActive: {
        backgroundColor: COLORS.error + '10',
    },
    blockControls: {
        backgroundColor: COLORS.surfaceHighlight + '30',
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    blockActions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        flex: 1,
        height: 40,
    },
    section: {
        marginTop: SPACING.m,
    },
    badge: {
        backgroundColor: COLORS.accent,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bookingCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    bookingInfo: {
        flex: 1,
    },
    statusBadgePending: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: COLORS.accent + '15',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    emptyContainer: {
        padding: SPACING.xl,
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight + '20',
        borderRadius: BORDER_RADIUS.m,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: COLORS.border,
    }
});

export default ProviderBookingsScreen;
