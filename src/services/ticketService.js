import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    updateDoc,
    serverTimestamp,
    increment
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const TICKETS_COLLECTION = 'tickets';
const EVENTS_COLLECTION = 'events';

export const ticketService = {
    /**
     * Issue a ticket to a user for an event
     * @param {string} userId
     * @param {string} eventId
     * @param {Object} eventData
     * @param {string} status - 'valid', 'scanned', 'cancelled', 'PENDING_PAYMENT'
     * @param {string|null} cashfreeOrderId
     * @param {Object|null} feeBreakdown - Result from calculateFees()
     */
    issueTicket: async (userId, eventId, eventData, status = 'valid', cashfreeOrderId = null, feeBreakdown = null) => {
        try {
            // 1. Create the ticket document
            const ticketData = {
                userId,
                eventId,
                eventTitle: eventData.title,
                date: eventData.date,
                location: eventData.locationName,
                image: eventData.imageUri,
                status: status,
                type: eventData.isPaid ? 'Paid' : 'Free',
                price: eventData.price || 0,
                organizerId: eventData.organizerId || null,
                cashfreeOrderId: cashfreeOrderId,
                issuedAt: serverTimestamp(),

                // --- Fee Breakdown (stored for accounting & organizer dashboard) ---
                feeBreakdown: feeBreakdown ? {
                    subtotal: feeBreakdown.subtotal,
                    convenienceFee: feeBreakdown.convenienceFee,
                    convenienceFeeGST: feeBreakdown.convenienceFeeGST,
                    totalPayable: feeBreakdown.totalPayable,
                    platformCommission: feeBreakdown.platformCommission,
                    platformCommissionGST: feeBreakdown.platformCommissionGST,
                    netOrganizerPayout: feeBreakdown.netOrganizerPayout,
                } : null,

                // Settlement tracking
                settlementStatus: 'PENDING', // PENDING | SETTLED
                settlementDate: null,
            };

            const docRef = await addDoc(collection(db, TICKETS_COLLECTION), ticketData);

            // 2. Update event remaining tickets (ONLY if it's already valid/paid)
            if (status === 'valid') {
                const eventRef = doc(db, EVENTS_COLLECTION, eventId);
                await updateDoc(eventRef, {
                    remainingTickets: increment(-1),
                    attendeesCount: increment(1)
                });
            }

            return { id: docRef.id, ...ticketData };
        } catch (error) {
            console.error("Error issuing ticket:", error);
            throw error;
        }
    },

    /**
     * Finalize pending tickets after payment success
     */
    finalizePendingTickets: async (cashfreeOrderId) => {
        try {
            // Simplify query to avoid composite index requirements
            const q = query(
                collection(db, TICKETS_COLLECTION),
                where('cashfreeOrderId', '==', cashfreeOrderId)
            );
            const querySnapshot = await getDocs(q);


            if (querySnapshot.empty) return false;

            for (const ticketDoc of querySnapshot.docs) {
                const ticketData = ticketDoc.data();

                // Only process if it's actually pending
                if (ticketData.status !== 'PENDING_PAYMENT') continue;

                const ticketRef = doc(db, TICKETS_COLLECTION, ticketDoc.id);

                // Update ticket to valid
                await updateDoc(ticketRef, {
                    status: 'valid',
                    updatedAt: serverTimestamp()
                });

                // Update event counts
                const eventRef = doc(db, EVENTS_COLLECTION, ticketData.eventId);
                await updateDoc(eventRef, {
                    remainingTickets: increment(-1),
                    attendeesCount: increment(1)
                });
            }
            return true;
        } catch (error) {
            console.error("Error finalizing pending tickets:", error);
            throw error;
        }
    },

    /**
     * Subscribe to tickets for a specific user (Real-time)
     */
    subscribeTicketsByUser: (userId, onUpdate) => {
        const q = query(
            collection(db, TICKETS_COLLECTION),
            where('userId', '==', userId)
        );

        const { onSnapshot } = require('firebase/firestore');
        return onSnapshot(q, (querySnapshot) => {
            const tickets = [];
            querySnapshot.forEach((doc) => {
                tickets.push({ id: doc.id, ...doc.data() });
            });
            onUpdate(tickets);
        }, (error) => {
            console.error("Error subscribing to tickets:", error);
        });
    },

    /**
     * Validate a ticket (scan)
     */
    validateTicket: async (ticketId) => {
        try {
            const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
            const ticketSnap = await getDoc(ticketRef);

            if (!ticketSnap.exists()) {
                throw new Error("Ticket not found");
            }

            const ticketData = ticketSnap.data();
            if (ticketData.status === 'scanned') {
                return { success: false, message: "Ticket already scanned" };
            }

            if (ticketData.status !== 'valid') {
                return { success: false, message: "Ticket is invalid" };
            }

            // Mark as scanned
            await updateDoc(ticketRef, {
                status: 'scanned',
                scannedAt: serverTimestamp()
            });

            return { success: true, message: "Ticket validated successfully", ticket: ticketData };
        } catch (error) {
            console.error("Error validating ticket:", error);
            throw error;
        }
    },

    /**
     * Get all tickets for all events belonging to an organizer
     */
    getTicketsByOrganizer: async (organizerId) => {
        try {
            if (!organizerId) {
                console.warn("getTicketsByOrganizer called without organizerId");
                return [];
            }
            const q = query(
                collection(db, TICKETS_COLLECTION),
                where('organizerId', '==', organizerId)
            );
            const querySnapshot = await getDocs(q);
            const tickets = [];
            querySnapshot.forEach((doc) => {
                tickets.push({ id: doc.id, ...doc.data() });
            });
            return tickets;
        } catch (error) {
            console.error("Error fetching organizer tickets:", error);
            throw error;
        }
    },

    /**
     * Get analytics for a specific event
     */
    getEventStats: async (eventId, organizerId) => {
        try {
            // Query by eventId only — security rules allow any authenticated user to read tickets
            const q = query(
                collection(db, TICKETS_COLLECTION),
                where('eventId', '==', eventId)
            );
            const querySnapshot = await getDocs(q);

            let sold = 0;
            let scanned = 0;
            const attendees = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                sold++;
                if (data.status === 'scanned') {
                    scanned++;
                }
                attendees.push({ id: doc.id, ...data });
            });

            return { sold, scanned, attendees };
        } catch (error) {
            console.error("Error fetching event stats:", error);
            // Return empty instead of throwing to avoid crashing the UI
            return { sold: 0, scanned: 0, attendees: [] };
        }
    }
};
