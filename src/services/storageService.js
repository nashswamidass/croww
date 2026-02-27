import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
            // Create a unique filename
            const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, `${path}/${filename}`);

            // Convert URI to Blob
            // On web, fetch works for blob/data URLs
            // On native, fetch works for file:// URLs
            const response = await fetch(uri);
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
