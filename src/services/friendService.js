import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    getDoc,
    writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { userService } from './userService';

const REQUESTS_COLLECTION = 'friend_requests';
const USERS_COLLECTION = 'users';

export const friendService = {

    /**
     * Send a friend request
     */
    sendFriendRequest: async (toUserId) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Must be logged in");

            // Check if already friends or request pending
            const status = await friendService.checkFriendStatus(currentUser.uid, toUserId);
            if (status !== 'none') {
                return { success: false, message: `Status is already ${status}` };
            }

            // Get current user details
            const userProfile = await userService.getUser();
            const fromUserName = userProfile?.name || currentUser.displayName || 'Anonymous';
            const fromUserAvatar = userProfile?.avatar || currentUser.photoURL || null;

            await addDoc(collection(db, REQUESTS_COLLECTION), {
                fromUserId: currentUser.uid,
                fromUserName: fromUserName || '',
                fromUserAvatar: fromUserAvatar || '',
                toUserId: toUserId,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error("Error sending friend request:", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Get pending friend requests for the current user
     */
    getFriendRequests: async () => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return [];

            const q = query(
                collection(db, REQUESTS_COLLECTION),
                where('toUserId', '==', currentUser.uid),
                where('status', '==', 'pending'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching friend requests:", error);
            return [];
        }
    },

    /**
     * Accept a friend request
     */
    acceptFriendRequest: async (requestId, fromUserId, fromUserName, fromUserAvatar) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Must be logged in");

            const batch = writeBatch(db);

            // 1. Update request status
            const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
            batch.update(requestRef, { status: 'accepted' });

            // 2. Add to current user's friends list
            const localUser = await userService.getUser(); // Info for the other person
            const myFriendRef = doc(db, USERS_COLLECTION, currentUser.uid, 'friends', fromUserId);
            batch.set(myFriendRef, {
                friendId: fromUserId,
                name: fromUserName,
                avatar: fromUserAvatar,
                since: serverTimestamp()
            });

            // 3. Add current user to sender's friends list
            const otherFriendRef = doc(db, USERS_COLLECTION, fromUserId, 'friends', currentUser.uid);
            batch.set(otherFriendRef, {
                friendId: currentUser.uid,
                name: localUser?.name || currentUser.displayName || 'User',
                avatar: localUser?.avatar || currentUser.photoURL || null,
                since: serverTimestamp()
            });

            // 4. Update stats (optional, requires reading first or using increment if stats are on main doc)
            // For simplicity, we assume client will refresh stats or we use a separate counter update if needed.
            // Using increment on user docs
            const myUserRef = doc(db, USERS_COLLECTION, currentUser.uid);
            // using dot notation for nested field update if stats exists
            // batch.update(myUserRef, { "stats.friends": increment(1) }); 
            // NOTE: 'increment' needs import. For now we skip atomic increment to keep it simple or do it if field exists.

            await batch.commit();
            return { success: true };
        } catch (error) {
            console.error("Error accepting friend request:", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Reject a friend request
     */
    rejectFriendRequest: async (requestId) => {
        try {
            await deleteDoc(doc(db, REQUESTS_COLLECTION, requestId));
            return { success: true };
        } catch (error) {
            console.error("Error rejecting friend request:", error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Get list of friends
     */
    getFriends: async (userId) => {
        try {
            const targetId = userId || auth.currentUser?.uid;
            if (!targetId) return [];

            const friendsRef = collection(db, USERS_COLLECTION, targetId, 'friends');
            const snapshot = await getDocs(friendsRef);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching friends:", error);
            return [];
        }
    },

    /**
     * Check friend status between current user and target user
     * Returns: 'none', 'pending', 'friends', 'self'
     */
    checkFriendStatus: async (currentUserId, targetUserId) => {
        if (currentUserId === targetUserId) return 'self';

        try {
            // 1. Check if already friends
            const friendDoc = await getDoc(doc(db, USERS_COLLECTION, currentUserId, 'friends', targetUserId));
            if (friendDoc.exists()) return 'friends';

            // 2. Check if I sent a request
            const sentQuery = query(
                collection(db, REQUESTS_COLLECTION),
                where('fromUserId', '==', currentUserId),
                where('toUserId', '==', targetUserId),
                where('status', '==', 'pending')
            );
            const sentSnap = await getDocs(sentQuery);
            if (!sentSnap.empty) return 'pending_sent'; // 'Requested'

            // 3. Check if they sent me a request
            const receivedQuery = query(
                collection(db, REQUESTS_COLLECTION),
                where('fromUserId', '==', targetUserId),
                where('toUserId', '==', currentUserId),
                where('status', '==', 'pending')
            );
            const receivedSnap = await getDocs(receivedQuery);
            if (!receivedSnap.empty) return 'pending_received'; // 'Accept/Reject'

            return 'none';
        } catch (error) {
            console.error("Error checking friend status:", error);
            return 'none';
        }
    },

    /**
     * Remove a friend
     */
    removeFriend: async (friendId) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Must be logged in");

            const batch = writeBatch(db);

            // Remove from my list
            batch.delete(doc(db, USERS_COLLECTION, currentUser.uid, 'friends', friendId));

            // Remove from their list
            batch.delete(doc(db, USERS_COLLECTION, friendId, 'friends', currentUser.uid));

            await batch.commit();
            return { success: true };
        } catch (error) {
            console.error("Error removing friend:", error);
            return { success: false, message: error.message };
        }
    }
};
