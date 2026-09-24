import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const Property3DViewer = ({
    descriptor,
    onClose,
    onViewPhotos,
    onReset,
}) => {
    const [hasError, setHasError] = useState(false);
    const assetUrl = descriptor?.assetUrl || null;
    const posterUrl = descriptor?.posterUrl || null;

    useEffect(() => {
        const handleMessage = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data?.type === 'SPATIAL_VIEWER') {
                    if (data.action === 'close' && onClose) {
                        onClose();
                    } else if (data.action === 'error') {
                        setHasError(true);
                    }
                }
            } catch {}
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onClose]);

    if (!assetUrl || hasError) {
        return (
            <View style={styles.errorContainer}>
                {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={styles.errorPoster} />
                ) : (
                    <View style={styles.errorIconCircle}>
                        <Ionicons name="cube-outline" size={36} color={COLORS.secondary} />
                    </View>
                )}
                <Typography variant="h3" style={styles.errorTitle}>
                    {"Spatial Walkthrough isn't available on this device."}
                </Typography>
                <Typography variant="body" style={styles.errorBody}>
                    Photos and property facts remain available.
                </Typography>
                <View style={styles.controlsRow}>
                    {onViewPhotos ? (
                        <TouchableOpacity
                            onPress={onViewPhotos}
                            style={styles.actionBtn}
                            accessibilityRole="button"
                            accessibilityLabel="View Photos"
                        >
                            <Typography variant="caption" style={styles.actionBtnText}>View photos</Typography>
                        </TouchableOpacity>
                    ) : null}
                    {onClose ? (
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.actionBtnSecondary}
                            accessibilityRole="button"
                            accessibilityLabel="Close Walkthrough"
                        >
                            <Typography variant="caption" style={styles.actionBtnSecondaryText}>Close</Typography>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        );
    }

    const iframeSrc = `/spatial-viewer/index.html?assetUrl=${encodeURIComponent(assetUrl)}&posterUrl=${encodeURIComponent(posterUrl || '')}`;

    return (
        <View style={styles.container}>
            <iframe
                src={iframeSrc}
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#0b0f19',
                }}
                allow="fullscreen; xr-spatial-tracking"
                title="Spatial Walkthrough"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', height: '100%', backgroundColor: '#0b0f19' },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        backgroundColor: COLORS.background,
    },
    errorPoster: {
        width: '100%',
        maxWidth: 480,
        height: 220,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.l,
    },
    errorIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.m,
    },
    errorTitle: { textAlign: 'center', marginBottom: SPACING.s },
    errorBody: { textAlign: 'center', color: COLORS.secondary, marginBottom: SPACING.l },
    controlsRow: { flexDirection: 'row', gap: SPACING.m },
    actionBtn: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: 20,
    },
    actionBtnText: { color: COLORS.white, fontWeight: '600' },
    actionBtnSecondary: {
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: 20,
    },
    actionBtnSecondaryText: { color: COLORS.primary },
});

export default Property3DViewer;
