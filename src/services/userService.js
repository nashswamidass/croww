import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    or,
    deleteDoc,
    increment,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import API_ENDPOINTS from '../constants/apiConfig';

const USERS_COLLECTION = 'users';
const FOLLOWS_COLLECTION = 'follows';

export const userService = {
    /**
     * Get all service providers and businesses for the marketplace.
     * Excludes blocked users (deleted by admin).
     */
    getServiceProviders: async () => {
        try {
            const q = query(
                collection(db, USERS_COLLECTION),
                where('userType', 'in', ['provider', 'business'])
            );
            const querySnapshot = await getDocs(q);
            const providers = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Exclude blocked/admin-deleted users
                if (data.isBlocked === true) return;
                providers.push({ id: doc.id, ...data });
            });
            return providers;
        } catch (error) {
            console.error("Error fetching providers: ", error);
            throw error;
        }
    },

    /**
     * Get a specific user/provider by ID
     */
    getUserById: async (userId) => {
        try {
            // Extreme safety guard for Production
            if (!userId) {
                console.warn("getUserById called with null/undefined userId");
                return null;
            }

            const cleanId = typeof userId === 'string' ? userId : (userId.id || userId.uid || String(userId));

            if (!cleanId || cleanId === 'undefined' || cleanId === '[object Object]') {
                console.warn("Invalid cleanId in getUserById:", cleanId);
                return null;
            }

            const docRef = doc(db, USERS_COLLECTION, cleanId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error("Error fetching user: ", error);
            // Don't re-throw to prevent UI crashes if this is called in a loop (like ChatList)
            return null;
        }
    },

    /**
     * Get marketplace settings (enabled categories, etc.)
     */
    getMarketplaceSettings: async () => {
        try {
            const docRef = doc(db, 'app_settings', 'marketplace');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data();
            }
            return null;
        } catch (error) {
            console.error("Error fetching marketplace settings: ", error);
            return null;
        }
    },

    /**
     * Save user data to both Firestore and Local Storage
     * @param {Object} userData 
     * @returns {Promise<boolean>} Success status
     */
    saveUser: async (userData) => {
        try {
            if (!userData.id) throw new Error("User ID is required to save user");

            // 1. Save to Firestore
            await setDoc(doc(db, USERS_COLLECTION, userData.id), userData, { merge: true });

            // 2. Update Local Storage
            await userService.saveUserToStorage(userData);

            return true;
        } catch (error) {
            console.error("Error saving user: ", error);
            return false;
        }
    },

    /**
     * Add a staff member to a business
     * @param {string} businessId 
     * @param {Object} staffData 
     */
    addStaff: async (businessId, staffData) => {
        try {
            const userRef = doc(db, USERS_COLLECTION, businessId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const currentData = userSnap.data();
                const staff = currentData.staff || [];
                const newStaff = {
                    id: 'staff-' + Date.now(),
                    ...staffData,
                    createdAt: new Date().toISOString()
                };

                await setDoc(userRef, {
                    staff: [...staff, newStaff]
                }, { merge: true });

                // Update local storage if this is the current user
                const currentUser = await userService.getUser();
                if (currentUser && currentUser.id === businessId) {
                    await userService.saveUserToStorage({
                        ...currentUser,
                        staff: [...staff, newStaff]
                    });
                }

                return newStaff;
            }
            return null;
        } catch (error) {
            console.error("Error adding staff: ", error);
            throw error;
        }
    },

    /**
     * Remove a staff member from a business
     * @param {string} businessId 
     * @param {string} staffId 
     */
    removeStaff: async (businessId, staffId) => {
        try {
            const userRef = doc(db, USERS_COLLECTION, businessId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const currentData = userSnap.data();
                const staff = currentData.staff || [];
                const updatedStaff = staff.filter(s => s.id !== staffId);

                await setDoc(userRef, { staff: updatedStaff }, { merge: true });

                // Update local storage if this is the current user
                const currentUser = await userService.getUser();
                if (currentUser && currentUser.id === businessId) {
                    await userService.saveUserToStorage({
                        ...currentUser,
                        staff: updatedStaff
                    });
                }

                return true;
            }
            return false;
        } catch (error) {
            console.error("Error removing staff: ", error);
            throw error;
        }
    },

    /**
     * Add a service package to a provider
     * @param {string} userId 
     * @param {Object} packageData 
     */
    addPackage: async (userId, packageData) => {
        try {
            const userRef = doc(db, USERS_COLLECTION, userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const currentData = userSnap.data();
                const packages = currentData.packages || [];
                const newPackage = {
                    id: 'pkg-' + Date.now(),
                    ...packageData,
                    createdAt: new Date().toISOString()
                };

                await setDoc(userRef, {
                    packages: [...packages, newPackage]
                }, { merge: true });

                // Update local storage if this is the current user
                const currentUser = await userService.getUser();
                if (currentUser && currentUser.id === userId) {
                    await userService.saveUserToStorage({
                        ...currentUser,
                        packages: [...packages, newPackage]
                    });
                }

                return newPackage;
            }
            return null;
        } catch (error) {
            console.error("Error adding package: ", error);
            throw error;
        }
    },

    /**
     * Remove a service package from a provider
     * @param {string} userId 
     * @param {string} packageId 
     */
    removePackage: async (userId, packageId) => {
        try {
            const userRef = doc(db, USERS_COLLECTION, userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const currentData = userSnap.data();
                const packages = currentData.packages || [];
                const updatedPackages = packages.filter(p => p.id !== packageId);

                await setDoc(userRef, { packages: updatedPackages }, { merge: true });

                // Update local storage if this is the current user
                const currentUser = await userService.getUser();
                if (currentUser && currentUser.id === userId) {
                    await userService.saveUserToStorage({
                        ...currentUser,
                        packages: updatedPackages
                    });
                }

                return true;
            }
            return false;
        } catch (error) {
            console.error("Error removing package: ", error);
            throw error;
        }
    },

    /**
     * Update specific fields on a user's Firestore profile (partial merge).
     * @param {string} userId
     * @param {Object} data - Fields to update (e.g. { availability: {...} })
     * @returns {Promise<boolean>}
     */
    updateProfile: async (userId, data) => {
        try {
            if (!userId) throw new Error("User ID is required to update profile");
            const userRef = doc(db, USERS_COLLECTION, userId);
            await setDoc(userRef, data, { merge: true });

            // Sync local storage if this is the current user
            const currentUser = await userService.getUser();
            if (currentUser && currentUser.id === userId) {
                const updatedUser = { ...currentUser, ...data };
                await userService.saveUserToStorage(updatedUser);
            }
            return true;
        } catch (error) {
            console.error("Error updating profile:", error);
            throw error;
        }
    },

    /**
     * Follow a business or provider via Cloud Function
     */
    followUser: async (followerId, targetUserId) => {
        try {
            const API_URL = API_ENDPOINTS.TOGGLE_FOLLOW;
            console.log(`[UserService] Following user via: ${API_URL}`);

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ followerId, targetUserId, action: 'follow' }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to follow user");
            }

            console.log(`[UserService] Successfully followed user ${targetUserId}`);
            return true;
        } catch (error) {
            console.error("Error following user:", error);
            throw error;
        }
    },

    /**
     * Unfollow a business or provider via Cloud Function
     */
    unfollowUser: async (followerId, targetUserId) => {
        try {
            const API_URL = API_ENDPOINTS.TOGGLE_FOLLOW;
            console.log(`[UserService] Unfollowing user via: ${API_URL}`);

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ followerId, targetUserId, action: 'unfollow' }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to unfollow user");
            }

            console.log(`[UserService] Successfully unfollowed user ${targetUserId}`);
            return true;
        } catch (error) {
            console.error("Error unfollowing user:", error);
            throw error;
        }
    },

    /**
     * Check if a user is following another user
     */
    getFollowStatus: async (followerId, targetUserId) => {
        try {
            if (!followerId || !targetUserId) return false;
            const followId = `${followerId}_${targetUserId}`;
            const followRef = doc(db, FOLLOWS_COLLECTION, followId);
            const docSnap = await getDoc(followRef);
            return docSnap.exists();
        } catch (error) {
            console.error("Error checking follow status:", error);
            return false;
        }
    },

    /**
     * Get IDs of all followers for a user
     */
    getFollowerIds: async (targetUserId) => {
        try {
            const q = query(
                collection(db, FOLLOWS_COLLECTION),
                where('targetUserId', '==', targetUserId)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data().followerId);
        } catch (error) {
            console.error("Error getting follower IDs:", error);
            return [];
        }
    },

    /**
     * Get IDs of all users that a user is following
     */
    getFollowingIds: async (userId) => {
        try {
            const q = query(
                collection(db, FOLLOWS_COLLECTION),
                where('followerId', '==', userId)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data().targetUserId);
        } catch (error) {
            console.error("Error getting following IDs:", error);
            return [];
        }
    },

    /**
     * Save user data to local storage
     */
    saveUserToStorage: async (userData) => {
        try {
            await AsyncStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
            console.error("Error saving user data locally: ", error);
        }
    },

    /**
     * Get user data from local storage
     * @returns {Promise<Object|null>}
     */
    getUser: async () => {
        try {
            const userStr = await AsyncStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error("Error getting user data locally: ", error);
            return null;
        }
    },

    /**
     * Clear all user-specific data from local storage
     */
    logout: async () => {
        try {
            const keys = [
                'user',
                'userLocation',
                'cityName',
                'manualCity',
                'aadhaar_verified',
                'aadhaar_name',
                'business_verification_status',
                'business_verification_id'
            ];
            await AsyncStorage.multiRemove(keys);
            console.log('[UserService] Local storage cleared successfully');
        } catch (error) {
            console.error("Error clearing local user data: ", error);
        }
    }
};

console.log('USER_SERVICE_KEYS:', Object.keys(userService));
