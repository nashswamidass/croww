import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Marker } from 'react-native-maps';
import { COLORS } from '../../constants/theme';
import { formatMarkerPrice } from '../../utils/propertyFormat';

const PropertyMarker = ({ item, selected, onPress }) => {
    const isCluster = item?.isCluster === true;
    const label = isCluster ? String(item.count) : formatMarkerPrice(item);

    // On Android, react-native-maps requires tracksViewChanges=true briefly to snapshot
    // the custom React view into a bitmap, then false for smooth map panning performance.
    const [tracksViewChanges, setTracksViewChanges] = useState(true);
    const prevSelectedRef = React.useRef(selected);
    const prevLabelRef = React.useRef(label);

    useEffect(() => {
        const hasVisualChange = prevSelectedRef.current !== selected || prevLabelRef.current !== label;
        prevSelectedRef.current = selected;
        prevLabelRef.current = label;

        if (hasVisualChange) {
            setTracksViewChanges(true);
        }
        const timer = setTimeout(() => {
            setTracksViewChanges(false);
        }, 220);
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
            <View collapsable={false} style={styles.markerCanvas}>
                {isCluster ? (
                    <View style={styles.clusterPill}>
                        <Text style={styles.clusterText}>{label}</Text>
                    </View>
                ) : (
                    <View style={[styles.pricePill, selected && styles.pricePillSelected]}>
                        <Text
                            style={[styles.priceText, selected && styles.priceTextSelected]}
                            numberOfLines={1}
                        >
                            {label}
                        </Text>
                    </View>
                )}
            </View>
        </Marker>
    );
};

const styles = StyleSheet.create({
    // Fixed deterministic marker canvas for Android bitmap snapshot bounds
    markerCanvas: {
        width: 108,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    // Compact floating price pill (Airbnb-style, Croww brand)
    pricePill: {
        height: 34,
        minWidth: 56,
        paddingHorizontal: 12,
        borderRadius: 17,
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        // Zero Android elevation/shadows
        elevation: 0,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
    },
    // Selected state ONLY changes colors - NO transform/scale changes
    pricePillSelected: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    priceText: {
        color: '#111827',
        fontSize: 13,
        fontWeight: '700',
        includeFontPadding: false,
        textAlign: 'center',
    },
    priceTextSelected: {
        color: '#FFFFFF',
    },
    // Compact cluster indicator (same fixed canvas system)
    clusterPill: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderColor: '#111827',
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 0,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
    },
    clusterText: {
        color: '#111827',
        fontSize: 13,
        fontWeight: '800',
        includeFontPadding: false,
    },
});

function areMarkerPropsEqual(prevProps, nextProps) {
    if (prevProps.selected !== nextProps.selected) return false;
    if (prevProps.item?.listingId !== nextProps.item?.listingId) return false;
    if (prevProps.item?.isCluster !== nextProps.item?.isCluster) return false;
    if (prevProps.item?.count !== nextProps.item?.count) return false;
    if (prevProps.item?.price !== nextProps.item?.price) return false;
    if (prevProps.item?.pricing?.expectedPrice !== nextProps.item?.pricing?.expectedPrice) return false;
    const prevCoord = prevProps.item?.mapCoordinate || prevProps.item;
    const nextCoord = nextProps.item?.mapCoordinate || nextProps.item;
    if (prevCoord?.latitude !== nextCoord?.latitude || prevCoord?.longitude !== nextCoord?.longitude) return false;
    return true;
}

export default memo(PropertyMarker, areMarkerPropsEqual);
