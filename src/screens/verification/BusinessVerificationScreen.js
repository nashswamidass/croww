import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import ImagePickerButton from '../../components/ImagePickerButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { submitBusinessVerification } from '../../services/verificationService';

const BusinessVerificationScreen = ({ navigation, route }) => {
    const { onVerified } = route.params || {};

    const [businessName, setBusinessName] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [documentImage, setDocumentImage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!businessName || !registrationNumber) {
            Alert.alert('Missing Information', 'Please fill in all required fields');
            return;
        }

        if (!documentImage) {
            Alert.alert('Document Required', 'Please upload your business registration document');
            return;
        }

        setLoading(true);

        const businessData = {
            businessName,
            registrationNumber,
            documentUri: documentImage,
            submittedAt: new Date().toISOString()
        };

        const result = await submitBusinessVerification(businessData);
        setLoading(false);

        if (result.success) {
            Alert.alert(
                'Submitted Successfully',
                `Your business verification has been submitted for review.\n\nVerification ID: ${result.verificationId}\n\nYou'll be notified once approved (typically 1-2 business days).`,
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            if (onVerified) onVerified('business');
                            navigation.goBack();
                        }
                    }
                ]
            );
        } else {
            Alert.alert('Error', result.message);
        }
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Typography variant="h1">Business Verification</Typography>
                    <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                        Verify your business to create public events
                    </Typography>
                </View>

                <NotionCard style={styles.infoCard}>
                    <Typography variant="small" style={{ color: COLORS.secondary }}>
                        📋 Required Documents:
                    </Typography>
                    <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 4 }}>
                        • Business Registration Certificate{'\n'}
                        • GST Certificate{'\n'}
                        • Trade License{'\n'}
                        (Any one of the above)
                    </Typography>
                </NotionCard>

                <View style={styles.inputContainer}>
                    <Typography variant="body" style={styles.label}>Business Name *</Typography>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your registered business name"
                        placeholderTextColor={COLORS.secondary}
                        value={businessName}
                        onChangeText={setBusinessName}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Typography variant="body" style={styles.label}>Registration Number *</Typography>
                    <TextInput
                        style={styles.input}
                        placeholder="CIN/GST/Trade License Number"
                        placeholderTextColor={COLORS.secondary}
                        value={registrationNumber}
                        onChangeText={setRegistrationNumber}
                    />
                </View>

                <ImagePickerButton
                    onImageSelected={setDocumentImage}
                    currentImage={documentImage}
                />

                <NotionCard style={[styles.infoCard, { backgroundColor: COLORS.accent + '20' }]}>
                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                        ⏱️ Verification typically takes 1-2 business days. You'll receive a notification once approved.
                    </Typography>
                </NotionCard>

                <NotionButton
                    title={loading ? "Submitting..." : "Submit for Review"}
                    onPress={handleSubmit}
                    disabled={loading}
                    style={styles.button}
                />

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
        marginTop: SPACING.l,
    },
    cancelButton: {
        marginTop: SPACING.m,
        borderWidth: 0,
    },
});

export default BusinessVerificationScreen;
