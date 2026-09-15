import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    orderBy,
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
     * Get notifications for the current user
     */
    getNotifications: (callback) => {
        const user = auth.currentUser;
        if (!user || !user.uid) {
            console.warn("No active user for notification listener");
            return () => { };
        }

        console.log("Starting notification listener for user:", user.uid);

        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('toUserId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(notifications);
        }, (error) => {
            console.error("Notifications listener FIREBASE ERROR:", error.code, error.message);

            // If it's an index error, we can try a fallback query without ordering 
            // to at least show SOME notifications while the index builds.
            if (error.code === 'failed-precondition') {
                console.warn("Attempting fallback notification query (no index)...");
                const fallbackQ = query(
                    collection(db, NOTIFICATIONS_COLLECTION),
                    where('toUserId', '==', user.uid)
                );
                onSnapshot(fallbackQ, (snapshot) => {
                    const notifications = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    callback(notifications);
                });
            }

            callback([]);
        });
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
