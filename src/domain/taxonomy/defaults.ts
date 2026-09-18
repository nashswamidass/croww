import type { ListingTaxonomyItem } from './types.ts';

/**
 * Bundled safe defaults for known current and future taxonomy.
 * Enables zero-downtime offline fallback and deterministic initial seeding.
 */
const RAW_DEFAULT_ITEMS: Omit<ListingTaxonomyItem, 'typeId'>[] = [
    // ─── 1. Stay Categories (Active & postingEnabled by default) ─────────────
    {
        id: 'stay_bed',
        parentCategory: 'stay',
        parentCategoryLabel: 'Stay',
        section: 'rent',
        displayName: 'Bed',
        shortDescription: 'Single bed space in a shared room or hostel',
        icon: 'bed-outline',
        status: 'ACTIVE',
        displayOrder: 1,
        consumerEnabled: true,
        postingEnabled: true,
        searchEnabled: true,
        filterEnabled: true,
        rentEnabled: true,
        saleEnabled: false,
        requiredFields: ['monthlyRent', 'deposit', 'occupancy', 'availableFrom'],
        optionalFields: ['foodIncluded', 'furnishing', 'attachedBathroom', 'genderPreference', 'amenities'],
    },
    {
        id: 'stay_shared_room',
        parentCategory: 'stay',
        parentCategoryLabel: 'Stay',
        section: 'rent',
        displayName: 'Shared Room',
        shortDescription: 'Shared bedroom with 1 or 2 roommates',
        icon: 'people-outline',
        status: 'ACTIVE',
        displayOrder: 2,
        consumerEnabled: true,
        postingEnabled: true,
        searchEnabled: true,
        filterEnabled: true,
        rentEnabled: true,
        saleEnabled: false,
        requiredFields: ['monthlyRent', 'deposit', 'occupancy', 'availableFrom'],
        optionalFields: ['foodIncluded', 'furnishing', 'attachedBathroom', 'genderPreference', 'amenities'],
    },
    {
        id: 'stay_private_room',
        parentCategory: 'stay',
        parentCategoryLabel: 'Stay',
        section: 'rent',
        displayName: 'Private Room',
        shortDescription: 'Independent private bedroom in an apartment or house',
        icon: 'key-outline',
        status: 'ACTIVE',
        displayOrder: 3,
        consumerEnabled: true,
        postingEnabled: true,
        searchEnabled: true,
        filterEnabled: true,
        rentEnabled: true,
        saleEnabled: false,
        requiredFields: ['monthlyRent', 'deposit', 'availableFrom'],
        optionalFields: ['furnishing', 'attachedBathroom', 'foodIncluded', 'genderPreference', 'amenities'],
    },
    {
        id: 'stay_pg',
        parentCategory: 'stay',
        parentCategoryLabel: 'Stay',
        section: 'rent',
        displayName: 'PG',
        shortDescription: 'Paying guest accommodation with food & housekeeping',
        icon: 'business-outline',
        status: 'ACTIVE',
        displayOrder: 4,
        consumerEnabled: true,
        postingEnabled: true,
        searchEnabled: true,
        filterEnabled: true,
        rentEnabled: true,
        saleEnabled: false,
        requiredFields: ['monthlyRent', 'deposit', 'occupancy', 'availableFrom'],
        optionalFields: ['foodIncluded', 'furnishing', 'attachedBathroom', 'genderPreference', 'amenities'],
    },
    {
        id: 'stay_coliving',
        parentCategory: 'stay',
        parentCategoryLabel: 'Stay',
        section: 'rent',
        displayName: 'Co-living',
        shortDescription: 'Fully managed community living with modern amenities',
        icon: 'people-circle-outline',
        status: 'ACTIVE',
        displayOrder: 5,
        consumerEnabled: true,
        postingEnabled: true,
        searchEnabled: true,
        filterEnabled: true,
        rentEnabled: true,
        saleEnabled: false,
        requiredFields: ['monthlyRent', 'deposit', 'availableFrom'],
        optionalFields: ['foodIncluded', 'furnishing', 'attachedBathroom', 'amenities'],
    },
    {
        id: 'stay_roommate_replacement',
        parentCategory: 'stay',
        parentCategoryLabel: 'Stay',
        section: 'rent',
        displayName: 'Roommate Replacement',
        shortDescription: 'Take over an existing tenancy or room in a shared flat',
        icon: 'person-add-outline',
        status: 'ACTIVE',
        displayOrder: 6,
        consumerEnabled: true,
        postingEnabled: true,
        searchEnabled: true,
        filterEnabled: true,
        rentEnabled: true,
        saleEnabled: false,
        requiredFields: ['monthlyRent', 'deposit', 'availableFrom'],
        optionalFields: ['furnishing', 'genderPreference', 'occupancy', 'amenities'],
    },

    // ─── 2. Future Residential Categories (Prepared, Inactive by default) ────
    {
        id: 'res_1bhk',
        parentCategory: 'residential',
        parentCategoryLabel: 'Residential',
        section: 'rent',
        displayName: '1 BHK',
        shortDescription: '1 Bedroom Hall Kitchen Apartment or House',
        icon: 'home-outline',
        status: 'INACTIVE',
        displayOrder: 7,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'bedrooms', 'bathrooms', 'availableFrom'],
        optionalFields: ['carpetArea', 'builtUpArea', 'furnishing', 'parking', 'floor', 'amenities'],
    },
    {
        id: 'res_2bhk',
        parentCategory: 'residential',
        parentCategoryLabel: 'Residential',
        section: 'rent',
        displayName: '2 BHK',
        shortDescription: '2 Bedroom Hall Kitchen Apartment or House',
        icon: 'home-outline',
        status: 'INACTIVE',
        displayOrder: 8,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'bedrooms', 'bathrooms', 'availableFrom'],
        optionalFields: ['carpetArea', 'builtUpArea', 'furnishing', 'parking', 'floor', 'amenities'],
    },
    {
        id: 'res_3bhk',
        parentCategory: 'residential',
        parentCategoryLabel: 'Residential',
        section: 'rent',
        displayName: '3 BHK',
        shortDescription: '3 Bedroom Hall Kitchen Apartment or House',
        icon: 'home-outline',
        status: 'INACTIVE',
        displayOrder: 9,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'bedrooms', 'bathrooms', 'availableFrom'],
        optionalFields: ['carpetArea', 'builtUpArea', 'furnishing', 'parking', 'floor', 'amenities'],
    },
    {
        id: 'res_4bhk',
        parentCategory: 'residential',
        parentCategoryLabel: 'Residential',
        section: 'rent',
        displayName: '4+ BHK',
        shortDescription: '4 or more Bedroom Home',
        icon: 'home-outline',
        status: 'INACTIVE',
        displayOrder: 10,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'bedrooms', 'bathrooms', 'availableFrom'],
        optionalFields: ['carpetArea', 'builtUpArea', 'furnishing', 'parking', 'floor', 'amenities'],
    },
    {
        id: 'res_villa',
        parentCategory: 'residential',
        parentCategoryLabel: 'Residential',
        section: 'both',
        displayName: 'Villa',
        shortDescription: 'Independent luxury villa or gated community house',
        icon: 'cube-outline',
        status: 'INACTIVE',
        displayOrder: 11,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'bedrooms', 'bathrooms', 'builtUpArea', 'availableFrom'],
        optionalFields: ['plotArea', 'furnishing', 'parking', 'amenities'],
    },
    {
        id: 'res_independent_house',
        parentCategory: 'residential',
        parentCategoryLabel: 'Residential',
        section: 'both',
        displayName: 'Independent House',
        shortDescription: 'Standalone residential building',
        icon: 'home-outline',
        status: 'INACTIVE',
        displayOrder: 12,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'bedrooms', 'bathrooms', 'availableFrom'],
        optionalFields: ['builtUpArea', 'plotArea', 'furnishing', 'parking', 'amenities'],
    },
    {
        id: 'sale_apartment',
        parentCategory: 'residential',
        parentCategoryLabel: 'Residential',
        section: 'both',
        displayName: 'Apartment',
        shortDescription: 'Multi-storey residential flat or condo',
        icon: 'business-outline',
        status: 'INACTIVE',
        displayOrder: 13,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['askingPrice', 'bedrooms', 'bathrooms', 'builtUpArea', 'availableFrom'],
        optionalFields: ['carpetArea', 'floor', 'totalFloors', 'furnishing', 'parking', 'amenities'],
    },
    {
        id: 'sale_plot',
        parentCategory: 'land',
        parentCategoryLabel: 'Land',
        section: 'sale',
        displayName: 'Plot / Land',
        shortDescription: 'Residential or commercial layout plot',
        icon: 'map-outline',
        status: 'INACTIVE',
        displayOrder: 14,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: false,
        saleEnabled: true,
        requiredFields: ['askingPrice', 'plotArea'],
        optionalFields: ['amenities'],
    },

    // ─── 3. Future Commercial Categories (Inactive by default) ────────────────
    {
        id: 'commercial_office',
        parentCategory: 'commercial',
        parentCategoryLabel: 'Commercial',
        section: 'both',
        displayName: 'Office',
        shortDescription: 'Commercial office workspace',
        icon: 'briefcase-outline',
        status: 'INACTIVE',
        displayOrder: 15,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'builtUpArea', 'floor', 'availableFrom'],
        optionalFields: ['carpetArea', 'furnishing', 'parking', 'amenities'],
    },
    {
        id: 'commercial_shop',
        parentCategory: 'commercial',
        parentCategoryLabel: 'Commercial',
        section: 'both',
        displayName: 'Shop / Retail',
        shortDescription: 'Retail shop or showroom space',
        icon: 'storefront-outline',
        status: 'INACTIVE',
        displayOrder: 16,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'builtUpArea', 'availableFrom'],
        optionalFields: ['carpetArea', 'floor', 'amenities'],
    },
    {
        id: 'commercial_space',
        parentCategory: 'commercial',
        parentCategoryLabel: 'Commercial',
        section: 'both',
        displayName: 'Commercial Space',
        shortDescription: 'General commercial space or building',
        icon: 'business-outline',
        status: 'INACTIVE',
        displayOrder: 17,
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: true,
        filterEnabled: false,
        rentEnabled: true,
        saleEnabled: true,
        requiredFields: ['monthlyRent', 'builtUpArea', 'availableFrom'],
        optionalFields: ['carpetArea', 'floor', 'amenities'],
    },
];

export const DEFAULT_TAXONOMY_ITEMS: ListingTaxonomyItem[] = RAW_DEFAULT_ITEMS.map((item) => ({
    ...item,
    typeId: item.id,
}));

/**
 * Mapping legacy category + subtype to canonical taxonomy machine ID.
 */
export function mapLegacyToTaxonomy(category?: string | null, subtype?: string | null, bedrooms?: number | null): string {
    if (!category && !subtype) return 'stay_pg';
    const sub = (subtype || '').toLowerCase().trim();
    const cat = (category || '').toLowerCase().trim();

    if (sub === 'bed') return 'stay_bed';
    if (sub === 'shared_room') return 'stay_shared_room';
    if (sub === 'private_room') return 'stay_private_room';
    if (sub === 'pg' || sub === 'paying_guest') return 'stay_pg';
    if (sub === 'coliving') return 'stay_coliving';
    if (sub === 'roommate_replacement') return 'stay_roommate_replacement';

    if (sub === 'villa') return 'res_villa';
    if (sub === 'independent_house' || sub === 'house') return 'res_independent_house';
    if (sub === 'plot' || cat === 'land' || sub === 'residential_plot' || sub === 'commercial_plot') return 'sale_plot';
    if (sub === 'office') return 'commercial_office';
    if (sub === 'shop') return 'commercial_shop';
    if (cat === 'commercial') return 'commercial_space';

    if (bedrooms === 1) return 'res_1bhk';
    if (bedrooms === 2) return 'res_2bhk';
    if (bedrooms === 3) return 'res_3bhk';
    if (bedrooms && bedrooms >= 4) return 'res_4bhk';

    if (sub === 'apartment') return 'sale_apartment';

    return 'stay_pg';
}

/**
 * Mapping canonical taxonomy machine ID to legacy category & subtype for backwards compatibility.
 */
export function mapTaxonomyToLegacy(typeOrItem: string | ListingTaxonomyItem): { category: string; subtype: string; defaultBedrooms?: number } {
    const rawId = typeof typeOrItem === 'object' && typeOrItem !== null
        ? (typeOrItem.id || (typeOrItem as any).typeId)
        : typeOrItem;
    const typeId = String(rawId || '');

    switch (typeId) {
        case 'bed':
        case 'stay_bed':
            return { category: 'residential', subtype: 'bed', defaultBedrooms: 1 };
        case 'shared_room':
        case 'stay_shared_room':
            return { category: 'residential', subtype: 'shared_room', defaultBedrooms: 1 };
        case 'private_room':
        case 'stay_private_room':
            return { category: 'residential', subtype: 'private_room', defaultBedrooms: 1 };
        case 'pg':
        case 'stay_pg':
            return { category: 'residential', subtype: 'pg', defaultBedrooms: 1 };
        case 'coliving':
        case 'stay_coliving':
            return { category: 'residential', subtype: 'coliving', defaultBedrooms: 1 };
        case 'roommate_replacement':
        case 'stay_roommate_replacement':
            return { category: 'residential', subtype: 'roommate_replacement', defaultBedrooms: 1 };
        case '1bhk':
        case 'res_1bhk':
            return { category: 'residential', subtype: 'apartment', defaultBedrooms: 1 };
        case '2bhk':
        case 'res_2bhk':
            return { category: 'residential', subtype: 'apartment', defaultBedrooms: 2 };
        case '3bhk':
        case 'res_3bhk':
            return { category: 'residential', subtype: 'apartment', defaultBedrooms: 3 };
        case '4bhk':
        case 'res_4bhk':
            return { category: 'residential', subtype: 'apartment', defaultBedrooms: 4 };
        case 'villa':
        case 'res_villa':
            return { category: 'residential', subtype: 'villa' };
        case 'independent_house':
        case 'res_independent_house':
            return { category: 'residential', subtype: 'independent_house' };
        case 'apartment':
        case 'sale_apartment':
        case 'res_apartment':
            return { category: 'residential', subtype: 'apartment' };
        case 'plot':
        case 'sale_plot':
        case 'land_plot':
            return { category: 'land', subtype: 'plot' };
        case 'office':
        case 'commercial_office':
        case 'com_office':
            return { category: 'commercial', subtype: 'office' };
        case 'shop':
        case 'commercial_shop':
        case 'com_shop':
            return { category: 'commercial', subtype: 'shop' };
        case 'commercial_space':
        case 'com_space':
            return { category: 'commercial', subtype: 'commercial_space' };
        case 'warehouse':
        case 'commercial_warehouse':
            return { category: 'commercial', subtype: 'warehouse' };
        default:
            return { category: 'residential', subtype: 'apartment' };
    }
}
