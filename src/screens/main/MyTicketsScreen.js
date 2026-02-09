import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import NotionButton from '../../components/NotionButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const MyTicketsScreen = ({ navigation }) => {
    const mockTickets = [
        {
            id: '1',
            eventTitle: 'Sunset Beach Party',
            date: 'Jan 28, 2026',
            time: '06:00 PM',
            location: 'Santa Monica Beach, CA',
            status: 'Upcoming',
            type: 'General Admission',
            image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400',
            qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TICKET-12345'
        },
        {
            id: '2',
            eventTitle: 'Tech Networking Mixer',
            date: 'Feb 05, 2026',
            time: '07:30 PM',
            location: 'Downtown Tech Hub, SF',
            status: 'Upcoming',
            type: 'VIP Pass',
            image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
            qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TICKET-67890'
        }
    ];

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">My Tickets</Typography>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {mockTickets.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="ticket-outline" size={64} color={COLORS.border} />
                        <Typography variant="h3" style={{ marginTop: SPACING.l }}>No Tickets Yet</Typography>
                        <Typography
                            variant="body"
                            style={{ color: COLORS.secondary, textAlign: 'center', marginTop: SPACING.s }}
                        >
                            You haven't purchased any tickets or joined any events yet.
                        </Typography>
                        <NotionButton
                            title="Explore Events"
                            style={{ marginTop: SPACING.xl }}
                            onPress={() => navigation.navigate('Map')}
                        />
                    </View>
                ) : (
                    mockTickets.map((ticket) => (
                        <NotionCard key={ticket.id} style={styles.ticketCard}>
                            <View style={styles.ticketMain}>
                                <Image source={{ uri: ticket.image }} style={styles.eventImage} />
                                <View style={styles.ticketDetails}>
                                    <View style={styles.statusBadge}>
                                        <Typography variant="small" style={{ color: COLORS.accent, fontWeight: 'bold' }}>
                                            {ticket.status}
                                        </Typography>
                                    </View>
                                    <Typography variant="h3" numberOfLines={1}>{ticket.eventTitle}</Typography>
                                    <View style={styles.infoRow}>
                                        <Ionicons name="calendar-outline" size={14} color={COLORS.secondary} />
                                        <Typography variant="caption" style={styles.infoText}>
                                            {ticket.date} • {ticket.time}
                                        </Typography>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Ionicons name="location-outline" size={14} color={COLORS.secondary} />
                                        <Typography variant="caption" style={styles.infoText} numberOfLines={1}>
                                            {ticket.location}
                                        </Typography>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.ticketFooter}>
                                <View>
                                    <Typography variant="small" style={{ color: COLORS.secondary }}>Ticket Type</Typography>
                                    <Typography variant="body" style={{ fontWeight: '600' }}>{ticket.type}</Typography>
                                </View>
                                <NotionButton
                                    title="View Ticket"
                                    variant="secondary"
                                    style={styles.viewButton}
                                    onPress={() => { }} // Could show a modal with QR code
                                />
                            </View>
                        </NotionCard>
                    ))
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
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
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: SPACING.xl,
    },
});

export default MyTicketsScreen;
