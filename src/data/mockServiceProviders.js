export const SERVICE_PROVIDERS = [
    {
        id: 1,
        name: 'DJ Pulse',
        role: 'DJ',
        category: 'DJs',
        rating: 4.8,
        reviews: 124,
        price: 150,
        priceUnit: '/hr',
        pricingType: 'fixed',
        location: 'Downtown, Mumbai',
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        about: 'Specializing in electronic, hip-hop, and top 40. Over 10 years of experience rocking parties and weddings.',
        portfolio: ['https://via.placeholder.com/300', 'https://via.placeholder.com/300']
    },
    {
        id: 2,
        name: 'Sarah Snaps',
        role: 'Photographer',
        category: 'Photographers',
        rating: 4.9,
        reviews: 85,
        price: 200,
        priceUnit: '/hr',
        location: 'Bandra, Mumbai',
        coordinates: { latitude: 19.0596, longitude: 72.8295 },
        about: 'Capturing moments that last a lifetime. Expert in event and portrait photography.',
        portfolio: ['https://via.placeholder.com/300', 'https://via.placeholder.com/300']
    },
    {
        id: 3,
        name: 'Neon Vibes',
        role: 'Decor',
        category: 'Decorators',
        rating: 4.5,
        reviews: 56,
        price: 500,
        priceUnit: '/event',
        location: 'Andheri, Mumbai',
        coordinates: { latitude: 19.1136, longitude: 72.8697 },
        about: 'Bringing your events to life with modern and neon-themed decorations.',
        portfolio: ['https://via.placeholder.com/300', 'https://via.placeholder.com/300']
    },
    {
        id: 4,
        name: 'The Groove Band',
        role: 'Live Band',
        category: 'Live Bands',
        rating: 4.7,
        reviews: 92,
        price: 300,
        priceUnit: '/hr',
        location: 'Juhu, Mumbai',
        coordinates: { latitude: 19.1075, longitude: 72.8263 },
        about: 'A versatile live band performing classic hits and modern favorites.',
        portfolio: ['https://via.placeholder.com/300', 'https://via.placeholder.com/300']
    },
    {
        id: 5,
        name: 'Chef Maria',
        role: 'Caterer',
        category: 'Caterers',
        rating: 4.6,
        reviews: 143,
        price: 40,
        priceUnit: '/head',
        location: 'South Mumbai',
        coordinates: { latitude: 18.9220, longitude: 72.8347 },
        about: 'Exquisite multi-cuisine catering for events of all sizes.',
        portfolio: ['https://via.placeholder.com/300', 'https://via.placeholder.com/300']
    }
];

export const SERVICE_CATEGORIES = [
    { id: 'djs', name: 'DJs', icon: 'headset' },
    { id: 'bands', name: 'Live Bands', icon: 'musical-notes' },
    { id: 'singers', name: 'Singers', icon: 'mic' },
    { id: 'decor', name: 'Decorators', icon: 'brush' },
    { id: 'photos', name: 'Photographers', icon: 'camera' },
    { id: 'catering', name: 'Caterers', icon: 'restaurant' },
    { id: 'bartenders', name: 'Bartenders', icon: 'wine' },
    { id: 'security', name: 'Security', icon: 'shield-checkmark' }
];
