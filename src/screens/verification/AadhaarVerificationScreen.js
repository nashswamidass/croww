import React, { useState, useEffect } from 'react';
import { Platform, View, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView } from 'react-native';

// LottieView may crash on web — safely import with fallback
let LottieView = null;
try {
    LottieView = require('lottie-react-native').default || require('lottie-react-native');
} catch (e) {
    console.warn('LottieView not available:', e.message);
}
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { finalizeAadhaarVerification, initiateAadhaarOTP, verifyAadhaarOTP, getVerificationStatus } from '../../services/verificationService';
import { showAlert } from '../../utils/showAlert';

// Resolve DigiLocker SDK OUTSIDE the component to avoid Rules of Hooks violation
let digiLockerVerifyFn = null;
if (Platform.OS !== 'web') {
    try {
        // The SDK's verify function is obtained without calling a hook
        const DigiLockerSDK = require('@cashfreepayments/react-native-digilocker');
        if (DigiLockerSDK && DigiLockerSDK.verify) {
            digiLockerVerifyFn = DigiLockerSDK.verify;
        }
    } catch (e) {
        console.warn('DigiLocker SDK not available:', e.message);
    }
}

const AadhaarVerificationScreen = ({ navigation, route }) => {
    const { onVerified } = route.params || {};

    // Verification Status
    const [isVerified, setIsVerified] = useState(false);
    const [verifiedName, setVerifiedName] = useState('');
    const [statusLoading, setStatusLoading] = useState(true);

    // States for DigiLocker flow
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);

    // States for Integrated OTP flow
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [otpLevel, setOtpLevel] = useState(0); // 0: Aadhaar input, 1: OTP input
    const [refId, setRefId] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);

    const verify = digiLockerVerifyFn;

    // Fetch status on mount
    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
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

    // Handle return from DigiLocker (Web redirect return)
    React.useEffect(() => {
        const verificationId = route.params?.verification_id;
        if (verificationId) {
            handleFinalize(verificationId);
            // Clear params to prevent re-triggering
            navigation.setParams({ verification_id: null });
        }
    }, [route.params?.verification_id]);

    const handleFinalize = async (verificationId) => {
        setVerifying(true);
        try {
            const result = await finalizeAadhaarVerification(verificationId);
            if (result.success) {
                // Fetch full status to get name
                await checkStatus();
                showAlert('Success', 'Aadhaar verified successfully!', [
                    {
                        text: 'Awesome',
                        onPress: () => {
                            if (onVerified) onVerified('aadhaar');
                            navigation.goBack();
                        }
                    }
                ]);
            } else {
                showAlert('Verification Failed', result.message || 'Verification could not be completed.');
            }
        } catch (err) {
            showAlert('Error', 'Failed to finalize verification: ' + err.message);
        } finally {
            setVerifying(false);
        }
    };


    const handleSendOTP = async () => {
        if (aadhaarNumber.length !== 12) {
            showAlert('Wait', 'Please enter a valid 12-digit Aadhaar number.');
            return;
        }

        setOtpLoading(true);
        try {
            const result = await initiateAadhaarOTP(aadhaarNumber);
            if (result.ref_id) {
                setRefId(result.ref_id);
                setOtpLevel(1);
                showAlert('OTP Sent', 'An OTP has been sent to your Aadhaar-linked mobile number.');
            } else {
                throw new Error(result.message || "Failed to send OTP");
            }
        } catch (error) {
            showAlert('Error', error.message || 'Could not send OTP. Try DigiLocker.');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp || otp.length < 6) {
            showAlert('Wait', 'Please enter the 6-digit OTP.');
            return;
        }

        setOtpLoading(true);
        try {
            const result = await verifyAadhaarOTP(refId, otp);
            if (result.success) {
                setVerifiedName(result.data?.full_name || '');
                setIsVerified(true);

                showAlert('Verified!', 'Your Aadhaar has been verified successfully.', [
                    {
                        text: 'Great',
                        onPress: () => {
                            if (onVerified) onVerified('aadhaar');
                            navigation.goBack();
                        }
                    }
                ]);
            } else {
                throw new Error(result.message || "OTP verification failed");
            }
        } catch (error) {
            showAlert('Verification Error', error.message);
        } finally {
            setOtpLoading(false);
        }
    };

    if (statusLoading) {
        return (
            <ScreenWrapper edges={['top', 'bottom']}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="body">Checking status...</Typography>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.header}>
                        <Typography variant="h1">Aadhaar Verification</Typography>
                        <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                            Fast, secure and 100% digital verification
                        </Typography>
                    </View>

                    {isVerified ? (
                        <NotionCard style={[styles.inputCard, { borderColor: '#4CAF50', borderWidth: 2 }]}>
                            <View style={{ alignItems: 'center', padding: SPACING.m }}>
                                <View style={styles.verifiedBadge}>
                                    <Typography variant="small" style={{ color: '#fff', fontWeight: 'bold' }}>VERIFIED</Typography>
                                </View>
                                <View style={styles.successAnimationContainer}>
                                    {LottieView ? (
                                        <LottieView
                                            source={{ uri: 'https://lottie.host/8e200780-d668-450f-aed3-42e742cc67f4/7eHk4pWpE2.json' }}
                                            style={styles.successLottie}
                                            autoPlay
                                            loop={false}
                                        />
                                    ) : (
                                        <View style={[styles.successLottie, { justifyContent: 'center', alignItems: 'center' }]}>
                                            <Typography variant="h1">✅</Typography>
                                        </View>
                                    )}
                                </View>
                                <Typography variant="h2" style={{ marginTop: SPACING.m }}>{verifiedName || "Verified User"}</Typography>
                                <Typography variant="body" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                    Aadhaar verification complete
                                </Typography>
                            </View>
                        </NotionCard>
                    ) : (
                        <>
                            {otpLevel === 0 ? (
                                <NotionCard style={styles.inputCard}>
                                    <Typography variant="body" style={styles.label}>Enter Aadhaar Number</Typography>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="1234 5678 9012"
                                        placeholderTextColor={COLORS.secondary}
                                        keyboardType="numeric"
                                        maxLength={12}
                                        value={aadhaarNumber}
                                        onChangeText={setAadhaarNumber}
                                    />
                                    <AntigravityButton
                                        title={otpLoading ? "Sending OTP..." : "Get OTP"}
                                        onPress={handleSendOTP}
                                        disabled={otpLoading || aadhaarNumber.length !== 12}
                                        style={{ marginTop: SPACING.m }}
                                    />
                                </NotionCard>
                            ) : (
                                <NotionCard style={styles.inputCard}>
                                    <Typography variant="body" style={styles.label}>Enter 6-digit OTP</Typography>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="111000"
                                        placeholderTextColor={COLORS.secondary}
                                        keyboardType="numeric"
                                        maxLength={6}
                                        value={otp}
                                        onChangeText={setOtp}
                                    />
                                    <AntigravityButton
                                        title={otpLoading ? "Verifying..." : "Verify OTP"}
                                        onPress={handleVerifyOTP}
                                        disabled={otpLoading || otp.length < 6}
                                        style={{ marginTop: SPACING.m }}
                                    />
                                    <AntigravityButton
                                        title="Change Number"
                                        variant="secondary"
                                        onPress={() => setOtpLevel(0)}
                                        style={{ marginTop: SPACING.s, borderWidth: 0 }}
                                    />
                                </NotionCard>
                            )}


                        </>
                    )}

                    <Typography variant="caption" style={styles.disclaimer}>
                        🔒 Your details are encrypted and secure. We do not store your Aadhaar number.
                    </Typography>

                    <AntigravityButton
                        title={isVerified ? "Done" : "Cancel"}
                        variant="secondary"
                        onPress={() => navigation.goBack()}
                        style={styles.cancelButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Verifying Overlay */}
            {verifying && (
                <View style={styles.overlay}>
                    <View style={styles.verifyingCard}>
                        <Typography variant="h3">Completing Verification...</Typography>
                        <Typography variant="body" style={{ color: COLORS.secondary, marginTop: 10, textAlign: 'center' }}>
                            Double-checking details with the government servers.
                        </Typography>
                        <View style={{ marginTop: 24 }}>
                            <AntigravityButton title="Please wait..." disabled />
                        </View>
                    </View>
                </View>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 9999,
    },
    verifyingCard: {
        backgroundColor: COLORS.surface,
        padding: 40,
        borderRadius: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...Platform.select({
            web: {
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            }
        })
    },
    content: {
        padding: SPACING.m,
        paddingBottom: 60,
    },
    header: {
        marginBottom: SPACING.l,
        marginTop: SPACING.m,
    },
    inputCard: {
        marginBottom: SPACING.m,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    label: {
        marginBottom: SPACING.s,
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    input: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.s,
        padding: SPACING.m,
        color: COLORS.primary,
        fontSize: 18,
        letterSpacing: 2,
        fontWeight: 'bold',
        borderWidth: 1,
        borderColor: COLORS.border,
        textAlign: 'center',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.l,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        marginHorizontal: SPACING.m,
        color: COLORS.secondary,
        fontWeight: '700',
        fontSize: 11,
    },
    button: {
        marginBottom: SPACING.m,
    },
    cancelButton: {
        marginTop: SPACING.l,
        borderWidth: 0,
    },
    verifiedBadge: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 12,
    },
    disclaimer: {
        color: COLORS.secondary,
        textAlign: 'center',
        marginTop: SPACING.m,
        paddingHorizontal: SPACING.m,
        lineHeight: 16,
        fontSize: 11,
    },
    successAnimationContainer: {
        width: 80,
        height: 80,
        marginVertical: SPACING.s,
    },
    successLottie: {
        width: '100%',
        height: '100%',
    },
});

export default AadhaarVerificationScreen;
