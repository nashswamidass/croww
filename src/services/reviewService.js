import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    orderBy,
    serverTimestamp,
    limit,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const REVIEWS_COLLECTION = 'reviews';

export const reviewService = {
    /**
     * Submit a review for a business
     * Only verified users can review
     * @param {Object} reviewData - { businessId, userId, userName, rating, comment }
     */
    submitReview: async (reviewData) => {
        try {
            const { businessId, userId, userName, rating, comment } = reviewData;

            if (!businessId || !userId || !rating) {
                throw new Error('Missing required review fields');
            }

            // Check if user already reviewed this business
            const existingReview = await reviewService.getUserReview(businessId, userId);
            if (existingReview) {
                // Update existing review
                const reviewRef = doc(db, REVIEWS_COLLECTION, existingReview.id);
                await updateDoc(reviewRef, {
                    rating,
                    comment: comment || '',
                    updatedAt: serverTimestamp(),
                });
                // Update business average rating
                await reviewService.updateBusinessRating(businessId);
                return existingReview.id;
            }

            // Create new review
            const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
                businessId,
                userId,
                userName: userName || 'User',
                rating,
                comment: comment || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Update business average rating
            await reviewService.updateBusinessRating(businessId);

            return docRef.id;
        } catch (error) {
            console.error('Error submitting review:', error);
            throw error;
        }
    },

    /**
     * Get all reviews for a business
     */
    getBusinessReviews: async (businessId) => {
        try {
            if (!businessId) return [];

            const q = query(
                collection(db, REVIEWS_COLLECTION),
                where('businessId', '==', businessId),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching reviews:', error);
            return [];
        }
    },

    /**
     * Get a specific user's review for a business
     */
    getUserReview: async (businessId, userId) => {
        try {
            if (!businessId || !userId) return null;

            const q = query(
                collection(db, REVIEWS_COLLECTION),
                where('businessId', '==', businessId),
                where('userId', '==', userId),
                limit(1)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        } catch (error) {
            console.error('Error fetching user review:', error);
            return null;
        }
    },

    /**
     * Delete a review
     */
    deleteReview: async (reviewId, businessId) => {
        try {
            await deleteDoc(doc(db, REVIEWS_COLLECTION, reviewId));
            if (businessId) {
                await reviewService.updateBusinessRating(businessId);
            }
        } catch (error) {
            console.error('Error deleting review:', error);
            throw error;
        }
    },

    /**
     * Recalculate and update the business's average rating
     */
    updateBusinessRating: async (businessId) => {
        try {
            const reviews = await reviewService.getBusinessReviews(businessId);
            const totalReviews = reviews.length;
            const avgRating = totalReviews > 0
                ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)
                : 0;

            const businessRef = doc(db, 'users', businessId);
            await updateDoc(businessRef, {
                rating: parseFloat(avgRating),
                reviews: totalReviews,
            });
        } catch (error) {
            console.error('Error updating business rating:', error);
        }
    },
};
