import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { getDigiLockerUrl, finalizeAadhaarVerification, getVerificationStatus } from '../../services/verificationService';
import { showAlert } from '../../utils/showAlert';

const VerifyIdentityScreen = ({ navigation, route }) => {
    const { onVerified } = route.params || {};
    
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verificationId, setVerificationId] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);
    const [verifiedName, setVerifiedName] = useState('');

    useEffect(() => {
        checkCurrentStatus();
    }, []);

    // New useEffect to handle status check when returning from DigiLocker via deep link
    useEffect(() => {
        const checkFromParams = async () => {
            const params = route.params || {};
            // If we have a verificationId in the route params (from deep link)
            if (params.verification_id) {
                console.log("[VerifyIdentity] Redirect detected with ID:", params.verification_id);
                setVerificationId(params.verification_id);
                if (Platform.OS !== 'web') {
                    WebBrowser.dismissBrowser();
                }
                // Trigger auto-verification
                handleCheckCompletion(params.verification_id);
            }
        };
        checkFromParams();
    }, [route.params]);

    const checkCurrentStatus = async () => {
        try {
            const status = await getVerificationStatus();
            if (status.aadhaarVerified) {
                setIsVerified(true);
                setVerifiedName(status.aadhaarName);
            }
        } catch (err) {
            console.error("Error checking verification status:", err);
        } finally {
            setStatusLoading(false);
        }
    };

    const handleStartVerification = async () => {
        setLoading(true);
        try {
            // Use platform-specific redirect URL:
            // Web → croww.ai/kyc-complete (real page user lands on)
            // Mobile → croww.ai/kyc-complete (safe fallback; browser closes after DigiLocker)
            const redirectUrl = 'https://croww.ai/kyc-complete';

            const result = await getDigiLockerUrl('signup', redirectUrl);
            if (result.url && result.verification_id) {
                setVerificationId(result.verification_id);
                
                if (Platform.OS === 'web') {
                    // On web, redirect the current window to DigiLocker
                    window.location.href = result.url;
                } else {
                    // On mobile, open in in-app browser — closes when done
                    await WebBrowser.openBrowserAsync(result.url);
                    // After browser closes, prompt user to check status
                }
            } else {
                throw new Error("Failed to generate verification URL");
            }
        } catch (error) {
            console.error("Verification start error:", error);
            showAlert('Error', 'Could not start verification: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Updated to accept optional id parameter for auto-check
    const handleCheckCompletion = async (explicitId = null) => {
        // Prevent React Native synthetic event from being used as the ID
        const idToCheck = (typeof explicitId === 'string' ? explicitId : null) || verificationId;
        
        if (!idToCheck) {
            showAlert('Wait', 'Please start the verification first.');
            return;
        }

        setVerifying(true);
        try {
            const result = await finalizeAadhaarVerification(idToCheck);
            if (result.success) {
                setIsVerified(true);
                // Refresh status to get the name from Firestore
                const status = await getVerificationStatus();
                setVerifiedName(status.aadhaarName);
                
                showAlert('Success', 'Aadhaar verified successfully!', [
                    {
                        text: 'Perfect',
                        onPress: () => {
                            if (onVerified) onVerified('aadhaar');
                            navigation.navigate('Tabs', { screen: 'Home' });
                        }
                    }
                ]);
            } else {
                showAlert('Pending', 'Verification is not yet complete. Please finish the steps in the DigiLocker window.');
            }
        } catch (error) {
            showAlert('Error', 'Failed to check status: ' + error.message);
        } finally {
            setVerifying(false);
        }
    };

    if (statusLoading) {
        return (
            <ScreenWrapper edges={['top', 'bottom']}>
                <View style={styles.center}>
                    <Typography variant="body">Checking status...</Typography>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Typography variant="h1">Verify Identity</Typography>
                    <Typography variant="body" style={styles.subtitle}>
                        Secure Government-backed verification via DigiLocker
                    </Typography>
                </View>

                {isVerified ? (
                    <NotionCard style={styles.successCard}>
                        <View style={styles.iconContainer}>
                            <Typography style={{ fontSize: 40 }}>✅</Typography>
                        </View>
                        <Typography variant="h2" style={styles.verifiedName}>{verifiedName || "Verified User"}</Typography>
                        <Typography variant="body" style={styles.verifiedText}>
                            Your Aadhaar has been verified successfully.
                        </Typography>
                        <AntigravityButton 
                            title="Done" 
                            onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} 
                            style={{ marginTop: SPACING.l, width: '100%' }}
                        />
                    </NotionCard>
                ) : (
                    <View>
                        <NotionCard style={styles.infoCard}>
                            <Typography variant="body" style={styles.infoTitle}>How it works:</Typography>
                            <View style={styles.step}>
                                <Typography variant="body" style={styles.stepNumber}>1</Typography>
                                <Typography variant="body" style={styles.stepText}>Tap the button below to open DigiLocker</Typography>
                            </View>
                            <View style={styles.step}>
                                <Typography variant="body" style={styles.stepNumber}>2</Typography>
                                <Typography variant="body" style={styles.stepText}>Log in with your Aadhaar number and OTP</Typography>
                            </View>
                            <View style={styles.step}>
                                <Typography variant="body" style={styles.stepNumber}>3</Typography>
                                <Typography variant="body" style={styles.stepText}>Grant consent to share your Aadhaar details</Typography>
                            </View>
                        </NotionCard>

                        <AntigravityButton
                            title={loading ? "Generating Link..." : "Verify with DigiLocker"}
                            onPress={handleStartVerification}
                            disabled={loading || verifying}
                            style={styles.mainButton}
                        />

                        {verificationId && (
                            <AntigravityButton
                                title={verifying ? "Checking..." : "I have completed verification"}
                                variant="secondary"
                                onPress={handleCheckCompletion}
                                disabled={loading || verifying}
                                style={styles.checkButton}
                            />
                        )}

                        <Typography variant="caption" style={styles.disclaimer}>
                            🔒 Croww uses Cashfree Secure ID for bank-grade security. We do not store your Aadhaar number or credentials.
                        </Typography>
                    </View>
                )}

                {!isVerified && (
                    <AntigravityButton
                        title="Cancel"
                        variant="secondary"
                        onPress={() => navigation.goBack()}
                        style={styles.cancelButton}
                    />
                )}
            </ScrollView>

            {verifying && (
                <View style={styles.overlay}>
                    <View style={styles.overlayCard}>
                        <Typography variant="h3">Verifying...</Typography>
                        <Typography variant="body" style={styles.overlayText}>
                            Syncing with government servers.
                        </Typography>
                    </View>
                </View>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: SPACING.m,
        flexGrow: 1,
    },
    header: {
        marginTop: SPACING.xl,
        marginBottom: SPACING.xl,
    },
    subtitle: {
        color: COLORS.secondary,
        marginTop: SPACING.s,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoCard: {
        padding: SPACING.l,
        marginBottom: SPACING.xl,
    },
    infoTitle: {
        fontWeight: '700',
        marginBottom: SPACING.m,
        color: COLORS.primary,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.accent,
        color: '#FFF',
        textAlign: 'center',
        lineHeight: 28,
        marginRight: SPACING.m,
        fontWeight: 'bold',
    },
    stepText: {
        flex: 1,
        color: COLORS.secondary,
    },
    mainButton: {
        height: 56,
        marginBottom: SPACING.m,
    },
    checkButton: {
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    cancelButton: {
        marginTop: 'auto',
        marginBottom: SPACING.xl,
        borderWidth: 0,
    },
    disclaimer: {
        textAlign: 'center',
        color: COLORS.secondary,
        marginTop: SPACING.l,
        paddingHorizontal: SPACING.l,
        lineHeight: 18,
    },
    successCard: {
        padding: SPACING.xl,
        alignItems: 'center',
        borderColor: '#4CAF50',
        borderWidth: 1,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4CAF5020',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    verifiedName: {
        marginBottom: SPACING.s,
    },
    verifiedText: {
        color: COLORS.secondary,
        textAlign: 'center',
        marginBottom: SPACING.l,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    overlayCard: {
        backgroundColor: COLORS.surface,
        padding: SPACING.xl,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
        width: '80%',
    },
    overlayText: {
        color: COLORS.secondary,
        marginTop: SPACING.s,
    }
});

export default VerifyIdentityScreen;
