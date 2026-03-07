import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { COLORS, SPACING } from '../../constants/theme';
import { paymentService } from '../../services/paymentService';
import { showAlert } from '../../utils/showAlert';
import { Ionicons } from '@expo/vector-icons';
import AntigravityButton from '../../components/AntigravityButton';
import * as WebBrowser from 'expo-web-browser';

// Dynamically load Cashfree SDK (reused logic)
const loadCashfreeSdk = () => {
    if (Platform.OS !== 'web') return Promise.resolve(false);

    return new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.Cashfree) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.onload = () => {
            console.log('Cashfree SDK loaded');
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load Cashfree SDK');
            reject(new Error('Failed to load Cashfree SDK'));
        };
        document.body.appendChild(script);
    });
};

const WebPaymentScreen = ({ navigation, route }) => {
    const { paymentSessionId, orderId } = route.params || {};
    const [loading, setLoading] = useState(true);
    const [sdkError, setSdkError] = useState(null);
    const paymentContainerRef = useRef(null);
    const cashfreeRef = useRef(null);

    useEffect(() => {
        if (!paymentSessionId || !orderId) {
            setSdkError('Invalid payment details');
            setLoading(false);
            return;
        }

        if (Platform.OS === 'web') {
            initializePayment();
        }

        // Background polling for payment status as a fallback
        const interval = setInterval(async () => {
            if (!loading && !sdkError) {
                try {
                    const result = await paymentService.verifyPayment(orderId);
                    if (result && result.status === 'PAID') {
                        clearInterval(interval);
                        handlePaymentSuccess();
                    }
                } catch (e) {
                    // Silently fail polling
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [paymentSessionId, orderId, loading, sdkError]);

    const handlePaymentSuccess = () => {
        navigation.navigate('Tabs', {
            screen: 'Tickets',
            params: { order_id: orderId }
        });
    };

    const initializationCalled = React.useRef(false);

    const initializePayment = async () => {
        if (initializationCalled.current) return;
        initializationCalled.current = true;

        try {
            // Trim and validate the ID to prevent corrupt strings causing the "invalid" error
            const cleanSessionId = (paymentSessionId || "").trim();
            const cleanOrderId = (orderId || "").trim();

            console.log("WebPaymentScreen: Initializing with:", { cleanSessionId, cleanOrderId });

            if (!cleanSessionId || cleanSessionId === "undefined") {
                throw new Error("Payment Session ID is missing or corrupt.");
            }

            await loadCashfreeSdk();

            const isProduction = paymentService.environment === 'PRODUCTION';
            console.log("WebPaymentScreen: Resolved environment isProduction:", isProduction);

            cashfreeRef.current = new window.Cashfree({
                mode: isProduction ? "production" : "sandbox"
            });

            setLoading(false);

            // Give the browser a tiny moment to ensure everything is mounted
            setTimeout(() => {
                console.log("WebPaymentScreen: Triggering checkout component (_self redirect)...");
                cashfreeRef.current.checkout({
                    paymentSessionId: cleanSessionId,
                    redirectTarget: "_modal", // Modal is better for mobile responsiveness
                    returnUrl: `${window.location.origin}/payment-return?order_id=${cleanOrderId}`,
                });
            }, 100);

        } catch (error) {
            console.error('Payment Init Error:', error);
            setSdkError(error.message || 'Failed to initialize payment');
            setLoading(false);
        }
    };

    const handleNativeRedirect = async () => {
        const appUrl = process.env.EXPO_PUBLIC_CASHFREE_APP_URL || 'https://croww-app.web.app';
        const checkoutUrl = `${appUrl}/WebPayment?paymentSessionId=${paymentSessionId}&orderId=${orderId}`;

        console.log("Opening Native Web Bridge:", checkoutUrl);
        await WebBrowser.openBrowserAsync(checkoutUrl);
    };

    if (Platform.OS !== 'web') {
        return (
            <ScreenWrapper edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <Ionicons
                        name="close"
                        size={24}
                        color={COLORS.primary}
                        onPress={() => navigation.goBack()}
                        style={{ padding: 4 }}
                    />
                    <Typography variant="h3">Secure Payment</Typography>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.container}>
                    <View style={styles.statusContainer}>
                        <Ionicons name="globe-outline" size={48} color={COLORS.accent} />
                        <Typography variant="h3" style={{ marginTop: SPACING.m }}>
                            Checkout via Browser
                        </Typography>
                        <Typography variant="body" color={COLORS.secondary} style={{ textAlign: 'center', marginTop: SPACING.s }}>
                            To ensure the highest security on your device, we'll open a secure payment session in your browser.
                        </Typography>

                        <AntigravityButton
                            title="Open Secure Checkout"
                            onPress={handleNativeRedirect}
                            style={{ marginTop: SPACING.xl, width: '100%' }}
                        />

                        <Typography variant="caption" color={COLORS.secondary} style={{ textAlign: 'center', marginTop: SPACING.xl }}>
                            The app will automatically detect your payment once completed.
                        </Typography>
                    </View>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <Ionicons
                    name="close"
                    size={24}
                    color={COLORS.primary}
                    onPress={() => navigation.goBack()}
                    style={{ padding: 4 }}
                />
                <Typography variant="h3">Secure Payment</Typography>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.container}>
                {loading && (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Typography style={{ marginTop: SPACING.m }}>
                            Preparing secure checkout...
                        </Typography>
                    </View>
                )}

                {sdkError ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={48} color={COLORS.error} />
                        <Typography variant="body" style={{ textAlign: 'center', marginTop: SPACING.m }}>
                            {sdkError}
                        </Typography>

                        <View style={styles.debugInfo}>
                            <Typography variant="caption" color={COLORS.secondary}>
                                System Status:
                            </Typography>
                            <Typography variant="caption" color={COLORS.secondary}>
                                Env: {paymentService.environment}
                            </Typography>
                            <Typography variant="caption" color={COLORS.secondary}>
                                Session ID: {paymentSessionId ? `${paymentSessionId.substring(0, 10)}...` : 'NONE'}
                            </Typography>
                        </View>

                        <AntigravityButton
                            title="Try Again"
                            onPress={() => window.location.reload()}
                            style={{ marginTop: SPACING.l, width: '100%' }}
                        />
                        <AntigravityButton
                            title="Go Back"
                            variant="outline"
                            onPress={() => navigation.goBack()}
                            style={{ marginTop: SPACING.s, width: '100%' }}
                        />
                    </View>
                ) : !loading && (
                    // Native modal doesn't need a visible container, but we keep the ref for safety or just hidden
                    <View style={styles.statusContainer}>
                        <Ionicons name="lock-closed" size={48} color={COLORS.success} />
                        <Typography variant="h3" style={{ marginTop: SPACING.m }}>
                            Payment in Progress
                        </Typography>
                        <Typography variant="body" color={COLORS.secondary} style={{ textAlign: 'center', marginTop: SPACING.s }}>
                            A secure payment modal should have appeared. Please complete your transaction there.
                        </Typography>

                        <AntigravityButton
                            title="Close / Cancel"
                            variant="outline"
                            onPress={() => navigation.goBack()}
                            style={{ marginTop: SPACING.xl }}
                        />
                    </View>
                )}
                {/* Hidden ref target if needed for SDK initialization context, though _modal usually doesn't need it */}
                <View ref={paymentContainerRef} style={{ height: 0, width: 0 }} />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        height: 60,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.l,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    loader: {
        marginTop: SPACING.xl,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    debugInfo: {
        marginTop: SPACING.xl,
        padding: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    }
});

export default WebPaymentScreen;
