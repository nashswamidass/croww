import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Typography from './Typography';
import NotionCard from './NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const BuddyRequestCard = ({ request, onJoin, onLeave, hasJoined, isOwn }) => {
    const isFull = request.spotsRemaining === 0;
    const spotsFilled = request.spotsAvailable - request.spotsRemaining;

    const getGenderBadge = () => {
        const badges = {
            any: { icon: '👥', text: 'Any gender welcome', color: COLORS.accent },
            male: { icon: '👨', text: 'Male preferred', color: COLORS.accents.blue },
            female: { icon: '👩', text: 'Female preferred', color: COLORS.accents.pink },
            'non-binary': { icon: '🌈', text: 'Non-binary preferred', color: COLORS.accents.purple }
        };
        return badges[request.genderPreference] || badges.any;
    };

    const genderBadge = getGenderBadge();

    return (
        <NotionCard style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.userInfo}>
                    <Image
                        source={{ uri: request.userAvatar }}
                        style={styles.avatar}
                    />
                    <View style={styles.userDetails}>
                        <Typography variant="body" style={{ fontWeight: '600' }}>
                            {request.userName}
                        </Typography>
                        {isOwn && (
                            <View style={styles.ownBadge}>
                                <Typography variant="caption" style={{ color: COLORS.accent }}>
                                    Your Request
                                </Typography>
                            </View>
                        )}
                    </View>
                </View>
                {request.status === 'active' && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                )}
            </View>

            {/* Spots Info */}
            <View style={styles.spotsContainer}>
                <View style={styles.spotsInfo}>
                    <Ionicons name="people" size={18} color={COLORS.accent} />
                    <Typography variant="body" style={styles.spotsText}>
                        {spotsFilled}/{request.spotsAvailable} spots filled
                    </Typography>
                </View>
                <View style={[styles.genderBadge, { backgroundColor: genderBadge.color + '20' }]}>
                    <Typography variant="caption" style={{ color: genderBadge.color }}>
                        {genderBadge.icon} {genderBadge.text}
                    </Typography>
                </View>
            </View>

            {/* Message */}
            {request.message && (
                <View style={styles.messageContainer}>
                    <Typography variant="body" style={{ color: COLORS.secondary }}>
                        "{request.message}"
                    </Typography>
                </View>
            )}

            {/* Joined Users */}
            {request.joinedUsers.length > 0 && (
                <View style={styles.joinedUsers}>
                    <View style={styles.avatarRow}>
                        {request.joinedUsers.slice(0, 3).map((userId, index) => (
                            <Image
                                key={userId}
                                source={{ uri: `https://i.pravatar.cc/150?img=${index + 15}` }}
                                style={[styles.joinedAvatar, { marginLeft: index > 0 ? -8 : 0 }]}
                            />
                        ))}
                        {request.joinedUsers.length > 3 && (
                            <View style={[styles.joinedAvatar, styles.moreAvatar]}>
                                <Typography variant="caption" style={{ color: COLORS.primary }}>
                                    +{request.joinedUsers.length - 3}
                                </Typography>
                            </View>
                        )}
                    </View>
                    <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: SPACING.s }}>
                        {request.joinedUsers.length} joined
                    </Typography>
                </View>
            )}

            {/* Action Button */}
            {!isOwn && (
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        hasJoined && styles.leaveButton,
                        isFull && !hasJoined && styles.disabledButton
                    ]}
                    onPress={hasJoined ? onLeave : onJoin}
                    disabled={isFull && !hasJoined}
                    activeOpacity={0.8}
                >
                    <Typography
                        variant="body"
                        style={{
                            color: hasJoined ? COLORS.secondary : COLORS.background,
                            fontWeight: '600'
                        }}
                    >
                        {isFull && !hasJoined ? 'Group Full' : hasJoined ? 'Leave Group' : 'Join Group'}
                    </Typography>
                </TouchableOpacity>
            )}
        </NotionCard>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: SPACING.s,
    },
    userDetails: {
        flex: 1,
    },
    ownBadge: {
        marginTop: 2,
    },
    spotsContainer: {
        gap: SPACING.s,
        marginBottom: SPACING.m,
    },
    spotsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    spotsText: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    genderBadge: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
        alignSelf: 'flex-start',
    },
    messageContainer: {
        backgroundColor: COLORS.surfaceHighlight,
        padding: SPACING.s,
        borderRadius: BORDER_RADIUS.s,
        marginBottom: SPACING.m,
    },
    joinedUsers: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    joinedAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: COLORS.surface,
    },
    moreAvatar: {
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -8,
    },
    actionButton: {
        backgroundColor: COLORS.accent,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
    },
    leaveButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    disabledButton: {
        backgroundColor: COLORS.surfaceHighlight,
        opacity: 0.5,
    },
});

export default BuddyRequestCard;
