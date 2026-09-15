import { MAX_SNAPSHOT_TITLE_LENGTH } from './constants.ts';
import type { SavedListingSnapshot, SavedPropertySnapshot } from './types.ts';

function clip(value: unknown, max = MAX_SNAPSHOT_TITLE_LENGTH): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
}

function money(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return Math.round(value);
}

/**
 * Display acceleration only. The live listing/property document is authoritative.
 */
export function listingSaveSnapshot(listing: Record<string, unknown> | null | undefined, extras: {
    localityName?: string | null;
    coverThumbnailUrl?: string | null;
} = {}): SavedListingSnapshot {
    const row = listing || {};
    return {
        title: clip(row.title),
        askingPrice: money(row.askingPrice),
        rentMonthly: money(row.rentMonthly),
        coverThumbnailUrl: clip(extras.coverThumbnailUrl || row.coverThumbnailUrl || row.thumbnailUrl, 500),
        localityName: clip(extras.localityName, 80),
        city: clip(row.city, 80),
        transactionType: row.transactionType === 'rent' || row.transactionType === 'buy' ? row.transactionType : null,
        bedrooms: typeof row.bedrooms === 'number' && Number.isFinite(row.bedrooms) ? row.bedrooms : null,
        status: typeof row.status === 'string' ? row.status : null,
    };
}

export function propertySaveSnapshot(property: Record<string, unknown> | null | undefined, extras: {
    localityName?: string | null;
    coverThumbnailUrl?: string | null;
    title?: string | null;
} = {}): SavedPropertySnapshot {
    const row = property || {};
    return {
        title: clip(extras.title || row.projectName || row.title, 120),
        category: typeof row.category === 'string' ? row.category : null,
        subtype: typeof row.subtype === 'string' ? row.subtype : null,
        bedrooms: typeof row.bedrooms === 'number' && Number.isFinite(row.bedrooms) ? row.bedrooms : null,
        coverThumbnailUrl: clip(extras.coverThumbnailUrl || row.coverThumbnailUrl, 500),
        localityName: clip(extras.localityName, 80),
        city: clip(row.city, 80),
    };
}
