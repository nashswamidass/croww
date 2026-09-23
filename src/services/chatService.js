import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    getDocs, getDoc,
    limit,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebaseConfig';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

// Helper to ensure auth
const ensureAuth = () => {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('Auth state changed in chatService:', user ? user.uid : 'null');
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                console.error('No authenticated user found for chat operation.');
                reject(new Error("You must be logged in to send messages."));
            }
        });
    });
};



export const chatService = {
    /**
     * Create a new chat or get existing one (1-on-1)
     * @param {string[]} participantIds - Array of user IDs
     * @param {Object} participantNames - Optional map of { id: name } for display
     * @param {Object} [context] - Optional listing/property identifiers for inquiries
     * @returns {Promise<string>} - The chat ID
     */
    createChat: async (participantIds, participantNames = {}, context = {}) => {
        try {
            if (!participantIds || !Array.isArray(participantIds)) {
                return null;
            }

            const validIds = participantIds.filter(id => id && typeof id === 'string');
            if (validIds.length < 2) {
                console.warn("Not enough valid participantIds to create a chat:", validIds);
                return null;
            }

            await ensureAuth();

            // Safer search: query for chats containing one of the participants, then filter manually
            const q = query(
                collection(db, CHATS_COLLECTION),
                where('participantIds', 'array-contains', validIds[0]),
                limit(50)
            );

            const querySnapshot = await getDocs(q);
            const sortedIds = [...validIds].sort();
            const listingId = typeof context.listingId === 'string' ? context.listingId : null;
            const propertyId = typeof context.propertyId === 'string' ? context.propertyId : null;

            for (const docSnapshot of querySnapshot.docs) {
                const data = docSnapshot.data();
                if (data.type === 'private' || !data.type) {
                    const docParticipantIds = [...(data.participantIds || [])].sort();
                    if (JSON.stringify(docParticipantIds) === JSON.stringify(sortedIds)) {
                        if (listingId && (data.listingId !== listingId || data.propertyId !== propertyId)) {
                            try {
                                await updateDoc(doc(db, CHATS_COLLECTION, docSnapshot.id), {
                                    listingId,
                                    propertyId: propertyId || null,
                                });
                            } catch (contextError) {
                                console.warn('Could not attach listing context to existing chat:', contextError?.message);
                            }
                        }
                        return docSnapshot.id;
                    }
                }
            }

            // Create new if not found
            const payload = {
                participantIds: sortedIds,
                participantNames: participantNames,
                type: 'private',
                createdAt: serverTimestamp(),
                lastMessage: null,
                lastMessageTimestamp: serverTimestamp(),
                unreadCounts: sortedIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
            };
            if (listingId) {
                payload.listingId = listingId;
                payload.propertyId = propertyId || null;
            }

            const chatRef = await addDoc(collection(db, CHATS_COLLECTION), payload);

            return chatRef.id;
        } catch (error) {
            console.error('Error creating chat:', error);
            throw error;
        }
    },

    /**
     * Get a chat document by ID
     * @param {string} chatId
     * @returns {Promise<Object>} Chat data or null
     */
    getChat: async (chatId) => {
        try {
            if (!chatId) return null;
            const chatSnap = await getDoc(doc(db, CHATS_COLLECTION, chatId));
            if (chatSnap.exists()) {
                return { id: chatSnap.id, ...chatSnap.data() };
            }
            return null;
        } catch (error) {
            console.error("Error getting chat:", error);
            return null;
        }
    },

    /**
     * Create a group chat
     * @param {string} name - Group name
     * @param {string[]} participantIds - Initial participants
     * @param {string} image - Optional group image URL
     * @returns {Promise<string>} - The chat ID
     */
    createGroupChat: async (name, participantIds, image = null) => {
        try {
            await ensureAuth();

            const chatRef = await addDoc(collection(db, CHATS_COLLECTION), {
                participantIds: participantIds,
                type: 'group',
                name: name,
                image: image,
                createdAt: serverTimestamp(),
                lastMessage: 'Group created',
                lastMessageTimestamp: serverTimestamp(),
                unreadCounts: participantIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
                admins: [auth.currentUser.uid]
            });

            return chatRef.id;
        } catch (error) {
            console.error('Error creating group chat:', error);
            throw error;
        }
    },

    /**
     * Send a message to a chat
     * @param {string} chatId 
     * @param {string} text 
     * @param {string} senderId
     * @param {string} senderName - Display name of the sender
     */
    sendMessage: async (chatId, text, senderId, senderName = '') => {
        try {
            await ensureAuth();

            const chatRef = doc(db, CHATS_COLLECTION, chatId);
            const messagesRef = collection(chatRef, MESSAGES_COLLECTION);

            // Add message to subcollection
            await addDoc(messagesRef, {
                text,
                senderId,
                senderName: senderName || 'User',
                createdAt: serverTimestamp(),
                readBy: [senderId]
            });

            // Update chat metadata and increment unread counts for others
            const chatSnap = await getDoc(chatRef);
            let unreadUpdate = {};

            if (chatSnap.exists()) {
                const chatData = chatSnap.data();
                const currentUnreads = chatData.unreadCounts || {};
                const participants = chatData.participantIds || [];

                participants.forEach(pid => {
                    if (pid !== senderId) {
                        // Increment for others using dot notation for nested field update
                        unreadUpdate[`unreadCounts.${pid}`] = (currentUnreads[pid] || 0) + 1;
                    }
                });
            }

            await updateDoc(chatRef, {
                lastMessage: text,
                lastMessageTimestamp: serverTimestamp(),
                ...unreadUpdate
            });

            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    },

    /**
     * Mark a chat as read for a specific user
     * @param {string} chatId 
     * @param {string} userId 
     */
    markChatAsRead: async (chatId, userId) => {
        try {
            if (!chatId || !userId) return;
            const chatRef = doc(db, CHATS_COLLECTION, chatId);
            await updateDoc(chatRef, {
                [`unreadCounts.${userId}`]: 0
            });
        } catch (error) {
            console.error('Error marking chat read:', error);
            // Don't throw, just log
        }
    },

    /**
     * Subscribe to messages in a chat
     * @param {string} chatId 
     * @param {function} callback 
     * @returns {function} - Unsubscribe function
     */
    subscribeToChat: (chatId, callback) => {
        if (!chatId || typeof chatId !== 'string') {
            console.warn("Invalid chatId passed to subscribeToChat:", chatId);
            return () => { };
        }

        // Ensure auth is initialized (though for subscription it might be tricky to await, usually it works if auth state persists)
        // ideally we'd wait for auth but onSnapshot handles connection retries.

        const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(docSnapshot => ({
                id: docSnapshot.id,
                ...docSnapshot.data(),
                // Convert Firestore Timestamp to Date/String if needed, or handle in component
                createdAt: docSnapshot.data().createdAt ? docSnapshot.data().createdAt.toDate() : new Date()
            }));
            // Provide messages in descending order (newest first) for inverted list
            callback(messages);
        }, (error) => {
            console.error('Error subscribing to chat:', error);
        });
    },

    /**
     * Subscribe to user's chat list with bounded query and clean unsubscribe
     * @param {string} userId 
     * @param {function} callback 
     * @param {object} options
     * @returns {function} - Unsubscribe function
     */
    subscribeToUserChats: (userId, callback, { limitCount = 50 } = {}) => {
        if (!userId || typeof userId !== 'string') {
            console.warn("Invalid userId passed to subscribeToUserChats:", userId);
            return () => { };
        }

        const size = Math.min(Math.max(Number(limitCount) || 50, 1), 100);
        let activeUnsubscribe = () => { };

        const q = query(
            collection(db, CHATS_COLLECTION),
            where('participantIds', 'array-contains', userId),
            orderBy('lastMessageTimestamp', 'desc'),
            limit(size)
        );

        activeUnsubscribe = onSnapshot(q, (snapshot) => {
            const chats = snapshot.docs.map(docSnapshot => ({
                id: docSnapshot.id,
                ...docSnapshot.data()
            }));
            callback(chats);
        }, (error) => {
            console.error('Chat list listener FIREBASE ERROR:', error.code, error.message);

            // Fallback for index issues — query without orderBy, preserving bounded size
            if (error.code === 'failed-precondition') {
                console.warn("Attempting fallback chat list query (no index)...");
                const fallbackQ = query(
                    collection(db, CHATS_COLLECTION),
                    where('participantIds', 'array-contains', userId),
                    limit(size)
                );
                activeUnsubscribe = onSnapshot(fallbackQ, (snapshot) => {
                    const chats = snapshot.docs.map(docSnapshot => ({
                        id: docSnapshot.id,
                        ...docSnapshot.data()
                    })).sort((a, b) => (b.lastMessageTimestamp?.seconds || 0) - (a.lastMessageTimestamp?.seconds || 0));
                    callback(chats);
                }, (fallbackError) => {
                    console.error('Fallback chat list query also failed:', fallbackError?.message);
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
     * One-shot bounded chat list for dashboard inquiry summaries.
     * Does not read message subcollections.
     */
    listUserChats: async (userId, { limitCount = 40 } = {}) => {
        if (!userId || typeof userId !== 'string') return [];
        const size = Math.min(Math.max(Number(limitCount) || 40, 1), 40);
        try {
            const q = query(
                collection(db, CHATS_COLLECTION),
                where('participantIds', 'array-contains', userId),
                orderBy('lastMessageTimestamp', 'desc'),
                limit(size)
            );
            const snap = await getDocs(q);
            return snap.docs.map((docSnapshot) => ({
                id: docSnapshot.id,
                ...docSnapshot.data(),
            }));
        } catch (error) {
            if (error?.code !== 'failed-precondition') {
                console.warn('[chatService] listUserChats failed', error?.code || error?.message);
                return [];
            }
            const fallbackQ = query(
                collection(db, CHATS_COLLECTION),
                where('participantIds', 'array-contains', userId),
                limit(size)
            );
            const snap = await getDocs(fallbackQ);
            return snap.docs.map((docSnapshot) => ({
                id: docSnapshot.id,
                ...docSnapshot.data(),
            })).sort((a, b) => (b.lastMessageTimestamp?.seconds || 0) - (a.lastMessageTimestamp?.seconds || 0));
        }
    },

    /**
     * Add a participant to a chat
     * @param {string} chatId 
     * @param {string} userId 
     */
    addParticipant: async (chatId, userId) => {
        try {
            const chatRef = doc(db, CHATS_COLLECTION, chatId);
            await updateDoc(chatRef, {
                participantIds: arrayUnion(userId),
                [`unreadCounts.${userId}`]: 0 // Initialize unread count
            });
            return true;
        } catch (error) {
            console.error('Error adding participant:', error);
            throw error;
        }
    },

    /**
     * Remove a participant from a chat
     * @param {string} chatId 
     * @param {string} userId 
     */
    removeParticipant: async (chatId, userId) => {
        try {
            const chatRef = doc(db, CHATS_COLLECTION, chatId);
            // Note: We can't easily remove the unreadCounts key without a cloud function or replacing the whole map
            // For now just removing from participantIds is enough to hide it
            await updateDoc(chatRef, {
                participantIds: arrayRemove(userId)
            });
            return true;
        } catch (error) {
            console.error('Error removing participant:', error);
            throw error;
        }
    }
};
