import React from 'react';
import { View, StyleSheet } from 'react-native';
import DesktopTopBar from './DesktopTopBar';
import DesktopNavRail from './DesktopNavRail';
import { COLORS } from '../../constants/theme';

export default function DesktopShell({
    activeTab,
    onTabSelect,
    isIntelligenceMode,
    children,
    style,
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <View style={[styles.root, style]}>
                {/* 1. Desktop Top Bar */}
                <DesktopTopBar />

                {/* 2. Main Desktop Viewport: Left Rail + Center/Right Content */}
                <View style={styles.body}>
                    <DesktopNavRail
                        activeTab={activeTab}
                        onTabSelect={onTabSelect}
                        isIntelligenceMode={isIntelligenceMode}
                    />
                    <View style={styles.viewport}>
                        {children}
                    </View>
                </View>
            </View>
        </div>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.background,
        overflow: 'hidden',
    },
    body: {
        flex: 1,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    viewport: {
        flex: 1,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
});
