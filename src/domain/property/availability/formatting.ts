import type { ListingAvailability } from './types.ts';

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Returns YYYY-MM-DD string for comparison at day boundary.
 */
function getLocalDateString(dateInput: number | Date = Date.now()): string {
    const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatAvailableFromDate(isoDate: string | null | undefined): string {
    if (!isoDate || typeof isoDate !== 'string') return '';
    const clean = isoDate.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean);
    if (!match) return clean;
    const [, , monthStr, dayStr] = match;
    const day = parseInt(dayStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthName = MONTH_NAMES[monthIdx] || monthStr;
    return `${day} ${monthName}`;
}

/**
 * Returns true if availableFrom is strictly after today.
 */
export function isFutureDate(dateStr: string | null | undefined, now: number | Date = Date.now()): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const clean = dateStr.trim().slice(0, 10);
    const todayStr = getLocalDateString(now);
    return clean > todayStr;
}

/**
 * Actively available means:
 * - availableCount > 0
 * - AND availableFrom is either not set or <= today
 */
export function isActivelyAvailable(
    availability: ListingAvailability | null | undefined,
    now: number | Date = Date.now()
): boolean {
    if (!availability || typeof availability.availableCount !== 'number') return false;
    if (availability.availableCount <= 0) return false;
    if (availability.availableFrom && isFutureDate(availability.availableFrom, now)) {
        return false;
    }
    return true;
}

/**
 * Future availability means:
 * - availableCount > 0
 * - AND availableFrom is strictly in the future (> today)
 */
export function isFutureAvailable(
    availability: ListingAvailability | null | undefined,
    now: number | Date = Date.now()
): boolean {
    if (!availability || typeof availability.availableCount !== 'number') return false;
    if (availability.availableCount <= 0) return false;
    return Boolean(availability.availableFrom && isFutureDate(availability.availableFrom, now));
}

/**
 * Full state:
 * - availableCount === 0
 */
export function isFull(availability: ListingAvailability | null | undefined): boolean {
    if (!availability || typeof availability.availableCount !== 'number') return false;
    return availability.availableCount === 0;
}

/**
 * Consumer-facing concise availability label.
 * Distinguishes zero supply ("Currently full") from missing data (null).
 */
export function formatAvailabilityLabel(
    availability: ListingAvailability | null | undefined,
    now: number | Date = Date.now()
): string | null {
    if (!availability || typeof availability.availableCount !== 'number') {
        return null;
    }

    if (availability.availableCount === 0) {
        return 'Currently full';
    }

    if (isFutureAvailable(availability, now)) {
        const formattedDate = formatAvailableFromDate(availability.availableFrom);
        return formattedDate ? `Available from ${formattedDate}` : 'Future vacancy';
    }

    const count = availability.availableCount;
    if (availability.availabilityMode === 'BED') {
        return `${count} ${count === 1 ? 'bed' : 'beds'} available`;
    }

    // Default or UNIT mode
    return `${count} ${count === 1 ? 'private room' : 'rooms'} available`;
}

/**
 * Owner-facing inventory capacity ratio.
 * e.g. "2 / 20 beds available" or "1 / 8 rooms available".
 */
export function formatInventoryRatio(
    availability: ListingAvailability | null | undefined
): string | null {
    if (!availability || typeof availability.availableCount !== 'number') {
        return null;
    }

    const available = availability.availableCount;
    const total = availability.totalCapacity;
    const unitLabel = availability.availabilityMode === 'BED' ? 'beds' : 'rooms';

    if (available === 0) {
        return `0 / ${total} ${unitLabel} available (Full)`;
    }

    return `${available} / ${total} ${unitLabel} available`;
}

/**
 * Filters out full listings (where availableCount === 0) for discovery queries.
 */
export function filterAvailableListings<T extends { availability?: ListingAvailability | null; availableCount?: number | null }>(
    listings: T[],
    options: { onlyAvailable?: boolean; now?: number | Date } = {}
): T[] {
    if (!options.onlyAvailable) return listings;
    return listings.filter((item) => {
        if (item.availableCount === 0) return false;
        if (item.availability && item.availability.availableCount === 0) return false;
        return true;
    });
}
