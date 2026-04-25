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
    orderBy
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { chatService } from './chatService';
import { notificationService } from './notificationService';

const BOOKINGS_COLLECTION = 'bookings';

export const bookingService = {
    /**
     * Get a single booking by ID
     */
    getBookingById: async (bookingId) => {
        try {
            const docRef = doc(db, BOOKINGS_COLLECTION, bookingId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error("Error getting booking by ID:", error);
            throw error;
        }
    },

    /**
     * Cancel a booking (by customer)
     */
    cancelBooking: async (bookingId, senderId, senderName) => {
        try {
            const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
            const bookingSnap = await getDoc(bookingRef);
            if (!bookingSnap.exists()) throw new Error("Booking not found");
            
            const bookingData = bookingSnap.data();
            
            await updateDoc(bookingRef, {
                status: 'cancelled',
                updatedAt: serverTimestamp()
            });

            // Notify provider
            try {
                await notificationService.sendNotification(
                    bookingData.providerId,
                    "Booking Cancelled",
                    `${senderName} has cancelled their booking for ${bookingData.serviceName}.`,
                    { bookingId, type: 'BOOKING_UPDATE', status: 'cancelled' }
                );

                // Send chat message
                const participantIds = [senderId, bookingData.providerId];
                const participantNames = {
                    [senderId]: senderName,
                    [bookingData.providerId]: bookingData.providerName || 'Provider'
                };
                const chatId = await chatService.createChat(participantIds, participantNames);
                if (chatId) {
                    await chatService.sendMessage(chatId, `⚠️ I have cancelled my booking for ${bookingData.serviceName}.`, senderId, senderName);
                }
            } catch (notifyErr) {
                console.warn("[bookingService] Notification/Chat failed during cancellation:", notifyErr);
            }

            return true;
        } catch (error) {
            console.error("Error cancelling booking:", error);
            throw error;
        }
    },
    /**
     * Create a new booking request
     */
    createBooking: async (senderId, providerId, bookingDetails) => {
        try {
            const bookingData = {
                senderId,
                providerId,
                ...bookingDetails,
                status: 'pending', // pending, accepted, rejected, completed
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, BOOKINGS_COLLECTION), bookingData);
            return { id: docRef.id, ...bookingData };
        } catch (error) {
            console.error("Error creating booking:", error);
            throw error;
        }
    },

    /**
     * Get bookings for a provider (incoming requests)
     */
    getBookingsForProvider: async (providerId) => {
        try {
            const q = query(
                collection(db, BOOKINGS_COLLECTION),
                where('providerId', '==', providerId),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting provider bookings:", error);
            throw error;
        }
    },

    /**
     * Get bookings for a user (outgoing requests)
     */
    getBookingsByUser: async (userId) => {
        try {
            const q = query(
                collection(db, BOOKINGS_COLLECTION),
                where('senderId', '==', userId),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting user bookings:", error);
            throw error;
        }
    },

    /**
     * Update booking status
     */
    updateBookingStatus: async (bookingId, status) => {
        try {
            const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
            await updateDoc(bookingRef, {
                status,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error("Error updating booking status:", error);
            throw error;
        }
    },

    /**
     * Update booking status with additional details and notifications
     */
    updateBookingStatusDetailed: async (booking, newStatus, message = null) => {
        try {
            const bookingId = booking.id;
            const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);

            const senderId = booking.senderId;
            const providerId = booking.providerId;

            await updateDoc(bookingRef, {
                status: newStatus,
                providerMessage: message,
                updatedAt: serverTimestamp()
            });

            // Send notification to the relevant user
            try {
                let recipientId = senderId;
                let notificationTitle = newStatus === 'accepted' ? "Booking Accepted!" : "Booking Declined";
                let notificationMessage = newStatus === 'accepted'
                    ? `Your booking for ${booking.serviceName} has been accepted.`
                    : `Your booking for ${booking.serviceName} was declined. Refund initiated.`;

                if (message) {
                    notificationMessage += `\n\nNote: "${message}"`;
                }

                await notificationService.sendNotification(recipientId, notificationTitle, notificationMessage, {
                    bookingId,
                    status: newStatus
                });
            } catch (notifyErr) {
                console.warn("[bookingService] Notification failed but proceeding:", notifyErr);
            }

            // Handle Chat
            try {
                const participantIds = [senderId, providerId];
                const participantNames = {
                    [senderId]: booking.customerName || 'Customer',
                    [providerId]: booking.providerName || 'Provider'
                };

                const chatId = await chatService.createChat(participantIds, participantNames);
                if (chatId) {
                    const prefix = newStatus === 'accepted' ? "✅ Booking Accepted: " : "❌ Booking Declined: ";
                    const refundInfo = newStatus === 'rejected' ? "\n\n(A refund will be automatically processed within 48 hours.)" : "";
                    const chatMsg = `${prefix}${message || (newStatus === 'accepted' ? 'Looking forward to it!' : 'I am unable to accept this request.')}${refundInfo}`;

                    await chatService.sendMessage(chatId, chatMsg, providerId, booking.providerName);
                }
            } catch (chatErr) {
                console.warn("[bookingService] Chat integration failed but proceeding:", chatErr);
            }

            return true;
        } catch (error) {
            console.error("Error updating detailed booking status:", error);
            throw error;
        }
    },

    /**
     * Finalize pending booking after payment success
     */
    finalizePendingBooking: async (cashfreeOrderId) => {
        try {
            // Simplify query to avoid composite index requirements
            const q = query(
                collection(db, BOOKINGS_COLLECTION),
                where('cashfreeOrderId', '==', cashfreeOrderId)
            );
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                console.log(`[bookingService] No booking found for cashfreeOrderId: ${cashfreeOrderId}`);
                return false;
            }

            for (const bookingDoc of querySnapshot.docs) {
                const bookingData = bookingDoc.data();
                console.log(`[bookingService] Found booking ${bookingDoc.id}, status: ${bookingData.status}, paymentStatus: ${bookingData.paymentStatus}`);

                // Only process if it's actually pending
                if (bookingData.paymentStatus !== 'PENDING_PAYMENT') {
                    console.log(`[bookingService] Booking ${bookingDoc.id} is not in PENDING_PAYMENT status, skipping.`);
                    continue;
                }

                const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingDoc.id);
                await updateDoc(bookingRef, {
                    paymentStatus: 'PAID',
                    status: 'pending', // Set status to 'pending' for provider review
                    updatedAt: serverTimestamp()
                });
                console.log(`[bookingService] Successfully updated booking ${bookingDoc.id} to PAID`);
            }
            return true;
        } catch (error) {
            console.error("Error finalizing pending booking:", error);
            throw error;
        }
    },

    /**
     * Subscribe to bookings for a specific user (Real-time)
     */
    subscribeBookingsByUser: (userId, onUpdate) => {
        const q = query(
            collection(db, BOOKINGS_COLLECTION),
            where('senderId', '==', userId)
        );

        const { onSnapshot } = require('firebase/firestore');
        return onSnapshot(q, (querySnapshot) => {
            const bookings = [];
            querySnapshot.forEach((doc) => {
                bookings.push({ id: doc.id, ...doc.data() });
            });
            onUpdate(bookings);
        }, (error) => {
            console.error("Error subscribing to bookings:", error);
        });
    },

    /**
     * Get booking stats for a provider
     * @param {string} providerId 
     */
    getProviderBookingStats: async (providerId) => {
        try {
            const q = query(
                collection(db, BOOKINGS_COLLECTION),
                where('providerId', '==', providerId)
            );
            const querySnapshot = await getDocs(q);

            let total = 0;
            let pending = 0;
            let accepted = 0;
            let completed = 0;
            let earnings = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                total++;
                if (data.status === 'pending') pending++;
                if (data.status === 'accepted') accepted++;
                if (data.status === 'completed') {
                    completed++;
                    earnings += (parseFloat(data.totalPrice) || 0);
                }
            });

            return { total, pending, accepted, completed, earnings };
        } catch (error) {
            console.error("Error fetching provider booking stats:", error);
            return { total: 0, pending: 0, accepted: 0, completed: 0, earnings: 0 };
        }
    },

    /**
     * Subscribe to bookings for a provider (incoming requests)
     */
    subscribeBookingsForProvider: (providerId, onUpdate) => {
        const q = query(
            collection(db, BOOKINGS_COLLECTION),
            where('providerId', '==', providerId)
        );

        const { onSnapshot } = require('firebase/firestore');
        return onSnapshot(q, (querySnapshot) => {
            const bookings = [];
            querySnapshot.forEach((doc) => {
                bookings.push({ id: doc.id, ...doc.data() });
            });
            onUpdate(bookings);
        }, (error) => {
            console.error("Error subscribing to provider bookings:", error);
        });
    }
};
