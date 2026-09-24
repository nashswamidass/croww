import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { property3DService } from '../../services/property';
import { inventoryErrorMessage } from '../../domain/property';
import {
    evaluateCaptureQuality,
    SPATIAL_MAX_SOURCE_BYTES,
} from '../../domain/spatial';
import { showAlert } from '../../utils/showAlert';
import Property3DViewer from '../../components/property/Property3DViewer';

const SpatialTourScreen = ({ route, navigation }) => {
    const propertyId = route.params?.propertyId || null;
    const listingId = route.params?.listingId || null;
    const [assets, setAssets] = useState([]);
    const [busy, setBusy] = useState(false);
    const [busyStatus, setBusyStatus] = useState('');
    const [previewAsset, setPreviewAsset] = useState(null);

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

    // Focus listener to reload when coming back from SpatialCapture
    React.useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            load();
        });
        return unsubscribe;
    }, [navigation, load]);

    const handleRecordWalkthrough = () => {
        navigation.navigate('SpatialCapture', { propertyId, listingId });
    };

    const handleUploadWalkthroughVideo = async () => {
        setBusy(true);
        setBusyStatus('Selecting video…');
        try {
            const picked = await DocumentPicker.getDocumentAsync({
                type: ['video/mp4', 'video/quicktime', 'video/webm'],
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (picked.canceled) return;
            const file = picked.assets?.[0];
            if (!file) return;

            setBusyStatus('Checking walkthrough…');
            const quality = evaluateCaptureQuality({
                uri: file.uri,
                sizeBytes: file.size,
                mimeType: file.mimeType,
                name: file.name,
            });
            if (!quality.valid) {
                showAlert(
                    "We couldn't use this walkthrough",
                    quality.userFacingMessage || 'Please upload a valid walkthrough video.'
                );
                return;
            }

            setBusyStatus('Ready to process. Creating asset…');
            const created = await property3DService.createAsset({
                propertyId,
                listingId,
                captureProvider: 'EXTERNAL_CAMERA',
                captureType: 'VIDEO',
            });
            if (created.reused) {
                showAlert(
                    'Spatial Walkthrough',
                    'This property already has a ready Spatial Walkthrough. It was reused for this listing.'
                );
                await load();
                return;
            }

            setBusyStatus('Uploading walkthrough video…');
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

            setBusyStatus('Queueing reconstruction…');
            await property3DService.attachAsset({
                mediaId: created.mediaId,
                propertyId: created.propertyId || propertyId,
                listingId,
            });

            showAlert(
                'Spatial Walkthrough',
                'Walkthrough uploaded and queued. Creating your Spatial Walkthrough in the background.'
            );
            await load();
        } catch (error) {
            showAlert('Spatial Walkthrough', inventoryErrorMessage(error?.code, error?.message));
        } finally {
            setBusy(false);
            setBusyStatus('');
        }
    };

    const handleUpload3DModel = async () => {
        setBusy(true);
        setBusyStatus('Selecting 3D model…');
        try {
            const picked = await DocumentPicker.getDocumentAsync({
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (picked.canceled) return;
            const file = picked.assets?.[0];
            if (!file) return;
            if (file.size && file.size > SPATIAL_MAX_SOURCE_BYTES) {
                showAlert('Spatial Walkthrough', 'File exceeds the 512 MB source limit.');
                return;
            }

            setBusyStatus('Creating model asset…');
            const isGlb = /\.glb$/i.test(file.name || '');
            const created = await property3DService.createAsset({
                propertyId,
                listingId,
                intendedFormat: isGlb ? 'glb' : 'gaussian_splat',
                captureProvider: 'PROCESSED_UPLOAD',
                captureType: 'MODEL',
            });
            if (created.reused) {
                showAlert('Spatial Walkthrough', 'This property already has a ready Spatial Walkthrough. It was reused.');
                await load();
                return;
            }

            setBusyStatus('Uploading 3D model…');
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

            setBusyStatus('Queueing processing…');
            await property3DService.attachAsset({
                mediaId: created.mediaId,
                propertyId: created.propertyId || propertyId,
                listingId,
            });

            showAlert('Spatial Walkthrough', '3D model uploaded. Processing queued.');
            await load();
        } catch (error) {
            showAlert('Spatial Walkthrough', inventoryErrorMessage(error?.code, error?.message));
        } finally {
            setBusy(false);
            setBusyStatus('');
        }
    };

    const openPreview = async (assetRow) => {
        try {
            const readyTour = await property3DService.getPublicReadyAsset({
                propertyId: assetRow.propertyId || propertyId,
                listingId,
            });
            if (readyTour?.available) {
                setPreviewAsset(property3DService.toViewerDescriptor(readyTour));
            } else {
                showAlert('Spatial Walkthrough', 'Walkthrough is not yet available for preview.');
            }
        } catch {
            showAlert('Spatial Walkthrough', 'Could not open walkthrough preview.');
        }
    };

    const renderStageBadge = (stage) => {
        let label = 'Processing';
        if (stage === 'PREPARING') label = 'Preparing frames';
        else if (stage === 'POSE_ESTIMATION') label = 'Estimating camera poses';
        else if (stage === 'RECONSTRUCTING') label = 'Reconstructing scene';
        else if (stage === 'SPLATTING') label = 'Training splat';
        else if (stage === 'OPTIMIZING') label = 'Optimizing assets';
        else if (stage === 'FINALIZING') label = 'Finalizing';
        return label;
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={styles.title}>Spatial Walkthrough</Typography>
                <View style={styles.iconBtn} />
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <Typography variant="body" style={styles.muted}>
                    Create an immersive walkthrough of the property. Record with your phone, upload a walkthrough video, or upload a pre-built 3D model.
                </Typography>

                {/* Primary Action: Record Walkthrough with phone */}
                <View style={styles.actionCard}>
                    <View style={styles.actionIconBox}>
                        <Ionicons name="videocam" size={28} color={COLORS.accent} />
                    </View>
                    <View style={styles.actionTextCol}>
                        <Typography variant="body" style={styles.actionTitle}>Record Walkthrough</Typography>
                        <Typography variant="caption" style={styles.actionDesc}>
                            Walk through rooms slowly with your phone camera.
                        </Typography>
                    </View>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleRecordWalkthrough}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Record Walkthrough"
                    >
                        <Typography variant="caption" style={styles.actionBtnText}>Record</Typography>
                    </TouchableOpacity>
                </View>

                {/* Secondary Action: Upload Walkthrough Video */}
                <View style={styles.actionCard}>
                    <View style={styles.actionIconBox}>
                        <Ionicons name="cloud-upload-outline" size={28} color={COLORS.primary} />
                    </View>
                    <View style={styles.actionTextCol}>
                        <Typography variant="body" style={styles.actionTitle}>Upload Walkthrough Video</Typography>
                        <Typography variant="caption" style={styles.actionDesc}>
                            MP4, MOV, or WEBM up to 512 MB.
                        </Typography>
                    </View>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleUploadWalkthroughVideo}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Upload Walkthrough Video"
                    >
                        <Typography variant="caption" style={styles.actionBtnText}>Upload</Typography>
                    </TouchableOpacity>
                </View>

                {/* Tertiary Action: Upload 3D Model */}
                <View style={styles.actionCard}>
                    <View style={styles.actionIconBox}>
                        <Ionicons name="cube-outline" size={28} color={COLORS.secondary} />
                    </View>
                    <View style={styles.actionTextCol}>
                        <Typography variant="body" style={styles.actionTitle}>Upload 3D Model</Typography>
                        <Typography variant="caption" style={styles.actionDesc}>
                            GLB, GLTF, PLY, or SPLAT format.
                        </Typography>
                    </View>
                    <TouchableOpacity
                        style={styles.actionBtnSecondary}
                        onPress={handleUpload3DModel}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Upload 3D Model"
                    >
                        <Typography variant="caption" style={styles.actionBtnSecondaryText}>Browse</Typography>
                    </TouchableOpacity>
                </View>

                {busy ? (
                    <View style={styles.busyBox}>
                        <Typography variant="body" style={styles.busyText}>{busyStatus}</Typography>
                    </View>
                ) : null}

                {/* Existing Assets Section */}
                {assets.length > 0 ? (
                    <View style={styles.assetsSection}>
                        <Typography variant="h3" style={styles.sectionHeader}>Walkthrough Assets</Typography>
                        {assets.map((row) => (
                            <View key={row.id} style={styles.assetCard}>
                                <View style={styles.assetHeader}>
                                    <View style={styles.statusRow}>
                                        <Ionicons
                                            name={
                                                row.available
                                                    ? 'checkmark-circle'
                                                    : row.status === 'FAILED'
                                                    ? 'alert-circle'
                                                    : 'sync-circle'
                                            }
                                            size={20}
                                            color={
                                                row.available
                                                    ? COLORS.accent
                                                    : row.status === 'FAILED'
                                                    ? COLORS.error
                                                    : COLORS.secondary
                                            }
                                        />
                                        <Typography variant="body" style={styles.assetTitle}>
                                            {row.label}
                                        </Typography>
                                    </View>
                                    {row.status === 'PROCESSING' || row.status === 'UPLOADING' ? (
                                        <Typography variant="caption" style={styles.stageText}>
                                            {renderStageBadge(row.stage)}
                                        </Typography>
                                    ) : null}
                                </View>

                                <View style={styles.rowActions}>
                                    {row.available ? (
                                        <TouchableOpacity
                                            onPress={() => openPreview(row)}
                                            style={styles.previewBtn}
                                            accessibilityRole="button"
                                            accessibilityLabel="Preview Spatial Walkthrough"
                                        >
                                            <Ionicons name="eye-outline" size={16} color={COLORS.accent} />
                                            <Typography variant="caption" style={styles.link}>Preview</Typography>
                                        </TouchableOpacity>
                                    ) : null}

                                    {row.status === 'FAILED' ? (
                                        <TouchableOpacity
                                            onPress={() => property3DService.retryProcessing({
                                                mediaId: row.id,
                                                propertyId: row.propertyId,
                                                listingId,
                                                retryCount: row.retryCount,
                                            }).then(load).catch((error) => showAlert('Spatial Walkthrough', inventoryErrorMessage(error?.code, error?.message)))}
                                            accessibilityRole="button"
                                            accessibilityLabel="Retry Walkthrough"
                                            style={styles.retryBtn}
                                        >
                                            <Ionicons name="reload-outline" size={16} color={COLORS.accent} />
                                            <Typography variant="caption" style={styles.link}>Retry</Typography>
                                        </TouchableOpacity>
                                    ) : null}

                                    {row.status !== 'ARCHIVED' ? (
                                        <TouchableOpacity
                                            onPress={() => property3DService.archiveAsset(row.id).then(load)}
                                            accessibilityRole="button"
                                            accessibilityLabel="Archive asset"
                                            style={styles.archiveBtn}
                                        >
                                            <Ionicons name="archive-outline" size={16} color={COLORS.error} />
                                            <Typography variant="caption" style={styles.danger}>Archive</Typography>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                ) : null}
            </ScrollView>

            {/* Preview Modal */}
            <Modal visible={Boolean(previewAsset)} animationType="slide" onRequestClose={() => setPreviewAsset(null)}>
                <View style={styles.modal}>
                    <TouchableOpacity onPress={() => setPreviewAsset(null)} style={styles.modalCloseBtn} accessibilityRole="button" accessibilityLabel="Close Preview">
                        <Ionicons name="close" size={24} color={COLORS.primary} />
                        <Typography variant="body" style={styles.link}>Close</Typography>
                    </TouchableOpacity>
                    {previewAsset ? (
                        <Property3DViewer
                            descriptor={previewAsset}
                            onClose={() => setPreviewAsset(null)}
                        />
                    ) : null}
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.m, paddingTop: SPACING.s },
    title: { flex: 1, textAlign: 'center' },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    body: { padding: SPACING.l, paddingBottom: SPACING.xl },
    muted: { color: COLORS.secondary, marginBottom: SPACING.l },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: SPACING.m,
    },
    actionIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionTextCol: { flex: 1 },
    actionTitle: { fontWeight: '600', color: COLORS.primary },
    actionDesc: { color: COLORS.secondary, marginTop: 2, fontSize: 12 },
    actionBtn: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    actionBtnText: { color: COLORS.accent, fontWeight: '600' },
    actionBtnSecondary: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    actionBtnSecondaryText: { color: COLORS.secondary, fontWeight: '600' },
    busyBox: {
        padding: SPACING.m,
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.s,
        marginVertical: SPACING.m,
    },
    busyText: { color: COLORS.primary },
    assetsSection: { marginTop: SPACING.l },
    sectionHeader: { marginBottom: SPACING.m },
    assetCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    assetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    assetTitle: { fontWeight: '600', color: COLORS.primary },
    stageText: { color: COLORS.secondary },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.l,
        marginTop: SPACING.m,
        paddingTop: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    archiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    link: { color: COLORS.accent, fontWeight: '600' },
    danger: { color: COLORS.error, fontWeight: '600' },
    modal: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.xl },
    modalCloseBtn: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, gap: 4 },
});

export default SpatialTourScreen;
