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
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
    [TABS.Explore]: ['home-outline', 'home'],
    [TABS.Saved]: ['bookmark-outline', 'bookmark'],
    [TABS.Post]: ['add', 'add'],
    [TABS.Areas]: ['sparkles-outline', 'sparkles'],
    [TABS.Profile]: ['person-outline', 'person'],
};

const TAB_LABELS = {
    [TABS.Explore]: 'Home',
    [TABS.Saved]: 'Saved',
    [TABS.Post]: 'Post',
    [TABS.Areas]: 'Areas',
    [TABS.Profile]: 'Profile',
};

/**
 * Primary consumer shell with floating black pill navigation.
 * Matches reference aesthetic: high contrast, minimal chrome, prominent center action.
 */
const PropertyTabNavigator = () => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 960;
    const { isIntelligenceMode, setIntelligenceMode } = useExplore();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => {
                const isExploreTab = route.name === TABS.Explore;
                const isAreasTab = route.name === TABS.Areas;

                return {
                    headerShown: false,
                    tabBarActiveTintColor: COLORS.accent,
                    tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.55)',
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
                                    { color: effectiveFocused ? COLORS.accent : 'rgba(255, 255, 255, 0.55)' },
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
                                    <Ionicons name="add" size={24} color="#FFFFFF" />
                                </View>
                            );
                        }
                        const pair = TAB_ICONS[route.name] || ['ellipse-outline', 'ellipse'];
                        const effectiveFocused = isExploreTab
                            ? (focused && !isIntelligenceMode)
                            : isAreasTab
                                ? isIntelligenceMode
                                : focused;
                        const iconName = effectiveFocused ? pair[1] : pair[0];
                        const iconColor = effectiveFocused ? COLORS.accent : 'rgba(255, 255, 255, 0.55)';

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
                        setIntelligenceMode(true);
                        navigation.navigate(TABS.Explore);
                    },
                })}
            />
            <Tab.Screen
                name={TABS.Profile}
                component={ProfileScreen}
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
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -4,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
        elevation: 6,
    },
});

export default PropertyTabNavigator;
