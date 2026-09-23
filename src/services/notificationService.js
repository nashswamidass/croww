import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

const NOTIFICATIONS_COLLECTION = 'notifications';

export const notificationService = {
    /**
     * Send a notification to a specific user
     */
    sendNotification: async (toUserId, title, message, data = {}) => {
        try {
            await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
                toUserId,
                fromUserId: auth.currentUser?.uid || null,
                title,
                message,
                data,
                read: false,
                createdAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error("Error sending notification:", error);
            return { success: false, error };
        }
    },

    /**
     * Get notifications for the current user with bounded query and clean unsubscribe
     */
    getNotifications: (callback, { limitCount = 50 } = {}) => {
        const user = auth.currentUser;
        if (!user || !user.uid) {
            console.warn("No active user for notification listener");
            return () => { };
        }

        const size = Math.min(Math.max(Number(limitCount) || 50, 1), 100);
        let activeUnsubscribe = () => { };

        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('toUserId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(size)
        );

        activeUnsubscribe = onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(notifications);
        }, (error) => {
            console.error("Notifications listener FIREBASE ERROR:", error.code, error.message);

            // Fallback for index issues — query without ordering, preserving limit
            if (error.code === 'failed-precondition') {
                console.warn("Attempting fallback notification query (no index)...");
                const fallbackQ = query(
                    collection(db, NOTIFICATIONS_COLLECTION),
                    where('toUserId', '==', user.uid),
                    limit(size)
                );
                activeUnsubscribe = onSnapshot(fallbackQ, (snapshot) => {
                    const notifications = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    callback(notifications);
                }, (fallbackError) => {
                    console.error("Fallback notification listener failed:", fallbackError?.message);
                    callback([]);
                });
            } else {
                callback([]);
            }
        });

        return () => {
            if (typeof activeUnsubscribe === 'function') {
                activeUnsubscribe();
            }
        };
    },

    /**
     * Mark a notification as read
     */
    markAsRead: async (notificationId) => {
        try {
            const ref = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
            await updateDoc(ref, { read: true });
            return { success: true };
        } catch (error) {
            console.error("Error marking notification as read:", error);
            return { success: false, error };
        }
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead: async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const q = query(
                collection(db, NOTIFICATIONS_COLLECTION),
                where('toUserId', '==', user.uid),
                where('read', '==', false)
            );
            const snapshot = await getDocs(q);

            // Use sequential updates for simplicity if batch size is small, 
            // or we could use WriteBatch if needed.
            const promises = snapshot.docs.map(notificationDoc =>
                updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationDoc.id), { read: true })
            );
            await Promise.all(promises);
            return { success: true };
        } catch (error) {
            console.error("Error marking all as read:", error);
            return { success: false, error };
        }
    }
};
