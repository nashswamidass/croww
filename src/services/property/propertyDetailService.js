import { toPublicMapCoordinate } from '../../domain/property';
import { listingService } from './listingService';
import { propertyService } from './propertyService';
import { localityService } from './localityService';
import { propertyMediaService } from './propertyMediaService';
import { propertyActorService } from './propertyActorService';
import { locationShareService } from './locationShareService';
import { listingOfferState } from '../../utils/propertyDetailView';

function publicMapCoordinate(id, latitude, longitude, precision) {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;
    return toPublicMapCoordinate(id || 'property', Number(latitude), Number(longitude), precision);
}

const DETAIL_CACHE_TTL_MS = 30 * 1000;
const listingCache = new Map(); // id -> { timestamp, data }
const contextCache = new Map(); // id -> { timestamp, data }
const inFlightDetail = new Map(); // key -> Promise

/**
 * Listing + related reads for the detail screen.
 * Screens must not query Firestore directly.
 */
export const propertyDetailService = {
    async getListing(listingId) {
        if (!listingId) return null;
        const cached = listingCache.get(listingId);
        if (cached && Date.now() - cached.timestamp < DETAIL_CACHE_TTL_MS) {
            return cached.data;
        }
        const flightKey = `listing_${listingId}`;
        if (inFlightDetail.has(flightKey)) {
            return inFlightDetail.get(flightKey);
        }
        const promise = (async () => {
            try {
                const res = await listingService.getListing(listingId);
                if (res) {
                    listingCache.set(listingId, { timestamp: Date.now(), data: res });
                }
                return res;
            } finally {
                inFlightDetail.delete(flightKey);
            }
        })();
        inFlightDetail.set(flightKey, promise);
        return promise;
    },

    async getProperty(propertyId) {
        return propertyService.getProperty(propertyId);
    },

    /**
     * After the listing document is shown, load property / media / actor / locality.
     * Media prefers listing attachments, then property gallery (one extra query if needed).
     */
    async loadListingContext(listing) {
        if (!listing) {
            return {
                property: null,
                propertyAccess: 'missing',
                media: [],
                actor: null,
                locality: null,
                mapCoordinate: null,
            };
        }

        const cached = contextCache.get(listing.id);
        if (cached && Date.now() - cached.timestamp < DETAIL_CACHE_TTL_MS) {
            return cached.data;
        }
        const flightKey = `context_${listing.id}`;
        if (inFlightDetail.has(flightKey)) {
            return inFlightDetail.get(flightKey);
        }

        const promise = (async () => {
            try {
                const [property, media, locality, actor] = await Promise.all([
                    listing.propertyId ? propertyService.getProperty(listing.propertyId) : Promise.resolve(null),
                    propertyMediaService.listPublicGallery({
                        listingId: listing.id,
                        propertyId: listing.propertyId,
                    }).catch(() => []),
                    listing.localityId ? localityService.getLocality(listing.localityId) : Promise.resolve(null),
                    listing.listedByUid ? propertyActorService.getPublicActor(listing.listedByUid) : Promise.resolve(null),
                ]);

                let propertyAccess = 'missing';
                if (property?.status === 'ACTIVE') propertyAccess = 'active';
                else if (property?.status === 'INACTIVE' || property?.status === 'ARCHIVED') propertyAccess = 'inactive';
                else if (listing.propertyId && !property) propertyAccess = 'hidden';

                const seed = listing.id || listing.propertyId;
                let lat = listing.latitude ?? property?.latitude;
                let lng = listing.longitude ?? property?.longitude;
                let precision = listing.locationPrecision || property?.locationPrecision || 'approximate_on_request';
                let isExactShared = precision === 'exact';
                let shareRecord = null;
                let shareStatus = precision === 'exact' ? 'EXACT_PUBLIC' : 'NONE';

                if (property?.id && precision !== 'exact') {
                    try {
                        const privateGeo = await propertyService.getPrivateGeo(property.id);
                        if (privateGeo && Number.isFinite(privateGeo.latitude) && Number.isFinite(privateGeo.longitude)) {
                            lat = privateGeo.latitude;
                            lng = privateGeo.longitude;
                            isExactShared = true;
                            shareStatus = 'APPROVED';
                        }
                    } catch {
                        // Not authorized to view private_geo
                    }
                    if (!isExactShared) {
                        shareRecord = await locationShareService.getShareStatus(property.id);
                        if (shareRecord?.status) {
                            shareStatus = shareRecord.status;
                        }
                    }
                }

                const result = {
                    property,
                    propertyAccess,
                    media: Array.isArray(media) ? media : [],
                    actor,
                    locality,
                    mapCoordinate: isExactShared
                        ? { latitude: Number(lat), longitude: Number(lng) }
                        : publicMapCoordinate(seed, lat, lng, precision),
                    locationPrecision: precision,
                    isExactShared,
                    shareStatus,
                    shareRecord,
                };
                contextCache.set(listing.id, { timestamp: Date.now(), data: result });
                return result;
            } finally {
                inFlightDetail.delete(flightKey);
            }
        })();

        inFlightDetail.set(flightKey, promise);
        return promise;
    },

    clearCache() {
        listingCache.clear();
        contextCache.clear();
        inFlightDetail.clear();
    },

    async loadPropertyDetail(propertyId) {
        const property = await propertyService.getProperty(propertyId);
        if (!property) return { kind: 'not_found', property: null };

        const [media, locality, publishedListings] = await Promise.all([
            propertyMediaService.listPublicGallery({ propertyId: property.id }).catch(() => []),
            property.localityId ? localityService.getLocality(property.localityId) : Promise.resolve(null),
            listingService.listPublishedForProperty(property.id).catch(() => []),
        ]);

        const precision = property.locationPrecision || 'exact';
        return {
            kind: property.status === 'ACTIVE' ? 'ok' : 'inactive',
            property,
            media: Array.isArray(media) ? media : [],
            locality,
            publishedListings: (publishedListings || []).filter(
                (row) => listingOfferState(row) === 'published'
            ),
            mapCoordinate: publicMapCoordinate(
                property.id,
                property.latitude,
                property.longitude,
                precision
            ),
            locationPrecision: precision,
        };
    },
};
