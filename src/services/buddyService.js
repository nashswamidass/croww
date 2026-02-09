import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUDDY_REQUESTS } from '../data/mockBuddyRequests';

/**
 * Mock Buddy Service
 * Manages event buddy requests for finding companions
 */

let buddyRequestsStore = [...BUDDY_REQUESTS];
const currentUserId = 'current-user'; // Mock current user

/**
 * Get all buddy requests for an event
 * @param {number} eventId - Event ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getBuddyRequests = async (eventId, filters = {}) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            let requests = buddyRequestsStore.filter(req => req.eventId === eventId);

            // Apply filters
            if (filters.genderPreference && filters.genderPreference !== 'any') {
                requests = requests.filter(req =>
                    req.genderPreference === 'any' || req.genderPreference === filters.genderPreference
                );
            }

            if (filters.hasSpots) {
                requests = requests.filter(req => req.spotsRemaining > 0);
            }

            // Sort by newest first
            requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            resolve(requests);
        }, 300);
    });
};

/**
 * Create a new buddy request
 * @param {number} eventId - Event ID
 * @param {Object} data - Request data
 * @returns {Promise<Object>}
 */
export const createBuddyRequest = async (eventId, data) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const newRequest = {
                id: `buddy-${Date.now()}`,
                eventId,
                userId: currentUserId,
                userName: 'You',
                userAvatar: 'https://i.pravatar.cc/150?img=20',
                spotsAvailable: data.spotsAvailable,
                spotsRemaining: data.spotsAvailable,
                genderPreference: data.genderPreference || 'any',
                message: data.message || '',
                status: 'active',
                createdAt: new Date().toISOString(),
                joinedUsers: []
            };

            buddyRequestsStore.push(newRequest);

            resolve({
                success: true,
                request: newRequest
            });
        }, 500);
    });
};

/**
 * Join a buddy request
 * @param {string} requestId - Request ID
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {Promise<Object>}
 */
export const joinBuddyRequest = async (requestId, userId = currentUserId) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const request = buddyRequestsStore.find(req => req.id === requestId);

            if (!request) {
                resolve({ success: false, message: 'Request not found' });
                return;
            }

            if (request.spotsRemaining === 0) {
                resolve({ success: false, message: 'Group is full' });
                return;
            }

            if (request.joinedUsers.includes(userId)) {
                resolve({ success: false, message: 'Already joined' });
                return;
            }

            // Add user to group
            request.joinedUsers.push(userId);
            request.spotsRemaining--;

            // Update status if full
            if (request.spotsRemaining === 0) {
                request.status = 'full';
            }

            resolve({
                success: true,
                message: `You've joined ${request.userName}'s group!`,
                request
            });
        }, 500);
    });
};

/**
 * Leave a buddy request
 * @param {string} requestId - Request ID
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {Promise<Object>}
 */
export const leaveBuddyRequest = async (requestId, userId = currentUserId) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const request = buddyRequestsStore.find(req => req.id === requestId);

            if (!request) {
                resolve({ success: false, message: 'Request not found' });
                return;
            }

            if (!request.joinedUsers.includes(userId)) {
                resolve({ success: false, message: 'Not in this group' });
                return;
            }

            // Remove user from group
            request.joinedUsers = request.joinedUsers.filter(id => id !== userId);
            request.spotsRemaining++;
            request.status = 'active';

            resolve({
                success: true,
                message: 'You left the group',
                request
            });
        }, 500);
    });
};

/**
 * Cancel a buddy request (creator only)
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>}
 */
export const cancelBuddyRequest = async (requestId) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const request = buddyRequestsStore.find(req => req.id === requestId);

            if (!request) {
                resolve({ success: false, message: 'Request not found' });
                return;
            }

            if (request.userId !== currentUserId) {
                resolve({ success: false, message: 'Not authorized' });
                return;
            }

            request.status = 'cancelled';

            resolve({
                success: true,
                message: 'Buddy request cancelled'
            });
        }, 500);
    });
};

/**
 * Get user's active buddy requests
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {Promise<Array>}
 */
export const getUserBuddyRequests = async (userId = currentUserId) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const requests = buddyRequestsStore.filter(req =>
                req.userId === userId && req.status === 'active'
            );
            resolve(requests);
        }, 300);
    });
};

/**
 * Check if user has joined a request
 * @param {string} requestId - Request ID
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {boolean}
 */
export const hasJoinedRequest = (requestId, userId = currentUserId) => {
    const request = buddyRequestsStore.find(req => req.id === requestId);
    return request ? request.joinedUsers.includes(userId) : false;
};

/**
 * Get buddy request count for an event
 * @param {number} eventId - Event ID
 * @returns {Promise<number>}
 */
export const getBuddyRequestCount = async (eventId) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const count = buddyRequestsStore.filter(req =>
                req.eventId === eventId && req.status === 'active'
            ).length;
            resolve(count);
        }, 100);
    });
};
