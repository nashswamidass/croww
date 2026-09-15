/**
 * READ-ONLY production inventory for croww-live-2026.
 * GET / runQuery / runAggregationQuery / listCollectionIds only.
 * No writes. Do not print PII, tokens, or exact coordinates.
 *
 *   node scripts/productionReadOnlyAudit.js --project croww-live-2026
 */
const { assertProjectAllowed } = require("./projectGuard");
const { cliAccessToken, getDoc, listCollection } = require("./cliFirestore");

const PROJECT = "croww-live-2026";

function token() {
    return cliAccessToken();
}

async function firestore(method, path, body) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/${path}`;
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token()}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    return { http: response.status, json };
}

async function countCollection(collectionId, collectionGroup = false) {
    const res = await firestore("POST", "documents:runAggregationQuery", {
        structuredAggregationQuery: {
            structuredQuery: {
                from: [{ collectionId, allDescendants: collectionGroup }],
            },
            aggregations: [{ alias: "n", count: {} }],
        },
    });
    const value = res.json?.[0]?.result?.aggregateFields?.n?.integerValue
        ?? res.json?.error?.message
        ?? `http_${res.http}`;
    return { collectionId, collectionGroup, http: res.http, count: value };
}

async function listRootCollections() {
    const ids = [];
    let pageToken = "";
    do {
        const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
        const res = await firestore("POST", `documents:listCollectionIds${qs}`, { pageSize: 100 });
        ids.push(...(res.json.collectionIds || []));
        pageToken = res.json.nextPageToken || "";
        if (!res.json.collectionIds && res.http !== 200) {
            return { http: res.http, error: res.json.error?.message || "listCollectionIds failed", ids };
        }
    } while (pageToken);
    return { http: 200, ids: ids.sort() };
}

function bump(map, key) {
    const k = key == null || key === "" ? "(missing)" : String(key);
    map[k] = (map[k] || 0) + 1;
}

function coordsEqual(a, b) {
    return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) === Number(b);
}

function hasAlias(row) {
    return row.lat != null || row.lng != null || row.exactLatitude != null
        || row.exactLongitude != null || row.privateLatitude != null;
}

async function main() {
    const guard = assertProjectAllowed({ apply: false });
    if (guard.projectId !== PROJECT) throw new Error("refusing non-production project for this audit");

    const collections = await listRootCollections();
    const countTargets = [
        "users", "admins", "events", "tickets", "bookings", "chats",
        "notifications", "follows", "friend_requests", "reviews",
        "properties", "listings", "localities", "property_media",
        "verification_cases", "spatial_processing_jobs", "kyc_sessions",
    ];
    const counts = [];
    for (const id of countTargets) {
        counts.push(await countCollection(id));
    }
    counts.push(await countCollection("savedListings", true));
    counts.push(await countCollection("savedProperties", true));
    counts.push(await countCollection("savedSearches", true));
    counts.push(await countCollection("savedSearchMatches", true));
    counts.push(await countCollection("private_geo", true));

    const properties = await listCollection(PROJECT, "properties");
    const listings = await listCollection(PROJECT, "listings");
    const localities = await listCollection(PROJECT, "localities");
    const media = await listCollection(PROJECT, "property_media").catch((error) => {
        console.error("property_media_list_failed", error.message);
        return [];
    });
    const cases = await listCollection(PROJECT, "verification_cases").catch((error) => {
        console.error("verification_cases_list_failed", error.message);
        return [];
    });

    const propertyStatus = {};
    const listingStatus = {};
    const listedByRole = {};
    const transactionType = {};
    const precision = {};
    const verificationSlices = { identity: {}, ownership: {}, property: {}, location: {} };
    let missingPin = 0;
    let hasPublicLatLng = 0;
    let hasGeoPoint = 0;
    let aliasHits = 0;
    let privateGeoPresent = 0;
    let privateGeoMissing = 0;
    let publicEqualsPrivateExact = 0;
    let publicDiffersFromPrivate = 0;
    let approximateWithMatchingExact = 0;
    const exposedIds = [];
    const missingPrivateGeoIds = [];
    const aliasIds = [];

    for (const snap of properties) {
        const row = snap.data || {};
        bump(propertyStatus, row.status);
        bump(precision, row.locationPrecision);
        if (Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))) hasPublicLatLng += 1;
        else missingPin += 1;
        if (row.geo && (row.geo.latitude != null || row.geo.longitude != null)) hasGeoPoint += 1;
        if (hasAlias(row)) {
            aliasHits += 1;
            if (aliasIds.length < 20) aliasIds.push(snap.id);
        }
        ["identity", "ownership", "property", "location"].forEach((key) => {
            bump(verificationSlices[key], row.verification?.[key]?.status || row.verification?.[key] || "(none)");
        });
        const priv = await getDoc(PROJECT, `properties/${snap.id}/private_geo/current`);
        if (priv.exists) {
            privateGeoPresent += 1;
            const exactLat = priv.data.latitude;
            const exactLng = priv.data.longitude;
            const same = coordsEqual(row.latitude, exactLat) && coordsEqual(row.longitude, exactLng);
            if (same) {
                publicEqualsPrivateExact += 1;
                if ((row.locationPrecision || "exact") !== "exact") {
                    approximateWithMatchingExact += 1;
                    if (exposedIds.length < 50) exposedIds.push({ id: snap.id, precision: row.locationPrecision || null });
                }
            } else {
                publicDiffersFromPrivate += 1;
            }
        } else {
            privateGeoMissing += 1;
            if (missingPrivateGeoIds.length < 50) missingPrivateGeoIds.push(snap.id);
        }
    }

    const listingAliasIds = [];
    const listingVerification = {};
    for (const snap of listings) {
        const row = snap.data || {};
        bump(listingStatus, row.status);
        bump(listedByRole, row.listedByRole);
        bump(transactionType, row.transactionType);
        bump(listingVerification, row.verification?.representation?.status || row.representationStatus || "(none)");
        if (hasAlias(row) && listingAliasIds.length < 20) listingAliasIds.push(snap.id);
    }

    const localityIntel = { withSnapshot: 0, withoutSnapshot: 0, personalScore: 0 };
    localities.forEach((snap) => {
        const intel = snap.data?.intelligence;
        if (intel && typeof intel === "object") localityIntel.withSnapshot += 1;
        else localityIntel.withoutSnapshot += 1;
        if (intel?.personalScore != null) localityIntel.personalScore += 1;
    });

    const mediaTypes = {};
    const processing = {};
    media.forEach((snap) => {
        bump(mediaTypes, snap.data?.mediaType);
        bump(processing, snap.data?.processingStatus);
    });

    const caseStatus = {};
    const caseType = {};
    cases.forEach((snap) => {
        bump(caseStatus, snap.data?.status);
        bump(caseType, snap.data?.type);
    });

    const usersSample = await listCollection(PROJECT, "users");
    const userType = {};
    const roleHits = { withRoles: 0, agent: 0, builder: 0, buyer: 0, owner: 0 };
    let aadhaarTrue = 0;
    let isVerifiedTrue = 0;
    let kycDetailsPresent = 0;
    usersSample.forEach((snap) => {
        const row = snap.data || {};
        bump(userType, row.userType);
        if (Array.isArray(row.roles) && row.roles.length) {
            roleHits.withRoles += 1;
            if (row.roles.includes("agent")) roleHits.agent += 1;
            if (row.roles.includes("builder")) roleHits.builder += 1;
            if (row.roles.includes("buyer")) roleHits.buyer += 1;
            if (row.roles.includes("owner")) roleHits.owner += 1;
        }
        if (row.aadhaarVerified === true) aadhaarTrue += 1;
        if (row.isVerified === true) isVerifiedTrue += 1;
        if (row.kycDetails) kycDetailsPresent += 1;
    });

    console.log(JSON.stringify({
        projectId: PROJECT,
        mode: "read-only",
        collections: collections.ids,
        collectionListHttp: collections.http,
        counts,
        properties: {
            listed: properties.length,
            status: propertyStatus,
            precision,
            hasPublicLatLng,
            missingPin,
            hasGeoPoint,
            aliasHits,
            aliasIds,
            privateGeoPresent,
            privateGeoMissing,
            missingPrivateGeoIds,
            publicEqualsPrivateExact,
            publicDiffersFromPrivate,
            approximateWithMatchingExact,
            exposedApproximateIds: exposedIds,
            verificationSlices,
        },
        listings: {
            listed: listings.length,
            status: listingStatus,
            listedByRole,
            transactionType,
            verificationOrRepresentation: listingVerification,
            aliasIds: listingAliasIds,
        },
        localities: { listed: localities.length, ...localityIntel },
        property_media: { listed: media.length, mediaTypes, processing },
        verification_cases: { listed: cases.length, caseStatus, caseType },
        users: {
            listed: usersSample.length,
            userType,
            roleHits,
            aadhaarTrue,
            isVerifiedTrue,
            kycDetailsPresent,
        },
    }, null, 2));
}

main().catch((error) => {
    console.error("audit_failed", error.message);
    process.exit(1);
});
