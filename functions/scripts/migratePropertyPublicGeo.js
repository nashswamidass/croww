/**
 * Idempotent public/private geo migration.
 *
 * Default is dry-run. Does not delete fields. Does not invent inventory.
 *
 *   cd functions
 *   node scripts/migratePropertyPublicGeo.js --project croww-staging-2026
 *   node scripts/migratePropertyPublicGeo.js --project croww-staging-2026 --apply
 *
 * Production:
 *   node scripts/migratePropertyPublicGeo.js --project croww-live-2026
 *   node scripts/migratePropertyPublicGeo.js --project croww-live-2026 --apply --confirm-production
 */
const { buildPublicGeoFields } = require("../propertyGeo");
const { assertProjectAllowed, hasFlag } = require("./projectGuard");
const { listCollection, getDoc, patchDoc, queryWhere } = require("./cliFirestore");

const APPLY = hasFlag("--apply");

function coordsEqual(a, b) {
    return Number(a) === Number(b);
}

async function migrate() {
    const guard = assertProjectAllowed({ apply: APPLY });
    const properties = await listCollection(guard.projectId, "properties");
    let processed = 0;
    let writtenPrivate = 0;
    let rewrittenPublic = 0;
    let listingsAligned = 0;
    let skippedInvalid = 0;

    for (const docSnap of properties) {
        processed += 1;
        const property = docSnap.data || {};
        const propertyId = docSnap.id;
        const precision = property.locationPrecision || "exact";
        const privateSnap = await getDoc(guard.projectId, `properties/${propertyId}/private_geo/current`);

        const exactSource = privateSnap.exists
            ? privateSnap.data
            : { latitude: property.latitude, longitude: property.longitude };

        if (!Number.isFinite(Number(exactSource.latitude)) || !Number.isFinite(Number(exactSource.longitude))) {
            skippedInvalid += 1;
            console.warn("skip_invalid_coords", propertyId);
            continue;
        }

        if (!privateSnap.exists) {
            writtenPrivate += 1;
            if (APPLY) {
                await patchDoc(guard.projectId, `properties/${propertyId}/private_geo/current`, {
                    latitude: exactSource.latitude,
                    longitude: exactSource.longitude,
                    geohash: exactSource.geohash || null,
                    geo: { latitude: exactSource.latitude, longitude: exactSource.longitude },
                    addressLine1: property.address?.line1 || null,
                    pincode: property.address?.pincode || null,
                    updatedAt: new Date(),
                    updatedByUid: "migration",
                });
            }
        }

        let localityCoordinate = null;
        if (property.localityId) {
            const loc = await getDoc(guard.projectId, `localities/${property.localityId}`);
            if (loc.exists) {
                localityCoordinate = { latitude: loc.data.latitude, longitude: loc.data.longitude };
            }
        }

        const publicGeo = buildPublicGeoFields(
            propertyId,
            Number(exactSource.latitude),
            Number(exactSource.longitude),
            precision,
            localityCoordinate
        );

        const publicChanged = !coordsEqual(publicGeo.latitude, property.latitude)
            || !coordsEqual(publicGeo.longitude, property.longitude)
            || publicGeo.geohash !== property.geohash;

        if (publicChanged) {
            rewrittenPublic += 1;
            if (APPLY) {
                await patchDoc(guard.projectId, `properties/${propertyId}`, {
                    latitude: publicGeo.latitude,
                    longitude: publicGeo.longitude,
                    geohash: publicGeo.geohash,
                    geo: { latitude: publicGeo.latitude, longitude: publicGeo.longitude },
                    updatedAt: new Date(),
                });
            }
        }

        const listings = await queryWhere(guard.projectId, "listings", "propertyId", "EQUAL", propertyId);
        for (const listingDoc of listings) {
            const listing = listingDoc.data || {};
            const listingChanged = !coordsEqual(listing.latitude, publicGeo.latitude)
                || !coordsEqual(listing.longitude, publicGeo.longitude)
                || listing.geohash !== publicGeo.geohash;
            if (!listingChanged) continue;
            listingsAligned += 1;
            if (APPLY) {
                await patchDoc(guard.projectId, `listings/${listingDoc.id}`, {
                    latitude: publicGeo.latitude,
                    longitude: publicGeo.longitude,
                    geohash: publicGeo.geohash,
                    geo: { latitude: publicGeo.latitude, longitude: publicGeo.longitude },
                });
            }
        }
    }

    console.log(JSON.stringify({
        mode: APPLY ? "apply" : "dry-run",
        projectId: guard.projectId,
        processed,
        skippedInvalid,
        wouldWritePrivateGeo: writtenPrivate,
        wouldRewritePublicPin: rewrittenPublic,
        wouldAlignListingPins: listingsAligned,
        note: "Does not delete exact coordinates. Copies them into private_geo when missing, then rewrites public pin from precision.",
    }, null, 2));
}

migrate().catch((error) => {
    console.error("migration_failed", error.message);
    process.exit(1);
});
