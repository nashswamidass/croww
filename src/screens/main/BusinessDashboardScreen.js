import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';
import { eventService } from '../../services/eventService';
import { ticketService } from '../../services/ticketService';
import { chatService } from '../../services/chatService';
import { bookingService } from '../../services/bookingService';
import { getVerificationStatus } from '../../services/verificationService';
import { getAvatarSource } from '../../utils/avatarHelper';
import { calculateFees, formatINR, getSettlementDate } from '../../utils/feeCalculator';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import PolicyAcceptanceModal from '../../components/PolicyAcceptanceModal';

const { width } = Dimensions.get('window');

const MetricCard = ({ title, value, change, icon, color }) => (
    <NotionCard style={styles.metricCard}>
        <View style={styles.metricHeader}>
            <View style={[styles.iconContainer, { backgroundColor: (color || COLORS.primary) + '20' }]}>
                <Ionicons name={icon} size={18} color={color || COLORS.primary} />
            </View>
            <Typography variant="caption" style={[styles.changeText, { color: color === COLORS.accent ? COLORS.accent : (COLORS.success || '#4CAF50') }]}>
                {change}
            </Typography>
        </View>
        <Typography variant="h2" style={styles.metricValue}>{value}</Typography>
        <Typography variant="caption" color={COLORS.secondary}>{title}</Typography>
    </NotionCard>
);

const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const BusinessDashboardScreen = ({ navigation }) => {
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState({
        totalEvents: 0,
        totalEarnings: 0,
        totalTicketsSold: 0,
        pendingInquiries: 0,
        completedBookings: 0,
        totalBookings: 0,
        bookingEarnings: 0,
        recentActivity: [],
    });
    const [loading, setLoading] = useState(true);
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [isPolicyModalVisible, setIsPolicyModalVisible] = useState(false);

    const isProvider = userData?.userType === 'provider';

    // Separate real-time listener for chats
    useEffect(() => {
        let unsubscribe;
        const setupChatListener = async () => {
            const user = await userService.getUser();
            if (user) {
                unsubscribe = chatService.subscribeToUserChats(user.id, (chats) => {
                    let totalUnread = 0;
                    chats.forEach(chat => {
                        const count = chat.unreadCounts?.[user.id];
                        if (typeof count === 'number') {
                            totalUnread += count;
                        }
                    });
                    setStats(prev => ({ ...prev, pendingInquiries: totalUnread }));
                });
            }
        };

        setupChatListener();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const loadDashboardData = async () => {
        try {
            const user = await userService.getUser();
            if (!user || !user.id) {
                console.log("No valid user found for dashboard");
                return;
            }
            setUserData(user);

            // Check if policy needs acceptance
            if (!user.policyAccepted) {
                setIsPolicyModalVisible(true);
            }
            // Fetch verification status
            const vStatus = await getVerificationStatus();
            setVerificationStatus(vStatus);

            const isPoviderAccount = user.userType === 'provider';

            if (isPoviderAccount) {
                // Fetch Provider Specific Stats
                const [events, bookingStats] = await Promise.all([
                    eventService.getEventsByOrganizer(user.id),
                    bookingService.getProviderBookingStats(user.id)
                ]);

                setStats(prev => ({
                    ...prev,
                    totalEvents: events.length,
                    totalBookings: bookingStats.total,
                    completedBookings: bookingStats.completed,
                    bookingEarnings: bookingStats.earnings,
                    totalEarnings: bookingStats.earnings, // For provider, earnings come from bookings
                }));

                // Fetch Recent Activity for Provider
                const bookings = await bookingService.getBookingsForProvider(user.id);
                const activities = bookings.slice(0, 10).map(b => ({
                    id: b.id,
                    user: b.customerName || 'Customer',
                    type: 'booking',
                    serviceName: b.serviceName,
                    time: formatRelativeTime(b.createdAt),
                    status: b.status,
                }));
                setStats(prev => ({ ...prev, recentActivity: activities }));
            } else {
                // Fetch Business/Venue Specific Stats (Tickets)
                const events = await eventService.getEventsByOrganizer(user.id);
                if (!events) return;

                const statPromises = events.map(async (event) => {
                    const eventStats = await ticketService.getEventStats(event.id, user.id);
                    const sold = eventStats?.sold || 0;
                    const price = parseFloat(event.price) || 0;
                    const fees = event.isPaid && price > 0 ? calculateFees(price, sold) : null;

                    return {
                        event,
                        sold,
                        grossEarnings: fees ? fees.subtotal : 0,
                        netOrganizerPayout: fees ? fees.netOrganizerPayout : 0,
                        platformCommission: fees ? fees.platformCommission : 0,
                        platformCommissionGST: fees ? fees.platformCommissionGST : 0,
                        settlementDate: event.date ? getSettlementDate(event.date) : null,
                    };
                });

                const allStats = await Promise.all(statPromises);

                let totalGross = 0;
                let totalNetPayout = 0;
                let totalCommission = 0;
                let totalCommissionGST = 0;
                let totalTicketsSold = 0;

                allStats.forEach(s => {
                    totalTicketsSold += s.sold;
                    totalGross += s.grossEarnings;
                    totalNetPayout += s.netOrganizerPayout;
                    totalCommission += s.platformCommission;
                    totalCommissionGST += s.platformCommissionGST;
                });

                setStats(prev => ({
                    ...prev,
                    totalEvents: events.length,
                    totalEarnings: totalNetPayout,  // Show net payout (after commission)
                    grossEarnings: totalGross,
                    totalCommission,
                    totalCommissionGST,
                    totalTicketsSold,
                    eventBreakdowns: allStats,
                }));

                // Fetch Recent Activity for Business
                const tickets = await ticketService.getTicketsByOrganizer(user.id);
                const activities = tickets.slice(0, 10).map(t => ({
                    id: t.id,
                    user: t.userName || 'Customer',
                    type: 'ticket',
                    eventTitle: t.eventTitle,
                    time: formatRelativeTime(t.issuedAt),
                    status: t.status,
                }));
                setStats(prev => ({ ...prev, recentActivity: activities }));
            }
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Refresh data every time the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [])
    );

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Typography variant="h1">Dashboard</Typography>
                    <Typography variant="body" color={COLORS.secondary}>
                        {isProvider ? `Hello, ${userData?.name || 'Service Provider'}` : `Welcome back, ${userData?.name || 'Business Owner'}`}
                    </Typography>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('InquiryList')}
                        style={{ marginRight: SPACING.m }}
                    >
                        <View>
                            <Ionicons name="chatbubbles-outline" size={24} color={COLORS.primary} />
                            {stats.pendingInquiries > 0 && (
                                <View style={styles.badge}>
                                    <Typography variant="small" style={styles.badgeText}>
                                        {stats.pendingInquiries > 99 ? '99+' : stats.pendingInquiries}
                                    </Typography>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                        <View style={styles.profileImageContainer}>
                            {getAvatarSource(userData?.photoURL || userData?.avatar, userData?.userType) ? (
                                <Image
                                    source={getAvatarSource(userData?.photoURL || userData?.avatar, userData?.userType)}
                                    style={styles.profileImage}
                                />
                            ) : (
                                <Ionicons name={isProvider ? "person" : "business"} size={24} color={COLORS.secondary} />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={{ alignItems: 'center', paddingVertical: SPACING.xl }}>
                        <ActivityIndicator size="large" color={COLORS.accent} />
                    </View>
                ) : (
                    <>
                        {/* Verification Banner */}
                        {isProvider ? (
                            !verificationStatus?.aadhaarVerified && (
                                <NotionCard style={{ padding: SPACING.m, marginBottom: SPACING.m, borderLeftWidth: 3, borderLeftColor: COLORS.accent }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.accent} style={{ marginRight: SPACING.s }} />
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" style={{ fontWeight: '600' }}>Identity Verification</Typography>
                                            <Typography variant="caption" color={COLORS.secondary}>
                                                Complete Aadhaar verification to build trust with customers.
                                            </Typography>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => navigation.navigate('VerifyIdentity', { onVerified: () => loadDashboardData() })}
                                            style={{ backgroundColor: COLORS.accent, paddingHorizontal: SPACING.m, paddingVertical: SPACING.s, borderRadius: 8 }}
                                        >
                                            <Typography variant="small" style={{ color: '#FFF', fontWeight: '700' }}>Verify</Typography>
                                        </TouchableOpacity>
                                    </View>
                                </NotionCard>
                            )
                        ) : (
                            !verificationStatus?.businessVerified && (
                                <NotionCard style={{ padding: SPACING.m, marginBottom: SPACING.m, borderLeftWidth: 3, borderLeftColor: verificationStatus?.businessPending ? '#FFD700' : COLORS.accent }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons
                                            name={verificationStatus?.businessPending ? 'time-outline' : 'shield-checkmark-outline'}
                                            size={20}
                                            color={verificationStatus?.businessPending ? '#FFD700' : COLORS.accent}
                                            style={{ marginRight: SPACING.s }}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                                {verificationStatus?.businessPending ? 'Verification Under Review' : 'Verify Your Business'}
                                            </Typography>
                                            <Typography variant="caption" color={COLORS.secondary}>
                                                {verificationStatus?.businessPending
                                                    ? 'Your documents are being reviewed. You\'ll be notified once approved.'
                                                    : 'Complete verification to post public events and accept payments.'}
                                            </Typography>
                                        </View>
                                        {!verificationStatus?.businessPending && (
                                            <TouchableOpacity
                                                onPress={() => navigation.navigate('BusinessVerification', { onVerified: () => loadDashboardData() })}
                                                style={{ backgroundColor: COLORS.accent, paddingHorizontal: SPACING.m, paddingVertical: SPACING.s, borderRadius: 8 }}
                                            >
                                                <Typography variant="small" style={{ color: '#FFF', fontWeight: '700' }}>Verify</Typography>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </NotionCard>
                            )
                        )}

                        {/* Key Metrics */}
                        <View style={styles.metricsGrid}>
                            <MetricCard
                                title={isProvider ? "Services Done" : "Total Events"}
                                value={isProvider ? stats.completedBookings : stats.totalEvents}
                                change={isProvider ? `${stats.totalBookings} total` : `${stats.totalEvents} created`}
                                icon={isProvider ? "checkmark-done-circle-outline" : "calendar-outline"}
                                color={COLORS.primary}
                            />
                            <MetricCard
                                title="Total Earnings"
                                value={`₹${(stats.totalEarnings || 0).toLocaleString()}`}
                                change={isProvider ? "from bookings" : "from tickets"}
                                icon="cash-outline"
                                color={COLORS.success || '#4CAF50'}
                            />
                        </View>

                        <View style={styles.metricsGrid}>
                            {isProvider ? (
                                <MetricCard
                                    title="Active Bookings"
                                    value={stats.totalBookings - stats.completedBookings}
                                    change="Pending/Accepted"
                                    icon="time-outline"
                                    color={COLORS.accent}
                                />
                            ) : (
                                <MetricCard
                                    title="Tickets Sold"
                                    value={stats.totalTicketsSold}
                                    change="all events"
                                    icon="ticket-outline"
                                    color={COLORS.accent}
                                />
                            )}
                            <MetricCard
                                title="Inquiries"
                                value={stats.pendingInquiries}
                                change="active chats"
                                icon="chatbubbles-outline"
                                color="#FFD700"
                            />
                        </View>

                        {/* Quick Actions */}
                        <View style={styles.section}>
                            <Typography variant="h3" style={styles.sectionTitle}>Quick Actions</Typography>
                            <View style={styles.actionGrid}>
                                {!isProvider && (
                                    verificationStatus?.businessVerified ? (
                                        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('CreateEvent')}>
                                            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
                                            <Typography variant="caption">Post Event</Typography>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.actionItem}
                                            onPress={() => {
                                                if (verificationStatus?.businessPending) {
                                                    Alert.alert('Verification Pending', 'Your documents are under review. You can post events once approved.');
                                                } else {
                                                    Alert.alert(
                                                        'Verification Required',
                                                        'You need to complete business verification before posting events.',
                                                        [
                                                            { text: 'Later', style: 'cancel' },
                                                            { text: 'Verify Now', onPress: () => navigation.navigate('BusinessVerification', { onVerified: () => loadDashboardData() }) }
                                                        ]
                                                    );
                                                }
                                            }}
                                        >
                                            <View style={{ opacity: 0.5 }}>
                                                <Ionicons name="add-circle" size={28} color={COLORS.secondary} />
                                            </View>
                                            <Typography variant="caption" style={{ color: COLORS.secondary }}>Post Event</Typography>
                                            <Typography variant="small" style={{ color: COLORS.accent, fontSize: 9 }}>
                                                {verificationStatus?.businessPending ? '⏱ Pending' : '🔒 Verify'}
                                            </Typography>
                                        </TouchableOpacity>
                                    )
                                )}

                                <TouchableOpacity
                                    style={styles.actionItem}
                                    onPress={() => navigation.navigate(isProvider ? 'ProviderBookings' : 'ManageStaff')}
                                >
                                    <Ionicons name={isProvider ? "calendar" : "people"} size={28} color={COLORS.primary} />
                                    <Typography variant="caption" style={{ textAlign: 'center' }}>
                                        {isProvider ? 'Bookings\nCalendar' : 'Manage Staff'}
                                    </Typography>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionItem}
                                    onPress={() => navigation.navigate('InquiryList')}
                                >
                                    <View>
                                        <Ionicons name="chatbubbles" size={28} color={COLORS.primary} />
                                        {stats.pendingInquiries > 0 && (
                                            <View style={styles.badgeOverlay}>
                                                <Typography variant="small" style={styles.badgeTextSmall}>
                                                    {stats.pendingInquiries > 99 ? '99+' : stats.pendingInquiries}
                                                </Typography>
                                            </View>
                                        )}
                                    </View>
                                    <Typography variant="caption" style={{ marginTop: 4 }}>Inquiries</Typography>
                                </TouchableOpacity>

                                {isProvider ? (
                                    <TouchableOpacity
                                        style={styles.actionItem}
                                        onPress={() => navigation.navigate('EditProfile')}
                                    >
                                        <Ionicons name="create" size={28} color={COLORS.primary} />
                                        <Typography variant="caption">Edit Services</Typography>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.actionItem}
                                        onPress={() => navigation.navigate('TicketScanner')}
                                    >
                                        <Ionicons name="qr-code" size={28} color={COLORS.primary} />
                                        <Typography variant="caption">Scan Ticket</Typography>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={styles.actionItem}
                                    onPress={() => navigation.navigate(isProvider ? 'Profile' : 'ManageEvents')}
                                >
                                    <Ionicons name={isProvider ? "person" : "calendar"} size={28} color={COLORS.primary} />
                                    <Typography variant="caption">
                                        {isProvider ? 'My Profile' : 'Manage Events'}
                                    </Typography>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Settings')}>
                                    <Ionicons name="settings" size={28} color={COLORS.primary} />
                                    <Typography variant="caption">Settings</Typography>
                                </TouchableOpacity>

                                {isProvider && (
                                    <TouchableOpacity
                                        style={styles.actionItem}
                                        onPress={() => navigation.navigate('ManagePackages')}
                                    >
                                        <Ionicons name="cube" size={28} color={COLORS.primary} />
                                        <Typography variant="caption">Packages</Typography>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Earnings & Payouts Section (Business/Venue only) */}
                        {!isProvider && stats.grossEarnings > 0 && (
                            <View style={styles.section}>
                                <Typography variant="h3" style={styles.sectionTitle}>💰 Earnings & Payouts</Typography>
                                <NotionCard style={{ padding: SPACING.m }}>
                                    <View style={styles.payoutRow}>
                                        <Typography variant="body" style={styles.payoutLabel}>Gross Ticket Sales</Typography>
                                        <Typography variant="body" style={styles.payoutValue}>{formatINR(stats.grossEarnings)}</Typography>
                                    </View>
                                    <View style={styles.payoutRow}>
                                        <Typography variant="caption" style={{ color: COLORS.secondary }}>Platform Commission (7%)</Typography>
                                        <Typography variant="caption" style={{ color: COLORS.accent }}>− {formatINR(stats.totalCommission)}</Typography>
                                    </View>
                                    <View style={styles.payoutRow}>
                                        <Typography variant="caption" style={{ color: COLORS.secondary }}>GST on Commission (18%)</Typography>
                                        <Typography variant="caption" style={{ color: COLORS.accent }}>− {formatINR(stats.totalCommissionGST)}</Typography>
                                    </View>
                                    <View style={[styles.payoutRow, styles.totalPayoutRow]}>
                                        <Typography variant="body" style={{ fontWeight: '700', color: COLORS.primary }}>Net Payout</Typography>
                                        <Typography variant="body" style={{ fontWeight: '700', color: '#4CAF50' }}>{formatINR(stats.totalEarnings)}</Typography>
                                    </View>
                                    {stats.eventBreakdowns?.length > 0 && (
                                        <>
                                            <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: SPACING.m, marginBottom: SPACING.s, fontWeight: '600' }}>Per-Event Settlements</Typography>
                                            {stats.eventBreakdowns.filter(e => e.sold > 0).map((item, idx) => (
                                                <View key={idx} style={styles.settlementRow}>
                                                    <View style={{ flex: 1 }}>
                                                        <Typography variant="caption" style={{ fontWeight: '600' }} numberOfLines={1}>{item.event.title}</Typography>
                                                        <Typography variant="small" style={{ color: COLORS.secondary }}>
                                                            {item.sold} ticket{item.sold > 1 ? 's' : ''} • Settlement: {item.settlementDate ? item.settlementDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}
                                                        </Typography>
                                                    </View>
                                                    <Typography variant="caption" style={{ fontWeight: '700', color: '#4CAF50' }}>
                                                        {formatINR(item.netOrganizerPayout)}
                                                    </Typography>
                                                </View>
                                            ))}
                                        </>
                                    )}
                                </NotionCard>
                            </View>
                        )}

                        {/* Recent Activity */}
                        <View style={styles.section}>
                            <Typography variant="h3" style={styles.sectionTitle}>Recent Activity</Typography>
                            {stats.recentActivity.length === 0 ? (
                                <NotionCard style={{ padding: SPACING.m, alignItems: 'center' }}>
                                    <Ionicons name="notifications-off-outline" size={32} color={COLORS.secondary} />
                                    <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.s }}>
                                        No recent activity yet.
                                    </Typography>
                                </NotionCard>
                            ) : (
                                    stats.recentActivity.map((activity) => (
                                        <View key={activity.id} style={styles.activityItem}>
                                            <View style={styles.activityIcon}>
                                                <Ionicons
                                                    name={activity.type === 'booking' ? 'calendar' : (activity.type === 'ticket' ? 'ticket' : (activity.type === 'review' ? 'star' : 'notifications'))}
                                                    size={16}
                                                    color={COLORS.secondary}
                                                />
                                            </View>
                                            <View style={styles.activityContent}>
                                                <Typography variant="body">
                                                    <Typography variant="body" style={{ fontWeight: '600' }}>{activity.user}</Typography>
                                                    {activity.type === 'booking' && ` requested a booking for ${activity.serviceName}`}
                                                    {activity.type === 'ticket' && ` purchased a ticket for ${activity.eventTitle}`}
                                                    {activity.type === 'review' && ` left a ${activity.rating}★ review`}
                                                </Typography>
                                                <Typography variant="caption" color={COLORS.secondary}>{activity.time}</Typography>
                                            </View>
                                            {activity.status && (
                                                <View style={[styles.statusBadge, {
                                                    backgroundColor:
                                                        activity.status === 'pending' || activity.status === 'PENDING_PAYMENT' ? COLORS.accent + '20' :
                                                            (activity.status === 'completed' || activity.status === 'valid' ? COLORS.success + '20' : COLORS.secondary + '20')
                                                }]}>
                                                    <Typography variant="small" style={{
                                                        color:
                                                            activity.status === 'pending' || activity.status === 'PENDING_PAYMENT' ? COLORS.accent :
                                                                (activity.status === 'completed' || activity.status === 'valid' ? COLORS.success : COLORS.secondary),
                                                        textTransform: 'capitalize'
                                                    }}>
                                                        {activity.status === 'PENDING_PAYMENT' ? 'Pending Pay' : activity.status}
                                                    </Typography>
                                                </View>
                                            )}
                                        </View>
                                    ))
                            )}
                        </View>

                    </>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            <PolicyAcceptanceModal
                visible={isPolicyModalVisible}
                user={userData}
                onAccept={() => setIsPolicyModalVisible(false)}
            />
        </ScreenWrapper >
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
    },
    profileButton: {
        padding: SPACING.xs,
    },
    content: {
        padding: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    metricsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.m,
    },
    metricCard: {
        width: (width - SPACING.m * 3) / 2,
        padding: SPACING.m,
    },
    metricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metricValue: {
        color: COLORS.primary,
        marginBottom: 2,
    },
    changeText: {
        color: COLORS.success || '#4CAF50',
        fontWeight: '600',
    },
    section: {
        marginTop: SPACING.l,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.l,
        ...SHADOWS.small,
    },
    actionItem: {
        alignItems: 'center',
        width: '33.33%',
        paddingVertical: SPACING.m,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    activityIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    activityContent: {
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: 'red',
        borderRadius: 10,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    },
    badgeOverlay: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: 'red',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        zIndex: 1
    },
    badgeTextSmall: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    },
    profileImageContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
    },
    payoutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    payoutLabel: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    payoutValue: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    totalPayoutRow: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        marginTop: SPACING.s,
        paddingTop: SPACING.s,
    },
    settlementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
});

export default BusinessDashboardScreen;
