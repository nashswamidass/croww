import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { COLORS } from '../../constants/theme';

const PropertyMiniMap = ({ coordinate, accessibilityLabel = 'Property location' }) => {
    if (!coordinate) return null;

    const region = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
    };

    return (
        <View style={styles.container} accessibilityLabel={accessibilityLabel}>
            <MapView
                style={styles.map}
                initialRegion={region}
                customMapStyle={LIGHT_MAP_STYLE}
                userInterfaceStyle="light"
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
            >
                <Marker coordinate={coordinate} pinColor={COLORS.accent} />
            </MapView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 180,
        backgroundColor: COLORS.surfaceHighlight,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default PropertyMiniMap;
