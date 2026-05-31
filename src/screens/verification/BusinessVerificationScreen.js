import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import MultiDocumentPicker from '../../components/MultiDocumentPicker';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { submitBusinessVerification } from '../../services/verificationService';
import { showAlert } from '../../utils/showAlert';

const BusinessVerificationScreen = ({ navigation, route }) => {
    const { onVerified } = route.params || {};

    const [businessName, setBusinessName] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!businessName.trim() || !registrationNumber.trim()) {
            showAlert('Missing Information', 'Please fill in all required fields.');
            return;
        }

        if (documents.length === 0) {
            showAlert('Documents Required', 'Please upload at least one business registration document.');
            return;
        }

        setLoading(true);

        const businessData = {
            businessName: businessName.trim(),
            registrationNumber: registrationNumber.trim(),
        };

        const result = await submitBusinessVerification(businessData, documents);
        setLoading(false);

        if (result.success) {
            showAlert(
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
            showAlert('Submission Failed', result.message || 'Failed to submit. Please try again.');
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
                        (Upload up to 3 documents — images or PDFs)
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
                        placeholder="CIN / GST / Trade License Number"
                        placeholderTextColor={COLORS.secondary}
                        value={registrationNumber}
                        onChangeText={setRegistrationNumber}
                        autoCapitalize="characters"
                    />
                </View>

                <MultiDocumentPicker
                    onDocumentsChange={setDocuments}
                    initialDocuments={documents}
                    maxDocuments={3}
                />

                <NotionCard style={[styles.infoCard, { backgroundColor: COLORS.accent + '15' }]}>
                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                        ⏱️ Verification typically takes 1–2 business days. You'll receive a notification once approved.
                    </Typography>
                </NotionCard>

                <AntigravityButton
                    title={loading ? 'Submitting...' : 'Submit for Review'}
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading}
                    style={styles.button}
                />

                <AntigravityButton
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
        paddingBottom: SPACING.xl,
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
