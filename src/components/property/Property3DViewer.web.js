import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Typography from '../Typography';
import { COLORS, SPACING } from '../../constants/theme';
import { buildSpatialViewerHtml } from './threeD/viewerHtml';

/**
 * Web viewer experiment: iframe + WebGL detection.
 * Does not bundle a Gaussian Splat decoder.
 */
const Property3DViewer = ({ descriptor, onClose, onViewPhotos, onReset }) => {
    const [webgl, setWebgl] = useState(null);
    const html = useMemo(() => buildSpatialViewerHtml({
        assetUrl: descriptor?.assetUrl || '',
        posterUrl: descriptor?.posterUrl || '',
        assetFormat: descriptor?.assetFormat || 'gaussian_splat',
    }), [descriptor]);

    useEffect(() => {
        const onMessage = (event) => {
            const data = event?.data;
            if (!data || data.source !== 'croww-3d') return;
            setWebgl(Boolean(data.webgl));
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    return (
        <View style={styles.wrap} accessibilityLabel="3D property viewer">
            <iframe
                title="Croww 3D viewer"
                srcDoc={html}
                style={styles.frame}
                sandbox="allow-scripts"
            />
            <Typography variant="caption" style={styles.meta}>
                {webgl === false ? 'WebGL is not available on this browser.' : 'Orbit, pan, and zoom are reserved for a future splat renderer.'}
            </Typography>
            <View style={styles.controls}>
                {onReset ? (
                    <TouchableOpacity onPress={onReset} accessibilityRole="button" accessibilityLabel="Reset 3D view" style={styles.btn}>
                        <Typography variant="caption">Reset</Typography>
                    </TouchableOpacity>
                ) : null}
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
    wrap: { padding: SPACING.l },
    frame: { width: '100%', height: 280, border: 'none', borderRadius: 12, background: '#111' },
    meta: { color: COLORS.secondary, marginTop: SPACING.s },
    controls: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginTop: SPACING.m },
    btn: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 999,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
    },
});

export default Property3DViewer;
