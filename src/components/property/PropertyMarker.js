import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { COLORS, SHADOWS } from '../../constants/theme';
import { formatListingPrice } from '../../utils/propertyFormat';

const PropertyMarker = ({ item, selected, onPress }) => {
    const coordinate = item.mapCoordinate;
    if (!coordinate) return null;
    const label = formatListingPrice(item);

    return (
        <Marker
            coordinate={coordinate}
            onPress={(e) => {
                e.stopPropagation?.();
                onPress(item);
            }}
            tracksViewChanges={false}
            zIndex={selected ? 100 : 10}
            anchor={{ x: 0.5, y: 1 }}
            accessibilityLabel={`${label} listing`}
        >
            <View collapsable={false} style={styles.pad}>
                <View style={[styles.pill, selected && styles.pillOn]}>
                    <Text style={[styles.text, selected && styles.textOn]}>{label}</Text>
                </View>
                <View style={[styles.tip, selected && styles.tipOn]} />
            </View>
        </Marker>
    );
};

const styles = StyleSheet.create({
    pad: {
        padding: 4,
        alignItems: 'center',
    },
    pill: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.borderLight,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
        minHeight: 28,
        justifyContent: 'center',
        ...SHADOWS.subtle,
    },
    pillOn: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    text: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '800',
    },
    textOn: {
        color: '#FFFFFF',
    },
    tip: {
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: COLORS.borderLight,
        marginTop: -1,
    },
    tipOn: {
        borderTopColor: COLORS.primary,
    },
});

export default memo(PropertyMarker);
