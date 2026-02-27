import { Platform } from 'react-native';

/**
 * Check if an image URI is valid for the current platform.
 * On web, file:// and content:// URIs are not accessible.
 * Returns the URI if valid, or null if not.
 */
export const getValidImageUri = (uri) => {
    if (!uri) return null;

    // Remote URLs are always valid
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

    // Data URIs are valid everywhere
    if (uri.startsWith('data:')) return uri;

    // On web, local file URIs are not accessible
    if (Platform.OS === 'web') {
        // blob: URIs are valid on web (from file inputs)
        if (uri.startsWith('blob:')) return uri;
        // Everything else (file://, content://) is not accessible
        return null;
    }

    // On native platforms, file:// and content:// are valid
    return uri;
};

// Default fallback image for events without a valid image
export const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80';
