import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const EventTicketsScreen = ({ route, navigation }) => {
    const { tickets, eventTitle } = route.params;

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
                <Typography variant="h2" numberOfLines={1} style={{ flex: 1, marginLeft: SPACING.s }}>
                    {eventTitle}
                </Typography>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {tickets.map((ticket, index) => (
                    <NotionCard key={ticket.id} style={styles.ticketCard}>
                        <View style={styles.ticketMain}>
                            <Image source={{ uri: ticket.image }} style={styles.eventImage} />
                            <View style={styles.ticketDetails}>
                                <View style={styles.statusBadge}>
                                    <Typography variant="small" style={{ color: COLORS.accent, fontWeight: 'bold' }}>
                                        {ticket.status}
                                    </Typography>
                                </View>
                                <Typography variant="h3" numberOfLines={1}>Ticket #{index + 1}</Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                    ID: {ticket.id}
                                </Typography>
                                <View style={styles.infoRow}>
                                    <Ionicons name="calendar-outline" size={14} color={COLORS.secondary} />
                                    <Typography variant="caption" style={styles.infoText}>
                                        {ticket.date} • {ticket.time}
                                    </Typography>
                                </View>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.ticketFooter}>
                            <View>
                                <Typography variant="small" style={{ color: COLORS.secondary }}>Type</Typography>
                                <Typography variant="body" style={{ fontWeight: '600' }}>
                                    {ticket.type}
                                </Typography>
                            </View>
                            <AntigravityButton
                                title="View QR Code"
                                variant="secondary"
                                style={styles.viewButton}
                                onPress={() => navigation.navigate('TicketDetail', { ticket })}
                            />
                        </View>
                    </NotionCard>
                ))}
                <View style={{ height: 40 }} />
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
        width: 60,
        height: 80,
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
    },
});

export default EventTicketsScreen;
