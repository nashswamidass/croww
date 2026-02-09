import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_DATA_KEY = 'croww_user_data';

export const userService = {
    /**
     * Save user data to storage
     */
    saveUser: async (userData) => {
        try {
            await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
            return true;
        } catch (error) {
            console.error('Error saving user data:', error);
            return false;
        }
    },

    /**
     * Get current user data
     */
    getUser: async () => {
        try {
            const data = await AsyncStorage.getItem(USER_DATA_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    },

    /**
     * Check if user is business account
     */
    isBusiness: async () => {
        const user = await userService.getUser();
        return user?.userType === 'business';
    },

    /**
     * Check if user is service provider
     */
    isProvider: async () => {
        const user = await userService.getUser();
        return user?.userType === 'provider';
    },

    /**
     * Sign out / Clear user data
     */
    logout: async () => {
        try {
            await AsyncStorage.removeItem(USER_DATA_KEY);
            return true;
        } catch (error) {
            console.error('Error during logout:', error);
            return false;
        }
    }
};
