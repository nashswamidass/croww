/**
 * Stable route names for the property product shell and future deep links.
 * Do not name new property routes after events or tickets.
 */
export const TABS = {
    Explore: 'Explore',
    Saved: 'Saved',
    Post: 'Post',
    Messages: 'Messages',
    Profile: 'Profile',
};

export const ROOT = {
    Auth: 'Auth',
    Main: 'Main',
    Blocked: 'Blocked',
};

export const PROPERTY_ROUTES = {
    Property: 'Property',
    Listing: 'Listing',
    Locality: 'Locality',
    PostListing: 'PostListing',
    SavedSearch: 'SavedSearch',
    InventoryDashboard: 'InventoryDashboard',
    InventoryMedia: 'InventoryMedia',
    TrustOverview: 'TrustOverview',
    SubmitVerification: 'SubmitVerification',
    SpatialTour: 'SpatialTour',
};

/** Nested tab navigator registered on the Main stack. */
export const TABS_NAVIGATOR = 'Tabs';

/** Legacy event/social routes kept on the Main stack, not as primary tabs. */
export const LEGACY_ROUTES = {
    Home: 'Home',
    Map: 'Map',
    Search: 'Search',
    MyTickets: 'MyTickets',
    ChatList: 'ChatList',
    BusinessDashboard: 'BusinessDashboard',
};
