import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';

const ScreenWrapper = ({ children, style, edges = ['top', 'left', 'right', 'bottom'] }) => {
    return (
        <SafeAreaView style={[styles.container, style]} edges={edges}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <View style={styles.content}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
    },
});

export default ScreenWrapper;
