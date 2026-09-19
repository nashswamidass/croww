import * as Linking from 'expo-linking';
import { getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';

const linking = {
    prefixes: [
        Linking.createURL('/'),
        'crowwapp://',
        'https://croww.ai',
        'https://croww-app.web.app',
    ],

    config: {
        screens: {
            Auth: {
                screens: {
                    Login: 'login',
                    Signup: 'signup',
                    ForgotPassword: 'forgot-password',
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
                            Explore: 'explore',
                            Saved: 'saved',
                            Post: 'post',
                            Areas: 'areas',
                            Profile: 'me',
                        },
                    },
                    // Legacy URLs remain routable on the stack, not as primary tabs.
                    Map: 'map',
                    Search: 'marketplace',
                    MyTickets: 'my-tickets',
                    Property: {
                        path: 'property/:propertyId',
                        parse: {
                            propertyId: (propertyId) => propertyId,
                        },
                    },
                    Listing: {
                        path: 'listing/:listingId',
                        parse: {
                            listingId: (listingId) => listingId,
                        },
                    },
                    Locality: {
                        path: 'area/:localityId',
                        parse: {
                            localityId: (localityId) => localityId,
                        },
                    },
                    PostListing: {
                        path: 'post/edit/:listingId?',
                        parse: {
                            listingId: (listingId) => listingId,
                        },
                    },
                    InventoryDashboard: 'inventory',
                    InventoryMedia: {
                        path: 'inventory/media/:listingId',
                        parse: {
                            listingId: (listingId) => listingId,
                        },
                    },
                    TrustOverview: 'verification',
                    SubmitVerification: 'verification/submit',
                    SpatialTour: 'spatial-tour',
                    SavedSearch: {
                        path: 'saved-search/:searchId',
                        parse: {
                            searchId: (searchId) => searchId,
                        },
                    },
                    PropertyVisualQA: 'visual-qa',
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
                    NotificationSettings: 'notification-settings',
                    HelpCenter: 'help',
                    Chat: 'messages/:chatId',
                    ChatList: 'chats',
                    Messages: 'inbox',
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

    // Redirect legacy /home and bare / to the Explore tab on web.
    getStateFromPath(path, options) {
        const cleanPath = path.split('?')[0].replace(/^\/+/, '');
        if (cleanPath === '' || cleanPath === 'home') {
            return {
                routes: [
                    {
                        name: 'Main',
                        state: {
                            routes: [
                                {
                                    name: 'Tabs',
                                    state: {
                                        routes: [{ name: 'Explore' }],
                                        index: 0,
                                    },
                                },
                            ],
                        },
                    },
                ],
            };
        }
        return defaultGetStateFromPath(path, options);
    },
};

export default linking;
