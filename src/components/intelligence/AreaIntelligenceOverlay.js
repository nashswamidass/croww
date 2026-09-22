import React from 'react';
import {
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IntelligenceMapOverlay from './IntelligenceMapOverlay';
import LocalityDetailSheet from './LocalityDetailSheet';
import { getFloatingNavbarClearance } from '../../constants/layout';

export const INTELLIGENCE_PHASES = {
    INTRO: 'INTRO',
    PREFERENCES: 'PREFERENCES',
    MAP: 'MAP',
};

export default function AreaIntelligenceOverlay({
    scoredLocalities = [],
    selectedLocality = null,
    selectedLocalityData = null,
    isDetailOpen = false,
    matcherRan = false,
    city = 'Chennai',
    onResetPreferences,
    onSelectLocality,
    onOpenLocalityDetail,
    onCloseLocalityDetail,
    onExploreLocality,
    onClose,
    onDismissLocality,
}) {
    const insets = useSafeAreaInsets();

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            {/* Top header control & Corner legend & Compact Area Result Card */}
            <IntelligenceMapOverlay
                scoredLocalities={scoredLocalities}
                selectedLocality={selectedLocality}
                selectedLocalityData={selectedLocalityData}
                matcherRan={matcherRan}
                city={city}
                onSelectLocality={onSelectLocality}
                onResetPreferences={onResetPreferences}
                onClose={onClose}
                onExploreLocality={onOpenLocalityDetail || onExploreLocality}
                onDismissLocality={onDismissLocality}
            />

            {/* Floating Detailed Locality Sheet ONLY after explicit user action */}
            {isDetailOpen && selectedLocality && (
                <View
                    style={[
                        styles.detailSheetContainer,
                        { paddingBottom: getFloatingNavbarClearance(insets, 8) },
                    ]}
                    pointerEvents="box-none"
                >
                    <LocalityDetailSheet
                        locality={selectedLocality}
                        scoreResult={selectedLocalityData?.result || selectedLocalityData}
                        onExplore={onExploreLocality}
                        onClose={onCloseLocalityDetail}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    detailSheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
    },
});
