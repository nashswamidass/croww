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

const BOOKINGS_COLLECTION = 'bookings';

export const bookingService = {
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

            if (querySnapshot.empty) return false;

            for (const bookingDoc of querySnapshot.docs) {
                const bookingData = bookingDoc.data();

                // Only process if it's actually pending
                if (bookingData.paymentStatus !== 'PENDING_PAYMENT') continue;

                const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingDoc.id);
                await updateDoc(bookingRef, {
                    paymentStatus: 'PAID',
                    status: 'pending', // Set status to 'pending' for provider review
                    updatedAt: serverTimestamp()
                });
            }
            return true;
        } catch (error) {
            console.error("Error finalizing pending booking:", error);
            throw error;
        }
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
    }
};
