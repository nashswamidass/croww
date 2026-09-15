/**
 * Location Share Service
 * Manages owner-controlled exact location sharing requests and permissions.
 */

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { COLLECTIONS } from '../../domain/property/constants';
import { notificationService } from '../notificationService';

function requireUid() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Authentication required');
    return uid;
}

export function buildShareId(propertyId, viewerUid) {
    if (!propertyId || !viewerUid) throw new Error('propertyId and viewerUid required');
    return `${propertyId}__${viewerUid}`;
}

export const locationShareService = {
    /**
     * Viewer requests exact location access for a property.
     */
    async requestLocationShare({ propertyId, listingId = null, ownerUid, propertyTitle = 'Property' }) {
        const viewerUid = requireUid();
        if (viewerUid === ownerUid) {
            return { ok: true, status: 'OWNER', message: 'You own this property' };
        }
        const shareId = buildShareId(propertyId, viewerUid);
        const ref = doc(db, COLLECTIONS.locationShares, shareId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const current = snap.data();
            if (current.status === 'APPROVED') {
                // Check expiry
                const isExpired = current.expiresAt && current.expiresAt.toMillis() <= Date.now();
                if (!isExpired) {
                    return { ok: true, status: 'APPROVED', share: current };
                }
            } else if (current.status === 'PENDING') {
                return { ok: true, status: 'PENDING', share: current };
            }
        }

        const payload = {
            id: shareId,
            propertyId,
            listingId: listingId || null,
            ownerUid,
            viewerUid,
            requestedByUid: viewerUid,
            reviewedByUid: null,
            status: 'PENDING',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            approvedAt: null,
            declinedAt: null,
            revokedAt: null,
            expiresAt: null,
        };

        await setDoc(ref, payload);

        // Notify property owner
        await notificationService.sendNotification(
            ownerUid,
            'Exact location requested',
            `A prospective buyer requested the exact location of ${propertyTitle}.`,
            {
                type: 'LOCATION_SHARE_REQUEST',
                propertyId,
                listingId,
                viewerUid,
                shareId,
            }
        ).catch((err) => console.warn('Failed to dispatch location share notification', err?.message));

        return { ok: true, status: 'PENDING', share: payload };
    },

    /**
     * Get share status for the current viewer on a property.
     */
    async getShareStatus(propertyId, viewerUid = null) {
        const uid = viewerUid || auth.currentUser?.uid;
        if (!uid || !propertyId) return null;
        try {
            const shareId = buildShareId(propertyId, uid);
            const snap = await getDoc(doc(db, COLLECTIONS.locationShares, shareId));
            if (!snap.exists()) return null;
            const data = snap.data();
            if (data.status === 'APPROVED' && data.expiresAt && data.expiresAt.toMillis() <= Date.now()) {
                return { ...data, status: 'EXPIRED' };
            }
            return data;
        } catch (error) {
            console.warn('Error fetching location share status:', error?.message);
            return null;
        }
    },

    /**
     * Owner approves location share.
     */
    async approveShare({ propertyId, viewerUid, listingId = null, durationDays = 30 }) {
        const ownerUid = requireUid();
        const shareId = buildShareId(propertyId, viewerUid);
        const ref = doc(db, COLLECTIONS.locationShares, shareId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Location share request not found');
        const current = snap.data();
        if (current.ownerUid !== ownerUid) throw new Error('Not authorized to approve this request');

        let expiresAt = null;
        if (durationDays && Number(durationDays) > 0) {
            const expireDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
            expiresAt = Timestamp.fromDate(expireDate);
        }

        const updates = {
            status: 'APPROVED',
            approvedAt: serverTimestamp(),
            reviewedByUid: ownerUid,
            updatedAt: serverTimestamp(),
            expiresAt,
        };

        await updateDoc(ref, updates);

        // Notify requester
        await notificationService.sendNotification(
            viewerUid,
            'Exact location shared',
            'The owner approved your request to view the exact property location.',
            {
                type: 'LOCATION_SHARE_APPROVED',
                propertyId,
                listingId: listingId || current.listingId || null,
                shareId,
            }
        ).catch((err) => console.warn('Failed to notify viewer of approved share', err?.message));

        return { ok: true, status: 'APPROVED', ...updates };
    },

    /**
     * Owner declines location share.
     */
    async declineShare({ propertyId, viewerUid }) {
        const ownerUid = requireUid();
        const shareId = buildShareId(propertyId, viewerUid);
        const ref = doc(db, COLLECTIONS.locationShares, shareId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Location share request not found');
        const current = snap.data();
        if (current.ownerUid !== ownerUid) throw new Error('Not authorized to decline this request');

        const updates = {
            status: 'DECLINED',
            declinedAt: serverTimestamp(),
            reviewedByUid: ownerUid,
            updatedAt: serverTimestamp(),
        };

        await updateDoc(ref, updates);
        return { ok: true, status: 'DECLINED', ...updates };
    },

    /**
     * Owner or viewer revokes/cancels location share.
     */
    async revokeShare({ propertyId, viewerUid }) {
        const currentUid = requireUid();
        const shareId = buildShareId(propertyId, viewerUid);
        const ref = doc(db, COLLECTIONS.locationShares, shareId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Location share request not found');
        const current = snap.data();
        if (current.ownerUid !== currentUid && current.viewerUid !== currentUid) {
            throw new Error('Not authorized to revoke this share');
        }

        const updates = {
            status: 'REVOKED',
            revokedAt: serverTimestamp(),
            reviewedByUid: currentUid,
            updatedAt: serverTimestamp(),
        };

        await updateDoc(ref, updates);
        return { ok: true, status: 'REVOKED', ...updates };
    },

    /**
     * List incoming pending location share requests for an owner.
     */
    async listIncomingPendingRequests() {
        const ownerUid = requireUid();
        const q = query(
            collection(db, COLLECTIONS.locationShares),
            where('ownerUid', '==', ownerUid),
            where('status', '==', 'PENDING')
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
};
