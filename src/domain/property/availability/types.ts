import type { AVAILABILITY_CHANGE_TYPES, AVAILABILITY_MODES } from './constants.ts';

export type AvailabilityMode = (typeof AVAILABILITY_MODES)[number];

export type AvailabilityChangeType = (typeof AVAILABILITY_CHANGE_TYPES)[number];

export type ListingAvailability = {
    availabilityMode: AvailabilityMode;
    totalCapacity: number;
    occupiedCount: number;
    availableCount: number;
    availableFrom?: string | null;
    updatedAt?: unknown;
    updatedByUid?: string | null;
};

export type AvailabilityHistoryRecord = {
    id?: string;
    listingId: string;
    timestamp: unknown;
    actor: string;
    previousAvailableCount: number | null;
    newAvailableCount: number;
    previousAvailableFrom?: string | null;
    newAvailableFrom?: string | null;
    changeType: AvailabilityChangeType;
    notes?: string | null;
};

export type AvailabilityInput = {
    availabilityMode?: unknown;
    totalCapacity?: unknown;
    occupiedCount?: unknown;
    availableCount?: unknown;
    availableFrom?: unknown;
};
