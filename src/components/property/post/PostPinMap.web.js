import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { LIGHT_MAP_STYLE } from '../../../constants/mapStyle';
import { COLORS } from '../../../constants/theme';

const libraries = ['places'];
const containerStyle = { width: '100%', height: '100%' };

const PostPinMap = ({ coordinate, onPick, accessibilityLabel }) => {
    const mapRef = useRef(null);
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: API_KEY || '',
        libraries,
    });

    const center = {
        lat: coordinate?.latitude || 13.0827,
        lng: coordinate?.longitude || 80.2707,
    };

    useEffect(() => {
        if (coordinate && mapRef.current) {
            mapRef.current.panTo({ lat: coordinate.latitude, lng: coordinate.longitude });
        }
    }, [coordinate?.latitude, coordinate?.longitude]);

    if (loadError || !isLoaded) {
        return <View style={styles.wrap} accessibilityLabel={accessibilityLabel || 'Map'} />;
    }

    return (
        <View style={styles.wrap} accessibilityLabel={accessibilityLabel || 'Place the property on the map'}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={14}
                onLoad={(map) => { mapRef.current = map; }}
                onClick={(event) => {
                    const lat = event?.latLng?.lat();
                    const lng = event?.latLng?.lng();
                    if (Number.isFinite(lat) && Number.isFinite(lng) && onPick) {
                        onPick({ latitude: lat, longitude: lng });
                    }
                }}
                options={{
                    styles: LIGHT_MAP_STYLE,
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    keyboardShortcuts: false,
                }}
            >
                {coordinate ? (
                    <MarkerF position={{ lat: coordinate.latitude, lng: coordinate.longitude }} />
                ) : null}
            </GoogleMap>
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
});

export default PostPinMap;
