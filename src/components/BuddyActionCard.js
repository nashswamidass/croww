import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { getRandomAvatar, getAvatarSource } from '../utils/avatarHelper';

const BuddyActionCard = ({ onPress, requestCount = 0, avatars = [] }) => {
    // Generate some mock avatars if none provided, just for the visual stack
    const displayAvatars = avatars.length > 0
        ? avatars.slice(0, 3)
        : [getRandomAvatar(), getRandomAvatar(), getRandomAvatar()];

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
            <LinearGradient
                colors={['#4c669f', '#3b5998', '#192f6a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
            >
                <View style={styles.content}>
                    <View style={styles.leftSection}>
                        <View style={styles.avatarStack}>
                            {displayAvatars.map((avatar, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.avatarContainer,
                                        { zIndex: 3 - index, marginLeft: index === 0 ? 0 : -15 }
                                    ]}
                                >
                                    <Image
                                        source={avatar.url ? { uri: avatar.url } : getAvatarSource(null)}
                                        style={styles.avatar}
                                    />
                                </View>
                            ))}
                        </View>
                        <View style={styles.textContainer}>
                            <Typography variant="h4" style={styles.title}>
                                {requestCount > 0
                                    ? `${requestCount} people looking`
                                    : "Going solo?"}
                            </Typography>
                            <Typography variant="caption" style={styles.subtitle}>
                                {requestCount > 0
                                    ? "Find your event buddy"
                                    : "Find a buddy!"}
                            </Typography>
                        </View>
                    </View>

                    <View style={styles.iconContainer}>
                        <Ionicons name="chevron-forward" size={24} color="#FFF" />
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: BORDER_RADIUS.l,
        padding: SPACING.m,
        marginVertical: SPACING.m,
        ...SHADOWS.medium,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarStack: {
        flexDirection: 'row',
        marginRight: SPACING.m,
    },
    avatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#4c669f', // Match start color for seamless blend or white for pop
        overflow: 'hidden',
        backgroundColor: COLORS.surfaceHighlight,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        justifyContent: 'center',
    },
    title: {
        color: '#FFF',
        fontWeight: '700',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
    },
    iconContainer: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        padding: 4,
    }
});

export default BuddyActionCard;
