import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

export default function DesktopRightPanel({
    title,
    subtitle,
    count,
    onClose,
    headerRight,
    children,
    width = 460,
    style,
}) {
    return (
        <section style={{ height: '100%' }}>
            <View style={[styles.panel, { width }, style]}>
                {/* Panel Header */}
                {(title || onClose || headerRight) && (
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            {title && (
                                <View style={styles.titleRow}>
                                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                                    {count != null && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{count}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            {subtitle && (
                                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                            )}
                        </View>

                        <View style={styles.headerRight}>
                            {headerRight}
                            {onClose && (
                                <TouchableOpacity
                                    style={styles.closeBtn}
                                    onPress={onClose}
                                    accessibilityRole="button"
                                    accessibilityLabel="Close panel"
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close" size={18} color={COLORS.secondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Panel Content */}
                <View style={styles.content}>
                    {children}
                </View>
            </View>
        </section>
    );
}

const styles = StyleSheet.create({
    panel: {
        height: '100%',
        backgroundColor: COLORS.surface,
        borderLeftWidth: 1,
        borderLeftColor: COLORS.border,
        flexDirection: 'column',
        zIndex: 80,
        ...SHADOWS.card,
    },
    header: {
        paddingHorizontal: SPACING.l,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
    },
    headerLeft: {
        flex: 1,
        marginRight: SPACING.s,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    badge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.primary,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.secondary,
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    content: {
        flex: 1,
        overflow: 'hidden',
    },
});
