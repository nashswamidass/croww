/**
 * Pure listing/property presentation helpers.
 * No Firestore. No fabricated defaults. Used by detail screens and unit tests.
 */

import { publicActorTrustFromUser, trustBadges as explicitTrustBadges } from '../domain/verification/index.ts';
export function toMillis(value) {
    if (!value) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function isListingExpired(listing, now = Date.now()) {
    const expires = toMillis(listing?.expiresAt);
    return expires != null && expires < now;
}

/**
 * @returns {'missing'|'published'|'expired'|'unavailable'}
 */
export function listingOfferState(listing, now = Date.now()) {
    if (!listing) return 'missing';
    if (listing.status === 'PUBLISHED' && isListingExpired(listing, now)) return 'expired';
    if (listing.status === 'PUBLISHED') return 'published';
    return 'unavailable';
}

export function listingStatusLabel(listing, now = Date.now()) {
    const state = listingOfferState(listing, now);
    if (state === 'expired') return 'This listing has expired';
    if (state === 'missing') return 'Listing not found';
    if (state === 'published') return null;
    const status = listing?.status;
    if (status === 'SOLD') return 'This listing is marked sold';
    if (status === 'RENTED') return 'This listing is marked rented';
    if (status === 'PAUSED') return 'This listing is paused';
    if (status === 'DRAFT') return 'This listing is not published';
    if (status === 'ARCHIVED') return 'This listing is archived';
    if (status === 'EXPIRED') return 'This listing has expired';
    return 'This listing is no longer active';
}

export function canContactListing({ listing, property, currentUid, now = Date.now() } = {}) {
    if (!listing) return false;
    if (listingOfferState(listing, now) !== 'published') return false;
    if (property && property.status && property.status !== 'ACTIVE') return false;
    if (property === false) return false; // explicit hidden/inactive sentinel
    const uid = currentUid || null;
    if (uid && (uid === listing.listedByUid || uid === listing.ownerUid)) return false;
    return true;
}

export function actorRoleLabel(role) {
    if (role === 'owner') return 'Listed by Owner';
    if (role === 'agent') return 'Listed by Agent';
    if (role === 'builder') return 'Listed by Builder';
    if (role === 'admin') return 'Listed by Croww';
    return null;
}

export function contactCtaLabel(role) {
    if (role === 'owner') return 'Contact owner';
    if (role === 'agent') return 'Contact agent';
    if (role === 'builder') return 'Contact builder';
    if (role === 'admin') return 'Contact Croww';
    return 'Contact lister';
}

export function splitDescriptions(listingDescription, propertyDescription) {
    const listing = typeof listingDescription === 'string' ? listingDescription.trim() : '';
    const property = typeof propertyDescription === 'string' ? propertyDescription.trim() : '';
    if (!listing && !property) return { listing: null, property: null };
    if (listing && property && listing === property) {
        return { listing, property: null };
    }
    return { listing: listing || null, property: property || null };
}

export function formatPublicLocation({
    precision,
    city,
    state,
    localityName,
    address,
    isExactShared = false,
} = {}) {
    const cityName = (city || address?.city || '').trim() || null;
    const stateName = (state || address?.state || '').trim() || null;
    const locality = (localityName || '').trim() || null;
    const isExact = isExactShared || precision === 'exact';
    const mode = isExact ? 'exact' : (precision === 'locality' ? 'locality' : 'approximate');

    const parts = [locality, cityName].filter(Boolean);
    const headline = parts.length ? parts.join(', ') : (stateName || null);

    if (!isExact) {
        return {
            precision: mode,
            headline,
            detail: mode === 'locality' ? 'Approximate area only' : 'Approximate location',
            street: null,
            pincode: null,
            showExactAddress: false,
        };
    }

    const street = (address?.line1 || '').trim() || null;
    const line2 = (address?.line2 || '').trim() || null;
    const pincode = (address?.pincode || '').trim() || null;
    const detailParts = [line2, stateName, pincode].filter(Boolean);

    return {
        precision: 'exact',
        headline,
        detail: detailParts.length ? detailParts.join(', ') : null,
        street,
        pincode,
        showExactAddress: true,
    };
}

function presentValue(value) {
    if (value == null) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    if (value === 'unknown') return null;
    return value;
}

function formatSqft(value) {
    if (value == null || !Number.isFinite(Number(value))) return null;
    return `${Math.round(Number(value)).toLocaleString('en-IN')} sq ft`;
}

function formatFurnishing(value) {
    const v = presentValue(value);
    if (!v) return null;
    if (v === 'semi') return 'Semi-furnished';
    if (v === 'fully') return 'Fully furnished';
    if (v === 'unfurnished') return 'Unfurnished';
    return null;
}

function formatPossession(value) {
    const v = presentValue(value);
    if (!v) return null;
    if (v === 'ready') return 'Ready to move';
    if (v === 'under_construction') return 'Under construction';
    return null;
}

function formatSubtypeLabel(subtype) {
    if (!presentValue(subtype)) return null;
    return subtype.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCategoryLabel(category) {
    if (!presentValue(category)) return null;
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function addFact(facts, label, value) {
    if (value == null || value === '') return;
    facts.push({ label, value: String(value) });
}

/**
 * Facts that apply to this category only. Empty values are omitted.
 */
export function buildPropertyFacts(property = {}, listing = {}) {
    const category = property.category || listing.category || null;
    const facts = [];
    const bedrooms = property.bedrooms ?? listing.bedrooms;
    const bathrooms = property.bathrooms ?? listing.bathrooms;
    const builtUp = property.builtUpAreaSqft ?? listing.builtUpAreaSqft;
    const carpet = property.carpetAreaSqft ?? null;
    const plot = property.plotAreaSqft ?? listing.plotAreaSqft;
    const subtype = formatSubtypeLabel(property.subtype || listing.subtype);
    const type = formatCategoryLabel(category);

    if (category === 'land') {
        addFact(facts, 'Type', type);
        addFact(facts, 'Land type', subtype);
        addFact(facts, 'Plot area', formatSqft(plot));
        return facts;
    }

    if (category === 'commercial') {
        addFact(facts, 'Type', type);
        addFact(facts, 'Subtype', subtype);
        addFact(facts, 'Area', formatSqft(builtUp) || formatSqft(carpet) || formatSqft(plot));
        if (property.floor != null) {
            const total = property.totalFloors;
            addFact(facts, 'Floor', total != null ? `${property.floor} of ${total}` : String(property.floor));
        }
        if (property.parking != null) {
            addFact(facts, 'Parking', property.parking === 0 ? 'None' : `${property.parking}`);
        }
        addFact(facts, 'Furnishing', formatFurnishing(property.furnishing));
        return facts;
    }

    // Residential, or unknown category with residential-like denormalized fields.
    if (bedrooms != null) {
        addFact(facts, 'BHK', bedrooms >= 5 ? '5+' : String(bedrooms));
    }
    if (bathrooms != null) addFact(facts, 'Bathrooms', String(bathrooms));
    addFact(facts, 'Carpet area', formatSqft(carpet));
    addFact(facts, 'Built-up area', formatSqft(builtUp));
    addFact(facts, 'Plot area', formatSqft(plot));
    if (property.floor != null) {
        const total = property.totalFloors;
        addFact(facts, 'Floor', total != null ? `${property.floor} of ${total}` : String(property.floor));
    } else if (property.totalFloors != null) {
        addFact(facts, 'Total floors', String(property.totalFloors));
    }
    addFact(facts, 'Furnishing', formatFurnishing(property.furnishing));
    if (property.parking != null) {
        addFact(facts, 'Parking', property.parking === 0 ? 'None' : `${property.parking}`);
    }
    addFact(facts, 'Property type', subtype || type);
    if (property.constructionYear != null) {
        addFact(facts, 'Year built', String(property.constructionYear));
    }
    addFact(facts, 'Possession', formatPossession(property.possessionStatus));
    return facts;
}

export function verificationBadges(property, listing, actorTrust) {
    return explicitTrustBadges({ property, listing, actorTrust });
}

function relativeFrom(ms, now, prefix) {
    if (ms == null) return null;
    const days = Math.floor((now - ms) / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(days)) return null;
    if (days <= 0) return `${prefix} today`;
    if (days === 1) return `${prefix} yesterday`;
    if (days < 7) return `${prefix} ${days} days ago`;
    if (days < 30) return `${prefix} ${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${prefix} ${months} month${months === 1 ? '' : 's'} ago`;
}

/**
 * Distinct timestamp lines. lastVerifiedAt is never labeled as a mere update.
 */
export function freshnessLines(listing = {}, property = {}, now = Date.now()) {
    const lines = [];
    const updated = relativeFrom(toMillis(listing.updatedAt) || toMillis(property.updatedAt), now, 'Updated');
    const published = relativeFrom(toMillis(listing.publishedAt), now, 'Listed');
    const verified = relativeFrom(
        toMillis(listing.lastVerifiedAt) || toMillis(property.lastVerifiedAt),
        now,
        'Listing reviewed'
    );
    if (updated) lines.push({ key: 'updated', text: updated });
    if (published && published !== updated) lines.push({ key: 'published', text: published });
    if (verified) lines.push({ key: 'verified', text: verified });
    return lines;
}

export function publicActorProjection(user) {
    if (!user) return null;
    const displayName = (user.name || user.displayName || '').trim() || null;
    const photoURL = user.avatar || user.profileImage || user.photoURL || null;
    return {
        uid: user.id || user.uid || null,
        displayName,
        photoURL,
        trust: publicActorTrustFromUser(user),
    };
}

export function buildListingShare({ listingId, title, city, priceText } = {}) {
    if (!listingId) return null;
    const url = `https://croww.ai/listing/${listingId}`;
    const bits = [title, priceText, city].filter(Boolean);
    const message = `${url}\n\n${bits.join(' · ')}\n\nShared via Croww`.trim();
    return { url, message, title: title || 'Croww listing' };
}

export function buildPropertyShare({ propertyId, headline } = {}) {
    if (!propertyId) return null;
    const url = `https://croww.ai/property/${propertyId}`;
    const message = headline
        ? `${url}\n\n${headline}\n\nShared via Croww`
        : `${url}\n\nShared via Croww`;
    return { url, message, title: headline || 'Croww property' };
}

export function isPublicGalleryMedia(item) {
    if (!item) return false;
    if (item.visibility !== 'public') return false;
    if (item.status !== 'ACTIVE') return false;
    if (item.mediaType === 'document' || item.mediaType === 'spatial') return false;
    return Boolean(item.url || item.thumbnailUrl);
}
