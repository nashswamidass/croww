import type { ListingTaxonomyItem } from './types.ts';

export interface TaxonomyValidationResult {
    valid: boolean;
    errors: string[];
    missingFields: string[];
}

/**
 * Validates whether a proposed listing payload complies with the active taxonomy configuration.
 * Must be checked before saving draft and before publication.
 */
export function validateTaxonomyPosting({
    typeId,
    transactionType,
    payload = {},
    taxonomyItem,
}: {
    typeId?: string | null;
    transactionType?: 'buy' | 'rent' | null;
    payload?: Record<string, unknown>;
    taxonomyItem?: ListingTaxonomyItem | null;
}): TaxonomyValidationResult {
    const errors: string[] = [];
    const missingFields: string[] = [];

    if (!typeId) {
        errors.push('Listing taxonomy typeId is required');
        return { valid: false, errors, missingFields };
    }

    if (!taxonomyItem) {
        errors.push(`Taxonomy type "${typeId}" is not recognized`);
        return { valid: false, errors, missingFields };
    }

    if (taxonomyItem.status !== 'ACTIVE') {
        errors.push(`Listing type "${taxonomyItem.displayName}" is currently inactive`);
    }

    if (!taxonomyItem.postingEnabled) {
        errors.push(`New postings for "${taxonomyItem.displayName}" are currently disabled by admin`);
    }

    if (transactionType === 'rent' && !taxonomyItem.rentEnabled) {
        errors.push(`"${taxonomyItem.displayName}" is not enabled for rent`);
    }

    if (transactionType === 'buy' && !taxonomyItem.saleEnabled) {
        errors.push(`"${taxonomyItem.displayName}" is not enabled for sale`);
    }

    // Validate Required Fields
    const required = taxonomyItem.requiredFields || [];
    for (const field of required) {
        let val = payload[field];
        if (val === undefined && field === 'monthlyRent') {
            val = payload.rentMonthly;
        } else if (val === undefined && field === 'rentMonthly') {
            val = payload.monthlyRent;
        } else if (val === undefined && field === 'deposit') {
            val = payload.securityDeposit;
        } else if (val === undefined && field === 'securityDeposit') {
            val = payload.deposit;
        }
        if (val === undefined || val === null || val === '') {
            missingFields.push(field);
            errors.push(`Required field "${field}" is missing for ${taxonomyItem.displayName}`);
        } else if (typeof val === 'number' && Number.isNaN(val)) {
            missingFields.push(field);
            errors.push(`Field "${field}" must be a valid number`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        missingFields,
    };
}
