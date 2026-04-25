import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { getAvatarSource } from '../utils/avatarHelper';

/**
 * A single clean "Find Buddies" teaser card for EventDetailScreen.
 * Shows group leaders' avatars, group count, and a CTA to open the full buddy screen.
 */
const BuddyActionCard = ({ onPress, requestCount = 0, avatars = [] }) => {
    const displayAvatars = avatars.slice(0, 4);
    const hasGroups = requestCount > 0;

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={onPress}
            style={styles.card}
        >
            {/* Left: icon badge */}
            <View style={styles.iconBadge}>
                <Ionicons name="people" size={22} color={COLORS.accent} />
            </View>

            {/* Middle: text + avatar stack */}
            <View style={styles.body}>
                <Typography variant="body" style={styles.title}>
                    {hasGroups ? `${requestCount} Buddy Group${requestCount > 1 ? 's' : ''}` : 'Find Event Buddies'}
                </Typography>
                <Typography variant="caption" style={styles.subtitle}>
                    {hasGroups ? 'Tap to view and join groups' : 'Be the first to create a group!'}
                </Typography>

                {/* Avatar strip */}
                {displayAvatars.length > 0 && (
                    <View style={styles.avatarStrip}>
                        {displayAvatars.map((av, i) => (
                            <View
                                key={i}
                                style={[styles.avatarWrap, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
                            >
                                <Image
                                    source={av.url ? { uri: av.url } : getAvatarSource(null)}
                                    style={styles.avatar}
                                />
                            </View>
                        ))}
                        {requestCount > 4 && (
                            <View style={[styles.avatarWrap, styles.moreCount, { marginLeft: -10 }]}>
                                <Typography style={styles.moreText}>+{requestCount - 4}</Typography>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Right: arrow */}
            <View style={styles.arrowWrap}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.accent + '30',
        padding: SPACING.m,
        marginHorizontal: SPACING.l,
        marginVertical: SPACING.m,
        ...SHADOWS.soft,
    },
    iconBadge: {
        width: 46,
        height: 46,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.accent + '15',
        borderWidth: 1,
        borderColor: COLORS.accent + '30',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    body: {
        flex: 1,
    },
    title: {
        fontWeight: '700',
        color: COLORS.primary,
        fontSize: 14,
        marginBottom: 2,
    },
    subtitle: {
        color: COLORS.secondary,
        fontSize: 12,
        marginBottom: SPACING.s,
    },
    avatarStrip: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: COLORS.surface,
        overflow: 'hidden',
        backgroundColor: COLORS.surfaceHighlight,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    moreCount: {
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
    },
    moreText: {
        color: COLORS.secondary,
        fontSize: 8,
        fontWeight: '800',
    },
    arrowWrap: {
        marginLeft: SPACING.s,
    },
});

export default BuddyActionCard;
