import React, { useState, useEffect, useRef, createRef } from 'react';
import { View, ActivityIndicator, Image, StyleSheet, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';

import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
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
import { navigateFromNotification } from '../utils/notificationNavigation';
import { showAlert } from '../utils/showAlert';

export const navigationRef = createNavigationContainerRef();

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
import BuddyRequestDetailScreen from '../screens/main/BuddyRequestDetailScreen';
import ReviewListScreen from '../screens/main/ReviewListScreen';

// Verification Screens
import VerifyIdentityScreen from '../screens/verification/VerifyIdentityScreen';
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
            try {
                // Timeout guard: if AsyncStorage is slow on cold boot, don't stall tab rendering
                const userWithTimeout = await Promise.race([
                    userService.getUser(),
                    new Promise(resolve => setTimeout(() => resolve(null), 3000))
                ]);
                setIsBusiness(userWithTimeout?.userType === 'business' || userWithTimeout?.userType === 'provider');
            } catch (e) {
                // Non-critical — tab bar falls back to individual layout
                setIsBusiness(false);
            }
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
            <Stack.Screen name="VerifyIdentity" component={VerifyIdentityScreen} />
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
            <Stack.Screen name="BuddyRequestDetail" component={BuddyRequestDetailScreen} />
            <Stack.Screen name="ReviewList" component={ReviewListScreen} />
            <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
        </Stack.Navigator>
    );
};

import { pushNotificationService } from '../services/pushNotificationService';

const SETTINGS_KEY = '@croww_user_settings';
const LAST_ASK_KEY = '@croww_last_notification_ask';

const AppNavigator = () => {
    const { user, loading, isBlocked, isAuthenticated } = useAuth();
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // Forcefully clear the splash screen when app comes back to foreground
                // This prevents the iOS bug where a black splash screen persists after minimizing
                SplashScreen.hideAsync().catch(() => { });
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (isAuthenticated && user) {
            // CRITICAL FIX FOR iPADOS: Defer push notification registration by 3 seconds.
            // Calling registerForPushNotificationsAsync() immediately on auth fires the
            // iOS permission sheet during the navigation transition render window, which
            // can block ALL touch input on iPad even after JS-side has moved on.
            const pushDelay = setTimeout(async () => {
                try {
                    // REQUIRE CONSENT: Check if user has explicitly enabled push notifications
                    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
                    const parsed = stored ? JSON.parse(stored) : {};

                    if (parsed.pushNotifications === true) {
                        console.log('[AppNavigator] Push notifications enabled in settings, registering...');
                        pushNotificationService.registerForPushNotificationsAsync();
                    } else {
                        console.log('[AppNavigator] Push notifications disabled in settings, checking for daily prompt...');
                        
                        // DAILY PROMPT LOGIC
                        const lastAsk = await AsyncStorage.getItem(LAST_ASK_KEY);
                        const today = new Date().toISOString().split('T')[0];

                        if (lastAsk !== today) {
                            showAlert(
                                'Enable Notifications',
                                'Stay updated! Switch on notifications to get your messages and booking updates faster.',
                                [
                                    { text: 'Later', style: 'cancel' },
                                    { 
                                        text: 'Turn On', 
                                        onPress: async () => {
                                            const token = await pushNotificationService.registerForPushNotificationsAsync();
                                            if (token) {
                                                // Update settings so we don't ask again and start registering tokens
                                                await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
                                                    ...parsed,
                                                    pushNotifications: true
                                                }));
                                                showAlert('Success', 'Push notifications have been enabled.');
                                            } else {
                                                showAlert('Permission Required', 'To enable notifications, please allow them in your device settings.');
                                            }
                                        }
                                    }
                                ]
                            );
                            await AsyncStorage.setItem(LAST_ASK_KEY, today);
                        }
                    }
                } catch (e) {
                    console.error('[AppNavigator] Error in notification logic:', e);
                }
            }, 3000);

            // Add listener for when user interacts with notification
            const cleanup = pushNotificationService.addNotificationListeners(
                (notification) => {
                    console.log('Notification Received in Foreground:', notification);
                },
                (response) => {
                    // User tapped a push notification — deep link to the relevant screen
                    const data = response?.notification?.request?.content?.data || {};
                    console.log('Push notification tapped, navigating with data:', data);
                    if (navigationRef.isReady()) {
                        navigateFromNotification(navigationRef, data);
                    }
                }
            );

            return () => {
                clearTimeout(pushDelay);
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
        <NavigationContainer linking={linking} ref={navigationRef}>
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

