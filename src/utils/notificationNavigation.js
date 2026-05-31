/**
 * Maps a notification's data payload to the correct navigation action.
 *
 * Notification types and their data payloads:
 *   buddy_request_join      → { type, requestId, eventId }  → Notifications screen (owner approves/rejects from list)
 *   buddy_request_approved  → { type, requestId, eventId }  → EventBuddy screen (requester sees they're in)
 *   new_event / NEW_EVENT   → { type, eventId }             → EventDetail screen
 *   CHAT_MESSAGE / CHAT     → { type, chatId, senderId }    → Chat screen
 *   friend_request / FRIEND_REQUEST → { type, requestId }    → FriendRequests screen
 *   FRIEND_ACCEPTED         → { type, userId }              → Profile screen of that user
 *   NEW_BOOKING / BOOKING_UPDATE → { type, bookingId }      → ProviderBookings / MyTickets screen
 *   fallback                →                               → Notifications screen
 *
 * @param {object} navigation - React Navigation navigation prop OR navigationRef
 * @param {object} data       - notification.data from Firestore or push payload
 */
export const navigateFromNotification = (navigation, data = {}) => {
    if (!navigation || !data) return;

    const { type: rawType, eventId, requestId, bookingId, chatId, senderId, userId } = data;
    const type = rawType ? rawType.toLowerCase() : '';

    // Support both a ref (with .navigate) and a regular navigation prop
    const navigate = (screen, params) => {
        if (typeof navigation.navigate === 'function') {
            navigation.navigate(screen, params);
        } else if (navigation.current && typeof navigation.current.navigate === 'function') {
            navigation.current.navigate(screen, params);
        }
    };

    switch (type) {
        case 'buddy_request_join':
            // Owner received a join request → go to the specific Buddy Request Detail screen
            if (requestId) {
                navigate('BuddyRequestDetail', { requestId, event: { id: eventId } });
            } else {
                navigate('Notifications');
            }
            break;

        case 'buddy_request_approved':
            // Requester got approved → take them to the EventBuddy screen for that event
            if (eventId) {
                navigate('EventBuddy', { eventId, highlightRequestId: requestId });
            } else {
                // We typically need eventId for EventBuddy screen, fallback to Notifications
                navigate('Notifications');
            }
            break;

        case 'new_event':
            if (eventId) {
                navigate('EventDetail', { id: eventId });
            } else {
                navigate('Notifications');
            }
            break;

        case 'review_prompt':
            if (data.businessId) {
                navigate('ServiceDetail', { serviceId: data.businessId, openReview: true });
            } else {
                navigate('Notifications');
            }
            break;
            
        case 'chat_message':
        case 'chat':
            if (chatId) {
                navigate('Chat', { chatId });
            } else {
                navigate('ChatList');
            }
            break;

        case 'friend_request':
            navigate('FriendRequests');
            break;

        case 'friend_accepted':
            if (userId || senderId) {
                navigate('ServiceDetail', { serviceId: userId || senderId });
            } else {
                navigate('FriendsList');
            }
            break;

        case 'new_booking':
        case 'booking_update':
            if (bookingId) {
                navigate('BookingDetail', { booking: { id: bookingId } });
            } else {
                navigate('ProviderBookings');
            }
            break;

        default:
            // Booking notifications sometimes carry bookingId but no explicit type
            if (bookingId) {
                navigate('ProviderBookings');
            } else if (chatId) {
                navigate('Chat', { chatId });
            } else {
                // Fallback: open the in-app notifications list
                navigate('Notifications');
            }
            break;
    }
};
