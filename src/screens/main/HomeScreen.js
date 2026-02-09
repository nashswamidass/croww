import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import VerificationBadge from '../../components/VerificationBadge';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { EVENTS } from '../../data/mockEvents';
import { Ionicons } from '@expo/vector-icons';
import { getDistanceFromLatLonInKm, formatDistance } from '../../utils/distance';

const HomeScreen = ({ navigation }) => {
    const [userLocation, setUserLocation] = useState(null);
    const [cityName, setCityName] = useState('Detecting...');

    useEffect(() => {
        (async () => {
            try {
                // Check cache first
                const cached = await AsyncStorage.getItem('userLocation');
                if (cached) setUserLocation(JSON.parse(cached));

                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced
                    });
                    setUserLocation(location.coords);
                    await AsyncStorage.setItem('userLocation', JSON.stringify(location.coords));

                    // Get city name
                    const reverseGeocode = await Location.reverseGeocodeAsync({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                    });
                    if (reverseGeocode && reverseGeocode.length > 0) {
                        const city = reverseGeocode[0].city || reverseGeocode[0].region;
                        setCityName(city || 'Unknown Location');
                    }
                }
            } catch (err) {
                console.log("HomeScreen location error:", err);
            }
        })();
    }, []);

    const getDistanceText = (eventCoord) => {
        if (!userLocation || !eventCoord) return 'Distance unknown';
        const dist = getDistanceFromLatLonInKm(
            userLocation.latitude,
            userLocation.longitude,
            eventCoord.latitude,
            eventCoord.longitude
        );
        return `${formatDistance(dist)} away`;
    };

    // Get featured events (those with images)
    const featuredEvents = EVENTS.filter(event => event.imageUri);
    const upcomingEvents = EVENTS.slice(0, 5);

    const handleEventPress = (event) => {
        navigation.navigate('EventDetail', { event });
    };

    return (
        <ScreenWrapper edges={['top']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Image
                            source={require('../../../assets/croww-logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={styles.locationContainer}
                            onPress={() => navigation.navigate('Map')}
                        >
                            <Ionicons name="location" size={14} color={COLORS.accent} />
                            <Typography variant="small" style={styles.locationText}>
                                {cityName}
                            </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.headerIconButton, { marginLeft: SPACING.s }]}
                            onPress={() => navigation.navigate('Notifications')}
                        >
                            <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.headerIconButton, { marginLeft: SPACING.s }]}
                            onPress={() => navigation.navigate('EventSearch')}
                        >
                            <Ionicons name="search-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Featured Events - Large Image Cards */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h3">Featured Events</Typography>
                        <TouchableOpacity onPress={() => navigation.navigate('Map')}>
                            <Typography variant="small" style={{ color: COLORS.accent }}>
                                See All
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.horizontalScroll}
                        contentContainerStyle={styles.horizontalContent}
                    >
                        {featuredEvents.map((event) => (
                            <TouchableOpacity
                                key={event.id}
                                style={styles.featuredCard}
                                onPress={() => handleEventPress(event)}
                                activeOpacity={0.9}
                            >
                                <ImageBackground
                                    source={{ uri: event.imageUri }}
                                    style={styles.featuredImage}
                                    imageStyle={{ borderRadius: BORDER_RADIUS.l }}
                                    resizeMode="cover"
                                >
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                                        style={styles.gradient}
                                    >
                                        <View style={styles.featuredContent}>
                                            <View style={styles.categoryBadge}>
                                                <Typography variant="caption" style={{ color: COLORS.background }}>
                                                    {event.category}
                                                </Typography>
                                            </View>

                                            {event.verificationStatus === 'verified' && (
                                                <VerificationBadge
                                                    status={event.verificationStatus}
                                                    type={event.verificationType}
                                                />
                                            )}

                                            <Typography variant="h2" style={{ marginTop: SPACING.s }}>
                                                {event.title}
                                            </Typography>

                                            <View style={styles.eventMeta}>
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="time-outline" size={16} color={COLORS.accent} />
                                                    <Typography variant="caption" style={styles.metaText}>
                                                        {event.date}
                                                    </Typography>
                                                </View>
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="location-outline" size={16} color={COLORS.accent} />
                                                    <Typography variant="caption" style={styles.metaText}>
                                                        {getDistanceText(event.coordinate)}
                                                    </Typography>
                                                </View>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </ImageBackground>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <View style={styles.quickActions}>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('CreateEvent')}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: COLORS.accent + '20' }]}>
                                <Ionicons name="add-circle" size={24} color={COLORS.accent} />
                            </View>
                            <Typography variant="small" style={{ marginTop: SPACING.xs }}>
                                Create Event
                            </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('Map')}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: COLORS.accents.pink + '20' }]}>
                                <Ionicons name="map" size={24} color={COLORS.accents.pink} />
                            </View>
                            <Typography variant="small" style={{ marginTop: SPACING.xs }}>
                                Explore Map
                            </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('Search')}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: COLORS.accents.purple + '20' }]}>
                                <Ionicons name="search" size={24} color={COLORS.accents.purple} />
                            </View>
                            <Typography variant="small" style={{ marginTop: SPACING.xs }}>
                                Find Services
                            </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('MyTickets')}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: COLORS.accents.orange + '20' }]}>
                                <Ionicons name="ticket" size={24} color={COLORS.accents.orange} />
                            </View>
                            <Typography variant="small" style={{ marginTop: SPACING.xs }}>
                                My Tickets
                            </Typography>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Upcoming Events - Compact List */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h3">Happening Soon</Typography>
                        <TouchableOpacity onPress={() => navigation.navigate('Map')}>
                            <Typography variant="small" style={{ color: COLORS.accent }}>
                                See All
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {upcomingEvents.map((event) => (
                        <TouchableOpacity
                            key={event.id}
                            style={styles.compactCard}
                            onPress={() => handleEventPress(event)}
                            activeOpacity={0.8}
                        >
                            <NotionCard style={styles.compactCardInner}>
                                {event.imageUri ? (
                                    <Image
                                        source={{ uri: event.imageUri }}
                                        style={styles.compactImage}
                                    />
                                ) : (
                                    <View style={[styles.compactImage, styles.imagePlaceholder]}>
                                        <Ionicons name="image-outline" size={32} color={COLORS.secondary} />
                                    </View>
                                )}

                                <View style={styles.compactContent}>
                                    <Typography variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
                                        {event.title}
                                    </Typography>
                                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                        {event.date} • {event.category}
                                    </Typography>
                                    <View style={styles.compactMeta}>
                                        <Ionicons name="location-outline" size={14} color={COLORS.accent} />
                                        <Typography variant="caption" style={{ color: COLORS.accent, marginLeft: 4 }}>
                                            {getDistanceText(event.coordinate)}
                                        </Typography>
                                    </View>
                                </View>

                                <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
                            </NotionCard>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Bottom Spacing for Tab Bar */}
                <View style={{ height: 120 }} />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: SPACING.l,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
        height: 60,
    },
    headerLeft: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: 90,
        height: 28,
        marginLeft: -5,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
        paddingVertical: 6,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 20,
        marginRight: SPACING.xs,
    },
    locationText: {
        color: COLORS.primary,
        textTransform: 'none',
        fontSize: 12,
        marginLeft: 4,
        fontWeight: '600',
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
    },
    horizontalScroll: {
        paddingLeft: SPACING.m,
    },
    horizontalContent: {
        paddingRight: SPACING.m,
    },
    featuredCard: {
        width: 280,
        height: 360,
        marginRight: SPACING.m,
    },
    featuredImage: {
        width: '100%',
        height: '100%',
        borderRadius: BORDER_RADIUS.l,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        borderRadius: BORDER_RADIUS.l,
    },
    featuredContent: {
        padding: SPACING.m,
    },
    categoryBadge: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
        alignSelf: 'flex-start',
        marginBottom: SPACING.xs,
    },
    eventMeta: {
        flexDirection: 'row',
        gap: SPACING.m,
        marginTop: SPACING.s,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        color: COLORS.secondary,
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: SPACING.m,
    },
    actionCard: {
        alignItems: 'center',
    },
    actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactCard: {
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
    },
    compactCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        gap: SPACING.m,
    },
    compactImage: {
        width: 70,
        height: 70,
        borderRadius: BORDER_RADIUS.m,
    },
    imagePlaceholder: {
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactContent: {
        flex: 1,
        gap: 4,
    },
    compactMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
});

export default HomeScreen;
