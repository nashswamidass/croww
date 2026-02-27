import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Share, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const TicketDetailScreen = ({ route, navigation }) => {
    const { ticket } = route.params;

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out my ticket for ${ticket.eventTitle}!\n\n📅 ${ticket.date}\n📍 ${ticket.location}\n🎫 Ticket ID: ${ticket.id}\n\n— Shared via Croww App`,
            });
        } catch (error) {
            console.error('Error sharing ticket:', error);
        }
    };


    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Ticket Details</Typography>
                <TouchableOpacity onPress={handleShare}>
                    <Ionicons name="share-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <NotionCard style={styles.ticketContainer}>
                    <Image source={{ uri: ticket.image }} style={styles.eventImage} />

                    <View style={styles.detailsSection}>
                        <Typography variant="h2" style={styles.title}>{ticket.eventTitle}</Typography>

                        <View style={styles.row}>
                            <Ionicons name="calendar-outline" size={18} color={COLORS.secondary} />
                            <Typography variant="body" style={styles.detailText}>{ticket.date}</Typography>
                        </View>

                        <View style={styles.row}>
                            <Ionicons name="location-outline" size={18} color={COLORS.secondary} />
                            <Typography variant="body" style={styles.detailText}>{ticket.location}</Typography>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.qrSection}>
                            <View style={styles.qrBackground}>
                                <QRCode
                                    value={ticket.id || 'TICKET-UNKNOWN'}
                                    size={200}
                                    color="#000000"
                                    backgroundColor="#FFFFFF"
                                />
                            </View>
                            <Typography variant="caption" style={styles.qrLabel}>
                                ID: {ticket.id || 'N/A'}
                            </Typography>
                            {ticket.status === 'scanned' && (
                                <View style={styles.scannedOverlay}>
                                    <Typography variant="h3" style={{ color: COLORS.success }}>SCANNED</Typography>
                                </View>
                            )}
                        </View>

                        <View style={styles.footer}>
                            <View>
                                <Typography variant="caption" color={COLORS.secondary}>Attendee</Typography>
                                <Typography variant="body" style={{ fontWeight: '600' }}>Nash Newton</Typography>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Typography variant="caption" color={COLORS.secondary}>Ticket Type</Typography>
                                <Typography variant="body" style={{ fontWeight: '600' }}>{ticket.type}</Typography>
                            </View>
                        </View>
                    </View>
                </NotionCard>

                <Typography variant="caption" style={styles.terms}>
                    Please show this QR code at the entrance. Each ticket is valid for one-time entry only.
                </Typography>

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
    ticketContainer: {
        padding: 0,
        overflow: 'hidden',
        borderRadius: 20,
    },
    eventImage: {
        width: '100%',
        height: 200,
    },
    detailsSection: {
        padding: SPACING.l,
    },
    title: {
        marginBottom: SPACING.m,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    detailText: {
        marginLeft: SPACING.s,
        color: COLORS.secondary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.l,
        borderStyle: 'dashed',
    },
    qrSection: {
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    qrBackground: {
        padding: SPACING.m,
        backgroundColor: 'white',
        borderRadius: 12,
        ...SHADOWS.small,
    },
    qrLabel: {
        marginTop: SPACING.m,
        color: COLORS.secondary,
        letterSpacing: 1,
    },
    scannedOverlay: {
        marginTop: SPACING.s,
        paddingHorizontal: SPACING.m,
        paddingVertical: 4,
        backgroundColor: COLORS.success + '20',
        borderRadius: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.l,
    },
    terms: {
        textAlign: 'center',
        color: COLORS.secondary,
        marginVertical: SPACING.l,
        paddingHorizontal: SPACING.xl,
    },
});

export default TicketDetailScreen;
