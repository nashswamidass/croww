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
     * Register for push notifications and get the token
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

            if (!Device.isDevice) {
                console.warn('Must use physical device for Push Notifications');
                return null;
            }

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.warn('Failed to get push token for push notification!');
                return null;
            }

            // Get the token from Expo
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

            const token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
            console.log('Push Token Generated:', token);

            // Save token to user profile
            const user = await userService.getUser();
            if (user && user.id) {
                await userService.saveUser({ ...user, pushToken: token });
            }

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
