import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { imageOptimizer } from '../utils/imageOptimizer';

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

            // Optimize image before upload (Resize + WebP)
            const optimizedUri = await imageOptimizer.optimizeImage(uri);
            const finalUri = optimizedUri || uri;

            const blob = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.onload = function() {
                    resolve(xhr.response);
                };
                xhr.onerror = function(e) {
                    console.error("[UploadService] XHR Blob creation failed", e);
                    reject(new TypeError("Network request failed processing local file"));
                };
                xhr.responseType = 'blob';
                xhr.open('GET', finalUri, true);
                xhr.send(null);
            });

            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, blob);

            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Error uploading image: ", error);
            throw error;
        }
    }
};
