import { auth } from '../services/firebaseConfig';

/**
 * POST/GET helper that attaches the current user's Firebase ID token.
 * Cloud Functions must verify this token and must not trust body.uid.
 */
export async function authenticatedFetch(url, { method = 'POST', body } = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('You must be signed in');
    }

    const token = await user.getIdToken();
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return response;
}
