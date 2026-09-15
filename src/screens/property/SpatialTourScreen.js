import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING } from '../../constants/theme';
import { property3DService } from '../../services/property';
import { inventoryErrorMessage } from '../../domain/property';
import { SPATIAL_MAX_SOURCE_BYTES } from '../../domain/spatial';
import { showAlert } from '../../utils/showAlert';

const SpatialTourScreen = ({ route, navigation }) => {
    const propertyId = route.params?.propertyId || null;
    const listingId = route.params?.listingId || null;
    const [assets, setAssets] = useState([]);
    const [busy, setBusy] = useState(false);

    const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('InventoryDashboard'));

    const load = useCallback(async () => {
        try {
            const rows = await property3DService.listMyAssets({ propertyId });
            setAssets(rows);
        } catch {
            setAssets([]);
        }
    }, [propertyId]);

    React.useEffect(() => { load(); }, [load]);

    const submit = async () => {
        setBusy(true);
        try {
            const picked = await DocumentPicker.getDocumentAsync({
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (picked.canceled) return;
            const file = picked.assets?.[0];
            if (!file) return;
            if (file.size && file.size > SPATIAL_MAX_SOURCE_BYTES) {
                showAlert('3D tour', 'File exceeds the 512 MB 3D source limit.');
                return;
            }
            const created = await property3DService.createAsset({ propertyId, listingId });
            if (created.reused) {
                showAlert('3D tour', 'This property already has a READY 3D tour. It was reused for this listing.');
                await load();
                return;
            }
            await property3DService.uploadSource({
                mediaId: created.mediaId,
                propertyId: created.propertyId || propertyId,
                file: {
                    uri: file.uri,
                    name: file.name,
                    mimeType: file.mimeType,
                    size: file.size,
                },
            });
            await property3DService.attachAsset({
                mediaId: created.mediaId,
                propertyId: created.propertyId || propertyId,
                listingId,
            });
            showAlert('3D tour', 'Source uploaded and queued. Processing is not instant and is not approval.');
            await load();
        } catch (error) {
            showAlert('3D tour', inventoryErrorMessage(error?.code, error?.message));
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
                <Typography variant="h3" style={styles.title}>3D tour</Typography>
                <View style={styles.iconBtn} />
            </View>
            <ScrollView contentContainerStyle={styles.body}>
                <Typography variant="body" style={styles.muted}>
                    Optional. A 3D walkthrough is media, not verification. Capture on-device is not available yet — upload a source file. Croww will not mark it READY until processing finishes.
                </Typography>
                <AntigravityButton
                    title={busy ? 'Working…' : 'Upload 3D source'}
                    onPress={submit}
                    disabled={busy}
                    accessibilityLabel="Upload 3D source"
                />
                {assets.map((row) => (
                    <View key={row.id} style={styles.row}>
                        <Typography variant="body">{row.label}</Typography>
                        <View style={styles.rowActions}>
                            {row.status === 'FAILED' ? (
                                <TouchableOpacity
                                    onPress={() => property3DService.retryProcessing({
                                        mediaId: row.id,
                                        propertyId: row.propertyId,
                                        listingId,
                                        retryCount: row.retryCount,
                                    }).then(load).catch((error) => showAlert('3D tour', inventoryErrorMessage(error?.code, error?.message)))}
                                    accessibilityRole="button"
                                    accessibilityLabel="Retry 3D processing"
                                >
                                    <Typography variant="caption" style={styles.link}>Retry</Typography>
                                </TouchableOpacity>
                            ) : null}
                            {row.status !== 'ARCHIVED' ? (
                                <TouchableOpacity
                                    onPress={() => property3DService.archiveAsset(row.id).then(load)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Archive 3D asset"
                                >
                                    <Typography variant="caption" style={styles.danger}>Archive</Typography>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                ))}
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
    row: { marginTop: SPACING.m },
    rowActions: { flexDirection: 'row', gap: SPACING.m, marginTop: 4 },
    link: { color: COLORS.accent },
    danger: { color: COLORS.error },
});

export default SpatialTourScreen;
