import { AVAILABILITY_MODES } from './constants.ts';
import type { AvailabilityInput, AvailabilityMode, ListingAvailability } from './types.ts';
import type { ValidationIssue } from '../validate.ts';

function isIntegerNonNegative(val: unknown): val is number {
    return typeof val === 'number' && Number.isInteger(val) && val >= 0;
}

function isValidIsoDateString(val: unknown): boolean {
    if (typeof val !== 'string' || !val.trim()) return false;
    const trimmed = val.trim();
    // Strictly require YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return false;
    }
    const [yearStr, monthStr, dayStr] = trimmed.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validateAvailabilityInput(input: AvailabilityInput | null | undefined): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!input || typeof input !== 'object') {
        issues.push({ field: 'availability', message: 'Availability data is required' });
        return issues;
    }

    const { availabilityMode, totalCapacity, occupiedCount, availableCount, availableFrom } = input;

    if (!availabilityMode || !AVAILABILITY_MODES.includes(availabilityMode as AvailabilityMode)) {
        issues.push({
            field: 'availability.availabilityMode',
            message: `Availability mode must be one of: ${AVAILABILITY_MODES.join(', ')}`,
        });
    }

    if (!isIntegerNonNegative(totalCapacity)) {
        issues.push({
            field: 'availability.totalCapacity',
            message: 'Total capacity must be a non-negative integer',
        });
    }

    if (!isIntegerNonNegative(occupiedCount)) {
        issues.push({
            field: 'availability.occupiedCount',
            message: 'Occupied count must be a non-negative integer',
        });
    }

    if (!isIntegerNonNegative(availableCount)) {
        issues.push({
            field: 'availability.availableCount',
            message: 'Available count must be a non-negative integer',
        });
    }

    // Capacity bounds check if all numbers are valid non-negative integers
    if (
        isIntegerNonNegative(totalCapacity) &&
        isIntegerNonNegative(occupiedCount) &&
        isIntegerNonNegative(availableCount)
    ) {
        if (occupiedCount > totalCapacity) {
            issues.push({
                field: 'availability.occupiedCount',
                message: 'Occupied count cannot exceed total capacity',
            });
        }
        if (availableCount > totalCapacity) {
            issues.push({
                field: 'availability.availableCount',
                message: 'Available count cannot exceed total capacity',
            });
        }
        if (occupiedCount + availableCount > totalCapacity) {
            issues.push({
                field: 'availability.capacity',
                message: 'Sum of occupied count and available count cannot exceed total capacity',
            });
        }
    }

    if (availableFrom != null && availableFrom !== '') {
        if (!isValidIsoDateString(availableFrom)) {
            issues.push({
                field: 'availability.availableFrom',
                message: 'Available from date must be a valid date string (YYYY-MM-DD)',
            });
        }
    }

    return issues;
}

/**
 * Calculates updated counts when adding vacancy.
 * Maintains occupiedCount + availableCount <= totalCapacity invariant.
 */
export function calculateAddVacancy(
    current: ListingAvailability,
    unitsToAdd: number,
    availableFrom?: string | null
): ListingAvailability {
    if (!Number.isInteger(unitsToAdd) || unitsToAdd < 0) {
        throw new Error('Units to add must be a non-negative integer');
    }
    const newAvailable = current.availableCount + unitsToAdd;
    if (newAvailable > current.totalCapacity) {
        throw new Error(`Cannot add ${unitsToAdd} vacancies: would exceed total capacity of ${current.totalCapacity}`);
    }
    // Tenant left: occupied decreases to maintain consistency
    const newOccupied = Math.max(0, Math.min(current.occupiedCount, current.totalCapacity - newAvailable));

    return {
        ...current,
        availableCount: newAvailable,
        occupiedCount: newOccupied,
        availableFrom: availableFrom !== undefined ? availableFrom : current.availableFrom || null,
    };
}

/**
 * Calculates updated counts when reducing vacancy (tenant moved in).
 */
export function calculateReduceVacancy(
    current: ListingAvailability,
    unitsToReduce: number = 1
): ListingAvailability {
    if (!Number.isInteger(unitsToReduce) || unitsToReduce < 0) {
        throw new Error('Units to reduce must be a non-negative integer');
    }
    if (unitsToReduce > current.availableCount) {
        throw new Error(`Cannot reduce ${unitsToReduce} vacancies: only ${current.availableCount} available`);
    }
    const newAvailable = current.availableCount - unitsToReduce;
    const newOccupied = Math.min(current.totalCapacity, current.occupiedCount + unitsToReduce);

    return {
        ...current,
        availableCount: newAvailable,
        occupiedCount: newOccupied,
    };
}

/**
 * Marks listing as having zero vacancy (FULL state).
 * Preserves recorded occupiedCount rather than fabricating 100% headcount
 * if units are offline, on hold, or undergoing renovation.
 */
export function calculateMarkFull(
    current: ListingAvailability,
    options: { occupiedCount?: number } = {}
): ListingAvailability {
    const occupied = options.occupiedCount !== undefined && Number.isInteger(options.occupiedCount) && options.occupiedCount >= 0
        ? Math.min(options.occupiedCount, current.totalCapacity)
        : Math.min(current.occupiedCount, current.totalCapacity);

    return {
        ...current,
        availableCount: 0,
        occupiedCount: occupied,
        availableFrom: null,
    };
}

/**
 * Reopens listing with specified vacancy and optional availableFrom date.
 */
export function calculateReopen(
    current: ListingAvailability,
    availableCount: number,
    availableFrom?: string | null
): ListingAvailability {
    if (!Number.isInteger(availableCount) || availableCount <= 0) {
        throw new Error('Available count must be greater than 0 to reopen');
    }
    if (availableCount > current.totalCapacity) {
        throw new Error(`Available count cannot exceed total capacity of ${current.totalCapacity}`);
    }
    const occupiedCount = Math.max(0, current.totalCapacity - availableCount);

    return {
        ...current,
        availableCount,
        occupiedCount,
        availableFrom: availableFrom ?? null,
    };
}
