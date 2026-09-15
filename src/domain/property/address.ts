/**
 * Address comparison helpers. Never "correct" or replace user-entered address.
 */

export type AddressLike = {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
};

export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

export function normalizeAddress(address: AddressLike | null | undefined): string {
    if (!address) return '';
    const parts = [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.pincode,
        address.country,
    ]
        .map((part) => (typeof part === 'string' ? part : ''))
        .join(' ');
    return normalizeWhitespace(parts)
        .toLowerCase()
        .replace(/[.,/#()[\]{}'"-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeProjectName(name: string | null | undefined): string {
    if (!name || typeof name !== 'string') return '';
    return normalizeWhitespace(name)
        .toLowerCase()
        .replace(/[.,/#()[\]{}'"-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function publicAddressFromInput(
    address: AddressLike,
    precision: string | null | undefined
): AddressLike {
    const exact = precision === 'exact' || precision == null || precision === '';
    return {
        line1: exact ? (address.line1 || '').trim() || null : null,
        line2: address.line2 ? String(address.line2).trim() || null : null,
        city: (address.city || '').trim(),
        state: (address.state || '').trim(),
        pincode: exact ? (address.pincode ? String(address.pincode).trim() : null) : null,
        country: (address.country || 'IN').trim(),
    };
}
