import { propertyFieldVisibility } from '../posting.ts';

export type CompletenessItem = {
    key: string;
    label: string;
    ok: boolean;
};

export type CompletenessResult = {
    items: CompletenessItem[];
    missing: CompletenessItem[];
    completeCount: number;
    total: number;
    /** Completeness is not verification. */
    isComplete: boolean;
};

function hasText(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasPositiveNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function hasPublicPin(row: { latitude?: unknown; longitude?: unknown } | null | undefined): boolean {
    return typeof row?.latitude === 'number'
        && typeof row?.longitude === 'number'
        && Number.isFinite(row.latitude)
        && Number.isFinite(row.longitude);
}

/**
 * Lightweight listing quality checklist from actual fields.
 * This is not verification and must never be labeled as verified.
 */
export function listingCompleteness(
    listing: Record<string, unknown> | null | undefined,
    property: Record<string, unknown> | null | undefined = null,
    { mediaCount = 0 }: { mediaCount?: number } = {}
): CompletenessResult {
    const category = (property?.category || listing?.category) as string | null;
    const subtype = (property?.subtype || listing?.subtype) as string | null;
    const visibility = propertyFieldVisibility(category, subtype);

    const photosOk = (typeof mediaCount === 'number' && mediaCount > 0)
        || hasText(listing?.coverThumbnailUrl);
    const locationOk = hasText(listing?.localityId || property?.localityId)
        && hasText(listing?.city || property?.city)
        && (hasPublicPin(listing) || hasPublicPin(property));
    const priceOk = listing?.transactionType === 'rent'
        ? hasPositiveNumber(listing?.rentMonthly)
        : hasPositiveNumber(listing?.askingPrice);
    const descriptionOk = hasText(listing?.description);
    const titleOk = hasText(listing?.title);

    let factsOk = titleOk;
    if (visibility.bedrooms) {
        factsOk = factsOk && typeof (property?.bedrooms ?? listing?.bedrooms) === 'number';
    }
    if (visibility.plotArea) {
        factsOk = factsOk && hasPositiveNumber(property?.plotAreaSqft ?? listing?.plotAreaSqft);
    }

    const items: CompletenessItem[] = [
        { key: 'photos', label: 'Photos', ok: photosOk },
        { key: 'location', label: 'Location', ok: locationOk },
        { key: 'price', label: 'Price', ok: priceOk },
        { key: 'description', label: 'Description', ok: descriptionOk },
        { key: 'facts', label: 'Key facts', ok: factsOk },
    ];
    const missing = items.filter((item) => !item.ok);
    return {
        items,
        missing,
        completeCount: items.filter((item) => item.ok).length,
        total: items.length,
        isComplete: missing.length === 0,
    };
}

export function completenessWarnings(result: CompletenessResult): string[] {
    const labels: Record<string, string> = {
        photos: 'Missing cover',
        location: 'Location incomplete',
        price: 'Missing price',
        description: 'Missing description',
        facts: 'Missing required property facts',
    };
    return result.missing.map((item) => labels[item.key] || item.label);
}
