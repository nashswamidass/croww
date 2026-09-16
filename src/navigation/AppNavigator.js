import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ExploreProvider } from '../context/ExploreContext';
import { AreaScorePreferencesProvider } from '../context/AreaScorePreferencesContext';
import { SavedItemsProvider } from '../context/SavedItemsContext';
import PropertyTabNavigator from './PropertyTabNavigator';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import BlockedScreen from '../screens/auth/BlockedScreen';
import LegalPolicyScreen from '../screens/auth/LegalPolicyScreen';
import linking from './linking';
import { navigateFromNotification } from '../utils/notificationNavigation';
import { showAlert } from '../utils/showAlert';
import { pushNotificationService } from '../services/pushNotificationService';

// Main Screens
import HomeScreen from '../screens/main/HomeScreen';
import MapScreen from '../screens/main/MapScreen';
import SearchScreen from '../screens/main/SearchScreen';
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
import PropertyScreen from '../screens/property/PropertyScreen';
import ListingScreen from '../screens/property/ListingScreen';
import LocalityScreen from '../screens/property/LocalityScreen';
import PostListingScreen from '../screens/property/PostListingScreen';
import InventoryDashboardScreen from '../screens/property/InventoryDashboardScreen';
import InventoryMediaScreen from '../screens/property/InventoryMediaScreen';
import TrustOverviewScreen from '../screens/property/TrustOverviewScreen';
import SubmitVerificationScreen from '../screens/property/SubmitVerificationScreen';
import SpatialTourScreen from '../screens/property/SpatialTourScreen';
import SavedSearchScreen from '../screens/property/SavedSearchScreen';
import PropertyVisualQAScreen from '../screens/property/PropertyVisualQAScreen';

// Verification Screens
import VerifyIdentityScreen from '../screens/verification/VerifyIdentityScreen';
import BusinessVerificationScreen from '../screens/verification/BusinessVerificationScreen';

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
        </Stack.Navigator>
    );
};

const MainNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs" component={PropertyTabNavigator} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Property" component={PropertyScreen} />
            <Stack.Screen name="Listing" component={ListingScreen} />
            <Stack.Screen name="Locality" component={LocalityScreen} />
            <Stack.Screen name="PostListing" component={PostListingScreen} />
            <Stack.Screen name="InventoryDashboard" component={InventoryDashboardScreen} />
            <Stack.Screen name="InventoryMedia" component={InventoryMediaScreen} />
            <Stack.Screen name="TrustOverview" component={TrustOverviewScreen} />
            <Stack.Screen name="SubmitVerification" component={SubmitVerificationScreen} />
            <Stack.Screen name="SpatialTour" component={SpatialTourScreen} />
            <Stack.Screen name="SavedSearch" component={SavedSearchScreen} />
            <Stack.Screen name="PropertyVisualQA" component={PropertyVisualQAScreen} />
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
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Navigator>
    );
};

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
        <ExploreProvider>
            <AreaScorePreferencesProvider>
            <SavedItemsProvider>
            <NavigationContainer linking={linking} ref={navigationRef}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {isBlocked ? (
                        <Stack.Screen name="Blocked" component={BlockedScreen} />
                    ) : (
                        <>
                            <Stack.Screen name="Main" component={MainNavigator} />
                            <Stack.Screen
                                name="Auth"
                                component={AuthNavigator}
                                options={{ presentation: 'modal' }}
                            />
                        </>
                    )}
                </Stack.Navigator>
            </NavigationContainer>
            </SavedItemsProvider>
            </AreaScorePreferencesProvider>
        </ExploreProvider>
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

