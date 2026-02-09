import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { sendAadhaarOTP, verifyAadhaarOTP } from '../../services/verificationService';

const AadhaarVerificationScreen = ({ navigation, route }) => {
    const { onVerified } = route.params || {};

    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mockOTP, setMockOTP] = useState(''); // For demo purposes

    const formatAadhaar = (text) => {
        // Remove non-digits
        const cleaned = text.replace(/\D/g, '');
        // Limit to 12 digits
        const limited = cleaned.slice(0, 12);
        // Format as XXXX XXXX XXXX
        return limited.replace(/(\d{4})(?=\d)/g, '$1 ');
    };

    const handleSendOTP = async () => {
        if (aadhaarNumber.replace(/\s/g, '').length !== 12) {
            Alert.alert('Invalid Aadhaar', 'Please enter a valid 12-digit Aadhaar number');
            return;
        }

        setLoading(true);
        const result = await sendAadhaarOTP(aadhaarNumber);
        setLoading(false);

        if (result.success) {
            setOtpSent(true);
            setMockOTP(result.otp); // For demo - show OTP
            Alert.alert('OTP Sent', `OTP: ${result.otp}\n\n(In production, this would be sent via SMS)`);
        } else {
            Alert.alert('Error', result.message);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP');
            return;
        }

        setLoading(true);
        const result = await verifyAadhaarOTP(aadhaarNumber, otp);
        setLoading(false);

        if (result.success) {
            Alert.alert('Success', result.message, [
                {
                    text: 'OK',
                    onPress: () => {
                        if (onVerified) onVerified('aadhaar');
                        navigation.goBack();
                    }
                }
            ]);
        } else {
            Alert.alert('Verification Failed', result.message);
        }
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Typography variant="h1">Aadhaar Verification</Typography>
                    <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                        Verify your identity using Aadhaar OTP
                    </Typography>
                </View>

                <NotionCard style={styles.infoCard}>
                    <Typography variant="small" style={{ color: COLORS.secondary }}>
                        🔒 Your Aadhaar details are secure and will only be used for verification purposes.
                    </Typography>
                </NotionCard>

                <View style={styles.inputContainer}>
                    <Typography variant="body" style={styles.label}>Aadhaar Number</Typography>
                    <TextInput
                        style={styles.input}
                        placeholder="XXXX XXXX XXXX"
                        placeholderTextColor={COLORS.secondary}
                        value={aadhaarNumber}
                        onChangeText={(text) => setAadhaarNumber(formatAadhaar(text))}
                        keyboardType="number-pad"
                        maxLength={14} // 12 digits + 2 spaces
                        editable={!otpSent}
                    />
                </View>

                {!otpSent ? (
                    <NotionButton
                        title={loading ? "Sending..." : "Send OTP"}
                        onPress={handleSendOTP}
                        disabled={loading}
                        style={styles.button}
                    />
                ) : (
                    <>
                        {mockOTP && (
                            <NotionCard style={[styles.infoCard, { backgroundColor: COLORS.success + '20' }]}>
                                <Typography variant="small" style={{ color: COLORS.success }}>
                                    📱 Demo OTP: {mockOTP}
                                </Typography>
                                <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                    (In production, this would be sent via SMS)
                                </Typography>
                            </NotionCard>
                        )}

                        <View style={styles.inputContainer}>
                            <Typography variant="body" style={styles.label}>Enter OTP</Typography>
                            <TextInput
                                style={styles.input}
                                placeholder="000000"
                                placeholderTextColor={COLORS.secondary}
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                        </View>

                        <NotionButton
                            title={loading ? "Verifying..." : "Verify OTP"}
                            onPress={handleVerifyOTP}
                            disabled={loading}
                            style={styles.button}
                        />

                        <NotionButton
                            title="Resend OTP"
                            variant="secondary"
                            onPress={handleSendOTP}
                            disabled={loading}
                            style={styles.secondaryButton}
                        />
                    </>
                )}

                <NotionButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => navigation.goBack()}
                    style={styles.cancelButton}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: SPACING.m,
    },
    header: {
        marginBottom: SPACING.l,
        marginTop: SPACING.l,
    },
    infoCard: {
        marginBottom: SPACING.l,
        padding: SPACING.m,
    },
    inputContainer: {
        marginBottom: SPACING.l,
    },
    label: {
        marginBottom: SPACING.s,
        color: COLORS.primary,
        fontWeight: '600',
    },
    input: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.s,
        padding: SPACING.m,
        color: COLORS.primary,
        fontSize: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    button: {
        marginBottom: SPACING.m,
    },
    secondaryButton: {
        marginBottom: SPACING.m,
    },
    cancelButton: {
        marginTop: SPACING.l,
        borderWidth: 0,
    },
});

export default AadhaarVerificationScreen;
