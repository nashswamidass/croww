import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { userService } from './userService';

const USERS_COLLECTION = 'users';

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
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Prepare user document
            const UserProfile = {
                id: user.uid,
                email: email,
                name: userData.name,
                userType: userData.userType || 'individual',
                category: userData.category || null,
                isVerified: false,
                role: userData.userType || 'individual', // Duplicate for ease of access if needed
                createdAt: serverTimestamp(),
                ...userData
            };

            // Remove password/sensitive fields if any accidentally passed
            delete UserProfile.password;

            // 3. Save to Firestore
            await setDoc(doc(db, USERS_COLLECTION, user.uid), UserProfile);

            // 4. Update Auth Profile (Display Name)
            await updateProfile(user, {
                displayName: userData.name
            });

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
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Fetch User Profile from Firestore
            const userDoc = await getDoc(doc(db, USERS_COLLECTION, user.uid));

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

            // 1. Delete from Firestore
            // Note: In a production app, you might want to use a Cloud Function
            // to delete user-generated content (posts, comments, etc.) to ensure complete cleanup.
            await deleteDoc(doc(db, USERS_COLLECTION, uid));

            // 2. Delete Auth User
            await user.delete();

            // 3. Clear local storage
            await userService.logout();

            return true;
        } catch (error) {
            console.error('Delete account error:', error);
            // Handle "requires-recent-login" error specifically in UI if needed
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
            const API_URL = 'https://sendcustompasswordreset-6vktyfoeaa-uc.a.run.app';

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
    }
};
