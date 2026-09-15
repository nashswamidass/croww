import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../utils/avatarHelper';

const GENDER_CONFIG = {
    any: { emoji: '👥', label: 'All welcome', color: COLORS.accent },
    male: { emoji: '👨', label: 'Male', color: COLORS.accents.blue },
    female: { emoji: '👩', label: 'Female', color: COLORS.accents.pink },
    'non-binary': { emoji: '🌈', label: 'Non-binary', color: COLORS.accents.purple },
};

const BuddyRequestCard = ({
    request,
    onJoin,
    onLeave,
    onChat,
    onPress,
    onProfilePress,
    hasJoined,
    isOwn,
    pendingJoin,
    pendingApprovals = [],
    onApprove,
    onIgnore,
}) => {
    const isFull = request.spotsRemaining === 0;
    const spotsFilled = request.spotsAvailable - request.spotsRemaining;
    const fillPercent = request.spotsAvailable > 0
        ? (spotsFilled / request.spotsAvailable) * 100
        : 0;
    const gender = GENDER_CONFIG[request.genderPreference] || GENDER_CONFIG.any;

    const joinLabel = isFull && !hasJoined && !pendingJoin
        ? 'Full'
        : hasJoined
            ? 'Leave'
            : pendingJoin
                ? 'Pending'
                : 'Join';

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.container}>
            {/* LEFT — large avatar + active dot */}
            <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={() => onProfilePress && onProfilePress(request.userId)}
                activeOpacity={0.8}
            >
                <Image source={getAvatarSource(request.userAvatar)} style={styles.avatar} />
                {request.status === 'active' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* RIGHT — content */}
            <View style={styles.content}>
                {/* Name + badges row */}
                <View style={styles.nameRow}>
                    <Typography variant="body" style={styles.name} numberOfLines={1}>
                        {request.userName}
                    </Typography>
                    {isOwn && (
                        <View style={styles.ownBadge}>
                            <Typography variant="caption" style={styles.ownBadgeText}>You</Typography>
                        </View>
                    )}
                    <View style={[styles.genderChip, { borderColor: gender.color + '60' }]}>
                        <Typography variant="caption" style={[styles.genderText, { color: gender.color }]}>
                            {gender.emoji} {gender.label}
                        </Typography>
                    </View>
                </View>

                {/* Message preview */}
                {request.message ? (
                    <Typography variant="small" style={styles.message} numberOfLines={1}>
                        {`"${request.message}"`}
                    </Typography>
                ) : null}

                {/* Spots progress */}
                <View style={styles.spotsRow}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, {
                            width: `${fillPercent}%`,
                            backgroundColor: isFull ? COLORS.error : COLORS.accent,
                        }]} />
                    </View>
                    <Typography variant="caption" style={styles.spotsLabel}>
                        {spotsFilled}/{request.spotsAvailable}
                        {isFull ? ' · Full' : ` · ${request.spotsRemaining} left`}
                    </Typography>
                </View>

                {/* Overlapping member avatars */}
                {request.memberSnapshots && request.memberSnapshots.length > 0 && (
                    <View style={styles.membersRow}>
                        {request.memberSnapshots.slice(0, 5).map((m, i) => (
                            <TouchableOpacity
                                key={m.uid}
                                onPress={() => onProfilePress && onProfilePress(m.uid)}
                                style={[styles.memberAvatarWrap, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
                                activeOpacity={0.8}
                            >
                                <Image source={getAvatarSource(m.avatar)} style={styles.memberAvatar} />
                            </TouchableOpacity>
                        ))}
                        {request.memberSnapshots.length > 5 && (
                            <View style={[styles.memberAvatar, styles.moreCount, { marginLeft: -10 }]}>
                                <Typography variant="caption" style={{ color: COLORS.primary, fontSize: 9, fontWeight: '800' }}>
                                    +{request.memberSnapshots.length - 5}
                                </Typography>
                            </View>
                        )}
                        <Typography variant="caption" style={styles.memberCount}>
                            {request.memberSnapshots.length} member{request.memberSnapshots.length !== 1 ? 's' : ''}
                        </Typography>
                    </View>
                )}

                {/* Pending join requests (owner view) */}
                {isOwn && pendingApprovals.length > 0 && (
                    <View style={styles.pendingSection}>
                        <View style={styles.pendingHeader}>
                            <Ionicons name="person-add" size={12} color={COLORS.warning} />
                            <Typography variant="caption" style={styles.pendingTitle}>
                                {pendingApprovals.length} waiting to join
                            </Typography>
                        </View>
                        {pendingApprovals.map(item => (
                            <View key={item.id} style={styles.pendingItem}>
                                <Image
                                    source={getAvatarSource(item.requesterAvatar)}
                                    style={styles.smallAvatar}
                                />
                                <Typography variant="small" style={styles.pendingName} numberOfLines={1}>
                                    {item.requesterName}
                                </Typography>
                                <View style={styles.pendingButtons}>
                                    <TouchableOpacity style={styles.ignoreBtn} onPress={() => onIgnore(item.id)}>
                                        <Ionicons name="close" size={14} color={COLORS.secondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.approveBtn} onPress={() => onApprove(item.id)}>
                                        <Ionicons name="checkmark" size={14} color={COLORS.background} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Action row */}
                <View style={styles.actionRow}>
                    {!isOwn && (
                        <TouchableOpacity
                            style={[
                                styles.joinBtn,
                                hasJoined && styles.joinBtnLeave,
                                pendingJoin && styles.joinBtnPending,
                                isFull && !hasJoined && !pendingJoin && styles.joinBtnDisabled,
                            ]}
                            onPress={hasJoined ? onLeave : pendingJoin ? null : onJoin}
                            disabled={isFull && !hasJoined && !pendingJoin}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={hasJoined ? 'exit-outline' : pendingJoin ? 'time-outline' : 'person-add-outline'}
                                size={14}
                                color={hasJoined || pendingJoin ? COLORS.secondary : COLORS.background}
                                style={{ marginRight: 5 }}
                            />
                            <Typography variant="small" style={[styles.joinBtnText, (hasJoined || pendingJoin) && { color: COLORS.secondary }]}>
                                {joinLabel}
                            </Typography>
                        </TouchableOpacity>
                    )}

                    {(hasJoined || isOwn) && (
                        <TouchableOpacity style={styles.chatBtn} onPress={onChat} activeOpacity={0.8}>
                            <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.accent} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        ...SHADOWS.soft,
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: SPACING.m,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 2,
        borderColor: COLORS.accent + '50',
    },
    activeDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.success,
        borderWidth: 2,
        borderColor: COLORS.surface,
    },
    content: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.xs,
        marginBottom: 4,
    },
    name: {
        fontWeight: '700',
        color: COLORS.primary,
        fontSize: 14,
    },
    ownBadge: {
        backgroundColor: COLORS.accent + '20',
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderWidth: 1,
        borderColor: COLORS.accent + '40',
    },
    ownBadgeText: {
        color: COLORS.accent,
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    genderChip: {
        borderRadius: BORDER_RADIUS.round,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderWidth: 1,
    },
    genderText: {
        fontSize: 10,
        fontWeight: '600',
    },
    message: {
        color: COLORS.secondary,
        fontStyle: 'italic',
        marginBottom: SPACING.s,
        fontSize: 12,
    },
    spotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        marginBottom: SPACING.s,
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.surfaceHighlight,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    spotsLabel: {
        color: COLORS.secondary,
        fontSize: 10,
        minWidth: 60,
    },
    membersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    memberAvatarWrap: {
        borderRadius: 18,
        borderWidth: 2,
        borderColor: COLORS.surface,
    },
    memberAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    moreCount: {
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 0,
    },
    memberCount: {
        marginLeft: SPACING.s,
        color: COLORS.secondary,
        fontSize: 10,
    },
    pendingSection: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.s,
        marginBottom: SPACING.s,
    },
    pendingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    pendingTitle: {
        color: COLORS.warning,
        fontWeight: '700',
        fontSize: 11,
    },
    pendingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    smallAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 8,
    },
    pendingName: {
        flex: 1,
        color: COLORS.primary,
        fontSize: 12,
    },
    pendingButtons: {
        flexDirection: 'row',
        gap: 6,
    },
    ignoreBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    approveBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: COLORS.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        marginTop: 2,
    },
    joinBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.m,
        paddingVertical: 7,
        paddingHorizontal: SPACING.s,
    },
    joinBtnLeave: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    joinBtnPending: {
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    joinBtnDisabled: {
        backgroundColor: COLORS.surfaceHighlight,
        opacity: 0.5,
    },
    joinBtnText: {
        color: COLORS.background,
        fontWeight: '700',
        fontSize: 12,
    },
    chatBtn: {
        width: 34,
        height: 34,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.accent + '40',
        backgroundColor: COLORS.accent + '10',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default BuddyRequestCard;
