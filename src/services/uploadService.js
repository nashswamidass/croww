import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadService = {
    /**
     * Upload an image to Firebase Storage
     * @param {string} uri - Local URI of the image
     * @param {string} path - Storage path (e.g., 'avatars/userId')
     * @returns {Promise<string>} Download URL
     */
    uploadImage: async (uri, path) => {
        try {
            if (!uri) return null;

            // If it's already a web URL, return it
            if (uri.startsWith('http')) return uri;

            const response = await fetch(uri);
            const blob = await response.blob();

            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, blob);

            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Error uploading image: ", error);
            throw error;
        }
    }
};
