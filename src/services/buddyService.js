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
    arrayUnion,
    arrayRemove,
    increment,
    getDoc
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { userService } from './userService';
import { chatService } from './chatService';
import { notificationService } from './notificationService';

const BUDDY_COLLECTION = 'buddy_requests';
const JOIN_REQUESTS_COLLECTION = 'buddy_join_requests';

export const getBuddyRequests = async (eventId, filters = {}) => {
    try {
        let q = query(
            collection(db, BUDDY_COLLECTION),
            where('eventId', '==', eventId),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Client-side filtering for complex logic not easily done in Firestore index yet
        if (filters.hasSpots) {
            requests = requests.filter(req => req.spotsRemaining > 0);
        }

        return requests;
    } catch (error) {
        console.error("Error fetching buddy requests:", error);
        return [];
    }
};

export const createBuddyRequest = async (eventId, data) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Must be logged in");

        // Get user details for the snapshot
        const userProfile = await userService.getUser();

        const userName = userProfile?.name || user.email || 'Anonymous';

        // 1. Create a group chat for this buddy request
        // Group name could be "Event Buddy: [Event Name]" but we might not have event name here easily
        // Let's just call it "[User]'s Buddy Group" for now
        const chatName = `${userName}'s Buddy Group`;
        const chatId = await chatService.createGroupChat(chatName, [user.uid]);

        const memberSnapshot = {
            uid: user.uid,
            name: userName,
            avatar: userProfile?.avatar || null
        };

        const docData = {
            eventId,
            userId: user.uid,
            userName: userName,
            userAvatar: userProfile?.avatar || null,
            spotsAvailable: Number(data.spotsAvailable),
            spotsRemaining: Number(data.spotsAvailable),
            genderPreference: data.genderPreference || 'any',
            message: data.message || '',
            status: 'active',
            joinedUsers: [user.uid],
            memberSnapshots: [memberSnapshot],
            chatId: chatId, // Link to the chat
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, BUDDY_COLLECTION), docData);
        return { success: true, request: { id: docRef.id, ...docData } };
    } catch (error) {
        console.error("Error creating buddy request:", error);
        return { success: false, message: error.message };
    }
};

export const joinBuddyRequest = async (requestId, targetUserId = null) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Must be logged in");

        const joiningUserId = targetUserId || user.uid;

        const ref = doc(db, BUDDY_COLLECTION, requestId);
        const requestSnapshot = await getDoc(ref);

        if (!requestSnapshot.exists()) throw new Error("Request not found");

        const requestData = requestSnapshot.data();

        if (requestData.spotsRemaining <= 0) {
            return { success: false, message: "Group is full" };
        }

        if (requestData.joinedUsers && requestData.joinedUsers.includes(joiningUserId)) {
            return { success: false, message: "User is already in this group" };
        }

        // Get joining user details
        const userProfile = targetUserId ? await userService.getUserById(targetUserId) : await userService.getUser();
        const memberSnapshot = {
            uid: joiningUserId,
            name: userProfile?.name || 'User',
            avatar: userProfile?.avatar || null
        };

        // Add to Chat
        if (requestData.chatId) {
            await chatService.addParticipant(requestData.chatId, joiningUserId);
        }

        await updateDoc(ref, {
            joinedUsers: arrayUnion(joiningUserId),
            memberSnapshots: arrayUnion(memberSnapshot),
            spotsRemaining: increment(-1)
        });

        return { success: true, message: "You've joined the group!" };
    } catch (error) {
        console.error("Error joining:", error);
        return { success: false, message: "Failed to join (Group might be full or error)" };
    }
};

export const leaveBuddyRequest = async (requestId) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Must be logged in");

        const ref = doc(db, BUDDY_COLLECTION, requestId);
        const requestSnapshot = await getDoc(ref);

        if (requestSnapshot.exists()) {
            const requestData = requestSnapshot.data();
            // Remove from Chat
            if (requestData.chatId) {
                await chatService.removeParticipant(requestData.chatId, user.uid);
            }

            // Find the member snapshot to remove
            const memberSnapshots = requestData.memberSnapshots || [];
            const memberToRemove = memberSnapshots.find(m => m.uid === user.uid);

            await updateDoc(ref, {
                joinedUsers: arrayRemove(user.uid),
                memberSnapshots: memberToRemove ? arrayRemove(memberToRemove) : memberSnapshots,
                spotsRemaining: increment(1)
            });
        }

        return { success: true, message: "You left the group" };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const getUserBuddyRequests = async (userId) => {
    if (!userId && auth.currentUser) userId = auth.currentUser.uid;
    if (!userId) return [];

    try {
        const q = query(
            collection(db, BUDDY_COLLECTION),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        return [];
    }
};

/**
 * Request to join a buddy group
 */
export const requestToJoinBuddy = async (requestId, ownerId) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Must be logged in");

        // Get requester details
        const userProfile = await userService.getUser();

        const joinRequestData = {
            buddyRequestId: requestId,
            requesterId: user.uid,
            requesterName: userProfile?.name || user.email || 'Anonymous',
            requesterAvatar: userProfile?.avatar || null,
            ownerId: ownerId,
            status: 'pending',
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, JOIN_REQUESTS_COLLECTION), joinRequestData);

        // Notify owner
        await notificationService.sendNotification(
            ownerId,
            "New Buddy Request",
            `${joinRequestData.requesterName} wants to join your buddy group!`,
            { type: 'buddy_request_join', requestId: requestId }
        );

        return { success: true, message: "Request sent!" };
    } catch (error) {
        console.error("Error requesting to join:", error);
        return { success: false, message: error.message };
    }
};

/**
 * Approve a join request
 */
export const approveJoinRequest = async (joinRequestId) => {
    try {
        const joinRequestRef = doc(db, JOIN_REQUESTS_COLLECTION, joinRequestId);
        const joinRequestSnap = await getDoc(joinRequestRef);

        if (!joinRequestSnap.exists()) throw new Error("Join request not found");

        const joinData = joinRequestSnap.data();

        // Use existing join logi
        const result = await joinBuddyRequest(joinData.buddyRequestId, joinData.requesterId);

        if (result.success) {
            // Update join request status
            await updateDoc(joinRequestRef, { status: 'approved' });

            // Notify seeker
            await notificationService.sendNotification(
                joinData.requesterId,
                "Request Approved! 🎊",
                "Your request to join the buddy group was approved!",
                { type: 'buddy_request_approved', requestId: joinData.buddyRequestId }
            );
        }

        return result;
    } catch (error) {
        console.error("Error approving join request:", error);
        return { success: false, message: error.message };
    }
};

/**
 * Ignore a join request
 */
export const ignoreJoinRequest = async (joinRequestId) => {
    try {
        const joinRequestRef = doc(db, JOIN_REQUESTS_COLLECTION, joinRequestId);
        await updateDoc(joinRequestRef, { status: 'ignored' });
        return { success: true };
    } catch (error) {
        console.error("Error ignoring join request:", error);
        return { success: false, message: error.message };
    }
};

/**
 * Get join requests for a specific buddy request (owner view)
 * or for the current user (my applications)
 */
export const getJoinRequests = async (buddyRequestId = null, status = 'pending', ownerId = null) => {
    try {
        const user = auth.currentUser;
        if (!user) return [];

        let q;
        if (buddyRequestId) {
            // Get requests for a specific buddy group (owner view)
            // MUST include ownerId to satisfy security rules
            const effectiveOwnerId = ownerId || user.uid;
            q = query(
                collection(db, JOIN_REQUESTS_COLLECTION),
                where('buddyRequestId', '==', buddyRequestId),
                where('ownerId', '==', effectiveOwnerId),
                where('status', '==', status)
            );
        } else {
            // Get requests I sent
            q = query(
                collection(db, JOIN_REQUESTS_COLLECTION),
                where('requesterId', '==', user.uid),
                where('status', '==', status)
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching join requests:", error);
        return [];
    }
};
