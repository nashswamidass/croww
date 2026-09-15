function trimDecimals(value, maxDecimals) {
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return value.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

/** Indian compact currency. Returns null when there is no numeric amount. */
export function formatInrCompact(amount) {
    if (amount == null || amount === '') return null;
    const value = Number(amount);
    if (!Number.isFinite(value)) return null;
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs >= 10000000) {
        return `${sign}₹${trimDecimals(abs / 10000000, 2)} Cr`;
    }
    if (abs >= 100000) {
        return `${sign}₹${trimDecimals(abs / 100000, 2)} L`;
    }
    return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

export function formatOfferPrice(listing) {
    if (!listing) {
        return { primary: 'Price on request', secondary: [], negotiable: false, amount: null };
    }
    if (listing.transactionType === 'rent') {
        const amount = listing.rentMonthly;
        const rent = formatInrCompact(amount);
        const secondary = [];
        const deposit = formatInrCompact(listing.deposit);
        const maintenance = formatInrCompact(listing.maintenanceMonthly);
        if (deposit) secondary.push(`Deposit ${deposit}`);
        if (maintenance) secondary.push(`Maintenance ${maintenance} / month`);
        return {
            primary: rent ? `${rent} / month` : 'Price on request',
            secondary,
            negotiable: listing.negotiable === true && !!rent,
            amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
        };
    }
    const amount = listing.askingPrice ?? listing.price;
    const price = formatInrCompact(amount);
    return {
        primary: price || 'Price on request',
        secondary: [],
        negotiable: listing.negotiable === true && !!price,
        amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    };
}

export function formatListingPrice(item) {
    const amount = item?.price;
    if (amount == null || !Number.isFinite(Number(amount))) return 'Price on request';
    const value = Number(amount);
    const suffix = item.transactionType === 'rent' ? '/mo' : '';
    if (item.transactionType === 'rent') {
        const compact = formatInrCompact(value);
        if (!compact) return 'Price on request';
        if (value >= 100000) return `${compact.replace(' ', '')}${suffix}`;
        if (value >= 1000) return `₹${Math.round(value / 1000)}k${suffix}`;
        return `${compact}${suffix}`;
    }
    return formatInrCompact(value) || 'Price on request';
}

export function formatBhk(bedrooms) {
    if (bedrooms == null) return null;
    if (bedrooms >= 5) return '5+ BHK';
    return `${bedrooms} BHK`;
}

export function formatArea(item) {
    const sqft = item?.builtUpAreaSqft || item?.plotAreaSqft;
    if (!sqft) return null;
    return `${Math.round(sqft).toLocaleString('en-IN')} sq ft`;
}

export function formatSubtype(subtype) {
    if (!subtype) return null;
    return subtype.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatFreshness(item) {
    if (item?.lastVerifiedAt) {
        const verified = toDate(item.lastVerifiedAt);
        if (verified) {
            const days = daysSince(verified);
            if (days != null && days <= 14) return 'Listing reviewed recently';
        }
    }
    const stamp = toDate(item?.updatedAt) || toDate(item?.publishedAt);
    if (!stamp) return null;
    const days = daysSince(stamp);
    if (days == null) return null;
    if (days <= 0) return 'Updated today';
    if (days === 1) return 'Updated yesterday';
    if (days < 7) return `Updated ${days} days ago`;
    if (days < 30) return `Updated ${Math.floor(days / 7)} w ago`;
    return `Updated ${Math.floor(days / 30)} mo ago`;
}

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysSince(date) {
    const ms = Date.now() - date.getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
}
