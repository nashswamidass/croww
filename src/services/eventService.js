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
    updateDoc
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { userService } from './userService';
import { notificationService } from './notificationService';

const EVENTS_COLLECTION = 'events';

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
     * Get all events (optionally filtered)
     * @returns {Promise<Array>} List of events
     */
    getEvents: async () => {
        try {
            const q = query(collection(db, EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            const now = new Date();
            const events = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // If it's an event with a date, filter out if it's in the past (more than 6 hours ago to allow for late joining)
                if (data.date) {
                    const eventDate = new Date(data.date);
                    // Expire events 6 hours after they start
                    if (eventDate.getTime() + (6 * 60 * 60 * 1000) < now.getTime()) {
                        return; // Skip expired
                    }
                }
                events.push({ id: doc.id, ...data });
            });
            return events;
        } catch (error) {
            console.error("Error fetching events: ", error);
            throw error;
        }
    },

    /**
     * Get single event by ID
     * @param {string} id 
     */
    getEventById: async (id) => {
        try {
            const docRef = doc(db, EVENTS_COLLECTION, id);
            const docSnap = await getDoc(docRef);

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
            const querySnapshot = await getDocs(q);
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
    }
};
