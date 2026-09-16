const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAdmin, requireAuth, isAdminUid } = require("./httpAuth");
const { buildPublicGeoFields } = require("./propertyGeo");

function db() {
    return admin.firestore();
}

async function applyPublicLocation(propertyId, exact, precision, localityCoordinate) {
    const publicGeo = buildPublicGeoFields(
        propertyId,
        exact.latitude,
        exact.longitude,
        precision,
        localityCoordinate
    );
    const geo = new admin.firestore.GeoPoint(publicGeo.latitude, publicGeo.longitude);
    await db().collection("properties").doc(propertyId).update({
        latitude: publicGeo.latitude,
        longitude: publicGeo.longitude,
        geohash: publicGeo.geohash,
        geo,
        locationPrecision: precision,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const listings = await db().collection("listings").where("propertyId", "==", propertyId).get();
    const batch = db().batch();
    listings.docs.forEach((snap) => {
        batch.update(snap.ref, {
            latitude: publicGeo.latitude,
            longitude: publicGeo.longitude,
            geohash: publicGeo.geohash,
            geo,
            locationPrecision: precision,
        });
    });
    if (!listings.empty) await batch.commit();
    return publicGeo;
}

/**
 * Admin-only publication. Rewrites public geo from private_geo before going live.
 */
exports.publishListing = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAdmin(request, response);
        if (!decoded) return;
        const listingId = request.body?.listingId;
        if (!listingId || typeof listingId !== "string") {
            response.status(400).send({ error: "INVALID_LISTING", message: "listingId required" });
            return;
        }
        const listingRef = db().collection("listings").doc(listingId);
        const listingSnap = await listingRef.get();
        if (!listingSnap.exists) {
            response.status(404).send({ error: "LISTING_NOT_FOUND", message: "Listing not found" });
            return;
        }
        const listing = listingSnap.data();
        const propertySnap = await db().collection("properties").doc(listing.propertyId).get();
        if (!propertySnap.exists) {
            response.status(404).send({ error: "PROPERTY_NOT_FOUND", message: "Property not found" });
            return;
        }
        const property = propertySnap.data();
        const privateSnap = await propertySnap.ref.collection("private_geo").doc("current").get();
        if (privateSnap.exists) {
            const exact = privateSnap.data();
            let localityCoordinate = null;
            if (property.localityId) {
                const loc = await db().collection("localities").doc(property.localityId).get();
                if (loc.exists) {
                    localityCoordinate = { latitude: loc.data().latitude, longitude: loc.data().longitude };
                }
            }
            await applyPublicLocation(
                listing.propertyId,
                { latitude: exact.latitude, longitude: exact.longitude },
                property.locationPrecision || "exact",
                localityCoordinate
            );
        }
        const freshProperty = (await propertySnap.ref.get()).data();
        const buyOk = listing.transactionType !== "buy" || (typeof listing.askingPrice === "number" && listing.askingPrice > 0);
        const rentOk = listing.transactionType !== "rent" || (typeof listing.rentMonthly === "number" && listing.rentMonthly > 0);
        if (!buyOk || !rentOk) {
            response.status(400).send({ error: "INVALID_LISTING", message: "Published listings need a positive price" });
            return;
        }
        if (listing.taxonomyId) {
            const taxDoc = await db().collection("listingTaxonomy").doc(listing.taxonomyId).get();
            if (taxDoc.exists) {
                const tax = taxDoc.data();
                if (tax.status !== "ACTIVE" || tax.postingEnabled === false) {
                    response.status(400).send({
                        error: "TAXONOMY_POSTING_DISABLED",
                        message: `Listing category "${tax.displayName || listing.taxonomyId}" is not enabled for posting`
                    });
                    return;
                }
            }
        }
        await listingRef.update({
            status: "PUBLISHED",
            publishedAt: listing.publishedAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedByUid: decoded.uid,
            latitude: freshProperty.latitude,
            longitude: freshProperty.longitude,
            geohash: freshProperty.geohash,
            geo: freshProperty.geo,
            locationPrecision: freshProperty.locationPrecision,
        });
        await listingRef.collection("private_meta").doc("current").set({
            moderation: {
                status: "APPROVED",
                reason: null,
                reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                reviewedByUid: decoded.uid,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedByUid: decoded.uid,
        }, { merge: true });
        logger.info("publishListing", { listingId, propertyId: listing.propertyId, adminUid: decoded.uid });
        response.status(200).send({ ok: true, listingId, status: "PUBLISHED" });
    } catch (error) {
        logger.error("publishListing failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Publish failed" });
    }
});

/**
 * Owner/admin: recompute public pin from private_geo (does not log coordinates).
 */
exports.syncPropertyPublicLocation = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAuth(request, response);
        if (!decoded) return;
        const propertyId = request.body?.propertyId;
        if (!propertyId || typeof propertyId !== "string") {
            response.status(400).send({ error: "INVALID_PROPERTY", message: "propertyId required" });
            return;
        }
        const propertyRef = db().collection("properties").doc(propertyId);
        const propertySnap = await propertyRef.get();
        if (!propertySnap.exists) {
            response.status(404).send({ error: "PROPERTY_NOT_FOUND", message: "Property not found" });
            return;
        }
        const property = propertySnap.data();
        const adminUser = await isAdminUid(decoded.uid);
        if (!adminUser && property.ownerUid !== decoded.uid && property.createdByUid !== decoded.uid) {
            response.status(403).send({ error: "FORBIDDEN", message: "Not allowed" });
            return;
        }
        const privateSnap = await propertyRef.collection("private_geo").doc("current").get();
        if (!privateSnap.exists) {
            response.status(400).send({ error: "INVALID_LOCATION", message: "No private location stored" });
            return;
        }
        const exact = privateSnap.data();
        let localityCoordinate = null;
        if (property.localityId) {
            const loc = await db().collection("localities").doc(property.localityId).get();
            if (loc.exists) {
                localityCoordinate = { latitude: loc.data().latitude, longitude: loc.data().longitude };
            }
        }
        await applyPublicLocation(
            propertyId,
            { latitude: exact.latitude, longitude: exact.longitude },
            property.locationPrecision || "exact",
            localityCoordinate
        );
        logger.info("syncPropertyPublicLocation", { propertyId, uid: decoded.uid });
        response.status(200).send({ ok: true, propertyId });
    } catch (error) {
        logger.error("syncPropertyPublicLocation failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Sync failed" });
    }
});
