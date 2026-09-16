import React from 'react';
import { useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import TabBarIcon from '../components/TabBarIcon';
import { TABS } from './routeNames';

import ExploreScreen from '../screens/property/ExploreScreen';
import SavedScreen from '../screens/property/SavedScreen';
import PostScreen from '../screens/property/PostScreen';
import ChatListScreen from '../screens/main/ChatListScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
    [TABS.Explore]: ['compass-outline', 'compass'],
    [TABS.Saved]: ['bookmark-outline', 'bookmark'],
    [TABS.Post]: ['add-circle-outline', 'add-circle'],
    [TABS.Messages]: ['chatbubbles-outline', 'chatbubbles'],
    [TABS.Profile]: ['person-outline', 'person'],
};

/**
 * Primary consumer shell with clean, light navigation bar.
 */
const PropertyTabNavigator = () => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 960;

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.secondary,
                tabBarStyle: {
                    backgroundColor: COLORS.surface,
                    borderTopWidth: 1,
                    borderTopColor: COLORS.border,
                    height: 68 + insets.bottom,
                    paddingBottom: Math.max(insets.bottom, 10),
                    paddingTop: 6,
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: -2 },
                    ...(isDesktop ? {
                        maxWidth: 680,
                        width: '100%',
                        alignSelf: 'center',
                        borderRadius: 24,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        shadowOpacity: 0.08,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 6 },
                    } : {}),
                },
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 0.1,
                    marginTop: 1,
                    marginBottom: 2,
                },
                tabBarIcon: ({ focused }) => {
                    const pair = TAB_ICONS[route.name] || ['ellipse-outline', 'ellipse'];
                    const iconName = focused ? pair[1] : pair[0];
                    return <TabBarIcon focused={focused} name={iconName} />;
                },
            })}
        >
            <Tab.Screen name={TABS.Explore} component={ExploreScreen} />
            <Tab.Screen name={TABS.Saved} component={SavedScreen} />
            <Tab.Screen name={TABS.Post} component={PostScreen} />
            <Tab.Screen name={TABS.Messages} component={ChatListScreen} />
            <Tab.Screen name={TABS.Profile} component={ProfileScreen} />
        </Tab.Navigator>
    );
};

export default PropertyTabNavigator;
