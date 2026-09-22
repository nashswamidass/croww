import React from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import TabBarIcon from '../components/TabBarIcon';
import { TABS } from './routeNames';

import { useExplore } from '../context/ExploreContext';

import ExploreScreen from '../screens/property/ExploreScreen';
import SavedScreen from '../screens/property/SavedScreen';
import PostScreen from '../screens/property/PostScreen';
import CrowwAreaIntelligenceIcon from '../components/icons/CrowwAreaIntelligenceIcon';
import ChatListScreen from '../screens/main/ChatListScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
    [TABS.Explore]: ['home-outline', 'home'],
    [TABS.Saved]: ['bookmark-outline', 'bookmark'],
    [TABS.Post]: ['add', 'add'],
    [TABS.Areas]: ['sparkles-outline', 'sparkles'],
    [TABS.Messages]: ['chatbubbles-outline', 'chatbubbles'],
};

const TAB_LABELS = {
    [TABS.Explore]: 'Home',
    [TABS.Saved]: 'Saved',
    [TABS.Post]: 'Post',
    [TABS.Areas]: 'Areas',
    [TABS.Messages]: 'Messages',
};

/**
 * Primary consumer shell with floating black pill navigation.
 * Tabs: Home | Saved | Post | Areas | Messages
 * Profile is accessible via the main stack (Settings button, ChatList nav, deep link).
 */
const PropertyTabNavigator = () => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 960;
    const { isIntelligenceMode, setIntelligenceMode, openAreasMode } = useExplore();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => {
                const isExploreTab = route.name === TABS.Explore;
                const isAreasTab = route.name === TABS.Areas;

                return {
                    headerShown: false,
                    tabBarActiveTintColor: COLORS.navActive || '#FFFFFF',
                    tabBarInactiveTintColor: COLORS.navInactive || 'rgba(255, 255, 255, 0.60)',
                    tabBarStyle: [
                        styles.tabBar,
                        {
                            bottom: Math.max(insets.bottom, 12),
                            ...(isDesktop
                                ? {
                                    left: '50%',
                                    right: 'auto',
                                    width: 520,
                                    transform: [{ translateX: -260 }],
                                }
                                : {
                                    left: 16,
                                    right: 16,
                                }),
                        },
                    ],
                    tabBarShowLabel: true,
                    tabBarLabel: ({ focused }) => {
                        const effectiveFocused = isExploreTab
                            ? (focused && !isIntelligenceMode)
                            : isAreasTab
                                ? isIntelligenceMode
                                : focused;
                        return (
                            <Text
                                style={[
                                    styles.tabBarLabel,
                                    { color: effectiveFocused ? (COLORS.navActive || '#FFFFFF') : (COLORS.navInactive || 'rgba(255, 255, 255, 0.60)') },
                                ]}
                            >
                                {TAB_LABELS[route.name] || route.name}
                            </Text>
                        );
                    },
                    tabBarIcon: ({ focused }) => {
                        if (route.name === TABS.Post) {
                            return (
                                <View style={styles.postButtonCircle}>
                                    <Ionicons name="add" size={24} color="#111111" />
                                </View>
                            );
                        }
                        const effectiveFocused = isExploreTab
                            ? (focused && !isIntelligenceMode)
                            : isAreasTab
                                ? isIntelligenceMode
                                : focused;
                        const iconColor = effectiveFocused ? (COLORS.navActive || '#FFFFFF') : (COLORS.navInactive || 'rgba(255, 255, 255, 0.60)');

                        if (route.name === TABS.Areas) {
                            return (
                                <CrowwAreaIntelligenceIcon
                                    size={22}
                                    color={iconColor}
                                    focused={effectiveFocused}
                                />
                            );
                        }

                        const pair = TAB_ICONS[route.name] || ['ellipse-outline', 'ellipse'];
                        const iconName = effectiveFocused ? pair[1] : pair[0];

                        return (
                            <TabBarIcon
                                focused={effectiveFocused}
                                name={iconName}
                                color={iconColor}
                                size={22}
                            />
                        );
                    },
                };
            }}
        >
            <Tab.Screen
                name={TABS.Explore}
                component={ExploreScreen}
                listeners={() => ({
                    tabPress: () => {
                        if (isIntelligenceMode) {
                            setIntelligenceMode(false);
                        }
                    },
                })}
            />
            <Tab.Screen
                name={TABS.Saved}
                component={SavedScreen}
                listeners={() => ({
                    tabPress: () => {
                        if (isIntelligenceMode) {
                            setIntelligenceMode(false);
                        }
                    },
                })}
            />
            <Tab.Screen name={TABS.Post} component={PostScreen} />
            <Tab.Screen
                name={TABS.Areas}
                component={ExploreScreen}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.navigate(TABS.Explore);
                        openAreasMode(true);
                    },
                })}
            />
            <Tab.Screen
                name={TABS.Messages}
                component={ChatListScreen}
                listeners={() => ({
                    tabPress: () => {
                        if (isIntelligenceMode) {
                            setIntelligenceMode(false);
                        }
                    },
                })}
            />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        backgroundColor: COLORS.navBlack || '#0F0F0F',
        borderRadius: 36,
        height: 64,
        paddingBottom: 6,
        paddingTop: 6,
        paddingHorizontal: 8,
        borderTopWidth: 0,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    tabBarLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.1,
        marginTop: 2,
    },
    postButtonCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -4,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 5,
    },
});

export default PropertyTabNavigator;
