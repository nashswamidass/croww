import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../services/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { getAvatarSource } from '../../utils/avatarHelper';
import {
    leaveBuddyRequest,
    requestToJoinBuddy,
    approveJoinRequest,
    ignoreJoinRequest,
    getJoinRequests
} from '../../services/buddyService';

const BuddyRequestDetailScreen = ({ route, navigation }) => {
    const { requestId, event } = route.params || {};
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [mySentRequest, setMySentRequest] = useState(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!requestId) return;

        // Listen for real-time updates to this buddy request
        const unsubscribe = onSnapshot(doc(db, 'buddy_requests', requestId), (docSnap) => {
            if (docSnap.exists()) {
                setRequest({ id: docSnap.id, ...docSnap.data() });
            } else {
                Alert.alert('Error', 'Request not found');
                navigation.goBack();
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [requestId]);

    useEffect(() => {
        const loadRequests = async () => {
            if (!request) return;

            // If I am the owner, fetch pending approvals
            if (request.userId === currentUser?.uid) {
                const approvals = await getJoinRequests(requestId, 'pending', request.userId);
                setPendingApprovals(approvals);
            } else {
                // If I am not the owner, check if I have a pending request
                const myRequests = await getJoinRequests();
                const found = myRequests.find(jr => jr.buddyRequestId === requestId);
                setMySentRequest(found);
            }
        };

        loadRequests();
    }, [request, currentUser]);

    const handleJoin = async () => {
        const result = await requestToJoinBuddy(requestId, request.userId);
        if (result.success) {
            Alert.alert('Requested!', result.message);
        } else {
            Alert.alert('Oops!', result.message);
        }
    };

    const handleLeave = async () => {
        Alert.alert(
            'Leave Group',
            'Are you sure you want to leave this group?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await leaveBuddyRequest(requestId);
                        if (result.success) navigation.goBack();
                    }
                }
            ]
        );
    };

    const handleApprove = async (joinRequestId) => {
        const result = await approveJoinRequest(joinRequestId);
        if (result.success) {
            Alert.alert('Success', 'Member added to group!');
            const approvals = await getJoinRequests(requestId, 'pending', request.userId);
            setPendingApprovals(approvals);
        } else {
            Alert.alert('Error', result.message);
        }
    };

    const handleIgnore = async (joinRequestId) => {
        const result = await ignoreJoinRequest(joinRequestId);
        if (result.success) {
            const approvals = await getJoinRequests(requestId, 'pending', request.userId);
            setPendingApprovals(approvals);
        }
    };

    const handleProfilePress = (userId) => {
        if (userId) {
            navigation.navigate('ServiceDetail', { serviceId: userId });
        }
    };

    if (loading) {
        return (
            <ScreenWrapper style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </ScreenWrapper>
        );
    }

    const hasJoined = request.joinedUsers && request.joinedUsers.includes(currentUser?.uid);
    const isFull = request.spotsRemaining === 0;
    const isOwn = request.userId === currentUser?.uid;

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2" style={{ marginLeft: SPACING.s }}>Buddy Group</Typography>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Event Context Card */}
                <View style={styles.eventContext}>
                    <Ionicons name="calendar" size={20} color={COLORS.accent} />
                    <View style={{ marginLeft: 12 }}>
                        <Typography variant="small" style={{ color: COLORS.secondary }}>Joining you for</Typography>
                        <Typography variant="body" style={{ fontWeight: '600' }}>{event?.title || 'This Event'}</Typography>
                    </View>
                </View>

                {/* Leader Section */}
                <TouchableOpacity
                    style={styles.leaderCard}
                    onPress={() => handleProfilePress(request.userId)}
                    activeOpacity={0.8}
                >
                    <Image source={getAvatarSource(request.userAvatar)} style={styles.leaderAvatar} />
                    <View style={styles.leaderInfo}>
                        <Typography variant="h3">{request.userName}</Typography>
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>Group Leader</Typography>
                    </View>
                    {isOwn && (
                        <View style={styles.ownBadge}>
                            <Typography variant="caption" style={{ color: COLORS.background }}>YOU</Typography>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Message */}
                <View style={styles.section}>
                    <Typography variant="small" style={styles.sectionTitle}>MESSAGE</Typography>
                    <View style={styles.messageBox}>
                        <Typography variant="body" style={styles.messageText}>
                            "{request.message || 'No message provided.'}"
                        </Typography>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Ionicons name="people" size={20} color={COLORS.accent} />
                        <Typography variant="h3" style={{ marginTop: 4 }}>
                            {request.spotsAvailable - request.spotsRemaining}/{request.spotsAvailable}
                        </Typography>
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>Spots Filled</Typography>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="transgender" size={20} color={COLORS.accent} />
                        <Typography variant="body" style={{ marginTop: 4, fontWeight: '700', textTransform: 'capitalize' }}>
                            {request.genderPreference}
                        </Typography>
                        <Typography variant="caption" style={{ color: COLORS.secondary }}>Preference</Typography>
                    </View>
                </View>

                {/* Members Section */}
                <View style={styles.section}>
                    <Typography variant="small" style={styles.sectionTitle}>MEMBERS ({request.memberSnapshots?.length || 0})</Typography>
                    <View style={styles.membersList}>
                        {request.memberSnapshots?.map((member) => (
                            <TouchableOpacity
                                key={member.uid}
                                style={styles.memberItem}
                                onPress={() => handleProfilePress(member.uid)}
                            >
                                <Image source={getAvatarSource(member.avatar)} style={styles.memberAvatar} />
                                <Typography variant="body" style={{ marginLeft: 12 }}>{member.name}</Typography>
                                {member.uid === request.userId && (
                                    <Ionicons name="star" size={14} color={COLORS.accent} style={{ marginLeft: 4 }} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Pending Requests (Owner Only) */}
                {isOwn && pendingApprovals.length > 0 && (
                    <View style={styles.section}>
                        <Typography variant="small" style={[styles.sectionTitle, { color: COLORS.accent }]}>
                            PENDING REQUESTS ({pendingApprovals.length})
                        </Typography>
                        {pendingApprovals.map((item) => (
                            <View key={item.id} style={styles.pendingItem}>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => handleProfilePress(item.userId)}
                                >
                                    <Image source={getAvatarSource(item.requesterAvatar)} style={styles.memberAvatar} />
                                    <Typography variant="body" style={{ flex: 1, marginLeft: 12 }}>{item.requesterName}</Typography>
                                </TouchableOpacity>
                                <View style={styles.pendingActions}>
                                    <TouchableOpacity
                                        onPress={() => handleIgnore(item.id)}
                                        style={styles.ignoreButton}
                                    >
                                        <Ionicons name="close" size={20} color={COLORS.secondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleApprove(item.id)}
                                        style={styles.approveButton}
                                    >
                                        <Ionicons name="checkmark" size={20} color={COLORS.background} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
                {!isOwn ? (
                    <TouchableOpacity
                        style={[
                            styles.mainButton,
                            hasJoined && styles.leaveButton,
                            mySentRequest && styles.disabledButton,
                            isFull && !hasJoined && !mySentRequest && styles.disabledButton
                        ]}
                        onPress={hasJoined ? handleLeave : (mySentRequest ? null : handleJoin)}
                        disabled={isFull && !hasJoined && !mySentRequest}
                    >
                        <Typography variant="body" style={styles.buttonText}>
                            {hasJoined ? 'Leave Group' : (mySentRequest ? 'Request Sent' : (isFull ? 'Group Full' : 'Request to Join'))}
                        </Typography>
                    </TouchableOpacity>
                ) : (
                    <Typography variant="body" style={{ color: COLORS.secondary, textAlign: 'center' }}>
                        You are the group leader
                    </Typography>
                )}

                {hasJoined && request.chatId && (
                    <TouchableOpacity
                        style={styles.chatButton}
                        onPress={() => navigation.navigate('Chat', {
                            recipientId: 'GROUP',
                            recipientName: request.userName + "'s Group",
                            chatId: request.chatId
                        })}
                    >
                        <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.background} />
                    </TouchableOpacity>
                )}
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        marginRight: SPACING.m,
    },
    content: {
        padding: SPACING.m,
    },
    eventContext: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.l,
    },
    leaderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.l,
        padding: SPACING.m,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    leaderAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    leaderInfo: {
        flex: 1,
        marginLeft: SPACING.m,
    },
    ownBadge: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        fontWeight: '700',
        color: COLORS.secondary,
        marginBottom: SPACING.m,
        letterSpacing: 1,
    },
    messageBox: {
        backgroundColor: COLORS.accent + '08',
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.accent,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xl,
        gap: SPACING.m,
    },
    statItem: {
        flex: 1,
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    membersList: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    pendingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.s,
    },
    pendingActions: {
        flexDirection: 'row',
        gap: SPACING.s,
    },
    approveButton: {
        backgroundColor: COLORS.success,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ignoreButton: {
        backgroundColor: COLORS.border,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        ...SHADOWS.medium,
    },
    mainButton: {
        flex: 1,
        backgroundColor: COLORS.accent,
        paddingVertical: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
    },
    leaveButton: {
        backgroundColor: COLORS.error,
    },
    disabledButton: {
        backgroundColor: COLORS.border,
    },
    chatButton: {
        backgroundColor: COLORS.accent,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SPACING.m,
    },
    buttonText: {
        color: COLORS.background,
        fontWeight: '700',
    },
});

export default BuddyRequestDetailScreen;
