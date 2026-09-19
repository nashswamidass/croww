import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { userService } from './userService';
import Constants from 'expo-constants';

// Configure how notifications should be handled when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Wraps a promise with a timeout so notification-related calls never hang the UI.
 * Critical for iPad review devices where Expo push registration can deadlock.
 */
const withTimeout = (promise, ms = 5000, label = 'Operation') =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[pushNotification] ${label} timed out after ${ms}ms`)), ms)
        )
    ]);

export const pushNotificationService = {
    /**
     * Check if the required native module is available
     */
    isNativeModuleAvailable: () => {
        try {
            // A simple check to see if expo-notifications native module is linked
            return !!Notifications.getDevicePushTokenAsync;
        } catch (e) {
            return false;
        }
    },

    /**
     * Inspect current notification permission status from the OS.
     */
    getPermissionStatus: async () => {
        try {
            if (Platform.OS === 'web' || !pushNotificationService.isNativeModuleAvailable()) {
                return { status: 'denied', granted: false, canAskAgain: false };
            }
            const result = await withTimeout(
                Notifications.getPermissionsAsync(),
                5000,
                'getPermissionsAsync'
            );
            return {
                status: result.status,
                granted: result.status === 'granted',
                canAskAgain: result.canAskAgain,
            };
        } catch (e) {
            console.warn('[pushNotification] getPermissionStatus error:', e?.message);
            return { status: 'undetermined', granted: false, canAskAgain: true };
        }
    },

    /**
     * Request notification permissions from the OS using genuine platform mechanism.
     */
    requestPermissions: async () => {
        try {
            if (Platform.OS === 'web' || !pushNotificationService.isNativeModuleAvailable()) {
                return { status: 'denied', granted: false };
            }

            const result = await withTimeout(
                Notifications.requestPermissionsAsync(),
                8000,
                'requestPermissionsAsync'
            );

            if (Platform.OS === 'android' && result.status === 'granted') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            return {
                status: result.status,
                granted: result.status === 'granted',
                canAskAgain: result.canAskAgain,
            };
        } catch (e) {
            console.warn('[pushNotification] requestPermissions error:', e?.message);
            return { status: 'denied', granted: false, canAskAgain: false };
        }
    },

    /**
     * Deliver a local notification immediately for testing or local alert flows.
     */
    sendLocalNotification: async ({ title, body, data = {} }) => {
        try {
            if (Platform.OS === 'web' || !pushNotificationService.isNativeModuleAvailable()) {
                return null;
            }
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data,
                    sound: true,
                },
                trigger: null, // deliver immediately
            });
            return id;
        } catch (e) {
            console.warn('[pushNotification] sendLocalNotification error:', e?.message);
            return null;
        }
    },

    /**
     * Register for push notifications and get the token.
     * All async operations are wrapped in timeouts to prevent post-login freezes
     * on iPad review devices with restrictive IPv6 network configurations.
     */
    registerForPushNotificationsAsync: async () => {
        try {
            if (Platform.OS === 'web') {
                return null;
            }

            if (!pushNotificationService.isNativeModuleAvailable()) {
                console.warn('ExpoPushTokenManager native module not found. A native rebuild is likely required.');
                return null;
            }

            // Check and request OS permissions
            let existingStatus;
            try {
                const result = await withTimeout(
                    Notifications.getPermissionsAsync(),
                    5000,
                    'getPermissionsAsync'
                );
                existingStatus = result.status;
            } catch (err) {
                console.warn('[pushNotification] getPermissionsAsync timed out or failed:', err.message);
                return null;
            }

            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                try {
                    const result = await withTimeout(
                        Notifications.requestPermissionsAsync(),
                        8000,
                        'requestPermissionsAsync'
                    );
                    finalStatus = result.status;
                } catch (err) {
                    console.warn('[pushNotification] requestPermissionsAsync timed out or failed:', err.message);
                    return null;
                }
            }

            if (finalStatus !== 'granted') {
                console.warn('Notification permission not granted by user.');
                return null;
            }

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            // If not a physical device, return a development/emulator indicator rather than failing permission setup
            if (!Device.isDevice) {
                console.log('[pushNotification] OS permissions granted on emulator/non-physical device.');
                return 'emulator-token-active';
            }

            // Get the token from Expo — this makes a network request
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

            let token;
            try {
                const tokenResult = await withTimeout(
                    Notifications.getExpoPushTokenAsync({ projectId }),
                    10000,
                    'getExpoPushTokenAsync'
                );
                token = tokenResult.data;
                console.log('Push Token Generated:', token);
            } catch (err) {
                console.warn('[pushNotification] getExpoPushTokenAsync timed out or failed:', err.message);
                return null;
            }

            // Save token to user profile — fire-and-forget (non-blocking) so it never blocks login flow
            userService.getUser().then(user => {
                if (user && user.id) {
                    userService.saveUser({ ...user, pushToken: token }).catch(err =>
                        console.warn('[pushNotification] Failed to save push token:', err.message)
                    );
                }
            }).catch(() => { });

            return token;
        } catch (e) {
            const errorMessage = e.message || '';
            if (errorMessage.includes('FirebaseApp is not initialized')) {
                console.warn('Native Firebase is not initialized. Android Push Notifications require google-services.json and proper EAS configuration.');
            } else {
                console.error('Error in registerForPushNotificationsAsync:', e);
            }
            return null;
        }
    },

    /**
     * Listen for notifications
     */
    addNotificationListeners: (onReceived, onResponse) => {
        if (!pushNotificationService.isNativeModuleAvailable()) return () => { };

        try {
            // This listener is fired whenever a notification is received while the app is foregrounded
            const notificationListener = Notifications.addNotificationReceivedListener(notification => {
                if (onReceived) onReceived(notification);
            });

            // This listener is fired whenever a user taps on or interacts with a notification
            const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
                if (onResponse) onResponse(response);
            });

            return () => {
                notificationListener.remove();
                responseListener.remove();
            };
        } catch (e) {
            console.error('Error setting up notification listeners:', e);
            return () => { };
        }
    }
};
