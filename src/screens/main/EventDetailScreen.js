import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Share, Image, Alert, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import VerificationBadge from '../../components/VerificationBadge';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDistanceFromLatLonInKm, formatDistance } from '../../utils/distance';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EventDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { event } = route.params || {};
    const [userLocation, setUserLocation] = useState(null);

    React.useEffect(() => {
        (async () => {
            const cached = await AsyncStorage.getItem('userLocation');
            if (cached) setUserLocation(JSON.parse(cached));

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setUserLocation(location.coords);
            }
        })();
    }, []);

    // Mock State
    const [isGoing, setIsGoing] = useState(false);

    // Mock Data if not passed
    const eventData = event || {
        title: "Unknown Event",
        date: "Date TBD",
        category: "General",
        description: "No description provided.",
        attendees: 12,
        isPublic: false,
        verificationStatus: 'none',
        coordinate: { latitude: 37.78825, longitude: -122.4324 }
    };

    const getDistanceText = () => {
        if (!userLocation || !eventData.coordinate) return 'Distance unknown';
        const dist = getDistanceFromLatLonInKm(
            userLocation.latitude,
            userLocation.longitude,
            eventData.coordinate.latitude,
            eventData.coordinate.longitude
        );
        return `${formatDistance(dist)} away`;
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join me at ${eventData.title}! It's happening on ${eventData.date}. #CrowwApp`,
            });
        } catch (error) {
            console.log(error.message);
        }
    };

    const toggleRSVP = () => {
        setIsGoing(!isGoing);
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Event Image */}
                {eventData.imageUri ? (
                    <Image source={{ uri: eventData.imageUri }} style={styles.eventImage} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons name="image-outline" size={48} color={COLORS.secondary} />
                    </View>
                )}

                <View style={styles.header}>
                    <View style={styles.tagRow}>
                        {eventData.isOfficial && (
                            <View style={[styles.tag, { backgroundColor: COLORS.accent, marginRight: SPACING.s }]}>
                                <Typography variant="small" style={{ color: COLORS.background, fontWeight: 'bold' }}>OFFICIAL</Typography>
                            </View>
                        )}
                        <View style={[styles.tag, { backgroundColor: eventData.isOfficial ? COLORS.surfaceHighlight : COLORS.accent }]}>
                            <Typography variant="small" style={{ color: eventData.isOfficial ? COLORS.accent : COLORS.background }}>{eventData.category}</Typography>
                        </View>
                        <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: SPACING.s }}>
                            {eventData.isPublic ? '🌍 Public' : '🔒 Private'}
                        </Typography>
                    </View>

                    {eventData.isOfficial && (
                        <TouchableOpacity
                            style={styles.organizerLink}
                            onPress={() => {
                                // In a real app, navigate to the specific business profile
                                // For now, we just stay on this screen or show a mock alert
                                Alert.alert('Venue Profile', `View ${eventData.organizerName || 'the organizer'}'s profile`);
                            }}
                        >
                            <Ionicons name="business" size={16} color={COLORS.accent} />
                            <Typography variant="caption" style={{ color: COLORS.accent, marginLeft: 4, fontWeight: '600' }}>
                                Hosted by {eventData.organizerName || 'Verified Venue'}
                            </Typography>
                        </TouchableOpacity>
                    )}

                    {eventData.verificationStatus && eventData.verificationStatus !== 'none' && !eventData.isOfficial && (
                        <View style={{ marginBottom: SPACING.s }}>
                            <VerificationBadge
                                status={eventData.verificationStatus}
                                type={eventData.verificationType}
                            />
                        </View>
                    )}

                    <Typography variant="h1">{eventData.title}</Typography>
                    <View style={styles.row}>
                        <Ionicons name="time-outline" size={20} color={COLORS.accent} />
                        <Typography variant="body" style={styles.metaText}>{eventData.date}</Typography>
                    </View>
                    <View style={styles.row}>
                        <Ionicons name="location-outline" size={20} color={COLORS.accent} />
                        <Typography variant="body" style={styles.metaText}>{getDistanceText()}</Typography>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    <NotionButton
                        title={isGoing ? "Going ✓" : "Join Event"}
                        variant={isGoing ? "secondary" : "primary"}
                        style={{ flex: 1, marginRight: SPACING.s }}
                        onPress={toggleRSVP}
                    />
                    <NotionButton
                        title="Invite Friends"
                        variant="secondary"
                        style={{ flex: 1, marginLeft: SPACING.s }}
                        onPress={handleShare}
                    />
                </View>

                <View style={styles.section}>
                    <Typography variant="h3">About</Typography>
                    <Typography variant="body" style={styles.description}>
                        {eventData.description}
                    </Typography>
                </View>

                {/* Find Event Buddies Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h3">Find Event Buddies</Typography>
                        <View style={styles.buddyBadge}>
                            <Typography variant="caption" style={{ color: COLORS.accent }}>
                                3 active
                            </Typography>
                        </View>
                    </View>
                    <Typography variant="body" style={{ color: COLORS.secondary, marginBottom: SPACING.m }}>
                        Connect with people attending this event
                    </Typography>
                    <NotionButton
                        title="View Buddy Requests"
                        icon="people"
                        onPress={() => navigation.navigate('EventBuddy', { event: eventData })}
                    />
                </View>

                {/* Attendees */}
                <View style={styles.section}>
                    <Typography variant="h3">Who's Coming</Typography>
                    <NotionCard style={styles.attendeesCard}>
                        <View style={styles.avatarRow}>
                            {[1, 2, 3, 4].map((i) => (
                                <View key={i} style={styles.avatar} />
                            ))}
                            <View style={[styles.avatar, styles.moreAvatar]}>
                                <Typography variant="small" style={{ color: COLORS.primary }}>+{eventData.attendees || 0}</Typography>
                            </View>
                        </View>
                        <Typography variant="caption" style={{ marginTop: SPACING.s }}>
                            Alex, Sarah, and {eventData.attendees || 10} others are going.
                        </Typography>
                    </NotionCard>
                </View>

            </ScrollView>
            {/* Close Button Overlay */}
            <NotionButton
                title="✕"
                variant="secondary"
                style={styles.closeButton}
                onPress={() => navigation.goBack()}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: SPACING.m,
    },
    eventImage: {
        width: '100%',
        height: 220,
        borderRadius: BORDER_RADIUS.l,
        marginBottom: SPACING.l,
        resizeMode: 'cover',
    },
    imagePlaceholder: {
        width: '100%',
        height: 180,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.l,
        marginBottom: SPACING.l,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        marginBottom: SPACING.l,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    tag: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
        alignSelf: 'flex-start',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.s,
    },
    metaText: {
        marginLeft: SPACING.s,
        color: COLORS.secondary,
    },
    organizerLink: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
        padding: SPACING.s,
        backgroundColor: COLORS.accent + '10',
        borderRadius: BORDER_RADIUS.m,
        alignSelf: 'flex-start',
    },
    actionRow: {
        flexDirection: 'row',
        marginBottom: SPACING.xl,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.s,
    },
    buddyBadge: {
        backgroundColor: COLORS.accent + '20',
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
    },
    description: {
        // This style is used but not defined in the original document.
        // Adding a placeholder definition to ensure valid syntax if it was intended to be here.
        // If it was meant to be empty, this is fine.
    },
    attendeesCard: {
        alignItems: 'center',
    },
    avatarRow: {
        flexDirection: 'row',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 2,
        borderColor: COLORS.surface,
        marginRight: -10,
    },
    moreAvatar: {
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: SPACING.m, // Safe area handled by absolute positioning relative to container if needed, but insets.top is better
        right: SPACING.m,
        width: 40,
        minWidth: 40,
        height: 40,
        paddingHorizontal: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 0,
    }
});

export default EventDetailScreen;
