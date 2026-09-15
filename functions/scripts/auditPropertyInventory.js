/**
 * Read-only property/listing integrity audit.
 *
 *   cd functions
 *   node scripts/auditPropertyInventory.js --project croww-staging-2026
 *
 * Never writes. Never deletes. Does not invent inventory.
 */
const { assertProjectAllowed } = require("./projectGuard");
const { listCollection, getDoc } = require("./cliFirestore");

const LISTING_STATUSES = new Set([
    "DRAFT", "PUBLISHED", "PAUSED", "SOLD", "RENTED", "EXPIRED", "ARCHIVED",
]);
const PROPERTY_STATUSES = new Set(["ACTIVE", "INACTIVE"]);
const ACTOR_ROLES = new Set(["owner", "agent", "builder", "admin"]);

function issue(code, id, detail) {
    return { code, id, detail };
}

async function run() {
    const guard = assertProjectAllowed({ apply: false });
    const findings = [];
    const propertyIds = new Set();

    const properties = await listCollection(guard.projectId, "properties");
    properties.forEach((snap) => {
        const row = snap.data || {};
        propertyIds.add(snap.id);
        if (!PROPERTY_STATUSES.has(row.status)) {
            findings.push(issue("INVALID_PROPERTY_STATUS", snap.id, row.status || null));
        }
        if (!Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) {
            findings.push(issue("MISSING_PUBLIC_PIN", snap.id, "latitude/longitude"));
        }
        if (!row.createdByUid || !row.ownerUid) {
            findings.push(issue("MISSING_ACTOR", snap.id, "createdByUid/ownerUid"));
        }
        if (row.verification?.ownership?.status === true || row.verification === true) {
            findings.push(issue("BOOLEAN_TRUST", snap.id, "property.verification"));
        }
    });

    const listings = await listCollection(guard.projectId, "listings");
    for (const snap of listings) {
        const row = snap.data || {};
        if (!LISTING_STATUSES.has(row.status)) {
            findings.push(issue("INVALID_LISTING_STATUS", snap.id, row.status || null));
        }
        if (!row.propertyId) {
            findings.push(issue("MISSING_PROPERTY_ID", snap.id, null));
        } else if (!propertyIds.has(row.propertyId)) {
            const exists = await getDoc(guard.projectId, `properties/${row.propertyId}`);
            if (!exists.exists) findings.push(issue("ORPHAN_LISTING", snap.id, row.propertyId));
        }
        if (!ACTOR_ROLES.has(row.listedByRole)) {
            findings.push(issue("INVALID_ACTOR_ROLE", snap.id, row.listedByRole || null));
        }
        if (!row.listedByUid) {
            findings.push(issue("MISSING_LISTED_BY", snap.id, null));
        }
        if (row.status === "PUBLISHED") {
            if (!Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) {
                findings.push(issue("PUBLISHED_MISSING_PIN", snap.id, null));
            }
            if (row.transactionType === "buy" && !(typeof row.askingPrice === "number" && row.askingPrice > 0)) {
                findings.push(issue("PUBLISHED_BUY_MISSING_PRICE", snap.id, row.askingPrice ?? null));
            }
            if (row.transactionType === "rent" && !(typeof row.rentMonthly === "number" && row.rentMonthly > 0)) {
                findings.push(issue("PUBLISHED_RENT_MISSING_RENT", snap.id, row.rentMonthly ?? null));
            }
            const expires = row.expiresAt instanceof Date ? row.expiresAt : null;
            if (expires && expires.getTime() < Date.now()) {
                findings.push(issue("PUBLISHED_BUT_EXPIRED", snap.id, expires.toISOString()));
            }
        }
        if (row.privateLatitude != null || row.exactLatitude != null || row.lat != null) {
            findings.push(issue("PRIVATE_GEO_ON_LISTING", snap.id, "unexpected alias fields"));
        }
        if (row.status === "PUBLISHED" && row.listedByUid && row.propertyId) {
            const propertySnap = await getDoc(guard.projectId, `properties/${row.propertyId}`);
            if (propertySnap.exists) {
                const property = propertySnap.data || {};
                if (row.listedByRole === "owner" && property.ownerUid && property.ownerUid !== row.listedByUid) {
                    findings.push(issue("OWNER_ACTOR_MISMATCH", snap.id, property.ownerUid));
                }
                if (row.geohash && property.geohash && row.geohash !== property.geohash) {
                    findings.push(issue("LISTING_PROPERTY_GEO_MISMATCH", snap.id, `${row.geohash} vs ${property.geohash}`));
                }
            }
        }
    }

    const summary = findings.reduce((acc, row) => {
        acc[row.code] = (acc[row.code] || 0) + 1;
        return acc;
    }, {});

    console.log(JSON.stringify({
        mode: "read-only",
        projectId: guard.projectId,
        propertiesProcessed: properties.length,
        listingsProcessed: listings.length,
        findingCount: findings.length,
        summary,
        sample: findings.slice(0, 50),
    }, null, 2));
}

run().catch((error) => {
    console.error("audit_failed", error.message);
    process.exit(1);
});
