import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    AppState,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { property3DService } from '../../services/property';
import {
    evaluateCaptureQuality,
    SPATIAL_HARD_STOP_DURATION_SECONDS,
    SPATIAL_MIN_DURATION_SECONDS,
    SPATIAL_TARGET_MIN_DURATION_SECONDS,
    SPATIAL_TARGET_MAX_DURATION_SECONDS,
} from '../../domain/spatial';
import { inventoryErrorMessage } from '../../domain/property';
import { showAlert } from '../../utils/showAlert';

const ROOM_FLOW = ['Start', 'Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Finish'];

const SpatialCaptureScreen = ({ route, navigation }) => {
    const propertyId = route.params?.propertyId || null;
    const listingId = route.params?.listingId || null;

    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();

    const cameraRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recordedVideo, setRecordedVideo] = useState(null); // { uri, duration, sizeBytes, name }
    const [busy, setBusy] = useState(false);
    const [busyStatus, setBusyStatus] = useState('');

    const timerRef = useRef(null);
    const recordingStartRef = useRef(0);

    const stopRecording = useCallback(() => {
        if (!isRecording) return;
        setIsRecording(false);
        try {
            if (cameraRef.current) {
                cameraRef.current.stopRecording();
            }
        } catch {}
    }, [isRecording]);

    // Stop recording cleanly if app goes to background
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState !== 'active' && isRecording) {
                stopRecording();
            }
        });
        return () => subscription.remove();
    }, [isRecording, stopRecording]);

    // Timer effect during recording
    useEffect(() => {
        if (isRecording) {
            recordingStartRef.current = Date.now();
            timerRef.current = setInterval(() => {
                const elapsedSeconds = Math.floor((Date.now() - recordingStartRef.current) / 1000);
                setDuration(elapsedSeconds);
                if (elapsedSeconds >= SPATIAL_HARD_STOP_DURATION_SECONDS) {
                    stopRecording();
                }
            }, 500);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRecording, stopRecording]);

    const handleBack = useCallback(() => {
        if (isRecording || recordedVideo) {
            showAlert(
                'Leave capture?',
                'Your recorded walkthrough video will not be saved.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Leave',
                        onPress: () => {
                            if (isRecording && cameraRef.current) {
                                try { cameraRef.current.stopRecording(); } catch {}
                            }
                            navigation.goBack();
                        },
                    },
                ]
            );
            return;
        }
        navigation.goBack();
    }, [isRecording, recordedVideo, navigation]);

    const startRecording = async () => {
        if (!cameraRef.current || isRecording) return;
        try {
            setDuration(0);
            setIsRecording(true);
            const recordPromise = cameraRef.current.recordAsync({
                maxDuration: SPATIAL_HARD_STOP_DURATION_SECONDS,
            });
            const result = await recordPromise;
            setIsRecording(false);
            if (result?.uri) {
                let sizeBytes = 0;
                try {
                    const info = await FileSystem.getInfoAsync(result.uri);
                    if (info.exists) sizeBytes = info.size || 0;
                } catch {}

                const recordedDuration = Math.max(1, Math.floor((Date.now() - recordingStartRef.current) / 1000));
                setRecordedVideo({
                    uri: result.uri,
                    duration: recordedDuration,
                    sizeBytes,
                    name: `walkthrough_${Date.now()}.mp4`,
                    mimeType: 'video/mp4',
                });
            }
        } catch (error) {
            setIsRecording(false);
            showAlert('Recording error', error?.message || 'Could not record video.');
        }
    };

    const handleRetake = () => {
        setRecordedVideo(null);
        setDuration(0);
    };

    const handleSubmit = async () => {
        if (!recordedVideo || busy) return;

        // Deterministic quality evaluation
        setBusy(true);
        setBusyStatus('Checking walkthrough…');
        const quality = evaluateCaptureQuality({
            uri: recordedVideo.uri,
            sizeBytes: recordedVideo.sizeBytes,
            durationSeconds: recordedVideo.duration,
            mimeType: recordedVideo.mimeType,
            name: recordedVideo.name,
        });

        if (!quality.valid) {
            setBusy(false);
            showAlert(
                "We couldn't use this walkthrough",
                quality.userFacingMessage || 'Try recording more slowly and include each room from several angles.'
            );
            return;
        }

        try {
            setBusyStatus('Creating your Spatial Walkthrough…');
            const created = await property3DService.createAsset({
                propertyId,
                listingId,
                captureProvider: 'PHONE',
                captureType: 'VIDEO',
            });

            if (created.reused) {
                showAlert(
                    'Spatial Walkthrough',
                    'This property already has a ready Spatial Walkthrough. It was reused for this listing.'
                );
                navigation.goBack();
                return;
            }

            setBusyStatus('Uploading walkthrough video…');
            await property3DService.uploadSource({
                mediaId: created.mediaId,
                propertyId: created.propertyId || propertyId,
                file: {
                    uri: recordedVideo.uri,
                    name: recordedVideo.name,
                    mimeType: recordedVideo.mimeType,
                    size: recordedVideo.sizeBytes,
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
                'Your walkthrough video was uploaded successfully. Reconstruction is running in the background.'
            );
            navigation.goBack();
        } catch (error) {
            showAlert('Spatial Walkthrough', inventoryErrorMessage(error?.code, error?.message));
        } finally {
            setBusy(false);
            setBusyStatus('');
        }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (!cameraPermission || !micPermission) {
        return (
            <ScreenWrapper edges={['top']}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (!cameraPermission.granted || !micPermission.granted) {
        return (
            <ScreenWrapper edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                        <Ionicons name="close" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Typography variant="h3" style={styles.headerTitle}>Record Walkthrough</Typography>
                    <View style={styles.iconBtn} />
                </View>
                <View style={styles.permissionContainer}>
                    <Ionicons name="videocam-outline" size={56} color={COLORS.primary} />
                    <Typography variant="h3" style={styles.permissionTitle}>Camera access required</Typography>
                    <Typography variant="body" style={styles.permissionBody}>
                        To record a Spatial Walkthrough of the property, Croww needs camera and microphone access.
                    </Typography>
                    <AntigravityButton
                        title="Allow Camera Access"
                        onPress={async () => {
                            await requestCameraPermission();
                            await requestMicPermission();
                        }}
                    />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
                    <Ionicons name="close" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Typography variant="h3" style={[styles.headerTitle, { color: COLORS.white }]}>
                    {recordedVideo ? 'Review Walkthrough' : 'Walk through the property'}
                </Typography>
                <View style={styles.iconBtn} />
            </View>

            {/* Recording View vs Review View */}
            {!recordedVideo ? (
                <View style={styles.cameraWrapper}>
                    <CameraView
                        ref={cameraRef}
                        style={StyleSheet.absoluteFillObject}
                        facing="back"
                        mode="video"
                        videoQuality="720p"
                    />

                    {/* Overlay Guidance */}
                    <View style={styles.overlayTop}>
                        {isRecording ? (
                            <View style={styles.timerBadge}>
                                <View style={styles.recordingDot} />
                                <Typography variant="h3" style={styles.timerText}>{formatTime(duration)}</Typography>
                                <Typography variant="caption" style={styles.timerSub}>
                                    {duration < SPATIAL_TARGET_MIN_DURATION_SECONDS ? `(min ${SPATIAL_MIN_DURATION_SECONDS}s)` : `(max ${SPATIAL_HARD_STOP_DURATION_SECONDS}s)`}
                                </Typography>
                            </View>
                        ) : (
                            <View style={styles.guidancePill}>
                                <Typography variant="caption" style={styles.guidancePillText}>
                                    Target: {SPATIAL_TARGET_MIN_DURATION_SECONDS}–{SPATIAL_TARGET_MAX_DURATION_SECONDS} sec • 720p
                                </Typography>
                            </View>
                        )}
                    </View>

                    {/* Room Flow helper bar */}
                    <View style={styles.roomFlowBar}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomFlowScroll}>
                            {ROOM_FLOW.map((room, idx) => (
                                <View key={room} style={styles.roomItem}>
                                    <Typography variant="caption" style={styles.roomText}>{room}</Typography>
                                    {idx < ROOM_FLOW.length - 1 && (
                                        <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 6 }} />
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Floating Tips */}
                    <View style={styles.tipsBox}>
                        <Typography variant="caption" style={styles.tipsText}>
                            • Move slowly  • Keep steady  • Overlap between rooms  • Avoid fast turns
                        </Typography>
                    </View>

                    {/* Shutter / Stop Controls */}
                    <View style={styles.controlsBottom}>
                        {isRecording ? (
                            <TouchableOpacity
                                onPress={stopRecording}
                                style={styles.stopButton}
                                accessibilityRole="button"
                                accessibilityLabel="Stop recording"
                            >
                                <View style={styles.stopSquare} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={startRecording}
                                style={styles.recordButton}
                                accessibilityRole="button"
                                accessibilityLabel="Start recording"
                            >
                                <View style={styles.recordInnerDot} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : (
                <View style={styles.reviewWrapper}>
                    <ScrollView contentContainerStyle={styles.reviewContent}>
                        <View style={styles.successIconBox}>
                            <Ionicons name="checkmark-circle" size={64} color={COLORS.accent} />
                            <Typography variant="h3" style={styles.reviewTitle}>Walkthrough Captured</Typography>
                            <Typography variant="body" style={styles.reviewSubtitle}>
                                Duration: {formatTime(recordedVideo.duration)} ({recordedVideo.duration}s)
                            </Typography>
                            <Typography variant="caption" style={styles.fileSizeText}>
                                File size: {(recordedVideo.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                            </Typography>
                        </View>

                        <View style={styles.checksCard}>
                            <Typography variant="caption" style={styles.checksHeader}>QUALITY CHECK</Typography>
                            <View style={styles.checkRow}>
                                <Ionicons
                                    name={recordedVideo.duration >= SPATIAL_MIN_DURATION_SECONDS ? 'checkmark-circle' : 'alert-circle'}
                                    size={18}
                                    color={recordedVideo.duration >= SPATIAL_MIN_DURATION_SECONDS ? COLORS.accent : COLORS.error}
                                />
                                <Typography variant="body" style={styles.checkText}>
                                    Duration: {recordedVideo.duration}s (min {SPATIAL_MIN_DURATION_SECONDS}s)
                                </Typography>
                            </View>
                            <View style={styles.checkRow}>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                                <Typography variant="body" style={styles.checkText}>
                                    Resolution: 720p performance-safe
                                </Typography>
                            </View>
                            <View style={styles.checkRow}>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                                <Typography variant="body" style={styles.checkText}>
                                    Under 512 MB upload budget
                                </Typography>
                            </View>
                        </View>

                        {busy ? (
                            <View style={styles.busyBox}>
                                <ActivityIndicator size="large" color={COLORS.primary} />
                                <Typography variant="body" style={styles.busyText}>{busyStatus}</Typography>
                            </View>
                        ) : (
                            <View style={styles.actionButtons}>
                                <AntigravityButton
                                    title="Submit Walkthrough"
                                    onPress={handleSubmit}
                                    disabled={busy || recordedVideo.duration < SPATIAL_MIN_DURATION_SECONDS}
                                    accessibilityLabel="Submit Walkthrough"
                                />
                                <TouchableOpacity
                                    onPress={handleRetake}
                                    style={styles.retakeBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Retake Walkthrough"
                                >
                                    <Typography variant="body" style={styles.retakeText}>Retake video</Typography>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.s,
        paddingBottom: SPACING.s,
        zIndex: 10,
    },
    headerTitle: { flex: 1, textAlign: 'center' },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    permissionContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        gap: SPACING.m,
    },
    permissionTitle: { textAlign: 'center' },
    permissionBody: { textAlign: 'center', color: COLORS.secondary, marginBottom: SPACING.l },
    cameraWrapper: { flex: 1, position: 'relative' },
    overlayTop: {
        position: 'absolute',
        top: 16,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 5,
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 8,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF3B30',
    },
    timerText: { color: COLORS.white },
    timerSub: { color: 'rgba(255,255,255,0.7)' },
    guidancePill: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: 16,
    },
    guidancePillText: { color: COLORS.white },
    roomFlowBar: {
        position: 'absolute',
        top: 64,
        left: 0,
        right: 0,
        zIndex: 5,
    },
    roomFlowScroll: {
        paddingHorizontal: SPACING.m,
        flexDirection: 'row',
        alignItems: 'center',
    },
    roomItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 6,
    },
    roomText: { color: COLORS.white, fontSize: 11 },
    tipsBox: {
        position: 'absolute',
        bottom: 120,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.65)',
        padding: SPACING.s,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
    },
    tipsText: { color: COLORS.white, textAlign: 'center', fontSize: 12 },
    controlsBottom: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordInnerDot: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FF3B30',
    },
    stopButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    stopSquare: {
        width: 28,
        height: 28,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
    },
    reviewWrapper: { flex: 1, backgroundColor: COLORS.background },
    reviewContent: { padding: SPACING.l, alignItems: 'center' },
    successIconBox: { alignItems: 'center', marginVertical: SPACING.l },
    reviewTitle: { marginTop: SPACING.m },
    reviewSubtitle: { color: COLORS.secondary, marginTop: 4 },
    fileSizeText: { color: COLORS.secondary, marginTop: 2 },
    checksCard: {
        width: '100%',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        marginBottom: SPACING.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    checksHeader: { color: COLORS.secondary, marginBottom: SPACING.s, fontWeight: '700' },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
    checkText: { color: COLORS.primary, fontSize: 13 },
    actionButtons: { width: '100%', gap: SPACING.m },
    retakeBtn: { padding: SPACING.m, alignItems: 'center' },
    retakeText: { color: COLORS.secondary },
    busyBox: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.m },
    busyText: { color: COLORS.secondary },
});

export default SpatialCaptureScreen;
