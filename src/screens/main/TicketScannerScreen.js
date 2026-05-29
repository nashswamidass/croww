import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { ticketService } from '../../services/ticketService';
import { eventService } from '../../services/eventService';
import { notificationService } from '../../services/notificationService';

const TicketScannerScreen = ({ navigation }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validatingText, setValidatingText] = useState("Validating...");
    const [scanResult, setScanResult] = useState(null);
    const [showConsumeModal, setShowConsumeModal] = useState(false);
    const [consumeCount, setConsumeCount] = useState(1);
    const [consuming, setConsuming] = useState(false);

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned || validating) return;

        setScanned(true);
        setValidating(true);
        setValidatingText("Validating...");

        try {
            const result = await ticketService.validateTicket(data);

            if (result.success) {
                const total = result.ticket.totalAdmits || 1;
                const scannedCount = result.ticket.scannedAdmits || 0;
                const remaining = total - scannedCount;

                if (remaining <= 0) {
                    Alert.alert("Invalid Ticket", "Ticket already fully scanned", [
                        {
                            text: "OK", onPress: () => {
                                setScanned(false);
                                setValidating(false);
                                setScanResult(null);
                            }
                        }
                    ], { cancelable: false });
                    return;
                }

                setScanResult(result);

                if (remaining === 1) {
                    // Automatically consume the 1 remaining admit (single admit)
                    setConsumeCount(1);
                    setValidatingText("Checking in...");
                    
                    try {
                        await ticketService.consumeTicket(result.ticket.id, 1);
                        
                        // Fetch event details safely without failing the scan if it's slow/fails
                        let fullEvent = null;
                        try {
                            fullEvent = await eventService.getEventById(result.ticket.eventId);
                        } catch (eventErr) {
                            console.warn("Failed to fetch event details for stats:", eventErr);
                            // Fallback minimal event object
                            fullEvent = {
                                id: result.ticket.eventId,
                                organizerId: result.ticket.organizerId,
                                title: result.ticket.eventTitle,
                                status: 'valid'
                            };
                        }

                        // Trigger review notification to the attendee safely
                        try {
                            if (result.ticket.userId && fullEvent && fullEvent.organizerId) {
                                await notificationService.sendNotification(
                                    result.ticket.userId,
                                    "How was your experience?",
                                    `You just checked in to ${result.ticket.eventTitle}. Tap here to review ${fullEvent.organizerName || 'the organizer'}!`,
                                    {
                                        type: 'review_prompt',
                                        businessId: fullEvent.organizerId,
                                        businessName: fullEvent.organizerName || 'the organizer'
                                    }
                                );
                            }
                        } catch (notifErr) {
                            console.log("Failed to send review notification", notifErr);
                        }

                        setValidating(false);

                        Alert.alert("Success", "Checked in 1 person!", [
                            {
                                text: "Scan Another",
                                onPress: () => {
                                    setScanResult(null);
                                    setScanned(false);
                                },
                                style: 'default'
                            },
                            {
                                text: "View Stats",
                                onPress: () => {
                                    setScanResult(null);
                                    setScanned(false);
                                    if (fullEvent) {
                                        navigation.replace('EventStats', { event: fullEvent });
                                    } else {
                                        navigation.goBack();
                                    }
                                }
                            }
                        ], { cancelable: false });

                    } catch (consumeErr) {
                        console.error("Auto Check-in Error:", consumeErr);
                        Alert.alert("Error", "Could not check in. Please try again.", [
                            {
                                text: "OK",
                                onPress: () => {
                                    setValidating(false);
                                    setScanned(false);
                                    setScanResult(null);
                                }
                            }
                        ], { cancelable: false });
                    }
                } else {
                    // Multiple person admit: ask how many are entering
                    setConsumeCount(1);
                    setValidating(false); // Done validating, modal will be shown
                    setShowConsumeModal(true);
                }
            } else {
                Alert.alert("Invalid Ticket", result.message, [
                    {
                        text: "OK", onPress: () => {
                            setScanned(false);
                            setValidating(false);
                            setScanResult(null);
                        }
                    }
                ], { cancelable: false });
            }
        } catch (error) {
            console.error("Scanner Error:", error);
            Alert.alert("Error", error.message || "Could not validate ticket. Please try again.", [
                {
                    text: "OK", onPress: () => {
                        setScanned(false);
                        setValidating(false);
                        setScanResult(null);
                    }
                }
            ], { cancelable: false });
        }
    };

    const handleConsume = async () => {
        setConsuming(true);
        try {
            await ticketService.consumeTicket(scanResult.ticket.id, consumeCount);
            
            // Fetch event for stats safely without failing the check-in if it's slow/fails
            let fullEvent = null;
            try {
                fullEvent = await eventService.getEventById(scanResult.ticket.eventId);
            } catch (eventErr) {
                console.warn("Failed to fetch event details for stats:", eventErr);
                // Fallback minimal event object
                fullEvent = {
                    id: scanResult.ticket.eventId,
                    organizerId: scanResult.ticket.organizerId,
                    title: scanResult.ticket.eventTitle,
                    status: 'valid'
                };
            }
            
            setConsuming(false);
            
            // Trigger review notification to the attendee safely
            try {
                if (scanResult.ticket.userId && fullEvent && fullEvent.organizerId) {
                    await notificationService.sendNotification(
                        scanResult.ticket.userId,
                        "How was your experience?",
                        `You just checked in to ${scanResult.ticket.eventTitle}. Tap here to review ${fullEvent.organizerName || 'the organizer'}!`,
                        {
                            type: 'review_prompt',
                            businessId: fullEvent.organizerId,
                            businessName: fullEvent.organizerName || 'the organizer'
                        }
                    );
                }
            } catch (notifErr) {
                console.log("Failed to send review notification", notifErr);
            }
            
            Alert.alert("Success", `Checked in ${consumeCount} people!`, [
                {
                    text: "Scan Another", 
                    onPress: () => {
                        setShowConsumeModal(false);
                        setScanResult(null);
                        setValidating(false);
                        setScanned(false); // Reset scanner last
                    },
                    style: 'default'
                },
                {
                    text: "View Stats", 
                    onPress: () => {
                        setShowConsumeModal(false);
                        setScanResult(null);
                        setValidating(false);
                        setScanned(false);
                        if (fullEvent) {
                            navigation.replace('EventStats', { event: fullEvent });
                        } else {
                            navigation.goBack();
                        }
                    }
                }
            ], { cancelable: false });
            
        } catch (error) {
            console.error("Error consuming ticket:", error);
            Alert.alert("Error", "Could not check in. Please try again.");
            setConsuming(false);
        }
    };

    if (!permission) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (!permission.granted) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <Typography variant="body" style={{ textAlign: 'center', marginBottom: SPACING.l }}>
                        We need your permission to use the camera to scan tickets.
                    </Typography>
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={requestPermission}
                    >
                        <Typography variant="body" style={{ color: 'white' }}>Grant Permission</Typography>
                    </TouchableOpacity>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Scan Ticket</Typography>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.scannerContainer}>
                <CameraView
                    style={styles.camera}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                >
                    <View style={styles.overlay}>
                        <View style={styles.unfocusedContainer}></View>
                        <View style={styles.focusedRow}>
                            <View style={styles.unfocusedContainer}></View>
                            <View style={styles.focusFrame}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                            </View>
                            <View style={styles.unfocusedContainer}></View>
                        </View>
                        <View style={styles.unfocusedContainer}></View>
                    </View>
                </CameraView>
            </View>

            <View style={styles.footer}>
                <Typography variant="body" style={{ textAlign: 'center' }}>
                    Position the ticket QR code within the frame to scan.
                </Typography>
                {validating && !showConsumeModal && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="small" color={COLORS.accent} />
                        <Typography variant="caption" style={{ marginLeft: SPACING.s }}>{validatingText}</Typography>
                    </View>
                )}
            </View>

            {/* Consume Modal */}
            <Modal
                visible={showConsumeModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setShowConsumeModal(false);
                    setScanned(false);
                    setValidating(false);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h3">Check-in Attendees</Typography>
                            <TouchableOpacity onPress={() => {
                                setShowConsumeModal(false);
                                setScanned(false);
                                setValidating(false);
                            }}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>
                        
                        {scanResult && scanResult.ticket && (() => {
                            const total = scanResult.ticket.totalAdmits || 1;
                            const scannedCount = scanResult.ticket.scannedAdmits || 0;
                            const remaining = total - scannedCount;
                            
                            return (
                                <>
                                    <NotionCard style={{ marginBottom: SPACING.l }}>
                                        <Typography variant="body" style={{ fontWeight: '600' }}>
                                            {scanResult.ticket.attendeeName}
                                        </Typography>
                                        <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                            {scanResult.ticket.ticketType} • Total Admits: {total}
                                        </Typography>
                                        <Typography variant="caption" style={{ color: COLORS.accent, fontWeight: '700', marginTop: 4 }}>
                                            {remaining} remaining
                                        </Typography>
                                    </NotionCard>

                                    <Typography variant="body" style={{ textAlign: 'center', marginBottom: SPACING.s }}>
                                        How many people are entering now?
                                    </Typography>
                                    
                                    <View style={styles.counterRow}>
                                        <TouchableOpacity 
                                            style={styles.counterButton}
                                            onPress={() => setConsumeCount(Math.max(1, consumeCount - 1))}
                                            disabled={consumeCount <= 1}
                                        >
                                            <Ionicons name="remove" size={24} color={consumeCount <= 1 ? COLORS.border : COLORS.primary} />
                                        </TouchableOpacity>
                                        
                                        <Typography variant="h1" style={styles.counterText}>{consumeCount}</Typography>
                                        
                                        <TouchableOpacity 
                                            style={styles.counterButton}
                                            onPress={() => setConsumeCount(Math.min(remaining, consumeCount + 1))}
                                            disabled={consumeCount >= remaining}
                                        >
                                            <Ionicons name="add" size={24} color={consumeCount >= remaining ? COLORS.border : COLORS.primary} />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <AntigravityButton 
                                        title={consuming ? "Processing..." : `Confirm ${consumeCount} Check-in${consumeCount > 1 ? 's' : ''}`}
                                        onPress={handleConsume}
                                        disabled={consuming}
                                    />
                                </>
                            );
                        })()}
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
        zIndex: 10,
        backgroundColor: COLORS.background,
    },
    backButton: {
        padding: 4,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
    },
    unfocusedContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    focusedRow: {
        flexDirection: 'row',
        height: 250,
    },
    focusFrame: {
        width: 250,
        height: 250,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: COLORS.accent,
        borderWidth: 4,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    footer: {
        padding: SPACING.xl,
        backgroundColor: COLORS.background,
        alignItems: 'center',
    },
    permissionButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.m,
        borderRadius: 12,
    },
    loadingOverlay: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.m,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: SPACING.xl,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    counterButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    counterText: {
        marginHorizontal: SPACING.xl,
        minWidth: 40,
        textAlign: 'center',
    }
});

export default TicketScannerScreen;
