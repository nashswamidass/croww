import { SAVED_SEARCH_ALERT_EVENT, SAVED_SEARCH_NOTIFICATION_TYPE } from './constants.ts';
import { listingMarketAmount } from './match.ts';
import type { AlertNotificationPayload, CanonicalSavedSearch, PublicListingForMatch } from './types.ts';

const PRIVATE_ALERT_KEYS = [
    'latitude',
    'longitude',
    'geohash',
    'geo',
    'address',
    'street',
    'pincode',
    'listedByUid',
    'ownerUid',
    'phone',
    'email',
    'private_geo',
];

function compactInr(amount: number | null): string | null {
    if (amount == null || !Number.isFinite(amount)) return null;
    const abs = Math.abs(amount);
    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(abs >= 100000000 ? 0 : 1).replace(/\.0$/, '')}Cr`;
    if (abs >= 100000) return `₹${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1).replace(/\.0$/, '')}L`;
    return `₹${Math.round(abs).toLocaleString('en-IN')}`;
}

export function alertPriceLine(listing: PublicListingForMatch): string | null {
    const amount = listingMarketAmount(listing);
    const compact = compactInr(amount);
    if (!compact) return null;
    if (listing.transactionType === 'rent') return `${compact}/month`;
    return compact;
}

export function alertFactsLine(listing: PublicListingForMatch): string | null {
    const parts: string[] = [];
    if (typeof listing.bedrooms === 'number' && listing.bedrooms > 0) {
        parts.push(listing.bedrooms >= 5 ? '5+ BHK' : `${listing.bedrooms} BHK`);
    }
    if (typeof listing.builtUpAreaSqft === 'number' && listing.builtUpAreaSqft > 0) {
        parts.push(`${Math.round(listing.builtUpAreaSqft).toLocaleString('en-IN')} sq ft`);
    }
    return parts.length ? parts.join(' · ') : null;
}

export function buildSavedSearchAlertCopy(listing: PublicListingForMatch, search: CanonicalSavedSearch): {
    title: string;
    message: string;
} {
    const name = search.name || 'saved';
    const title = `New property matching your ${name} search`;
    const lines = [alertPriceLine(listing), alertFactsLine(listing)].filter(Boolean);
    return {
        title: title.slice(0, 120),
        message: (lines.join('\n') || 'A new published listing matches this search.').slice(0, 240),
    };
}

export function buildSavedSearchAlertData(listingId: string, savedSearchId: string): AlertNotificationPayload {
    return {
        type: SAVED_SEARCH_NOTIFICATION_TYPE,
        listingId,
        savedSearchId,
        eventType: SAVED_SEARCH_ALERT_EVENT,
    };
}

export function assertPublicAlertPayload(data: Record<string, unknown>): string[] {
    return PRIVATE_ALERT_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(data, key));
}
