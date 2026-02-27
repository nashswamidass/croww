import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Typography from './Typography';
import NotionCard from './NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../utils/avatarHelper';

const BuddyRequestCard = ({ request, onJoin, onLeave, onChat, onPress, onProfilePress, hasJoined, isOwn, pendingJoin, pendingApprovals = [], onApprove, onIgnore }) => {
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
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
            <NotionCard style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.userInfo}
                        onPress={() => onProfilePress && onProfilePress(request.userId)}
                    >
                        <Image
                            source={getAvatarSource(request.userAvatar)}
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
                    </TouchableOpacity>
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
                {request.memberSnapshots && request.memberSnapshots.length > 0 && (
                    <View style={styles.joinedUsers}>
                        <View style={styles.avatarRow}>
                            {request.memberSnapshots.slice(0, 4).map((member, index) => (
                                <TouchableOpacity
                                    key={member.uid}
                                    onPress={() => onProfilePress && onProfilePress(member.uid)}
                                    activeOpacity={0.7}
                                >
                                    <Image
                                        source={getAvatarSource(member.avatar)}
                                        style={[styles.joinedAvatar, { marginLeft: index > 0 ? -12 : 0, zIndex: 10 - index }]}
                                    />
                                </TouchableOpacity>
                            ))}
                            {request.memberSnapshots.length > 4 && (
                                <View style={[styles.joinedAvatar, styles.moreAvatar, { marginLeft: -12, zIndex: 0 }]}>
                                    <Typography variant="caption" style={{ color: COLORS.primary, fontWeight: '700' }}>
                                        +{request.memberSnapshots.length - 4}
                                    </Typography>
                                </View>
                            )}
                        </View>
                        <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: SPACING.s }}>
                            {request.memberSnapshots.length} {request.memberSnapshots.length === 1 ? 'member' : 'members'}
                        </Typography>
                    </View>
                )}

                {/* Pending Approvals (For Owners) */}
                {isOwn && pendingApprovals.length > 0 && (
                    <View style={styles.pendingSection}>
                        <Typography variant="small" style={styles.pendingTitle}>
                            Join Requests ({pendingApprovals.length})
                        </Typography>
                        {pendingApprovals.map((item) => (
                            <View key={item.id} style={styles.pendingItem}>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => onProfilePress && onProfilePress(item.userId)}
                                >
                                    <Image
                                        source={getAvatarSource(item.requesterAvatar)}
                                        style={styles.smallAvatar}
                                    />
                                    <Typography variant="small" style={{ flex: 1, marginLeft: 8 }}>
                                        {item.requesterName}
                                    </Typography>
                                </TouchableOpacity>
                                <View style={styles.pendingActions}>
                                    <TouchableOpacity
                                        onPress={() => onIgnore(item.id)}
                                        style={styles.ignoreButton}
                                    >
                                        <Ionicons name="close" size={20} color={COLORS.secondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => onApprove(item.id)}
                                        style={styles.approveButton}
                                    >
                                        <Ionicons name="checkmark" size={20} color={COLORS.background} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.footerActions}>
                    {!isOwn ? (
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                hasJoined && styles.leaveButton,
                                pendingJoin && styles.pendingButton,
                                isFull && !hasJoined && !pendingJoin && styles.disabledButton,
                                { flex: 5 }
                            ]}
                            onPress={hasJoined ? onLeave : (pendingJoin ? null : onJoin)}
                            disabled={isFull && !hasJoined && !pendingJoin}
                            activeOpacity={0.8}
                        >
                            <Typography
                                variant="body"
                                style={{
                                    color: (hasJoined || pendingJoin) ? COLORS.secondary : COLORS.background,
                                    fontWeight: '600'
                                }}
                            >
                                {isFull && !hasJoined && !pendingJoin
                                    ? 'Group Full'
                                    : hasJoined
                                        ? 'Leave Group'
                                        : pendingJoin
                                            ? 'Requested'
                                            : 'Request to Join'}
                            </Typography>
                        </TouchableOpacity>
                    ) : null}

                    {hasJoined && (
                        <TouchableOpacity
                            style={[styles.chatButton, { flex: 1, marginLeft: 8 }]}
                            onPress={onChat}
                        >
                            <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.accent} />
                        </TouchableOpacity>
                    )}
                </View>
            </NotionCard>
        </TouchableOpacity>
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
    pendingSection: {
        marginTop: SPACING.s,
        paddingTop: SPACING.m,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        marginBottom: SPACING.m,
    },
    pendingTitle: {
        fontWeight: '600',
        marginBottom: SPACING.s,
        color: COLORS.secondary,
    },
    pendingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
        backgroundColor: COLORS.surfaceHighlight,
        padding: SPACING.s,
        borderRadius: BORDER_RADIUS.s,
    },
    smallAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    pendingActions: {
        flexDirection: 'row',
        gap: SPACING.s,
    },
    approveButton: {
        backgroundColor: COLORS.success,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ignoreButton: {
        backgroundColor: COLORS.border,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        backgroundColor: COLORS.accent,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
    },
    chatButton: {
        padding: SPACING.s,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.accent + '30',
        alignItems: 'center',
        justifyContent: 'center',
    },
    leaveButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pendingButton: {
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    disabledButton: {
        backgroundColor: COLORS.surfaceHighlight,
        opacity: 0.5,
    },
});

export default BuddyRequestCard;
