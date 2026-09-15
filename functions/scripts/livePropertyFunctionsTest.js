/**
 * Production Phase 5A Live Security and Functional Tests.
 *
 * Tests:
 * 1. publishListing authorization:
 *    A. Buyer attempts publishListing -> 403
 *    B. Owner attempts self-publish -> 403
 *    C. Agent attempts publish another user's listing -> 403
 *    D. Client directly writes status = PUBLISHED -> 403
 *    E. Admin calls publishListing on DRAFT smoke listing -> 200, status = PUBLISHED
 * 2. Geo privacy:
 *    - Public listing/property has approximate pin only
 *    - No exact coordinate leakage or lat/lng aliases
 *    - Private geo is restricted (Buyer -> 403, Owner/Admin -> 200)
 * 3. syncPropertyPublicLocation:
 *    - Owner -> 200
 *    - Non-owner Buyer -> 403
 * 4. Idempotency & failure handling:
 *    - Repeated publishListing -> 200
 *    - Nonexistent listing -> 404
 *    - Missing listingId -> 400
 *    - Missing / invalid token -> 401
 * 5. Full cleanup of all ephemeral fixtures & auth accounts.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assertProjectAllowed } = require("./projectGuard");
const { cliAccessToken, encodeMap, decodeMap } = require("./cliFirestore");

const PROJECT = "croww-live-2026";
assertProjectAllowed(PROJECT);

const gsPath = path.join(__dirname, "../../../croww-app/google-services.json");
const gs = JSON.parse(fs.readFileSync(gsPath, "utf8"));
const API_KEY = gs?.client?.[0]?.api_key?.[0]?.current_key;
if (!API_KEY) throw new Error("API key not found in google-services.json");

const PUBLISH_URL = "https://us-central1-croww-live-2026.cloudfunctions.net/publishListing";
const SYNC_GEO_URL = "https://us-central1-croww-live-2026.cloudfunctions.net/syncPropertyPublicLocation";

const RESULTS = [];

function record(name, pass, detail) {
    const status = pass ? "PASS" : "FAIL";
    RESULTS.push({ name, status, detail });
    console.log(`[${status}] ${name}: ${detail}`);
}

async function identity(pathSuffix, body) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${pathSuffix}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(`Identity error ${res.status}: ${JSON.stringify(json)}`);
    }
    return json;
}

function randomPassword() {
    return `Cr0ww!${crypto.randomBytes(8).toString("hex")}A1`;
}

async function fsClient(idToken, method, docPath, body) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
    const headers = { "Content-Type": "application/json" };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, json };
}

async function fsIam(method, docPath, body) {
    const token = cliAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, json };
}

async function callFunction(url, token, body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, json };
}

async function main() {
    console.log("Starting Production Phase 5A Live Security Tests on croww-live-2026...");
    const stamp = Date.now();
    const createdUsers = [];
    const cleanupDocs = [];

    const propId = `smoke-prop-${stamp}`;
    const listingId = `smoke-listing-${stamp}`;

    try {
        // 1. Create Ephemeral Personas
        console.log("--- 1. Creating Ephemeral Test Personas ---");
        const personas = {
            buyer: { role: "buyer", userType: "individual" },
            owner: { role: "owner", userType: "individual" },
            agent: { role: "agent", userType: "business" },
            admin: { role: "admin", userType: "admin" },
        };

        for (const [key, spec] of Object.entries(personas)) {
            const email = `smoke.phase5a.${stamp}.${key}@croww.test`;
            const authRes = await identity("accounts:signUp", {
                email,
                password: randomPassword(),
                returnSecureToken: true,
            });
            spec.uid = authRes.localId;
            spec.idToken = authRes.idToken;
            spec.email = email;
            createdUsers.push(spec);

            // Write user document
            const userDoc = {
                email,
                name: `Smoke ${key}`,
                userType: spec.userType,
                role: spec.userType,
                roles: [spec.role],
                isSmoke: true,
                createdAt: new Date().toISOString(),
            };
            await fsIam("PATCH", `users/${spec.uid}?currentDocument.exists=false`, {
                fields: encodeMap(userDoc),
            });
            cleanupDocs.push(`users/${spec.uid}`);
            console.log(`Created ephemeral persona ${key}: ${spec.uid}`);
        }

        // 2. Create Ephemeral Smoke Property & DRAFT Listing via IAM
        console.log("--- 2. Creating Ephemeral DRAFT Listing Fixture ---");
        const exactLat = 12.9715987;
        const exactLng = 77.5945632;

        const propertyData = {
            id: propId,
            title: "Phase 5A Ephemeral Smoke Property",
            propertyType: "apartment",
            ownerUid: personas.owner.uid,
            createdByUid: personas.owner.uid,
            locationPrecision: "approximate",
            latitude: exactLat,
            longitude: exactLng,
            geohash: "tdr1vne",
            geo: { latitude: exactLat, longitude: exactLng },
            isSmoke: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await fsIam("PATCH", `properties/${propId}?currentDocument.exists=false`, {
            fields: encodeMap(propertyData),
        });
        cleanupDocs.push(`properties/${propId}`);

        // Write exact private_geo
        const privateGeoData = {
            latitude: exactLat,
            longitude: exactLng,
            accuracy: 5,
            isSmoke: true,
            updatedAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `properties/${propId}/private_geo/current?currentDocument.exists=false`, {
            fields: encodeMap(privateGeoData),
        });
        cleanupDocs.push(`properties/${propId}/private_geo/current`);

        // Write DRAFT listing
        const listingData = {
            id: listingId,
            propertyId: propId,
            title: "Phase 5A Ephemeral Smoke Listing",
            transactionType: "buy",
            askingPrice: 7500000,
            status: "DRAFT",
            ownerUid: personas.owner.uid,
            listedByUid: personas.owner.uid,
            listedByRole: "owner",
            locationPrecision: "approximate",
            latitude: exactLat,
            longitude: exactLng,
            geohash: "tdr1vne",
            geo: { latitude: exactLat, longitude: exactLng },
            isSmoke: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `listings/${listingId}?currentDocument.exists=false`, {
            fields: encodeMap(listingData),
        });
        cleanupDocs.push(`listings/${listingId}`);
        cleanupDocs.push(`listings/${listingId}/private_meta/current`);

        console.log(`Created smoke fixture: property=${propId}, listing=${listingId}`);

        // 3. Test Unauthorized Publishing Paths
        console.log("--- 3. Testing Unauthorized Publication Paths ---");

        // A. Buyer attempts publishListing
        const buyerPublish = await callFunction(PUBLISH_URL, personas.buyer.idToken, { listingId });
        record(
            "Test A: Buyer attempts publishListing",
            buyerPublish.status === 403,
            `HTTP ${buyerPublish.status} (expected 403)`
        );

        // B. Owner attempts self-publish
        const ownerPublish = await callFunction(PUBLISH_URL, personas.owner.idToken, { listingId });
        record(
            "Test B: Owner attempts self-publish",
            ownerPublish.status === 403,
            `HTTP ${ownerPublish.status} (expected 403)`
        );

        // C. Agent attempts publish another user's listing
        const agentPublish = await callFunction(PUBLISH_URL, personas.agent.idToken, { listingId });
        record(
            "Test C: Agent attempts publishListing",
            agentPublish.status === 403,
            `HTTP ${agentPublish.status} (expected 403)`
        );

        // D. Client directly writes status = PUBLISHED to Firestore
        const clientDirectPublish = await fsClient(
            personas.owner.idToken,
            "PATCH",
            `listings/${listingId}?updateMask.fieldPaths=status`,
            { fields: { status: { stringValue: "PUBLISHED" } } }
        );
        record(
            "Test D: Client directly writes status = PUBLISHED",
            clientDirectPublish.status === 403,
            `HTTP ${clientDirectPublish.status} (expected 403)`
        );

        // 4. Test Authorized Admin Publication Path
        console.log("--- 4. Testing Admin Publication Path ---");
        const adminPublish = await callFunction(PUBLISH_URL, personas.admin.idToken, { listingId });
        record(
            "Test E: Admin calls publishListing",
            adminPublish.status === 200 && adminPublish.json.status === "PUBLISHED",
            `HTTP ${adminPublish.status}, status=${adminPublish.json.status}`
        );

        // Verify Firestore state after publication
        const publishedListingSnap = await fsIam("GET", `listings/${listingId}`);
        const publishedData = decodeMap(publishedListingSnap.json.fields || {});
        record(
            "Verification: Listing status is PUBLISHED",
            publishedData.status === "PUBLISHED" && !!publishedData.publishedAt,
            `status=${publishedData.status}, publishedAt=${publishedData.publishedAt}`
        );

        const privateMetaSnap = await fsIam("GET", `listings/${listingId}/private_meta/current`);
        const metaData = decodeMap(privateMetaSnap.json.fields || {});
        record(
            "Verification: Moderation status is APPROVED",
            metaData.moderation?.status === "APPROVED",
            `moderation=${JSON.stringify(metaData.moderation)}`
        );

        // 5. Verify Public / Private Geo
        console.log("--- 5. Verifying Public vs Private Geo ---");
        const publicLat = publishedData.latitude;
        const publicLng = publishedData.longitude;

        // With locationPrecision: approximate, public pin must be jittered
        const isJittered = Math.abs(publicLat - exactLat) > 0.00001 || Math.abs(publicLng - exactLng) > 0.00001;
        record(
            "Geo: Public pin is approximate and jittered",
            isJittered,
            `exact=(${exactLat}, ${exactLng}), public=(${publicLat}, ${publicLng})`
        );

        const hasCoordinateAliases = "lat" in publishedData || "lng" in publishedData;
        record(
            "Geo: No lat/lng aliases on public listing",
            !hasCoordinateAliases,
            "only canonical latitude / longitude / geohash / geo present"
        );

        const hasPrivateGeoDuplication = "accuracy" in publishedData;
        record(
            "Geo: Private geo fields not leaked to public listing",
            !hasPrivateGeoDuplication,
            "accuracy field not duplicated onto listing"
        );

        // Security check on private_geo
        const buyerPrivateRead = await fsClient(personas.buyer.idToken, "GET", `properties/${propId}/private_geo/current`);
        record(
            "Geo Security: Buyer cannot read private_geo",
            buyerPrivateRead.status === 403,
            `HTTP ${buyerPrivateRead.status} (expected 403)`
        );

        const ownerPrivateRead = await fsClient(personas.owner.idToken, "GET", `properties/${propId}/private_geo/current`);
        record(
            "Geo Security: Owner can read private_geo",
            ownerPrivateRead.status === 200,
            `HTTP ${ownerPrivateRead.status} (expected 200)`
        );

        const adminPrivateRead = await fsClient(personas.admin.idToken, "GET", `properties/${propId}/private_geo/current`);
        record(
            "Geo Security: Admin can read private_geo",
            adminPrivateRead.status === 200,
            `HTTP ${adminPrivateRead.status} (expected 200)`
        );

        // 6. Verify syncPropertyPublicLocation
        console.log("--- 6. Verifying syncPropertyPublicLocation ---");
        const buyerSync = await callFunction(SYNC_GEO_URL, personas.buyer.idToken, { propertyId: propId });
        record(
            "syncPropertyPublicLocation: Buyer denied",
            buyerSync.status === 403,
            `HTTP ${buyerSync.status} (expected 403)`
        );

        const ownerSync = await callFunction(SYNC_GEO_URL, personas.owner.idToken, { propertyId: propId });
        record(
            "syncPropertyPublicLocation: Owner allowed",
            ownerSync.status === 200 && ownerSync.json.ok === true,
            `HTTP ${ownerSync.status}, ok=${ownerSync.json.ok}`
        );

        // 7. Idempotency and Failure Tests
        console.log("--- 7. Testing Idempotency and Failure Cases ---");
        const repeatedPublish = await callFunction(PUBLISH_URL, personas.admin.idToken, { listingId });
        record(
            "Idempotency: Repeated publishListing call",
            repeatedPublish.status === 200 && repeatedPublish.json.status === "PUBLISHED",
            `HTTP ${repeatedPublish.status}, status=${repeatedPublish.json.status}`
        );

        const invalidListingPublish = await callFunction(PUBLISH_URL, personas.admin.idToken, { listingId: "nonexistent-id" });
        record(
            "Failure Test: Nonexistent listing ID",
            invalidListingPublish.status === 404,
            `HTTP ${invalidListingPublish.status} (expected 404)`
        );

        const missingListingPublish = await callFunction(PUBLISH_URL, personas.admin.idToken, {});
        record(
            "Failure Test: Missing listingId parameter",
            missingListingPublish.status === 400,
            `HTTP ${missingListingPublish.status} (expected 400)`
        );

        const unauthenticatedPublish = await callFunction(PUBLISH_URL, null, { listingId });
        record(
            "Failure Test: Missing Bearer token",
            unauthenticatedPublish.status === 401,
            `HTTP ${unauthenticatedPublish.status} (expected 401)`
        );

        const invalidTokenPublish = await callFunction(PUBLISH_URL, "invalid-token-xyz", { listingId });
        record(
            "Failure Test: Invalid Bearer token",
            invalidTokenPublish.status === 401,
            `HTTP ${invalidTokenPublish.status} (expected 401)`
        );

    } finally {
        // 10. Cleanup
        console.log("--- 10. Cleaning up Ephemeral Fixtures and Users ---");
        for (const docPath of cleanupDocs) {
            try {
                const delRes = await fsIam("DELETE", docPath);
                console.log(`Cleaned up doc ${docPath}: status ${delRes.status}`);
            } catch (err) {
                console.error(`Failed to delete doc ${docPath}:`, err.message);
            }
        }

        for (const user of createdUsers) {
            try {
                if (user.idToken) {
                    await identity("accounts:delete", { idToken: user.idToken });
                    console.log(`Deleted ephemeral Auth user: ${user.uid}`);
                }
            } catch (err) {
                console.error(`Failed to delete user ${user.uid}:`, err.message);
            }
        }
    }

    const failed = RESULTS.filter((r) => r.status === "FAIL");
    console.log("============================================================");
    console.log(`Summary: Total ${RESULTS.length} tests, ${RESULTS.length - failed.length} passed, ${failed.length} failed.`);
    console.log("============================================================");

    if (failed.length > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
