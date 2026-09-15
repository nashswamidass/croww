import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import MultiDocumentPicker from '../../components/MultiDocumentPicker';
import { COLORS, SPACING } from '../../constants/theme';
import { propertyTrustService } from '../../services/property';
import { showAlert } from '../../utils/showAlert';

const TYPE_COPY = {
    OWNER: 'Owner account evidence',
    AGENT: 'Agent account evidence',
    BUILDER: 'Builder account evidence',
    OWNERSHIP: 'Ownership evidence for this property',
    PROPERTY: 'Property evidence',
    LOCATION: 'Location evidence',
    REPRESENTATION: 'Representation evidence for this listing',
};

const PROPERTY_TYPES = [
    { type: 'PROPERTY', evidenceType: 'PROPERTY_DOCUMENT', label: 'Property' },
    { type: 'OWNERSHIP', evidenceType: 'OWNERSHIP_DOCUMENT', label: 'Ownership' },
    { type: 'LOCATION', evidenceType: 'LOCATION_EVIDENCE', label: 'Location' },
];

const DEFAULT_EVIDENCE = {
    OWNER: 'OTHER',
    AGENT: 'OTHER',
    BUILDER: 'COMPANY_DOCUMENT',
    OWNERSHIP: 'OWNERSHIP_DOCUMENT',
    PROPERTY: 'PROPERTY_DOCUMENT',
    LOCATION: 'LOCATION_EVIDENCE',
    REPRESENTATION: 'AUTHORIZATION_DOCUMENT',
};

const SubmitVerificationScreen = ({ route, navigation }) => {
    const initialType = route.params?.type;
    const subjectId = route.params?.subjectId;
    const propertyId = route.params?.propertyId || null;
    const listingId = route.params?.listingId || null;
    const [type, setType] = useState(initialType);
    const [documents, setDocuments] = useState([]);
    const [busy, setBusy] = useState(false);
    const evidenceType = DEFAULT_EVIDENCE[type] || route.params?.evidenceType || 'OTHER';
    const showPropertyTypes = PROPERTY_TYPES.some((row) => row.type === initialType);
    const copy = useMemo(() => TYPE_COPY[type] || 'Verification evidence', [type]);

    const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TrustOverview'));

    const submit = async () => {
        if (!documents.length) {
            showAlert('Documents', 'Upload at least one document. Review is not instant.');
            return;
        }
        setBusy(true);
        try {
            await propertyTrustService.submit({
                type,
                subjectId,
                evidenceType,
                documents,
                propertyId,
                listingId,
            });
            showAlert(
                'Submitted for review',
                'Your evidence was submitted as pending. Croww will review it. This does not verify the listing yet.',
                [{ text: 'OK', onPress: goBack }]
            );
        } catch (error) {
            showAlert('Verification', error?.message || 'Could not submit verification.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={styles.title}>Submit verification</Typography>
                <View style={styles.iconBtn} />
            </View>
            <ScrollView contentContainerStyle={styles.body}>
                <Typography variant="body" style={styles.muted}>
                    {copy}. Documents stay private. Upload is not approval.
                </Typography>
                {showPropertyTypes ? (
                    <View style={styles.chips}>
                        {PROPERTY_TYPES.map((row) => (
                            <TouchableOpacity
                                key={row.type}
                                onPress={() => setType(row.type)}
                                style={[styles.chip, type === row.type && styles.chipOn]}
                                accessibilityRole="button"
                                accessibilityLabel={`Verify ${row.label}`}
                            >
                                <Typography variant="caption">{row.label}</Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : null}
                <MultiDocumentPicker
                    label="Private evidence"
                    maxDocuments={5}
                    onDocumentsChange={setDocuments}
                />
                <AntigravityButton
                    title={busy ? 'Submitting…' : 'Submit for review'}
                    onPress={submit}
                    disabled={busy}
                    accessibilityLabel="Submit verification for review"
                    style={styles.btn}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.m, paddingTop: SPACING.s },
    title: { flex: 1, textAlign: 'center' },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    body: { padding: SPACING.l, paddingBottom: SPACING.xl },
    muted: { color: COLORS.secondary, marginBottom: SPACING.m },
    chips: { flexDirection: 'row', gap: SPACING.s, marginBottom: SPACING.m },
    chip: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 999,
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
    },
    chipOn: { borderColor: COLORS.accent, backgroundColor: COLORS.surfaceHighlight },
    btn: { marginTop: SPACING.l },
});

export default SubmitVerificationScreen;
