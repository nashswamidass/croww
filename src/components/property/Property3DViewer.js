import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';

/**
 * Isolated 3D viewer shell. No Firestore, auth, or listing services.
 * Native V1: poster + accessible controls + photo fallback.
 * Gaussian Splat decoding is not bundled; do not claim rendering works.
 */
const Property3DViewer = ({
    descriptor,
    onClose,
    onViewPhotos,
    onReset,
}) => {
    const [resetNonce, setResetNonce] = useState(0);
    const assetUrl = descriptor?.assetUrl || null;
    const posterUrl = descriptor?.posterUrl || null;

    const title = useMemo(() => {
        if (!assetUrl) return '3D tour unavailable';
        return '3D unavailable on this device';
    }, [assetUrl]);

    const body = !assetUrl
        ? 'No READY 3D asset is attached to this listing.'
        : 'A compatible 3D renderer is not available in this app build. Photos remain available.';

    const reset = () => {
        setResetNonce((value) => value + 1);
        if (onReset) onReset();
    };

    return (
        <View style={styles.wrap} accessibilityLabel="3D property viewer">
            {posterUrl ? (
                <Image
                    key={resetNonce}
                    source={{ uri: posterUrl }}
                    style={styles.poster}
                    accessibilityLabel="3D tour poster"
                />
            ) : (
                <View style={styles.posterEmpty}>
                    <Ionicons name="cube-outline" size={36} color={COLORS.secondary} />
                </View>
            )}
            <Typography variant="h3" style={styles.title}>{title}</Typography>
            <Typography variant="body" style={styles.body}>{body}</Typography>
            <View style={styles.controls}>
                <TouchableOpacity onPress={reset} accessibilityRole="button" accessibilityLabel="Reset 3D view" style={styles.btn}>
                    <Typography variant="caption">Reset</Typography>
                </TouchableOpacity>
                {onViewPhotos ? (
                    <TouchableOpacity onPress={onViewPhotos} accessibilityRole="button" accessibilityLabel="View photos" style={styles.btn}>
                        <Typography variant="caption">View photos</Typography>
                    </TouchableOpacity>
                ) : null}
                {onClose ? (
                    <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close 3D viewer" style={styles.btn}>
                        <Typography variant="caption">Close</Typography>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { padding: SPACING.l, alignItems: 'center' },
    poster: { width: '100%', height: 180, borderRadius: 12, backgroundColor: COLORS.surfaceHighlight },
    posterEmpty: {
        width: '100%',
        height: 140,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { marginTop: SPACING.m, textAlign: 'center' },
    body: { marginTop: SPACING.s, color: COLORS.secondary, textAlign: 'center' },
    controls: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginTop: SPACING.l },
    btn: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 999,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
    },
});

export default Property3DViewer;
