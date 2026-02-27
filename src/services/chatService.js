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
    getDocs,
    limit,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebaseConfig';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';

// Helper to ensure auth
const ensureAuth = () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('Auth state changed:', user ? user.uid : 'null');
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                console.log('Signing in anonymously...');
                signInAnonymously(auth).then(userCred => {
                    console.log('Signed in anonymously:', userCred.user.uid);
                    resolve(userCred.user);
                }).catch(error => {
                    console.error('Anonymous auth failed:', error);
                    reject(error);
                });
            }
        });
    });
};



export const chatService = {
    /**
     * Create a new chat or get existing one (1-on-1)
     * @param {string[]} participantIds - Array of user IDs
     * @param {Object} participantNames - Optional map of { id: name } for display
     * @returns {Promise<string>} - The chat ID
     */
    createChat: async (participantIds, participantNames = {}) => {
        try {
            if (!participantIds || !Array.isArray(participantIds)) {
                console.error("Invalid participantIds passed to createChat:", participantIds);
                return null;
            }

            const validIds = participantIds.filter(id => id && typeof id === 'string');
            if (validIds.length < 2) {
                console.warn("Not enough valid participantIds to create a chat:", validIds);
                return null;
            }

            await ensureAuth();
            const sortedIds = [...validIds].sort();

            const q = query(
                collection(db, CHATS_COLLECTION),
                where('participantIds', '==', sortedIds),
                limit(1)
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                return querySnapshot.docs[0].id;
            }

            const chatRef = await addDoc(collection(db, CHATS_COLLECTION), {
                participantIds: sortedIds,
                participantNames: participantNames,
                type: 'private',
                createdAt: serverTimestamp(),
                lastMessage: null,
                lastMessageTimestamp: serverTimestamp(),
                unreadCounts: sortedIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
            });

            return chatRef.id;
        } catch (error) {
            console.error('Error creating chat:', error);
            throw error;
        }
    },

    /**
     * Create a group chat
     * @param {string} name - Group name
     * @param {string[]} participantIds - Initial participants
     * @param {string} image - Optional group image URL
     * @returns {Promise<string>} - The chat ID
     */
    /**
     * Get a chat document by ID
     * @param {string} chatId
     * @returns {Promise<Object>} Chat data or null
     */
    getChat: async (chatId) => {
        try {
            if (!chatId) return null;
            const chatSnap = await getDocs(query(collection(db, CHATS_COLLECTION), where('__name__', '==', chatId)));
            if (!chatSnap.empty) {
                return { id: chatSnap.docs[0].id, ...chatSnap.docs[0].data() };
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
            // Get current chat data to update unread counts safely (or use increment if consistent)
            // For now, simpler approach: read, update locally, write back (transaction better but this is MVP)
            const chatSnap = await getDocs(query(collection(db, CHATS_COLLECTION), where('__name__', '==', chatId)));
            let unreadUpdate = {};

            if (!chatSnap.empty) {
                const chatData = chatSnap.docs[0].data();
                const currentUnreads = chatData.unreadCounts || {};
                const participants = chatData.participantIds || [];

                participants.forEach(pid => {
                    if (pid !== senderId) {
                        // Increment for others
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
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Convert Firestore Timestamp to Date/String if needed, or handle in component
                createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date()
            }));
            callback(messages);
        }, (error) => {
            console.error('Error subscribing to chat:', error);
        });
    },

    /**
     * Subscribe to user's chat list
     * @param {string} userId 
     * @param {function} callback 
     * @returns {function} - Unsubscribe function
     */
    subscribeToUserChats: (userId, callback) => {
        if (!userId || typeof userId !== 'string') {
            console.warn("Invalid userId passed to subscribeToUserChats:", userId);
            return () => { };
        }

        const q = query(
            collection(db, CHATS_COLLECTION),
            where('participantIds', 'array-contains', userId),
            orderBy('lastMessageTimestamp', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(chats);
        }, (error) => {
            console.error('Chat list listener FIREBASE ERROR:', error.code, error.message);

            // Fallback for index issues
            if (error.code === 'failed-precondition') {
                console.warn("Attempting fallback chat list query (no index)...");
                const fallbackQ = query(
                    collection(db, CHATS_COLLECTION),
                    where('participantIds', 'array-contains', userId)
                );
                onSnapshot(fallbackQ, (snapshot) => {
                    const chats = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).sort((a, b) => (b.lastMessageTimestamp?.seconds || 0) - (a.lastMessageTimestamp?.seconds || 0));
                    callback(chats);
                });
            }
        });
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
