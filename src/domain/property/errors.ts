export const INVENTORY_ERROR_CODES = [
    'UNAUTHENTICATED',
    'UNAUTHORIZED_ACTOR',
    'INVALID_PROPERTY',
    'INVALID_LISTING',
    'PROPERTY_NOT_FOUND',
    'LISTING_NOT_FOUND',
    'OWNERSHIP_CONFLICT',
    'ACTOR_NOT_PERMITTED',
    'PROTECTED_FIELD',
    'POTENTIAL_DUPLICATE',
    'INVALID_LOCATION',
    'INVALID_STATUS_TRANSITION',
    'MEDIA_NOT_PERMITTED',
    'PUBLICATION_FORBIDDEN',
    'TAXONOMY_POSTING_DISABLED',
] as const;

export type InventoryErrorCode = (typeof INVENTORY_ERROR_CODES)[number];

export class InventoryError extends Error {
    code: InventoryErrorCode;
    details?: unknown;

    constructor(code: InventoryErrorCode, message: string, details?: unknown) {
        super(message);
        this.name = 'InventoryError';
        this.code = code;
        this.details = details;
    }
}
