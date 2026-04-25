import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { userService } from './userService';
import API_ENDPOINTS from '../constants/apiConfig';

const USERS_COLLECTION = 'users';

const withTimeout = (promise, ms, errorMessage) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
    ]);
};

export const authService = {
    /**
     * Register a new user
     * @param {string} email 
     * @param {string} password 
     * @param {Object} userData - Additional user data (name, userType, etc.)
     */
    signup: async (email, password, userData) => {
        try {
            // 1. Create Auth User
            const userCredential = await withTimeout(
                createUserWithEmailAndPassword(auth, email, password),
                15000,
                'Signup network timeout. Please check your connection and try again.'
            );
            const user = userCredential.user;

            // 2. Prepare user document
            const { userType } = userData; // Destructure userType for conditional logic
            const UserProfile = {
                id: user.uid,
                email: email,
                name: userData.name,
                userType: userType || 'individual',
                category: userData.category || null,
                stats: userType === 'provider' ? {
                    bookings: 0,
                    rating: 0,
                    experience: '0 years',
                    reviews: 0
                } : (userType === 'business' ? {
                    totalEvents: 0,
                    followers: 0,
                    rating: 0,
                    reviews: 0
                } : {
                    eventsAttended: 0,
                    friends: 0,
                    buddyConnections: 0
                }),
                policyAccepted: (userType !== 'business' && userType !== 'provider'), // Individuals don't need to accept
                policyAcceptedAt: null,
                isVerified: false,
                role: userType || 'individual', // Duplicate for ease of access if needed
                createdAt: serverTimestamp(),
                ...userData
            };

            // Remove password/sensitive fields if any accidentally passed
            delete UserProfile.password;

            // 3. Save to Firestore
            await withTimeout(
                setDoc(doc(db, USERS_COLLECTION, user.uid), UserProfile),
                10000,
                'Profile creation timeout. Please try logging in if account was created.'
            );

            // 4. Update Auth Profile (Display Name)
            await withTimeout(
                updateProfile(user, {
                    displayName: userData.name
                }),
                5000,
                'Profile update timeout.'
            );

            // 4.5 Send Verification Email
            // Disabled: We now use a Cloud Function (sendWelcomeEmail) for branded HTML emails
            /*
            try {
                await sendEmailVerification(user);
                console.log('Verification email sent!');
            } catch (err) {
                console.error('Failed to send verification email:', err);
            }
            */

            // 5. Cache locally
            await userService.saveUserToStorage(UserProfile);

            return UserProfile;
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    },

    /**
     * Login existing user
     * @param {string} email 
     * @param {string} password 
     */
    login: async (email, password) => {
        try {
            // 1. Auth Login
            const userCredential = await withTimeout(
                signInWithEmailAndPassword(auth, email, password),
                15000,
                'Login network timeout. Please check your connection and try again.'
            );
            const user = userCredential.user;

            // 2. Fetch User Profile from Firestore
            const userDoc = await withTimeout(
                getDoc(doc(db, USERS_COLLECTION, user.uid)),
                10000,
                'Profile fetch timeout. Please check your connection and try again.'
            );

            if (!userDoc.exists()) {
                throw new Error('User profile not found');
            }

            const userData = userDoc.data();

            // 3. Cache locally
            await userService.saveUserToStorage({ ...userData, id: user.uid });

            return { ...userData, id: user.uid };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    /**
     * Logout
     */
    logout: async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                try {
                    await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
                        pushToken: null
                    });
                } catch (err) {
                    console.log('Non-critical: Failed to remove push token during logout', err);
                }
            }
            await signOut(auth);
            await userService.logout();
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },

    /**
     * Delete user account and all associated data
     */
    deleteAccount: async () => {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('No user logged in');

            const uid = user.uid;

            // Call custom Cloud Function for secure account deletion
            const API_URL = API_ENDPOINTS.DELETE_USER_ACCOUNT;

            console.log(`[AuthService] Calling deleteAccount function for UID: ${uid}`);

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uid }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AuthService] Delete Error: ${errorText}`);
                throw new Error(`Failed to delete account: ${errorText}`);
            }

            // 3. Clear local storage and log out
            await userService.logout();
            await signOut(auth);

            return true;
        } catch (error) {
            console.error('Delete account error:', error);
            throw error;
        }
    },

    /**
     * Send password reset email
     * @param {string} email 
     */
    resetPassword: async (email) => {
        try {
            // Call custom Cloud Function for branded email
            const API_URL = API_ENDPOINTS.SEND_CUSTOM_PASSWORD_RESET;

            console.log(`[AuthService] Calling reset function at: ${API_URL}`);

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            console.log(`[AuthService] Reset Response Status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AuthService] Reset Error: ${errorText}`);
                throw new Error(`Failed to send reset email: ${errorText}`);
            }

            console.log('[AuthService] Custom reset email sent successfully');
            return true;
        } catch (error) {
            console.error('[AuthService] Reset flow failed:', error);
            // Re-throw so the UI can capture the REAL error instead of hiding it with a fallback
            throw error;
        }
    },

    /**
     * Accept commission policy
     * @param {string} uid 
     */
    acceptPolicy: async (uid) => {
        try {
            const userRef = doc(db, USERS_COLLECTION, uid);
            const updateData = {
                policyAccepted: true,
                policyAcceptedAt: new Date().toISOString()
            };

            await updateDoc(userRef, updateData);

            // Update local cache
            const currentUser = await userService.getUser();
            if (currentUser && currentUser.id === uid) {
                await userService.saveUserToStorage({ ...currentUser, ...updateData });
            }

            return true;
        } catch (error) {
            console.error('Error accepting policy:', error);
            throw error;
        }
    }
};
