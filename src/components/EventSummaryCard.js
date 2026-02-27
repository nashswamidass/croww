import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import NotionCard from './NotionCard';
import Typography from './Typography';
import AntigravityButton from './AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

import { getDistanceFromLatLonInKm, formatDistance } from '../utils/distance';

const EventSummaryCard = ({ event, visible, onClose, onDetails, userLocation }) => {
    if (!visible || !event) return null;

    const distance = userLocation && event.coordinate
        ? formatDistance(getDistanceFromLatLonInKm(
            userLocation.latitude,
            userLocation.longitude,
            event.coordinate?.latitude || 0,
            event.coordinate?.longitude || 0
        ))
        : null;

    return (
        <View style={styles.container}>
            <NotionCard style={styles.card}>
                <View style={styles.content}>
                    <View style={styles.textInfo}>
                        <Typography variant="h3">{event.title}</Typography>
                        <Typography variant="caption" style={styles.meta}>
                            {distance ? `${distance} away • ` : ''}{event.date} • {event.category}
                        </Typography>
                        <Typography variant="body" numberOfLines={1}>
                            {event.description}
                        </Typography>
                    </View>

                    <View style={styles.actions}>
                        <AntigravityButton
                            title="Details"
                            style={styles.button}
                            onPress={() => onDetails(event)}
                        />
                        <AntigravityButton
                            title="✕"
                            variant="secondary"
                            style={styles.closeButton}
                            onPress={onClose}
                        />
                    </View>
                </View>
            </NotionCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 140, // safely above nav bar
        left: SPACING.m,
        right: SPACING.m,
        zIndex: 1000, // Ensure card appears above all other elements
    },
    card: {
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.l,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    textInfo: {
        flex: 1,
        marginRight: SPACING.m,
    },
    meta: {
        color: COLORS.accents.blue, // Just an example accent
        marginBottom: SPACING.xs,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    button: {
        height: 36,
        minWidth: 80,
        paddingHorizontal: SPACING.s,
    },
    closeButton: {
        height: 36,
        minWidth: 36,
        width: 36,
        paddingHorizontal: 0,
        borderWidth: 0,
    }
});

export default EventSummaryCard;
