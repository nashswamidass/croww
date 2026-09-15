import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Typography from './Typography';
import { Ionicons } from '@expo/vector-icons';

export default function ProductionPreviewBanner() {
    const [dismissed, setDismissed] = useState(false);
    const isPreview = process.env.EXPO_PUBLIC_APP_ENV === 'production-preview';

    if (!isPreview || dismissed) {
        return null;
    }

    return (
        <View style={styles.banner}>
            <View style={styles.badge}>
                <View style={styles.dot} />
                <Typography variant="caption" style={styles.badgeText}>
                    CROWW PRODUCTION PREVIEW
                </Typography>
            </View>

            <Typography variant="caption" style={styles.text} numberOfLines={1}>
                Target: croww-live-2026 (871336486604) · Real Firebase Backend
            </Typography>

            <TouchableOpacity
                onPress={() => setDismissed(true)}
                style={styles.closeBtn}
                accessibilityLabel="Dismiss preview banner"
            >
                <Ionicons name="close" size={16} color="#000" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#FFB800',
        paddingVertical: 6,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 9999,
        ...(Platform.OS === 'web'
            ? { position: 'sticky', top: 0 }
            : {}),
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000000',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginRight: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00FF66',
        marginRight: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    text: {
        color: '#000000',
        fontSize: 11,
        fontWeight: '600',
        flex: 1,
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    },
});
