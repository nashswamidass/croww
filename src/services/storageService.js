import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { imageOptimizer } from '../utils/imageOptimizer';

/**
 * Storage Service for handling file uploads to Firebase Storage
 */
export const storageService = {
    /**
     * Upload an image to Firebase Storage
     * @param {string} uri - Local URI of the image
     * @param {string} path - Storage path (e.g., 'events', 'profiles')
     * @returns {Promise<string>} Download URL of the uploaded image
     */
    uploadImage: async (uri, path) => {
        if (!uri) return null;

        // If it's already a remote URL, return it
        if (uri.startsWith('http')) return uri;

        try {
            // Optimize image before upload (Resize + WebP)
            const optimizedUri = await imageOptimizer.optimizeImage(uri);
            const finalUri = optimizedUri || uri;

            // Create a unique filename - use .webp extension
            const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
            const storageRef = ref(storage, `${path}/${filename}`);

            // Convert URI to Blob
            const response = await fetch(finalUri);
            const blob = await response.blob();

            // Upload to Storage
            await uploadBytes(storageRef, blob);

            // Get Download URL
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error(`Error uploading image to ${path}:`, error);
            throw error;
        }
    }
};
