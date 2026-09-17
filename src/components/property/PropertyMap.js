import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapView, { PROVIDER_GOOGLE, Marker, Circle } from 'react-native-maps';
import { LIGHT_MAP_STYLE } from '../../constants/mapStyle';
import { EXPLORE_MAX_MARKERS } from '../../constants/explore';
import PropertyMarker from './PropertyMarker';
import LocalityScoreBubble from '../intelligence/LocalityScoreBubble';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const mapProvider = Platform.OS === 'android'
    ? PROVIDER_GOOGLE
    : (isExpoGo ? undefined : PROVIDER_GOOGLE);

const PropertyMap = ({
    initialRegion,
    followRegion,
    listings = [],
    selectedId,
    userCoordinate,
    onSelect,
    onRegionChangeComplete,
    onMapPress,
    intelligenceMode = false,
    localityRegions = [],
}) => {
    const mapRef = useRef(null);

    useEffect(() => {
        if (followRegion && mapRef.current) {
            mapRef.current.animateToRegion(followRegion, 700);
        }
    }, [followRegion]);

    const markers = listings.slice(0, EXPLORE_MAX_MARKERS);
    if (selectedId && !markers.some((item) => item.listingId === selectedId)) {
        const extra = listings.find((item) => item.listingId === selectedId);
        if (extra) markers.push(extra);
    }

    return (
        <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            provider={mapProvider}
            customMapStyle={LIGHT_MAP_STYLE}
            userInterfaceStyle="light"
            onPress={onMapPress}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation={!!userCoordinate}
            showsMyLocationButton={false}
            rotateEnabled={false}
            accessibilityLabel="Property map"
        >
            {userCoordinate ? (
                <Marker
                    coordinate={userCoordinate}
                    pinColor="#0F766E"
                    title="You"
                    identifier="user-location"
                />
            ) : null}

            {intelligenceMode && localityRegions && localityRegions.length > 0 ? (
                localityRegions.map((item) => (
                    <React.Fragment key={`region_${item.locality.id}`}>
                        <Circle
                            center={{ latitude: item.locality.latitude, longitude: item.locality.longitude }}
                            radius={1600}
                            fillColor={item.locality.id === selectedId ? 'rgba(124, 58, 237, 0.26)' : 'rgba(124, 58, 237, 0.14)'}
                            strokeColor="rgba(124, 58, 237, 0.6)"
                            strokeWidth={1.5}
                        />
                        <Marker
                            coordinate={{ latitude: item.locality.latitude, longitude: item.locality.longitude }}
                            onPress={() => onSelect && onSelect(item)}
                        >
                            <LocalityScoreBubble
                                name={item.locality.name}
                                score={item.score}
                                selected={item.locality.id === selectedId}
                            />
                        </Marker>
                    </React.Fragment>
                ))
            ) : (
                markers.map((item) => (
                    <PropertyMarker
                        key={item.listingId}
                        item={item}
                        selected={item.listingId === selectedId}
                        onPress={onSelect}
                    />
                ))
            )}
        </MapView>
    );
};

const styles = StyleSheet.create({
    map: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default PropertyMap;
