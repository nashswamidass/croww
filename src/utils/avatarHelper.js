// Utility to handle the funny cartoon avatar library using DiceBear API

export const AVATAR_STYLES = [
    'adventurer',
    'big-smile',
    'bottts',
    'croodles',
    'pixel-art',
    'open-peeps',
    'lorelei'
];

/**
 * Gets a random avatar URL from DiceBear
 * @returns {Object} { id, url }
 */
export const getRandomAvatar = () => {
    const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    const randomSeed = Math.random().toString(36).substring(7);

    // We use PNG format for maximum compatibility with React Native Image component
    const url = `https://api.dicebear.com/7.x/${randomStyle}/png?seed=${randomSeed}&size=200&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf`;

    return {
        id: `${randomStyle}_${randomSeed}`,
        url: url
    };
};

/**
 * Gets the source object for an Image component
 * @param {string|null} photoURL 
 * @param {string} userType
 * @returns {ImageSourcePropType|null}
 */
export const getAvatarSource = (photoURL, userType = 'individual') => {
    if (!photoURL) {
        if (userType === 'business') return null;
        return require('../../assets/avatars/female_default.png');
    }

    if (typeof photoURL === 'string') {
        // Handle full URIs (web or local)
        if (photoURL.includes('://') || photoURL.startsWith('data:')) {
            return { uri: photoURL };
        }

        // Explicit local asset mapping for seeds
        if (photoURL === 'female_1') return require('../../assets/avatars/female_default.png');
    }

    // Fallback based on user type
    if (userType === 'business') {
        return null;
    }

    // Default individual fallback
    return require('../../assets/avatars/female_default.png');
};
