import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Share, ScrollView, Platform, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatIndianDate } from '../../utils/localization';

const TicketDetailScreen = ({ route, navigation }) => {
    const { ticket } = route.params;
    const ticketViewRef = React.useRef();
    const qrCodeRef = React.useRef();

    const handleShare = async () => {
        try {
            if (!ticketViewRef.current && Platform.OS !== 'web') {
                Alert.alert("Error", "Ticket view is not ready yet. Please try again.");
                return;
            }

            const formattedDate = ticket.date ? formatIndianDate(ticket.date) : 'TBD';
            const shareText = `🎟️ Ticket for ${ticket.eventTitle}\n\n📅 Date: ${formattedDate}\n📍 Location: ${ticket.location}\n🆔 Ticket ID: ${ticket.id}\n\nPresent this Ticket ID or the QR code at the entrance!`;
            const fileName = `Ticket_${(ticket.eventTitle || 'Event').replace(/[^a-zA-Z0-9]/g, '_')}_${ticket.id}.png`;

            if (Platform.OS === 'web') {
                const qrCodeEl = qrCodeRef.current;
                const svg = qrCodeEl?.querySelector?.('svg');
                if (!svg) {
                    Alert.alert("Error", "Could not capture the QR code on this browser.");
                    return;
                }
                const serializer = new XMLSerializer();
                const svgStr = serializer.serializeToString(svg);
                
                const img = new window.Image();
                const b64 = window.btoa(unescape(encodeURIComponent(svgStr)));
                img.src = 'data:image/svg+xml;base64,' + b64;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width + 40;
                    canvas.height = img.height + 40;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 20, 20);
                    
                    canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        const file = new File([blob], fileName, { type: 'image/png' });
                        
                        let sharedSuccessfully = false;
                        try {
                            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                await navigator.share({
                                    title: `Ticket: ${ticket.eventTitle}`,
                                    text: shareText,
                                    files: [file]
                                });
                                sharedSuccessfully = true;
                            } else if (navigator.share) {
                                await navigator.share({
                                    title: `Ticket: ${ticket.eventTitle}`,
                                    text: shareText,
                                });
                                sharedSuccessfully = true;
                            }
                        } catch (e) {
                            console.log("Web share aborted or failed:", e);
                        }
                        
                        const pngUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = pngUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(pngUrl);
                        
                        if (sharedSuccessfully) {
                            Alert.alert("Success", "Ticket details shared and QR code downloaded!");
                        } else {
                            Alert.alert("Ticket Saved", "The QR code has been downloaded to your device as an image.");
                        }
                    }, 'image/png');
                };
                return;
            }

            // NATIVE (iOS / Android): capture the ENTIRE ticket as a beautiful image
            const uri = await captureRef(ticketViewRef, {
                format: 'png',
                quality: 1.0,
                result: 'tmpfile',
            });

            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                // Fallback: Copy to cache and open
                const destUri = FileSystem.cacheDirectory + fileName;
                await FileSystem.copyAsync({ from: uri, to: destUri });
                Alert.alert("Ticket Saved", `Ticket QR saved to your device.`);
                return;
            }

            if (Platform.OS === 'ios') {
                // iOS deeply supports combining URLs (files) and message texts simultaneously
                await Share.share({
                    message: shareText,
                    url: uri,
                });
            } else {
                // Android restricts file:// URIs via standard Share without FileProvider implementations
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: shareText,
                    UTI: 'public.png',
                });
            }
        } catch (error) {
            console.error('Error sharing ticket:', error);
            Alert.alert("Error", "Could not generate or share the ticket QR code. Please try again.");
        }
    };



    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={(e) => {
                        if (Platform.OS === 'web' && e?.target?.blur) e.target.blur();
                        navigation.goBack();
                    }} 
                    style={styles.backButton}
                >
                    <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Ticket Details</Typography>
                <TouchableOpacity onPress={handleShare}>
                    <Ionicons name="share-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Wrap the NotionCard inside a View for the native view shot, since custom components sometimes fail captureRef */}
                <View ref={ticketViewRef} collapsable={false}>
                    <NotionCard style={styles.ticketContainer}>
                        <Image source={{ uri: ticket.image }} style={styles.eventImage} />

                        <View style={styles.detailsSection}>
                            <Typography variant="h2" style={styles.title}>{ticket.eventTitle}</Typography>

                            <View style={styles.row}>
                                <Ionicons name="calendar-outline" size={18} color={COLORS.secondary} />
                                <Typography variant="body" style={styles.detailText}>{ticket.date ? formatIndianDate(ticket.date) : 'TBD'}</Typography>
                            </View>

                            <View style={styles.row}>
                                <Ionicons name="location-outline" size={18} color={COLORS.secondary} />
                                <Typography variant="body" style={styles.detailText}>{ticket.location}</Typography>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.qrSection}>
                                <View ref={qrCodeRef} style={styles.qrBackground} collapsable={false}>
                                    <QRCode
                                        value={ticket.id || 'TICKET-UNKNOWN'}
                                        size={200}
                                        color="#000000"
                                        backgroundColor="#FFFFFF"
                                    />
                                </View>
                                <Typography variant="caption" style={styles.qrLabel}>
                                    Ticket ID: {ticket.id || 'N/A'}
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
                                    <Typography variant="body" style={{ fontWeight: '600' }}>{ticket.attendeeName || 'Attendee'}</Typography>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Typography variant="caption" color={COLORS.secondary}>Ticket Type</Typography>
                                    <Typography variant="body" style={{ fontWeight: '600' }}>{ticket.type}</Typography>
                                </View>
                            </View>
                        </View>
                    </NotionCard>
                </View>

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
