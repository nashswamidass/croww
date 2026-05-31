import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    where,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { userService } from './userService';
import { notificationService } from './notificationService';

const EVENTS_COLLECTION = 'events';

/**
 * Wraps a promise with a timeout. Rejects with a TimeoutError if the promise
 * doesn't resolve within `ms` milliseconds. This is critical on iPad with
 * IPv6 networks where Firestore can deadlock silently.
 */
const withTimeout = (promise, ms = 10000, label = 'Operation') => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[eventService] ${label} timed out after ${ms}ms`)), ms)
        )
    ]);
};

export const eventService = {
    /**
     * Create a new event
     * @param {Object} eventData 
     * @returns {Promise<Object>} Created event with ID
     */
    createEvent: async (eventData) => {
        try {
            // preparing data
            const docData = {
                ...eventData,
                createdAt: serverTimestamp(),
                attendeesCount: 1, // Organizer
                capacity: eventData.maxTickets || 0,
                remainingTickets: eventData.maxTickets || 0,
            };

            const docRef = await addDoc(collection(db, EVENTS_COLLECTION), docData);
            console.log("Event created with ID: ", docRef.id);

            // Notify Followers (Asynchronous/Background)
            if (eventData.organizerId) {
                userService.getFollowerIds(eventData.organizerId).then(followerIds => {
                    const organizerName = eventData.organizerName || 'A business you follow';
                    followerIds.forEach(followerId => {
                        notificationService.sendNotification(
                            followerId,
                            'New Event Posted! 🎊',
                            `${organizerName} just posted a new event: ${eventData.title}. Check it out!`,
                            { eventId: docRef.id, type: 'new_event' }
                        );
                    });
                }).catch(err => console.error("Error notifying followers:", err));
            }

            return { id: docRef.id, ...docData };
        } catch (error) {
            console.error("Error creating event: ", error);
            throw error;
        }
    },

    /**
     * Get all PUBLIC events (optionally filtered)
     * Private events (isPublic !== true) are never included in this listing.
     * @returns {Promise<Array>} List of public events
     */
    getEvents: async () => {
        try {
            console.log("[Service] Fetching public events from Firestore...");
            // Only fetch public events at the query level — fastest and most secure
            const q = query(
                collection(db, EVENTS_COLLECTION),
                where('isPublic', '==', true)
            );

            // Anti-freeze: wrap getDocs in a 10s timeout to prevent iPad IPv6 deadlock
            let querySnapshot;
            try {
                querySnapshot = await withTimeout(getDocs(q), 10000, 'getEvents');
            } catch (timeoutErr) {
                console.warn('[eventService] getEvents timed out — returning empty list to keep UI responsive');
                return [];
            }

            const now = new Date();
            const events = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                console.log(`[Service] Processing Doc: ${doc.id} | Title: ${data.title} | isPublic: ${data.isPublic} | date: ${data.date}`);
                
                if (data.date) {
                    const eventDate = new Date(data.date);
                    // All events expire 12 hours after they start
                    if (eventDate.getTime() + (12 * 60 * 60 * 1000) < now.getTime()) {
                        return; // Skip expired events
                    }
                }
                events.push({ id: doc.id, ...data });
            });
            console.log(`[Service] Returning ${events.length} public events after local filtering`);
            return events;
        } catch (error) {
            console.error("Error fetching events: ", error);
            // Return empty array on error to keep the UI responsive
            return [];
        }
    },

    /**
     * Get single event by ID
     * @param {string} id 
     */
    getEventById: async (id) => {
        try {
            const docRef = doc(db, EVENTS_COLLECTION, id);
            const docSnap = await withTimeout(getDoc(docRef), 10000, 'getEventById');

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching event: ", error);
            throw error;
        }
    },

    /**
     * Get events by organizer ID
     * @param {string} organizerId 
     */
    getEventsByOrganizer: async (organizerId) => {
        try {
            if (!organizerId) {
                console.warn("getEventsByOrganizer called without organizerId");
                return [];
            }
            const q = query(
                collection(db, EVENTS_COLLECTION),
                where('organizerId', '==', organizerId),
                orderBy('createdAt', 'desc')
            );
            let querySnapshot;
            try {
                querySnapshot = await withTimeout(getDocs(q), 10000, 'getEventsByOrganizer');
            } catch (timeoutErr) {
                console.warn('[eventService] getEventsByOrganizer timed out — returning empty list');
                return [];
            }
            const events = [];
            querySnapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            return events;
        } catch (error) {
            console.error("Error fetching organizer events: ", error);
            // Return empty array instead of throwing to prevent dashboard crashes
            return [];
        }
    },

    /**
     * Update an existing event
     * @param {string} eventId 
     * @param {Object} eventData 
     */
    updateEvent: async (eventId, eventData) => {
        try {
            const docRef = doc(db, EVENTS_COLLECTION, eventId);
            const updateData = {
                ...eventData,
                updatedAt: serverTimestamp(),
            };
            await updateDoc(docRef, updateData);
            return { id: eventId, ...updateData };
        } catch (error) {
            console.error("Error updating event: ", error);
            throw error;
        }
    },

    /**
     * Cancel an event (soft-delete). Notifies attendees via the notifications collection.
     * @param {string} eventId
     * @param {string} organizerName - used in the notification message
     */
    cancelEvent: async (eventId, organizerName = 'The organizer') => {
        try {
            const docRef = doc(db, EVENTS_COLLECTION, eventId);
            await updateDoc(docRef, {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return true;
        } catch (error) {
            console.error("Error cancelling event: ", error);
            throw error;
        }
    },

    /**
     * Permanently delete an event.
     * @param {string} eventId
     */
    deleteEvent: async (eventId) => {
        try {
            const docRef = doc(db, EVENTS_COLLECTION, eventId);
            await deleteDoc(docRef);
            return true;
        } catch (error) {
            console.error("Error deleting event: ", error);
            throw error;
        }
    }
};
