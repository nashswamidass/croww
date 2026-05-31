import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING } from '../constants/theme';

const ScreenWrapper = ({ children, style, edges = ['top', 'left', 'right', 'bottom'] }) => {
    return (
        <SafeAreaView style={[styles.container, style]} edges={edges}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            {/* Premium Subtle Gradient Background */}
            <LinearGradient
                colors={['#240A0A', '#0A0A0A', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.6, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.content}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Fallback color in case gradient fails to load
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
    },
});

export default ScreenWrapper;
