import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { ticketService } from '../../services/ticketService';

const EventStatsScreen = ({ route, navigation }) => {
    const { event } = route.params;
    const [stats, setStats] = useState({ sold: 0, scanned: 0, attendees: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await ticketService.getEventStats(event.id, event.organizerId);
            setStats(data);
        } catch (error) {
            console.error("Error loading stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderAttendee = ({ item }) => (
        <View style={styles.attendeeRow}>
            <View style={styles.attendeeInfo}>
                <Typography variant="body" style={{ fontWeight: '500' }}>
                    {item.userName || 'Attendee'}
                </Typography>
                <Typography variant="caption" color={COLORS.secondary}>
                    {item.id.substring(0, 8)}...
                </Typography>
            </View>
            <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'scanned' ? COLORS.success + '20' : COLORS.border + '40' }
            ]}>
                <Typography variant="small" style={{
                    color: item.status === 'scanned' ? COLORS.success : COLORS.secondary,
                    fontWeight: 'bold'
                }}>
                    {item.status === 'scanned' ? 'SCANNED' : 'VALID'}
                </Typography>
            </View>
        </View>
    );

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    const scanRate = stats.sold > 0 ? Math.round((stats.scanned / stats.sold) * 100) : 0;

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Event Stats</Typography>
                <TouchableOpacity onPress={loadStats}>
                    <Ionicons name="refresh" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h3" style={styles.eventTitle}>{event.title}</Typography>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <NotionCard style={styles.statCard}>
                        <Typography variant="caption" color={COLORS.secondary}>Sold</Typography>
                        <Typography variant="h2">{stats.sold}</Typography>
                        <Typography variant="small" color={COLORS.secondary}>
                            of {event.maxTickets}
                        </Typography>
                    </NotionCard>
                    <NotionCard style={styles.statCard}>
                        <Typography variant="caption" color={COLORS.secondary}>Scanned</Typography>
                        <Typography variant="h2">{stats.scanned}</Typography>
                        <Typography variant="small" color={COLORS.secondary}>
                            {scanRate}% rate
                        </Typography>
                    </NotionCard>
                </View>

                {/* Progress Bar */}
                <NotionCard style={styles.progressCard}>
                    <Typography variant="body" style={styles.cardLabel}>Attendance Progress</Typography>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${scanRate}%` }]} />
                    </View>
                    <Typography variant="caption" color={COLORS.secondary} style={{ marginTop: 8 }}>
                        {stats.scanned} of {stats.sold} ticket holders present
                    </Typography>
                </NotionCard>

                {/* Attendee List */}
                <Typography variant="h3" style={styles.sectionTitle}>Attendee List</Typography>
                <NotionCard style={styles.listCard}>
                    {stats.attendees.length === 0 ? (
                        <Typography variant="body" color={COLORS.secondary} style={{ textAlign: 'center', padding: 20 }}>
                            No tickets sold yet.
                        </Typography>
                    ) : (
                        stats.attendees.map((item) => (
                            <React.Fragment key={item.id}>
                                {renderAttendee({ item })}
                                <View style={styles.divider} />
                            </React.Fragment>
                        ))
                    )}
                </NotionCard>
                <View style={{ height: 40 }} />
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
    },
    eventTitle: {
        marginBottom: SPACING.l,
        textAlign: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.l,
    },
    statCard: {
        flex: 0.48,
        alignItems: 'center',
        padding: SPACING.m,
    },
    progressCard: {
        padding: SPACING.m,
        marginBottom: SPACING.l,
    },
    cardLabel: {
        fontWeight: '600',
        marginBottom: SPACING.s,
    },
    progressBarBg: {
        height: 12,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.accent,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    listCard: {
        padding: 0,
    },
    attendeeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
    },
    attendeeInfo: {
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: 4,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.m,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default EventStatsScreen;
