/**
 * Saved-search alerts. Keep matching semantics in sync with
 * src/domain/property/saved/match.ts (unit-tested there).
 *
 * Trigger: listings/{id} write that newly becomes PUBLISHED.
 * Does not alert on PUBLISHED→PUBLISHED edits.
 */
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

const MAX_ALERT_QUERY = 200;
const MAX_ALERT_MATCHES_PER_PUBLICATION = 50;
const EVENT_TYPE = "listingPublished";
const NOTIFICATION_TYPE = "saved_search_match";

function cityKey(city) {
    if (typeof city !== "string") return null;
    const key = city.trim().toLowerCase();
    return key || null;
}

function listingMarketAmount(listing) {
    if (!listing) return null;
    if (listing.transactionType === "rent") {
        const value = listing.rentMonthly;
        return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
    }
    if (listing.transactionType === "buy") {
        const value = listing.askingPrice;
        return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
    }
    return null;
}

function isPublicationTransition(before, after) {
    if (!after || after.status !== "PUBLISHED") return false;
    if (!before) return true;
    return before.status !== "PUBLISHED";
}

function viewportToBounds(viewport) {
    const latDelta = Math.abs(viewport.latitudeDelta) || 0.08;
    const lngDelta = Math.abs(viewport.longitudeDelta) || 0.08;
    return {
        north: Math.min(90, viewport.latitude + latDelta / 2),
        south: Math.max(-90, viewport.latitude - latDelta / 2),
        east: Math.min(180, viewport.longitude + lngDelta / 2),
        west: Math.max(-180, viewport.longitude - lngDelta / 2),
    };
}

function inBounds(lat, lng, bounds) {
    return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

function listingMatchesSavedSearch(listing, search) {
    if (!listing || !search || listing.status !== "PUBLISHED") return false;
    const filters = search.filters || {};
    const location = search.location || {};
    if (filters.transactionType && listing.transactionType !== filters.transactionType) return false;
    if (filters.category && listing.category !== filters.category) return false;
    if (filters.subtype && listing.subtype !== filters.subtype) return false;
    if (filters.bhk != null) {
        const beds = listing.bedrooms;
        if (beds == null || !Number.isFinite(beds)) return false;
        if (filters.bhk >= 5) {
            if (beds < 5) return false;
        } else if (beds !== filters.bhk) return false;
    }
    const amount = listingMarketAmount(listing);
    if (filters.minPrice != null || filters.maxPrice != null) {
        if (amount == null) return false;
        if (filters.minPrice != null && amount < filters.minPrice) return false;
        if (filters.maxPrice != null && amount > filters.maxPrice) return false;
    }
    const searchCity = location.cityKey || cityKey(location.city);
    if (location.mode === "CITY") {
        if (!searchCity) return false;
        if (cityKey(listing.city) !== searchCity) return false;
    } else if (searchCity) {
        if (cityKey(listing.city) !== searchCity) return false;
    }
    if (location.mode === "LOCALITY" || location.localityId) {
        if (!location.localityId || listing.localityId !== location.localityId) return false;
    }
    if (location.mode === "VIEWPORT") {
        if (!location.viewport) return false;
        const lat = Number(listing.latitude);
        const lng = Number(listing.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        if (!inBounds(lat, lng, viewportToBounds(location.viewport))) return false;
    }
    return true;
}

function compactInr(amount) {
    if (amount == null || !Number.isFinite(amount)) return null;
    const abs = Math.abs(amount);
    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(abs >= 100000000 ? 0 : 1).replace(/\.0$/, "")}Cr`;
    if (abs >= 100000) return `₹${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1).replace(/\.0$/, "")}L`;
    return `₹${Math.round(abs).toLocaleString("en-IN")}`;
}

function alertCopy(listing, search) {
    const name = search.name || "saved";
    const amount = listingMarketAmount(listing);
    const price = compactInr(amount);
    const priceLine = price
        ? (listing.transactionType === "rent" ? `${price}/month` : price)
        : null;
    const facts = [];
    if (typeof listing.bedrooms === "number" && listing.bedrooms > 0) {
        facts.push(listing.bedrooms >= 5 ? "5+ BHK" : `${listing.bedrooms} BHK`);
    }
    if (typeof listing.builtUpAreaSqft === "number" && listing.builtUpAreaSqft > 0) {
        facts.push(`${Math.round(listing.builtUpAreaSqft).toLocaleString("en-IN")} sq ft`);
    }
    return {
        title: `New property matching your ${name} search`.slice(0, 120),
        message: [priceLine, facts.join(" · ")].filter(Boolean).join("\n").slice(0, 240)
            || "A new published listing matches this search.",
    };
}

function matchId(savedSearchId, listingId) {
    return `${savedSearchId}_${listingId}_${EVENT_TYPE}`.slice(0, 700);
}

async function claimMatch(db, uid, savedSearchId, listingId) {
    const ref = db.doc(`users/${uid}/savedSearchMatches/${matchId(savedSearchId, listingId)}`);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.set(ref, {
            listingId,
            savedSearchId,
            eventType: EVENT_TYPE,
            createdAt: FieldValue.serverTimestamp(),
        });
        return true;
    });
}

exports.isPublicationTransition = isPublicationTransition;
exports.listingMatchesSavedSearch = listingMatchesSavedSearch;

exports.onListingWrittenSavedSearchAlerts = onDocumentWritten("listings/{listingId}", async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!isPublicationTransition(before, after)) return;

    const listingId = event.params.listingId;
    const listingCity = cityKey(after.city);
    if (!listingCity) {
        logger.info("[savedSearchAlerts] skip: listing has no city", listingId);
        return;
    }

    const db = admin.firestore();
    let docs;
    try {
        const snap = await db.collectionGroup("savedSearches")
            .where("alertEnabled", "==", true)
            .where("cityKey", "==", listingCity)
            .limit(MAX_ALERT_QUERY)
            .get();
        docs = snap.docs;
    } catch (error) {
        logger.error("[savedSearchAlerts] query failed", error);
        return;
    }

    const listing = { id: listingId, ...after };
    let sent = 0;
    for (const searchDoc of docs) {
        if (sent >= MAX_ALERT_MATCHES_PER_PUBLICATION) break;
        const data = searchDoc.data() || {};
        if (data.alertEnabled !== true) continue;
        const uid = searchDoc.ref.parent.parent && searchDoc.ref.parent.parent.id;
        if (!uid) continue;
        if (uid === listing.listedByUid || uid === listing.ownerUid) continue;
        const search = {
            name: data.name,
            location: data.location || {},
            filters: data.filters || {},
            criteriaHash: data.criteriaHash,
            alertEnabled: true,
        };
        if (!listingMatchesSavedSearch(listing, search)) continue;
        try {
            const claimed = await claimMatch(db, uid, searchDoc.id, listingId);
            if (!claimed) continue;
            const copy = alertCopy(listing, search);
            await db.collection("notifications").add({
                toUserId: uid,
                fromUserId: null,
                title: copy.title,
                message: copy.message,
                data: {
                    type: NOTIFICATION_TYPE,
                    listingId,
                    savedSearchId: searchDoc.id,
                    eventType: EVENT_TYPE,
                },
                read: false,
                createdAt: FieldValue.serverTimestamp(),
            });
            sent += 1;
        } catch (error) {
            logger.error("[savedSearchAlerts] notify failed", uid, searchDoc.id, error);
        }
    }
    logger.info("[savedSearchAlerts] done", { listingId, candidates: docs.length, sent });
});
