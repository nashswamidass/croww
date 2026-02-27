import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { ticketService } from '../../services/ticketService';

const TicketScannerScreen = ({ navigation }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [validating, setValidating] = useState(false);
    const [scanResult, setScanResult] = useState(null);

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned || validating) return;

        setScanned(true);
        setValidating(true);

        try {
            const result = await ticketService.validateTicket(data);
            setScanResult(result);

            if (result.success) {
                Alert.alert("Success", result.message, [
                    {
                        text: "OK", onPress: () => {
                            setScanned(false);
                            setValidating(false);
                            setScanResult(null);
                        }
                    }
                ]);
            } else {
                Alert.alert("Invalid Ticket", result.message, [
                    {
                        text: "OK", onPress: () => {
                            setScanned(false);
                            setValidating(false);
                            setScanResult(null);
                        }
                    }
                ]);
            }
        } catch (error) {
            Alert.alert("Error", "Could not validate ticket. Please try again.", [
                {
                    text: "OK", onPress: () => {
                        setScanned(false);
                        setValidating(false);
                    }
                }
            ]);
        } finally {
            setValidating(false);
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
                {validating && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="small" color={COLORS.accent} />
                        <Typography variant="caption" style={{ marginLeft: SPACING.s }}>Validating...</Typography>
                    </View>
                )}
            </View>
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
    }
});

export default TicketScannerScreen;
