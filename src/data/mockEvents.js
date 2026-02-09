import { COLORS } from '../constants/theme';

const getRelativeDate = (daysOffset, hour = 18) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
};

export const EVENTS = [
    {
        id: 1,
        title: "Sunset Beach Party",
        description: "Live DJ set by the ocean with bonfires.",
        category: "Party",
        date: "Tonight, 8 PM",
        timestamp: getRelativeDate(0, 20), // Today 8pm
        coordinate: { latitude: 37.78825, longitude: -122.4324 },
        color: COLORS.accents.pink,
        imageUri: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
        isPublic: true,
        verificationStatus: 'verified',
        verificationType: 'aadhaar'
    },
    {
        id: 2,
        title: "Tech Networking Mixer",
        description: "Meet local founders and developers.",
        category: "Corporate",
        date: "Tomorrow, 6 PM",
        timestamp: getRelativeDate(1, 18), // Tomorrow 6pm
        coordinate: { latitude: 37.75825, longitude: -122.4624 },
        color: COLORS.accents.blue,
        imageUri: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
        isPublic: true,
        verificationStatus: 'verified',
        verificationType: 'business'
    },
    {
        id: 3,
        title: "Jazz in the Park",
        description: "Live jazz band open air concert.",
        category: "Concert",
        date: "Saturday, 2 PM",
        timestamp: getRelativeDate(3, 14), // In 3 days
        coordinate: { latitude: 37.76825, longitude: -122.4424 },
        color: COLORS.accents.orange,
        imageUri: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800',
        isPublic: false,
        verificationStatus: 'none',
        verificationType: null
    },
    {
        id: 4,
        title: "Wedding Expo",
        description: "Find vendors for your big day.",
        category: "Exhibition",
        date: "Next Sunday",
        timestamp: getRelativeDate(7, 10), // In 7 days (1 week)
        coordinate: { latitude: 37.79825, longitude: -122.4124 },
        color: COLORS.accents.purple,
        imageUri: null,
        isPublic: true,
        verificationStatus: 'verified',
        verificationType: 'business'
    },
    {
        id: 5,
        title: "Monthly Art Walk",
        description: "Tour the city's best galleries.",
        category: "Art",
        date: "In 2 Weeks",
        timestamp: getRelativeDate(14, 18), // In 14 days (2 weeks)
        coordinate: { latitude: 37.77825, longitude: -122.4524 },
        color: COLORS.accents.yellow,
        imageUri: null,
        isPublic: false,
        verificationStatus: 'none',
        verificationType: null
    }
];
