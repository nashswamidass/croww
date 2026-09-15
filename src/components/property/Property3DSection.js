import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import AntigravityButton from '../AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { property3DService } from '../../services/property';
import Property3DViewer from './Property3DViewer';

const Property3DSection = ({
    propertyId,
    listingId,
    posterUrl,
    canManage = false,
    onAddTour,
    onViewPhotos,
}) => {
    const [tour, setTour] = useState(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        property3DService.getPublicReadyAsset({ propertyId, listingId, posterUrl })
            .then((next) => { if (!cancelled) setTour(next); })
            .catch(() => { if (!cancelled) setTour({ available: false }); });
        return () => { cancelled = true; };
    }, [propertyId, listingId, posterUrl]);

    if (!tour) return null;

    const descriptor = property3DService.toViewerDescriptor(tour);

    return (
        <View style={styles.section} accessibilityLabel="3D tour">
            <Typography variant="h3">3D tour</Typography>
            {tour.available ? (
                <>
                    <Typography variant="caption" style={styles.muted}>
                        Optional walkthrough. This is not a verification badge.
                    </Typography>
                    <AntigravityButton
                        title="Open 3D tour"
                        variant="secondary"
                        onPress={() => setOpen(true)}
                        accessibilityLabel="Open 3D tour"
                    />
                </>
            ) : (
                <View style={styles.unavailableCard}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="cube-outline" size={24} color={COLORS.secondary} />
                    </View>
                    <View style={styles.cardContent}>
                        <Typography variant="body" style={styles.cardTitle}>
                            3D Tour unavailable for this property
                        </Typography>
                        <Typography variant="caption" style={styles.cardSubtitle}>
                            Photos and property facts remain available.
                        </Typography>
                    </View>
                    {canManage && onAddTour ? (
                        <TouchableOpacity
                            style={styles.addBtn}
                            onPress={onAddTour}
                            accessibilityRole="button"
                            accessibilityLabel="Add 3D tour"
                        >
                            <Typography variant="caption" style={styles.addBtnText}>Add tour</Typography>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}
            <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
                <View style={styles.modal}>
                    <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
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
};

const styles = StyleSheet.create({
    section: { paddingHorizontal: SPACING.l, paddingTop: SPACING.m },
    muted: { color: COLORS.secondary, marginVertical: SPACING.s },
    unavailableCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.m,
        marginTop: SPACING.s,
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
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontWeight: '600',
        color: COLORS.primary,
        fontSize: 14,
    },
    cardSubtitle: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    addBtn: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    addBtnText: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    modal: { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.xl },
    link: { color: COLORS.accent, padding: SPACING.l },
});

export default Property3DSection;
