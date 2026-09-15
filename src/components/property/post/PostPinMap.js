import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { LIGHT_MAP_STYLE } from '../../../constants/mapStyle';
import { COLORS } from '../../../constants/theme';

const PostPinMap = ({ coordinate, onPick, accessibilityLabel }) => {
    const mapRef = useRef(null);

    const region = {
        latitude: coordinate?.latitude || 13.0827,
        longitude: coordinate?.longitude || 80.2707,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
    };

    useEffect(() => {
        if (coordinate && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 500);
        }
    }, [coordinate]);

    return (
        <View style={styles.wrap} accessibilityLabel={accessibilityLabel || 'Place the property on the map'}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={region}
                customMapStyle={LIGHT_MAP_STYLE}
                userInterfaceStyle="light"
                onPress={(e) => {
                    const c = e?.nativeEvent?.coordinate;
                    if (c && onPick) onPick(c);
                }}
                rotateEnabled={false}
            >
                {coordinate ? (
                    <Marker coordinate={coordinate} pinColor={COLORS.accent} />
                ) : null}
            </MapView>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        height: 220,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 14,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default PostPinMap;
