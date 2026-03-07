import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS, SHADOWS } from '../constants/theme';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import BlockedScreen from '../screens/auth/BlockedScreen';
import LegalPolicyScreen from '../screens/auth/LegalPolicyScreen';
import linking from './linking';

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
import InquiryListScreen from '../screens/main/InquiryListScreen';
import ManageEventsScreen from '../screens/main/ManageEventsScreen';
import ManagePackagesScreen from '../screens/main/ManagePackagesScreen';
import ManageStaffScreen from '../screens/main/ManageStaffScreen';
import TicketScannerScreen from '../screens/main/TicketScannerScreen';
import EventStatsScreen from '../screens/main/EventStatsScreen';
import EventTicketsScreen from '../screens/main/EventTicketsScreen';
import FriendRequestsScreen from '../screens/main/FriendRequestsScreen';
import FriendsListScreen from '../screens/main/FriendsListScreen';
import TicketDetailScreen from '../screens/main/TicketDetailScreen';
import WebPaymentScreen from '../screens/main/WebPaymentScreen';
import CreateBookingScreen from '../screens/main/CreateBookingScreen';
import ChatListScreen from '../screens/main/ChatListScreen';
import EventListScreen from '../screens/main/EventListScreen';
import ProviderBookingsScreen from '../screens/main/ProviderBookingsScreen';
import BookingDetailScreen from '../screens/main/BookingDetailScreen';
import ReviewListScreen from '../screens/main/ReviewListScreen';

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
                    else if (route.name === 'Tickets') iconName = focused ? 'ticket' : 'ticket-outline';
                    else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

                    return <TabBarIcon focused={focused} name={iconName} />;
                },
            })}
        >
            <Tab.Screen
                name="Home"
                component={isBusiness ? BusinessDashboardScreen : HomeScreen}
            />
            {!isBusiness && (
                <Tab.Screen name="Tickets" component={MyTicketsScreen} />
            )}
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
            <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
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
            <Stack.Screen name="InquiryList" component={InquiryListScreen} />
            <Stack.Screen name="ManageEvents" component={ManageEventsScreen} />
            <Stack.Screen name="ManagePackages" component={ManagePackagesScreen} />
            <Stack.Screen name="ManageStaff" component={ManageStaffScreen} />
            <Stack.Screen name="TicketScanner" component={TicketScannerScreen} />
            <Stack.Screen name="EventStats" component={EventStatsScreen} />
            <Stack.Screen name="EventTickets" component={EventTicketsScreen} />
            <Stack.Screen name="FriendRequests" component={FriendRequestsScreen} />
            <Stack.Screen name="FriendsList" component={FriendsListScreen} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
            <Stack.Screen name="WebPayment" component={WebPaymentScreen} />
            <Stack.Screen name="CreateBooking" component={CreateBookingScreen} />
            <Stack.Screen name="ProviderBookings" component={ProviderBookingsScreen} />
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
            <Stack.Screen name="EventList" component={EventListScreen} />
            <Stack.Screen name="ReviewList" component={ReviewListScreen} />
            <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
        </Stack.Navigator>
    );
};

import { pushNotificationService } from '../services/pushNotificationService';

const AppNavigator = () => {
    const { user, loading, isBlocked, isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated && user) {
            // Register for push notifications
            pushNotificationService.registerForPushNotificationsAsync();

            // Add listener for when user interacts with notification
            const cleanup = pushNotificationService.addNotificationListeners(
                (notification) => {
                    console.log('Notification Received in Foreground:', notification);
                },
                (response) => {
                    console.log('User Interacted with Notification:', response);
                    // Navigation logic could go here based on response.notification.request.content.data
                }
            );

            return () => {
                if (cleanup) cleanup();
            };
        }
    }, [isAuthenticated, user?.id]);

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: '#000000' }]}>
                <View style={styles.logoWrapper}>
                    <Image
                        source={require('../../assets/croww-logo.png')}
                        style={styles.loadingLogo}
                        resizeMode="contain"
                    />
                </View>
            </View>
        );
    }

    return (
        <NavigationContainer linking={linking}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {isBlocked ? (
                    <Stack.Screen name="Blocked" component={BlockedScreen} />
                ) : !isAuthenticated ? (
                    <Stack.Screen name="Auth" component={AuthNavigator} />
                ) : (
                    <Stack.Screen name="Main" component={MainNavigator} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingLogo: {
        width: 200,
        height: 100,
    },
});

export default AppNavigator;

