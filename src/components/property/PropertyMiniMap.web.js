import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { COLORS } from '../../constants/theme';
import Typography from '../Typography';

const containerStyle = { width: '100%', height: '100%' };

const PropertyMiniMap = ({ coordinate, accessibilityLabel = 'Property location' }) => {
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script-mini',
        googleMapsApiKey: API_KEY || '',
    });

    if (loadError) {
        return (
            <View style={styles.fallback} accessibilityLabel={accessibilityLabel}>
                <Typography variant="caption">Map unavailable</Typography>
            </View>
        );
    }

    if (!isLoaded || !coordinate) {
        return <View style={styles.fallback} accessibilityLabel={accessibilityLabel} />;
    }

    return (
        <View style={styles.container} accessibilityLabel={accessibilityLabel}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={{ lat: coordinate.latitude, lng: coordinate.longitude }}
                zoom={14}
                options={{
                    styles: LIGHT_MAP_STYLE,
                    disableDefaultUI: true,
                    draggable: false,
                    scrollwheel: false,
                    keyboardShortcuts: false,
                }}
            >
                <MarkerF position={{ lat: coordinate.latitude, lng: coordinate.longitude }} />
            </GoogleMap>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 180,
        backgroundColor: COLORS.surfaceHighlight,
    },
    fallback: {
        width: '100%',
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceHighlight,
    },
});

export default PropertyMiniMap;
