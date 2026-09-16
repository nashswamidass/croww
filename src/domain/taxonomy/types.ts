/**
 * Canonical taxonomy contracts for server-driven listing types.
 */

export type ParentCategory = 'stay' | 'residential' | 'commercial' | 'land';

export interface TaxonomyFieldDefinition {
    key: string;
    label: string;
    type: 'number' | 'text' | 'select' | 'boolean' | 'date';
    options?: string[];
    unit?: string;
}

export interface ListingTaxonomyItem {
    id: string; // Machine ID e.g. 'stay_bed', 'stay_pg', 'res_1bhk'
    typeId: string; // Machine ID alias
    parentCategory: ParentCategory;
    parentCategoryLabel: string; // e.g. "Stay", "Residential", "Commercial"
    section?: 'rent' | 'sale' | 'both';
    displayName: string; // e.g. "PG / Paying Guest"
    shortDescription?: string;
    icon?: string; // Ionicons / Material icon identifier
    image?: string;
    status: 'ACTIVE' | 'INACTIVE'; // Master availability
    displayOrder: number;

    // Decoupled Enablement States
    consumerEnabled: boolean; // Rendered on Explore & Category Pills
    postingEnabled: boolean;  // Allowed in Post Wizard & accepted by backend creation
    searchEnabled: boolean;   // Searchable and filterable for existing listings
    filterEnabled: boolean;   // Rendered in Filter Sheets & Modals

    rentEnabled: boolean;     // Allowed for rent transactions
    saleEnabled: boolean;     // Allowed for sale transactions

    // Dynamic Form Configuration
    requiredFields: string[]; // e.g. ["monthlyRent", "deposit", "occupancy", "availableFrom"]
    optionalFields: string[]; // e.g. ["foodIncluded", "furnishing", "genderPreference"]

    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string;
}

export interface ListingTaxonomyAuditLog {
    id: string;
    typeId: string;
    adminUid: string;
    adminEmail?: string;
    timestamp: string;
    action: 'CREATE' | 'UPDATE' | 'ENABLE' | 'DISABLE';
    previousValue: Partial<ListingTaxonomyItem>;
    newValue: Partial<ListingTaxonomyItem>;
    changedFields: string[];
}
