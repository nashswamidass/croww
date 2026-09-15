import { PROPERTY_CATEGORIES, PROPERTY_SUBTYPES, TRANSACTION_TYPES } from '../constants.ts';
import { isValidLatitude, isValidLongitude } from '../geo.ts';
import {
    MAX_SAVED_SEARCH_NAME_LENGTH,
    MAX_SEARCH_LABEL_LENGTH,
    SAVED_SEARCH_LOCATION_MODES,
} from './constants.ts';
import type {
    CanonicalSavedSearch,
    SavedSearchFilters,
    SavedSearchLocation,
    SavedSearchLocationMode,
    SavedViewport,
} from './types.ts';

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
    return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function clipString(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) return null;
    return trimmed.slice(0, max);
}

function cityKey(city: string | null | undefined): string | null {
    if (typeof city !== 'string') return null;
    const key = city.trim().toLowerCase();
    return key || null;
}

function finiteNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
}

function positiveInt(value: unknown): number | null {
    const n = finiteNumber(value);
    if (n == null) return null;
    const rounded = Math.round(n);
    return rounded >= 0 ? rounded : null;
}

function canonicalizeBhk(value: unknown): number | null {
    if (Array.isArray(value)) {
        const nums = value.map(canonicalizeBhk).filter((n): n is number => n != null);
        return nums.length ? nums.sort((a, b) => a - b)[0] : null;
    }
    const n = positiveInt(value);
    if (n == null || n < 1) return null;
    return Math.min(n, 5);
}

function canonicalizeViewport(input: unknown): SavedViewport | null {
    if (!input || typeof input !== 'object') return null;
    const row = input as Record<string, unknown>;
    const latitude = finiteNumber(row.latitude);
    const longitude = finiteNumber(row.longitude);
    const latitudeDelta = finiteNumber(row.latitudeDelta);
    const longitudeDelta = finiteNumber(row.longitudeDelta);
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
    if (latitudeDelta == null || longitudeDelta == null) return null;
    if (!(latitudeDelta > 0) || !(longitudeDelta > 0)) return null;
    return {
        latitude: Number(latitude.toFixed(5)),
        longitude: Number(longitude.toFixed(5)),
        latitudeDelta: Number(Math.min(latitudeDelta, 2).toFixed(5)),
        longitudeDelta: Number(Math.min(longitudeDelta, 2).toFixed(5)),
    };
}

export function canonicalizeFilters(input: unknown): SavedSearchFilters {
    const row = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const transactionType = includes(TRANSACTION_TYPES, row.transactionType) ? row.transactionType : null;
    const category = includes(PROPERTY_CATEGORIES, row.category) ? row.category : null;
    const subtype = includes(PROPERTY_SUBTYPES, row.subtype) ? row.subtype : null;
    let minPrice = positiveInt(row.minPrice);
    let maxPrice = positiveInt(row.maxPrice);
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
        const swap = minPrice;
        minPrice = maxPrice;
        maxPrice = swap;
    }
    return {
        transactionType,
        category: category || null,
        subtype: category ? subtype : null,
        bhk: canonicalizeBhk(row.bhk),
        minPrice,
        maxPrice,
    };
}

export function inferLocationMode(input: {
    localityId?: string | null;
    searchLabel?: string | null;
    mode?: unknown;
    city?: string | null;
} = {}): SavedSearchLocationMode {
    if (clipString(input.localityId, 128)) return 'LOCALITY';
    if (includes(SAVED_SEARCH_LOCATION_MODES, input.mode) && input.mode !== 'CITY') {
        return input.mode;
    }
    if (clipString(input.searchLabel, MAX_SEARCH_LABEL_LENGTH) && !clipString(input.localityId, 128)) {
        return 'VIEWPORT';
    }
    return 'CITY';
}

export function canonicalizeLocation(input: unknown): SavedSearchLocation {
    const row = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const city = clipString(row.city, 80);
    const localityId = clipString(row.localityId, 128);
    const viewport = canonicalizeViewport(row.viewport);
    const requested = includes(SAVED_SEARCH_LOCATION_MODES, row.mode) ? row.mode : null;
    const mode = localityId
        ? 'LOCALITY'
        : (requested || inferLocationMode({ localityId, searchLabel: clipString(row.searchLabel, MAX_SEARCH_LABEL_LENGTH), mode: requested, city }));
    return {
        mode,
        city,
        cityKey: cityKey(city),
        localityId: localityId,
        searchLabel: clipString(row.searchLabel, MAX_SEARCH_LABEL_LENGTH),
        viewport,
    };
}

function fnv1aHex(value: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value as object).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function criteriaHash(location: SavedSearchLocation, filters: SavedSearchFilters): string {
    return fnv1aHex(stableStringify({
        location: {
            mode: location.mode,
            cityKey: location.cityKey,
            localityId: location.localityId,
            viewport: location.mode === 'VIEWPORT' ? location.viewport : null,
        },
        filters,
    }));
}

export function generateSavedSearchName(location: SavedSearchLocation, filters: SavedSearchFilters): string {
    const parts: string[] = [];
    if (location.searchLabel) parts.push(location.searchLabel);
    else if (location.mode === 'LOCALITY' && location.localityId) parts.push('This area');
    else if (location.city) parts.push(location.city);
    if (filters.transactionType === 'rent') parts.push('Rent');
    else if (filters.transactionType === 'buy') parts.push('Buy');
    if (filters.bhk) parts.push(filters.bhk >= 5 ? '5+ BHK' : `${filters.bhk} BHK`);
    if (filters.subtype) parts.push(filters.subtype.replace(/_/g, ' '));
    else if (filters.category) parts.push(filters.category);
    if (filters.maxPrice != null) {
        const n = filters.maxPrice;
        if (n >= 10000000) parts.push(`under ₹${Math.round(n / 10000000)}Cr`);
        else if (n >= 100000) parts.push(`under ₹${Math.round(n / 100000)}L`);
        else parts.push(`under ₹${n.toLocaleString('en-IN')}`);
    } else if (filters.minPrice != null) {
        const n = filters.minPrice;
        if (n >= 10000000) parts.push(`from ₹${Math.round(n / 10000000)}Cr`);
        else if (n >= 100000) parts.push(`from ₹${Math.round(n / 100000)}L`);
        else parts.push(`from ₹${n.toLocaleString('en-IN')}`);
    }
    const label = parts.join(' · ').replace(/\s+/g, ' ').trim();
    return (label || 'Saved search').slice(0, MAX_SAVED_SEARCH_NAME_LENGTH);
}

export function canonicalizeSavedSearch(input: unknown = {}): CanonicalSavedSearch {
    const row = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const filters = canonicalizeFilters(row.filters || row);
    const location = canonicalizeLocation(row.location || row);
    const generated = generateSavedSearchName(location, filters);
    const name = clipString(row.name, MAX_SAVED_SEARCH_NAME_LENGTH) || generated;
    return {
        name,
        location,
        filters,
        criteriaHash: criteriaHash(location, filters),
        alertEnabled: row.alertEnabled === true
            || row.alertsEnabled === true
            || (typeof row.alert === 'object' && row.alert != null
                && (row.alert as { enabled?: boolean }).enabled === true),
    };
}

export function isMeaningfulSavedSearch(input: unknown): boolean {
    const canonical = canonicalizeSavedSearch(input);
    const { filters, location } = canonical;
    if (location.localityId) return true;
    if (location.mode === 'VIEWPORT' && location.viewport) return true;
    if (filters.transactionType === 'rent') return true;
    if (filters.category || filters.subtype) return true;
    if (filters.bhk != null) return true;
    if (filters.minPrice != null || filters.maxPrice != null) return true;
    if (location.searchLabel) return true;
    return false;
}

export function exploreStateToSearchInput(state: {
    city?: string | null;
    localityId?: string | null;
    searchLocation?: { label?: string | null } | null;
    viewport?: unknown;
    filters?: unknown;
    name?: string | null;
    alertEnabled?: boolean;
} = {}) {
    const localityId = state.localityId || null;
    const searchLabel = state.searchLocation?.label || null;
    const mode = inferLocationMode({ localityId, searchLabel, city: state.city });
    return {
        name: state.name || null,
        alertEnabled: state.alertEnabled === true,
        location: {
            mode,
            city: state.city || null,
            localityId,
            searchLabel,
            viewport: state.viewport || null,
        },
        filters: state.filters || {},
    };
}
