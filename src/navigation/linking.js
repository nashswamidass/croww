import * as Linking from 'expo-linking';

const linking = {
    // Add support for custom schemes and web origins
    prefixes: [Linking.createURL('/'), 'https://croww.ai', 'https://croww-app.web.app'],

    config: {
        screens: {
            // Root Navigator (AppNavigator)
            Auth: {
                screens: {
                    Login: 'login',
                    Signup: 'signup',
                    LegalPolicy: {
                        path: 'policy/:type',
                        parse: {
                            type: (type) => type,
                        },
                    },
                },
            },
            Main: {
                screens: {
                    Tabs: {
                        screens: {
                            Home: 'home',
                            Tickets: 'my-tickets',
                            Map: 'map',
                            Search: 'marketplace',
                            Profile: 'me',
                        },
                    },
                    LegalPolicy: {
                        path: 'legal/:type',
                        parse: {
                            type: (type) => type,
                        },
                    },
                    EventDetail: {
                        path: 'event/:id',
                        parse: {
                            id: (id) => id,
                        },
                    },
                    ServiceDetail: {
                        path: 'provider/:serviceId',
                        parse: {
                            serviceId: (serviceId) => serviceId,
                        },
                    },
                    Settings: 'settings',
                    HelpCenter: 'help',
                    Chat: 'messages/:chatId',
                    VerifyIdentity: 'kyc-complete',
                    WebPayment: 'payment-return',
                    Notifications: 'notifications',
                    FriendRequests: 'friend-requests',
                    EventBuddy: {
                        path: 'buddies/:eventId',
                        parse: {
                            eventId: (eventId) => eventId,
                        },
                    },
                    BuddyRequestDetail: {
                        path: 'buddy-request/:requestId',
                        parse: {
                            requestId: (requestId) => requestId,
                        },
                    },
                },
            },
            Blocked: 'blocked',
        },
    },
};

export default linking;
