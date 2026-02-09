export const BUDDY_REQUESTS = [
    {
        id: 'buddy-1',
        eventId: 1, // Sunset Beach Party
        userId: 'user-1',
        userName: 'Sarah M.',
        userAvatar: 'https://i.pravatar.cc/150?img=1',
        spotsAvailable: 4,
        spotsRemaining: 2,
        genderPreference: 'any',
        message: "Looking for chill people to grab drinks with! First time at this bar 🍻",
        status: 'active',
        createdAt: new Date().toISOString(),
        joinedUsers: ['user-2', 'user-3']
    },
    {
        id: 'buddy-2',
        eventId: 1,
        userId: 'user-4',
        userName: 'Mike R.',
        userAvatar: 'https://i.pravatar.cc/150?img=12',
        spotsAvailable: 2,
        spotsRemaining: 1,
        genderPreference: 'any',
        message: "Beach vibes! Let's make it a fun night 🌊",
        status: 'active',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        joinedUsers: ['user-5']
    },
    {
        id: 'buddy-3',
        eventId: 2, // Tech Networking Mixer
        userId: 'user-6',
        userName: 'Alex Chen',
        userAvatar: 'https://i.pravatar.cc/150?img=8',
        spotsAvailable: 3,
        spotsRemaining: 3,
        genderPreference: 'any',
        message: "Looking to network and meet other founders. Let's connect!",
        status: 'active',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        joinedUsers: []
    },
    {
        id: 'buddy-4',
        eventId: 1,
        userId: 'user-7',
        userName: 'Emma L.',
        userAvatar: 'https://i.pravatar.cc/150?img=5',
        spotsAvailable: 2,
        spotsRemaining: 0,
        genderPreference: 'female',
        message: "Girls night out! 💃",
        status: 'full',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        joinedUsers: ['user-8', 'user-9']
    },
    {
        id: 'buddy-5',
        eventId: 3, // Jazz in the Park
        userId: 'user-10',
        userName: 'David K.',
        userAvatar: 'https://i.pravatar.cc/150?img=13',
        spotsAvailable: 5,
        spotsRemaining: 4,
        genderPreference: 'any',
        message: "Jazz enthusiast here! Would love to enjoy the music with fellow fans 🎷",
        status: 'active',
        createdAt: new Date(Date.now() - 5400000).toISOString(),
        joinedUsers: ['user-11']
    }
];
