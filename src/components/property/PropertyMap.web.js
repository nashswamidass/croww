import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { EXPLORE_MAX_MARKERS } from '../../constants/explore';
import { formatListingPrice } from '../../utils/propertyFormat';
import { COLORS } from '../../constants/theme';
import Typography from '../Typography';

const libraries = ['places'];
const containerStyle = { width: '100%', height: '100%' };

const PropertyMap = ({
    initialRegion,
    followRegion,
    listings,
    selectedId,
    userCoordinate,
    onSelect,
    onRegionChangeComplete,
    onMapPress,
}) => {
    const mapRef = useRef(null);
    const defaultCenter = useRef({
        lat: initialRegion.latitude,
        lng: initialRegion.longitude,
    });
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: API_KEY || '',
        libraries,
    });

    const onLoad = useCallback((map) => {
        mapRef.current = map;
    }, []);

    useEffect(() => {
        if (followRegion && mapRef.current) {
            mapRef.current.panTo({ lat: followRegion.latitude, lng: followRegion.longitude });
            mapRef.current.setZoom(14);
        }
    }, [followRegion]);

    const handleIdle = () => {
        const map = mapRef.current;
        if (!map || !onRegionChangeComplete) return;
        const center = map.getCenter();
        const bounds = map.getBounds();
        if (!center || !bounds) return;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        onRegionChangeComplete({
            latitude: center.lat(),
            longitude: center.lng(),
            latitudeDelta: Math.abs(ne.lat() - sw.lat()),
            longitudeDelta: Math.abs(ne.lng() - sw.lng()),
        });
    };

    const markers = listings.slice(0, EXPLORE_MAX_MARKERS);

    if (loadError) {
        return (
            <View style={styles.fallback}>
                <Typography variant="body">Map failed to load. Check your connection.</Typography>
            </View>
        );
    }

    if (!isLoaded) {
        return <View style={styles.fallback} />;
    }

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={defaultCenter.current}
            zoom={13}
            onLoad={onLoad}
            onIdle={handleIdle}
            onClick={onMapPress}
            options={{
                styles: LIGHT_MAP_STYLE,
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: 'greedy',
            }}
        >
            {userCoordinate ? (
                <MarkerF
                    position={{ lat: userCoordinate.latitude, lng: userCoordinate.longitude }}
                    title="You"
                />
            ) : null}
            {markers.map((item) => {
                const selected = item.listingId === selectedId;
                const pos = item.mapCoordinate;
                if (!pos) return null;
                return (
                    <MarkerF
                        key={item.listingId}
                        position={{ lat: pos.latitude, lng: pos.longitude }}
                        label={{
                            text: formatListingPrice(item),
                            color: selected ? '#FFFFFF' : '#111827',
                            fontSize: '12px',
                            fontWeight: '700',
                        }}
                        onClick={() => onSelect(item)}
                    />
                );
            })}
        </GoogleMap>
    );
};

const styles = StyleSheet.create({
    fallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
});

export default PropertyMap;
