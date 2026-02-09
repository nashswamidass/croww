import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS, SHADOWS } from '../constants/theme';
import { userService } from '../services/userService';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Main Screens
import HomeScreen from '../screens/main/HomeScreen';
import MapScreen from '../screens/main/MapScreen';
import SearchScreen from '../screens/main/SearchScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import BusinessDashboardScreen from '../screens/main/BusinessDashboardScreen';
import EventSearchScreen from '../screens/main/EventSearchScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ServiceDetailScreen from '../screens/main/ServiceDetailScreen';
import EventDetailScreen from '../screens/main/EventDetailScreen';
import CreateEventScreen from '../screens/main/CreateEventScreen';
import EventBuddyScreen from '../screens/main/EventBuddyScreen';
import CreateBuddyRequestScreen from '../screens/main/CreateBuddyRequestScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import PrivacyScreen from '../screens/main/PrivacyScreen';
import BlockedUsersScreen from '../screens/main/BlockedUsersScreen';
import HelpCenterScreen from '../screens/main/HelpCenterScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import MyTicketsScreen from '../screens/main/MyTicketsScreen';

// Verification Screens
import AadhaarVerificationScreen from '../screens/verification/AadhaarVerificationScreen';
import BusinessVerificationScreen from '../screens/verification/BusinessVerificationScreen';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBarIcon from '../components/TabBarIcon';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
    const insets = useSafeAreaInsets();
    const [isBusiness, setIsBusiness] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const user = await userService.getUser();
            setIsBusiness(user?.userType === 'business' || user?.userType === 'provider');
        };
        checkUser();
    }, []);

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
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 8,
                },
                tabBarShowLabel: false,
                tabBarIcon: ({ focused }) => {
                    let iconName;
                    if (route.name === 'Home') {
                        if (isBusiness) {
                            iconName = focused ? 'analytics' : 'analytics-outline';
                        } else {
                            iconName = focused ? 'home' : 'home-outline';
                        }
                    }
                    else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
                    else if (route.name === 'Search') iconName = focused ? 'storefront' : 'storefront-outline';
                    else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

                    return <TabBarIcon focused={focused} name={iconName} />;
                },
            })}
        >
            <Tab.Screen
                name="Home"
                component={isBusiness ? BusinessDashboardScreen : HomeScreen}
            />
            <Tab.Screen name="Map" component={MapScreen} />
            <Tab.Screen name="Search" component={SearchScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
};

const AuthNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
        </Stack.Navigator>
    );
};

const MainNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs" component={MainTabNavigator} />
            <Stack.Screen name="BusinessDashboard" component={BusinessDashboardScreen} />
            <Stack.Screen name="EventSearch" component={EventSearchScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} />
            <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
            <Stack.Screen name="AadhaarVerification" component={AadhaarVerificationScreen} />
            <Stack.Screen name="BusinessVerification" component={BusinessVerificationScreen} />
            <Stack.Screen name="EventBuddy" component={EventBuddyScreen} />
            <Stack.Screen name="CreateBuddyRequest" component={CreateBuddyRequestScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} />
            <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        </Stack.Navigator>
    );
};

const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Auth">
                <Stack.Screen name="Auth" component={AuthNavigator} />
                <Stack.Screen name="Main" component={MainNavigator} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
