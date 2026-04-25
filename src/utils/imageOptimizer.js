import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Utility for optimizing images before upload.
 * Reduces size while maintaining acceptable quality.
 */
export const imageOptimizer = {
    /**
     * Resizes and compresses an image
     * @param {string} uri - Local URI of the image
     * @param {object} options - Optimization options
     * @returns {Promise<string>} URI of the optimized image
     */
    optimizeImage: async (uri, options = {}) => {
        if (!uri) return null;
        if (uri.startsWith('http')) return uri;

        const {
            maxWidth = 1080,
            maxHeight = 1080,
            compress = 0.8,
            format = ImageManipulator.SaveFormat.WEBP
        } = options;

        try {
            // First attempt with WEBP
            try {
                const result = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: maxWidth } }],
                    { compress, format: ImageManipulator.SaveFormat.WEBP }
                );
                console.log(`[ImageOptimizer] Optimized with WebP. Result Size: ${result.uri.length}`);
                return result.uri;
            } catch (webpError) {
                console.warn("[ImageOptimizer] WebP optimization failed, falling back to JPEG:", webpError);
                // Fallback to JPEG if WEBP fails for any reason
                const fallbackResult = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: maxWidth } }],
                    { compress, format: ImageManipulator.SaveFormat.JPEG }
                );
                return fallbackResult.uri;
            }
        } catch (error) {
            console.error("Error optimizing image:", error);
            return uri; // Fallback to original
        }
    }
};
