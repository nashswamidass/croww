import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Marker } from 'react-native-maps';
import { COLORS } from '../../constants/theme';
import { formatMarkerPrice } from '../../utils/propertyFormat';

const PropertyMarker = ({ item, selected, onPress }) => {
    const isCluster = item?.isCluster === true;
    const label = isCluster ? String(item.count) : formatMarkerPrice(item);

    // On Android, react-native-maps requires tracksViewChanges=true initially to snapshot
    // the custom React view into a bitmap, then false for smooth map panning performance.
    const [tracksViewChanges, setTracksViewChanges] = useState(true);

    useEffect(() => {
        setTracksViewChanges(true);
        const timer = setTimeout(() => {
            setTracksViewChanges(false);
        }, 350);
        return () => clearTimeout(timer);
    }, [selected, label]);

    const coordinate = item?.mapCoordinate || (item?.latitude && item?.longitude ? { latitude: item.latitude, longitude: item.longitude } : null);
    if (!coordinate) return null;

    return (
        <Marker
            coordinate={coordinate}
            onPress={(e) => {
                e.stopPropagation?.();
                onPress?.(item);
            }}
            tracksViewChanges={Platform.OS === 'android' ? tracksViewChanges : false}
            zIndex={selected ? 100 : (isCluster ? 40 : 10)}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={isCluster ? `${item.count} properties in this area` : `${label} property listing`}
            accessibilityRole="button"
        >
            <View collapsable={false} style={styles.container}>
                {isCluster ? (
                    <View style={styles.clusterPill}>
                        <Text style={styles.clusterText}>{label}</Text>
                    </View>
                ) : (
                    <View style={[styles.pricePill, selected && styles.pricePillSelected]}>
                        <Text style={[styles.priceText, selected && styles.priceTextSelected]}>
                            {label}
                        </Text>
                    </View>
                )}
            </View>
        </Marker>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
    },
    // Compact floating price pill (Airbnb-style, Croww brand)
    pricePill: {
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        // Zero Android elevation inside Marker to eliminate gray bitmap bounding box artifacts
        elevation: 0,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0,
        shadowRadius: 2,
    },
    pricePillSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        transform: [{ scale: 1.08 }],
        shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0,
    },
    priceText: {
        color: '#111827',
        fontSize: 13,
        fontWeight: '700',
        includeFontPadding: false,
    },
    priceTextSelected: {
        color: '#FFFFFF',
    },
    // Compact cluster indicator
    clusterPill: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderColor: COLORS.primary,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 0,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0,
        shadowRadius: 2,
    },
    clusterText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '800',
        includeFontPadding: false,
    },
});

export default memo(PropertyMarker);
