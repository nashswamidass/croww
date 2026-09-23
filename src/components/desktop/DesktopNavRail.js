import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { TABS } from '../../navigation/routeNames';
import CrowwAreaIntelligenceIcon from '../icons/CrowwAreaIntelligenceIcon';

export default function DesktopNavRail({ activeTab, onTabSelect, isIntelligenceMode, style }) {
    const navItems = [
        {
            name: TABS.Explore,
            label: 'Home',
            iconActive: 'home',
            iconInactive: 'home-outline',
            isActive: activeTab === TABS.Explore && !isIntelligenceMode,
        },
        {
            name: TABS.Areas,
            label: 'Areas',
            customIcon: true,
            isActive: activeTab === TABS.Areas || isIntelligenceMode,
        },
        {
            name: TABS.Saved,
            label: 'Saved',
            iconActive: 'bookmark',
            iconInactive: 'bookmark-outline',
            isActive: activeTab === TABS.Saved && !isIntelligenceMode,
        },
        {
            name: TABS.Messages,
            label: 'Messages',
            iconActive: 'chatbubbles',
            iconInactive: 'chatbubbles-outline',
            isActive: activeTab === TABS.Messages && !isIntelligenceMode,
        },
        {
            name: TABS.Post,
            label: 'Post',
            isSpecial: true,
            isActive: activeTab === TABS.Post && !isIntelligenceMode,
        },
    ];

    return (
        <aside style={{ height: '100%' }}>
            <View style={[styles.container, style]}>
                <View style={styles.navGroup}>
                    {navItems.map((item) => {
                        const { isActive, isSpecial, customIcon } = item;
                        return (
                            <TouchableOpacity
                                key={item.name}
                                style={[
                                    styles.navItem,
                                    isActive && !isSpecial && styles.navItemActive,
                                ]}
                                onPress={() => onTabSelect(item.name)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={item.label}
                                activeOpacity={0.8}
                            >
                                {isSpecial ? (
                                    <View style={[styles.postButton, isActive && styles.postButtonActive]}>
                                        <Ionicons name="add" size={24} color={isActive ? '#FFFFFF' : '#111827'} />
                                    </View>
                                ) : customIcon ? (
                                    <View style={styles.iconWrapper}>
                                        <CrowwAreaIntelligenceIcon
                                            size={22}
                                            color={isActive ? '#FFFFFF' : COLORS.secondary}
                                            focused={isActive}
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.iconWrapper}>
                                        <Ionicons
                                            name={isActive ? item.iconActive : item.iconInactive}
                                            size={22}
                                            color={isActive ? '#FFFFFF' : COLORS.secondary}
                                        />
                                    </View>
                                )}
                                <Text
                                    style={[
                                        styles.navLabel,
                                        isActive && !isSpecial && styles.navLabelActive,
                                        isSpecial && styles.navLabelSpecial,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </aside>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 76,
        backgroundColor: COLORS.surface,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
        alignItems: 'center',
        paddingVertical: SPACING.l,
        justifyContent: 'space-between',
        zIndex: 90,
    },
    navGroup: {
        width: '100%',
        alignItems: 'center',
        gap: SPACING.m,
    },
    navItem: {
        width: 60,
        height: 58,
        borderRadius: BORDER_RADIUS.m,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
    },
    navItemActive: {
        backgroundColor: COLORS.navigation || '#111111',
    },
    iconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 24,
    },
    navLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.secondary,
        marginTop: 4,
    },
    navLabelActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    navLabelSpecial: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    postButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    postButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
});
