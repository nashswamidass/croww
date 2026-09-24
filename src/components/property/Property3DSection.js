import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import AntigravityButton from '../AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { property3DService } from '../../services/property';
import Property3DViewer from './Property3DViewer';

const Property3DSection = ({
    propertyId,
    listingId,
    spatialTourAvailable = false,
    posterUrl,
    canManage = false,
    onAddTour,
    onViewPhotos,
}) => {
    const [tour, setTour] = useState(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // Phase 13: If spatialTourAvailable is false AND user is not the owner:
        // DO NOT perform the spatial media query. Zero Firestore queries.
        if (!spatialTourAvailable && !canManage) {
            setTour(null);
            return;
        }

        if (!spatialTourAvailable && canManage) {
            // Owner viewing their listing without an active tour
            setTour({ available: false });
            return;
        }

        // spatialTourAvailable is true -> fetch descriptor (cached in memory)
        let cancelled = false;
        property3DService.getPublicReadyAsset({ propertyId, listingId, posterUrl })
            .then((next) => { if (!cancelled) setTour(next); })
            .catch(() => { if (!cancelled) setTour({ available: false }); });
        return () => { cancelled = true; };
    }, [propertyId, listingId, spatialTourAvailable, canManage, posterUrl]);

    // Phase 14: If unavailable for a consumer: simply omit the section entirely!
    if (!spatialTourAvailable && !canManage) {
        return null;
    }

    if (tour?.available) {
        const descriptor = property3DService.toViewerDescriptor(tour);
        const resolvedPoster = descriptor?.posterUrl || posterUrl;

        return (
            <View style={styles.section} accessibilityLabel="Spatial Walkthrough">
                <Typography variant="h3" style={styles.title}>Spatial Walkthrough</Typography>
                <Typography variant="caption" style={styles.supportingCopy}>
                    Explore the space before you visit.
                </Typography>

                {resolvedPoster ? (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setOpen(true)}
                        style={styles.posterContainer}
                        accessibilityRole="button"
                        accessibilityLabel="Open Spatial Walkthrough"
                    >
                        <Image source={{ uri: resolvedPoster }} style={styles.posterImage} />
                        <View style={styles.posterOverlay}>
                            <View style={styles.playBadge}>
                                <Ionicons name="scan-outline" size={28} color={COLORS.white} />
                            </View>
                            <Typography variant="caption" style={styles.posterBadgeText}>
                                Interactive 3D
                            </Typography>
                        </View>
                    </TouchableOpacity>
                ) : null}

                <View style={styles.btnRow}>
                    <AntigravityButton
                        title="View Spatial Walkthrough"
                        onPress={() => setOpen(true)}
                        accessibilityLabel="View Spatial Walkthrough"
                    />
                </View>

                <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
                    <View style={styles.modal}>
                        <TouchableOpacity
                            onPress={() => setOpen(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Close Walkthrough"
                            style={styles.closeBtn}
                        >
                            <Ionicons name="close" size={24} color={COLORS.primary} />
                            <Typography variant="body" style={styles.link}>Close</Typography>
                        </TouchableOpacity>
                        <Property3DViewer
                            descriptor={descriptor}
                            onClose={() => setOpen(false)}
                            onViewPhotos={() => {
                                setOpen(false);
                                if (onViewPhotos) onViewPhotos();
                            }}
                        />
                    </View>
                </Modal>
            </View>
        );
    }

    // Owner management state when spatialTourAvailable is false
    if (canManage && onAddTour) {
        return (
            <View style={styles.section} accessibilityLabel="Spatial Walkthrough Management">
                <Typography variant="h3" style={styles.title}>Spatial Walkthrough</Typography>
                <View style={styles.manageCard}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="videocam-outline" size={24} color={COLORS.accent} />
                    </View>
                    <View style={styles.cardContent}>
                        <Typography variant="body" style={styles.cardTitle}>
                            No Spatial Walkthrough yet
                        </Typography>
                        <Typography variant="caption" style={styles.cardSubtitle}>
                            Record or upload a walkthrough so buyers can explore in 3D.
                        </Typography>
                    </View>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={onAddTour}
                        accessibilityRole="button"
                        accessibilityLabel="Add Spatial Walkthrough"
                    >
                        <Typography variant="caption" style={styles.addBtnText}>Add Walkthrough</Typography>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    section: { paddingHorizontal: SPACING.l, paddingTop: SPACING.m },
    title: { marginBottom: 2 },
    supportingCopy: { color: COLORS.secondary, marginBottom: SPACING.m },
    posterContainer: {
        width: '100%',
        height: 180,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    posterImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    posterOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    posterBadgeText: {
        color: COLORS.white,
        marginTop: 6,
        fontWeight: '600',
    },
    btnRow: { width: '100%' },
    manageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.m,
        gap: SPACING.m,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardContent: { flex: 1 },
    cardTitle: { fontWeight: '600', color: COLORS.primary, fontSize: 14 },
    cardSubtitle: { color: COLORS.secondary, marginTop: 2 },
    addBtn: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    addBtnText: { color: COLORS.accent, fontWeight: '600' },
    modal: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.xl },
    closeBtn: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, gap: 4 },
    link: { color: COLORS.accent, fontWeight: '600' },
});

export default Property3DSection;
