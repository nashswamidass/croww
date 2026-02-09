export const MOCK_ANALYTICS = {
    profileViews: {
        total: 1240,
        change: '+15%',
        daily: [45, 52, 38, 65, 48, 72, 55]
    },
    bookings: {
        total: 24,
        pending: 5,
        completed: 19,
        earnings: '$3,450'
    },
    engagement: {
        rating: 4.8,
        reviews: 156,
        responseRate: '98%'
    },
    recentActivity: [
        { id: 1, type: 'view', user: 'User123', time: '2 mins ago' },
        { id: 2, type: 'booking', user: 'Alex Smith', time: '1 hour ago', status: 'pending' },
        { id: 3, type: 'review', user: 'Maria G.', time: '5 hours ago', rating: 5 },
        { id: 4, type: 'view', user: 'User456', time: 'Yesterday' }
    ]
};
