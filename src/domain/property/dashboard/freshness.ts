import {
    DASHBOARD_EXPIRES_SOON_MS,
    DASHBOARD_STALE_UPDATE_MS,
} from './constants.ts';

export type AttentionWarning = {
    key: string;
    label: string;
};

function toMillis(value: unknown): number | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof value === 'object' && value && typeof (value as { seconds?: number }).seconds === 'number') {
        return (value as { seconds: number }).seconds * 1000;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 1e12 ? value : value * 1000;
    }
    const parsed = new Date(value as string);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/**
 * Attention flags from real timestamps only.
 * updatedAt is never treated as lastVerifiedAt.
 */
export function dashboardAttention(
    listing: Record<string, unknown> | null | undefined,
    now = Date.now()
): AttentionWarning[] {
    if (!listing) return [];
    const warnings: AttentionWarning[] = [];
    const status = listing.status;
    const updatedAt = toMillis(listing.updatedAt);
    const expiresAt = toMillis(listing.expiresAt);
    const lastVerifiedAt = toMillis(listing.lastVerifiedAt);

    if (status === 'EXPIRED') {
        warnings.push({ key: 'expired', label: 'Listing expired' });
    } else if (expiresAt != null && expiresAt < now) {
        warnings.push({ key: 'expired', label: 'Listing expired' });
    } else if (expiresAt != null && expiresAt - now <= DASHBOARD_EXPIRES_SOON_MS && expiresAt >= now) {
        warnings.push({ key: 'expires_soon', label: 'Expires soon' });
    }

    if (
        (status === 'PUBLISHED' || status === 'PAUSED')
        && updatedAt != null
        && now - updatedAt >= DASHBOARD_STALE_UPDATE_MS
    ) {
        warnings.push({ key: 'needs_update', label: 'Needs update' });
    }

    if (
        (status === 'PUBLISHED' || status === 'PAUSED')
        && lastVerifiedAt != null
        && now - lastVerifiedAt >= DASHBOARD_STALE_UPDATE_MS
    ) {
        warnings.push({ key: 'needs_verification', label: 'Needs verification' });
    }

    return warnings;
}

export function dashboardTimestampMillis(value: unknown): number | null {
    return toMillis(value);
}
