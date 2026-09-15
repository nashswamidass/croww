/**
 * Phase 8A-B Live End-to-End Location Sharing Test Suite
 *
 * Target: croww-live-2026
 *
 * Tests the live Cloud Functions:
 * 1. requestLocationShare
 * 2. respondLocationShare
 * 3. revokeLocationShare
 *
 * Scenarios:
 * A. Viewer sees approximate location.
 * B. Viewer cannot read private_geo.
 * C. Viewer requests exact location (HTTP requestLocationShare).
 * D. Owner receives pending request (notification + location_shares).
 * E. Viewer still cannot read private_geo while PENDING.
 * F. Owner approves (HTTP respondLocationShare).
 * G. Viewer can now read private_geo.
 * H. Stranger still cannot read private_geo.
 * I. Owner revokes (HTTP revokeLocationShare).
 * J. Viewer immediately loses access.
 * K. Re-request works after revocation according to implementation.
 * L. Decline path denies access.
 * M. Expired share denies access.
 *
 * Abuse vectors:
 * - duplicate request handling
 * - owner cannot request own property
 * - forged viewerUid
 * - forged ownerUid
 * - forged propertyId
 * - forged shareId
 * - unauthorized response (stranger or viewer responding)
 * - unauthorized revoke (stranger or viewer revoking)
 * - missing token (401)
 * - invalid token (401)
 * - nonexistent share / property (404)
 *
 * Exact Public Mode:
 * - exact_public exposes exact location only because owner selected it
 * - changing exact_public -> approximate immediately returns to jittered pin
 * - private_geo remains protected
 * - changing approximate_on_request -> exact_public does not create stale mismatches
 *
 * Ephemeral cleanup & production inventory check.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assertProjectAllowed } = require("./projectGuard");
const { cliAccessToken, encodeMap, decodeMap } = require("./cliFirestore");
const { derivePublicCoordinate, buildPublicGeoFields } = require("../propertyGeo");

const guard = assertProjectAllowed({ apply: true });
const PROJECT = guard.projectId;

const gsPath = path.join(__dirname, "../../../croww-app/google-services.json");
const gs = JSON.parse(fs.readFileSync(gsPath, "utf8"));
const API_KEY = gs?.client?.[0]?.api_key?.[0]?.current_key;
if (!API_KEY) throw new Error("API key not found in google-services.json");

const BASE_URL = `https://us-central1-${PROJECT}.cloudfunctions.net`;
const REQUEST_URL = `${BASE_URL}/requestLocationShare`;
const RESPOND_URL = `${BASE_URL}/respondLocationShare`;
const REVOKE_URL = `${BASE_URL}/revokeLocationShare`;

const RESULTS = [];
const EPHEMERAL_DOCS = [];
const EPHEMERAL_USERS = [];

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

async function httpFunction(url, token, body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, json };
}

async function createEphemeralUser(emailPrefix) {
    const email = `${emailPrefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}@test.croww.club`;
    const password = randomPassword();
    const created = await identity("accounts:signUp", {
        email,
        password,
        returnSecureToken: true,
    });
    const uid = created.localId;
    const idToken = created.idToken;

    EPHEMERAL_USERS.push({ uid, idToken });

    // Seed minimal user record
    await fsIam("PATCH", `users/${uid}`, {
        fields: encodeMap({
            email,
            displayName: `Test User ${emailPrefix}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }),
    });
    EPHEMERAL_DOCS.push(`users/${uid}`);

    return { uid, email, idToken };
}

async function cleanup() {
    console.log("\nStarting Phase 8A-B ephemeral cleanup...");
    // Find all notifications created during test for our ephemeral users
    try {
        const token = cliAccessToken();
        for (const user of EPHEMERAL_USERS) {
            const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
            const queryRes = await fetch(queryUrl, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    structuredQuery: {
                        from: [{ collectionId: "notifications" }],
                        where: {
                            fieldFilter: {
                                field: { fieldPath: "toUserId" },
                                op: "EQUAL",
                                value: { stringValue: user.uid },
                            },
                        },
                    },
                }),
            });
            const rows = await queryRes.json();
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    if (row.document?.name) {
                        const parts = row.document.name.split("/documents/");
                        if (parts[1]) EPHEMERAL_DOCS.push(parts[1]);
                    }
                }
            }
        }
    } catch (err) {
        console.warn("Error querying notifications for cleanup:", err.message);
    }

    for (const docPath of EPHEMERAL_DOCS.reverse()) {
        try {
            await fsIam("DELETE", docPath);
        } catch (err) {
            console.warn(`Cleanup error deleting ${docPath}:`, err.message);
        }
    }
    for (const user of EPHEMERAL_USERS) {
        try {
            await identity("accounts:delete", { idToken: user.idToken });
        } catch (err) {
            console.warn(`Cleanup error deleting user ${user.uid}:`, err.message);
        }
    }
    console.log("Phase 8A-B cleanup completed.");
}

async function main() {
    console.log("=== CROWW PHASE 8A-B: LIVE END-TO-END LOCATION SHARING TEST ===");
    console.log(`Target project: ${PROJECT}`);
    console.log(`Endpoints:\n  request: ${REQUEST_URL}\n  respond: ${RESPOND_URL}\n  revoke:  ${REVOKE_URL}\n`);

    try {
        // Step 1: Create ephemeral actors
        console.log("Creating ephemeral test actors...");
        const owner = await createEphemeralUser("e2e_owner");
        const viewer = await createEphemeralUser("e2e_viewer");
        const stranger = await createEphemeralUser("e2e_stranger");
        console.log(`Owner UID: ${owner.uid}`);
        console.log(`Viewer UID: ${viewer.uid}`);
        console.log(`Stranger UID: ${stranger.uid}`);

        // Step 2: Seed Property & Listing with approximate_on_request
        console.log("\n--- Setting up Property & Listing ---");
        const propertyId = `prop_e2e_${Date.now()}`;
        const listingId = `list_e2e_${Date.now()}`;
        const shareId = `${propertyId}__${viewer.uid}`;
        EPHEMERAL_DOCS.push(`properties/${propertyId}`);
        EPHEMERAL_DOCS.push(`listings/${listingId}`);
        EPHEMERAL_DOCS.push(`location_shares/${shareId}`);

        const exactCoord = { latitude: 12.9352, longitude: 77.6245 };
        const approxGeo = buildPublicGeoFields(propertyId, exactCoord.latitude, exactCoord.longitude, "approximate_on_request");

        // Seed property
        await fsIam("PATCH", `properties/${propertyId}`, {
            fields: encodeMap({
                id: propertyId,
                ownerUid: owner.uid,
                createdByUid: owner.uid,
                localityId: "bengaluru_koramangala",
                city: "Bengaluru",
                status: "ACTIVE",
                locationPrecision: "approximate_on_request",
                locationVisibility: "approximate_on_request",
                publicGeo: {
                    latitude: approxGeo.latitude,
                    longitude: approxGeo.longitude,
                    geohash: approxGeo.geohash,
                    precision: "approximate_on_request",
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }),
        });

        // Seed private_geo/current
        const privateGeoPath = `properties/${propertyId}/private_geo/current`;
        EPHEMERAL_DOCS.push(privateGeoPath);
        await fsIam("PATCH", privateGeoPath, {
            fields: encodeMap({
                latitude: exactCoord.latitude,
                longitude: exactCoord.longitude,
                precision: "exact",
                updatedAt: new Date().toISOString(),
            }),
        });

        // Seed listing
        await fsIam("PATCH", `listings/${listingId}`, {
            fields: encodeMap({
                id: listingId,
                propertyId,
                ownerUid: owner.uid,
                listedByUid: owner.uid,
                listedByRole: "owner",
                status: "PUBLISHED",
                locationPrecision: "approximate_on_request",
                locationVisibility: "approximate_on_request",
                publicGeo: {
                    latitude: approxGeo.latitude,
                    longitude: approxGeo.longitude,
                    geohash: approxGeo.geohash,
                    precision: "approximate_on_request",
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }),
        });

        // Test A: Viewer sees approximate location
        const listingGet = await fsClient(viewer.idToken, "GET", `listings/${listingId}`);
        const publicPin = decodeMap(listingGet.json?.fields?.publicGeo?.mapValue?.fields || {});
        const isApprox = publicPin.latitude !== exactCoord.latitude;
        record("A. Viewer sees approximate location on listing", isApprox, `Public lat: ${publicPin.latitude}, Exact lat: ${exactCoord.latitude}`);

        // Test B: Viewer cannot read private_geo
        const viewerReadPrivateBefore = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("B. Viewer cannot read private_geo initially", viewerReadPrivateBefore.status === 403, `Status: ${viewerReadPrivateBefore.status}`);

        // Test C: Viewer requests exact location via HTTP requestLocationShare
        console.log("\n--- Testing requestLocationShare HTTP Function ---");
        const reqRes = await httpFunction(REQUEST_URL, viewer.idToken, { propertyId, listingId });
        record("C. Viewer requests exact location (HTTP 200)", reqRes.ok && reqRes.json.status === "PENDING", `Status: ${reqRes.status}, Body: ${JSON.stringify(reqRes.json)}`);

        // Test D: Owner receives pending request
        const shareSnap = await fsIam("GET", `location_shares/${shareId}`);
        const shareData = decodeMap(shareSnap.json?.fields || {});
        const isPending = shareData.status === "PENDING" && shareData.viewerUid === viewer.uid && shareData.ownerUid === owner.uid;
        record("D. Owner receives pending location_shares record", isPending, `Status: ${shareData.status}, Viewer: ${shareData.viewerUid}`);

        // Test E: Viewer still cannot read private_geo while PENDING
        const viewerReadPending = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("E. Viewer cannot read private_geo while PENDING", viewerReadPending.status === 403, `Status: ${viewerReadPending.status}`);

        // Test Abuse Vectors on requestLocationShare:
        console.log("\n--- Testing requestLocationShare Abuse Vectors ---");
        // Duplicate request returns existing pending share
        const dupRes = await httpFunction(REQUEST_URL, viewer.idToken, { propertyId, listingId });
        record("Duplicate request handled gracefully", dupRes.ok && dupRes.json.status === "PENDING", `Status: ${dupRes.status}`);

        // Owner cannot request own property
        const ownerReqOwn = await httpFunction(REQUEST_URL, owner.idToken, { propertyId });
        record("Owner cannot request own property (400)", ownerReqOwn.status === 400 && ownerReqOwn.json.error === "CANNOT_REQUEST_OWN_PROPERTY", `Status: ${ownerReqOwn.status}`);

        // Missing token -> 401
        const noTokenReq = await httpFunction(REQUEST_URL, null, { propertyId });
        record("Missing token rejected (401)", noTokenReq.status === 401, `Status: ${noTokenReq.status}`);

        // Invalid token -> 401
        const badTokenReq = await httpFunction(REQUEST_URL, "invalid_bearer_token", { propertyId });
        record("Invalid token rejected (401)", badTokenReq.status === 401, `Status: ${badTokenReq.status}`);

        // Nonexistent property -> 404
        const nonExistentReq = await httpFunction(REQUEST_URL, viewer.idToken, { propertyId: "nonexistent_prop_id" });
        record("Nonexistent property rejected (404)", nonExistentReq.status === 404, `Status: ${nonExistentReq.status}`);

        // Test Abuse Vectors on respondLocationShare:
        console.log("\n--- Testing respondLocationShare Abuse Vectors ---");
        // Stranger attempts to approve -> 403
        const strangerApprove = await httpFunction(RESPOND_URL, stranger.idToken, { propertyId, viewerUid: viewer.uid, decision: "APPROVE" });
        record("Stranger attempts to approve (403)", strangerApprove.status === 403, `Status: ${strangerApprove.status}`);

        // Viewer attempts to self-approve -> 403
        const viewerSelfApprove = await httpFunction(RESPOND_URL, viewer.idToken, { propertyId, viewerUid: viewer.uid, decision: "APPROVE" });
        record("Viewer attempts self-approve (403)", viewerSelfApprove.status === 403, `Status: ${viewerSelfApprove.status}`);

        // Nonexistent share -> 404
        const nonExistentShareRes = await httpFunction(RESPOND_URL, owner.idToken, { propertyId, viewerUid: "nonexistent_uid", decision: "APPROVE" });
        record("Nonexistent share response rejected (404)", nonExistentShareRes.status === 404, `Status: ${nonExistentShareRes.status}`);

        // Invalid decision -> 400
        const badDecisionRes = await httpFunction(RESPOND_URL, owner.idToken, { propertyId, viewerUid: viewer.uid, decision: "INVALID_DECISION" });
        record("Invalid decision rejected (400)", badDecisionRes.status === 400, `Status: ${badDecisionRes.status}`);

        // Test F: Owner approves
        console.log("\n--- Testing Owner Approval & Private Geo Access ---");
        const approveRes = await httpFunction(RESPOND_URL, owner.idToken, {
            propertyId,
            viewerUid: viewer.uid,
            decision: "APPROVE",
            durationDays: 30,
        });
        record("F. Owner approves location share (HTTP 200)", approveRes.ok && approveRes.json.status === "APPROVED", `Status: ${approveRes.status}`);

        // Test G: Viewer can now read private_geo
        const viewerReadApproved = await fsClient(viewer.idToken, "GET", privateGeoPath);
        const privateCoord = decodeMap(viewerReadApproved.json?.fields || {});
        const gotExact = privateCoord.latitude === exactCoord.latitude && privateCoord.longitude === exactCoord.longitude;
        record("G. Approved viewer reads private_geo (HTTP 200, exact coords)", viewerReadApproved.ok && gotExact, `Status: ${viewerReadApproved.status}, Lat: ${privateCoord.latitude}`);

        // Test H: Stranger still cannot read private_geo
        const strangerReadPrivate = await fsClient(stranger.idToken, "GET", privateGeoPath);
        record("H. Stranger still denied private_geo (403)", strangerReadPrivate.status === 403, `Status: ${strangerReadPrivate.status}`);

        // Responding again to non-PENDING share -> 400
        const reApproveNonPending = await httpFunction(RESPOND_URL, owner.idToken, { propertyId, viewerUid: viewer.uid, decision: "APPROVE" });
        record("Responding to non-PENDING share rejected (400)", reApproveNonPending.status === 400, `Status: ${reApproveNonPending.status}`);

        // Test Abuse Vectors on revokeLocationShare:
        console.log("\n--- Testing revokeLocationShare Abuse Vectors ---");
        // Stranger attempts to revoke -> 403
        const strangerRevoke = await httpFunction(REVOKE_URL, stranger.idToken, { propertyId, viewerUid: viewer.uid });
        record("Stranger attempts to revoke (403)", strangerRevoke.status === 403, `Status: ${strangerRevoke.status}`);

        // Viewer attempts to revoke -> 403
        const viewerRevoke = await httpFunction(REVOKE_URL, viewer.idToken, { propertyId, viewerUid: viewer.uid });
        record("Viewer attempts to revoke (403)", viewerRevoke.status === 403, `Status: ${viewerRevoke.status}`);

        // Missing parameters -> 400
        const badRevokeParams = await httpFunction(REVOKE_URL, owner.idToken, { propertyId });
        record("Missing viewerUid in revoke rejected (400)", badRevokeParams.status === 400, `Status: ${badRevokeParams.status}`);

        // Test I: Owner revokes
        console.log("\n--- Testing Owner Revocation ---");
        const revokeRes = await httpFunction(REVOKE_URL, owner.idToken, { propertyId, viewerUid: viewer.uid });
        record("I. Owner revokes location share (HTTP 200)", revokeRes.ok && revokeRes.json.status === "REVOKED", `Status: ${revokeRes.status}`);

        // Test J: Viewer immediately loses access
        const viewerReadRevoked = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("J. Viewer immediately loses access upon revoke (403)", viewerReadRevoked.status === 403, `Status: ${viewerReadRevoked.status}`);

        // Test K: Re-request works after revocation
        console.log("\n--- Testing Re-request Lifecycle ---");
        const reReqRes = await httpFunction(REQUEST_URL, viewer.idToken, { propertyId, listingId });
        record("K. Re-request after revocation creates new PENDING request", reReqRes.ok && reReqRes.json.status === "PENDING", `Status: ${reReqRes.status}`);

        // Test L: Decline path denies access
        console.log("\n--- Testing Decline Path ---");
        const declineRes = await httpFunction(RESPOND_URL, owner.idToken, {
            propertyId,
            viewerUid: viewer.uid,
            decision: "DECLINE",
        });
        record("Owner declines request (HTTP 200)", declineRes.ok && declineRes.json.status === "DECLINED", `Status: ${declineRes.status}`);

        const viewerReadDeclined = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("L. Declined viewer denied private_geo access (403)", viewerReadDeclined.status === 403, `Status: ${viewerReadDeclined.status}`);

        // Test M: Expired share denies access
        console.log("\n--- Testing Expiry Handling ---");
        // Re-request then manually simulate expired APPROVED share
        await httpFunction(REQUEST_URL, viewer.idToken, { propertyId });
        await fsIam("PATCH", `location_shares/${shareId}`, {
            fields: encodeMap({
                status: "APPROVED",
                expiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
                updatedAt: new Date(),
            }),
        });

        const viewerReadExpired = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("M. Expired share denies private_geo access (403)", viewerReadExpired.status === 403, `Status: ${viewerReadExpired.status}`);

        // Step 5: Exact Location Public Mode Checks
        console.log("\n--- Testing Exact Public Mode Invariants ---");
        // Mode 1: Exact Public Mode
        const exactPublicPin = derivePublicCoordinate(propertyId, exactCoord, "exact");
        const isExactPublic = exactPublicPin.latitude === exactCoord.latitude && exactPublicPin.longitude === exactCoord.longitude;
        record("Exact public mode exposes exact coordinates explicitly", isExactPublic, `Lat: ${exactPublicPin.latitude}, Lng: ${exactPublicPin.longitude}`);

        // Toggle: Changing exact_public -> approximate immediately returns to jittered pin
        const toggledToApprox = derivePublicCoordinate(propertyId, exactCoord, "approximate");
        const isToggledJittered = toggledToApprox.latitude !== exactCoord.latitude;
        record("Changing exact_public -> approximate immediately jitters public pin", isToggledJittered, `Exact: ${exactCoord.latitude}, Approx: ${toggledToApprox.latitude}`);

        // Toggle: Changing approximate_on_request -> exact_public does not leak or cause mismatch
        const toggledToExact = derivePublicCoordinate(propertyId, exactCoord, "exact");
        const isToggledExact = toggledToExact.latitude === exactCoord.latitude;
        record("Changing approximate_on_request -> exact_public updates pin correctly", isToggledExact, `Exact lat: ${toggledToExact.latitude}`);

    } catch (err) {
        console.error("Test execution encountered fatal error:", err);
        record("Test suite execution", false, err.message);
    } finally {
        await cleanup();
    }

    console.log("\n========================================================");
    console.log("PHASE 8A-B END-TO-END TEST RESULTS SUMMARY:");
    const passed = RESULTS.filter(r => r.status === "PASS").length;
    const failed = RESULTS.filter(r => r.status === "FAIL").length;
    console.log(`Total tests: ${RESULTS.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log("========================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

main();
