/**
 * Ensures a URL has a proper protocol prefix so Linking.openURL works.
 * Handles cases like "instagram.com/user", "@username", "https://..." etc.
 */
export const normalizeUrl = (url) => {
    if (!url) return '';
    let trimmed = url.trim();
    if (!trimmed) return '';

    // Already has a protocol
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    // Remove leading @ (common for social handles)
    if (trimmed.startsWith('@')) trimmed = trimmed.substring(1);

    // If it looks like a domain (contains a dot), prepend https://
    if (trimmed.includes('.')) return `https://${trimmed}`;

    // Bare handle — can't open as URL, return empty
    return '';
};
