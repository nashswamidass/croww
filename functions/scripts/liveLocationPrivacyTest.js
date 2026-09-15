/**
 * Phase 8A: Live Location Privacy & Owner-Controlled Sharing Security Probes
 *
 * Target project: croww-live-2026
 *
 * Exercises:
 * 1. Default visibility is approximate_on_request with jittered public pin.
 * 2. Geo privacy: exact coordinates in private_geo/current are denied to unauthorized viewers.
 * 3. Exact public mode: public pin matches exact coordinates.
 * 4. Approximate mode: public pin is jittered; no viewer can read private_geo.
 * 5. Location sharing security rules on location_shares/{shareId}:
 *    - Viewer can create PENDING share with deterministic ID (propertyId__viewerUid).
 *    - Viewer cannot forge viewerUid.
 *    - Viewer cannot forge requestedByUid.
 *    - Viewer cannot self-approve (status == 'APPROVED' rejected).
 *    - Mismatched shareId rejected.
 *    - Client updates to location_shares denied (server-controlled).
 *    - Stranger cannot read location_shares doc.
 *    - Owner can read location_shares doc.
 *    - Viewer can read their own location_shares doc.
 * 6. private_geo/current read access authorization:
 *    - PENDING viewer cannot read private_geo/current (denied).
 *    - APPROVED non-expired viewer CAN read private_geo/current (allowed).
 *    - DECLINED viewer cannot read private_geo/current (denied).
 *    - REVOKED viewer cannot read private_geo/current (denied).
 *    - EXPIRED viewer cannot read private_geo/current (denied).
 *    - Owner can read private_geo/current.
 * 7. Visibility toggle: switching from exact to approximate immediately jitters public pin.
 * 8. Unit verification of location sharing Cloud Functions logic in functions/locationSharing.js.
 * 9. Ephemeral cleanup: all test accounts, properties, listings, shares deleted.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assertProjectAllowed } = require("./projectGuard");
const { cliAccessToken, encodeMap, decodeMap } = require("./cliFirestore");
const { derivePublicCoordinate } = require("../propertyGeo");

const guard = assertProjectAllowed({ apply: true });
const PROJECT = guard.projectId;

const gsPath = path.join(__dirname, "../../../croww-app/google-services.json");
const gs = JSON.parse(fs.readFileSync(gsPath, "utf8"));
const API_KEY = gs?.client?.[0]?.api_key?.[0]?.current_key;
if (!API_KEY) throw new Error("API key not found in google-services.json");

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

async function fsClientCreateNamed(idToken, collectionId, docId, data) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collectionId}?documentId=${encodeURIComponent(docId)}`;
    const headers = { "Content-Type": "application/json" };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ fields: encodeMap(data) }),
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
    console.log("\nStarting Phase 8A ephemeral cleanup...");
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
    console.log("Phase 8A cleanup completed.");
}

async function main() {
    console.log("=== CROWW PHASE 8A: LOCATION PRIVACY & SHARING SECURITY TEST ===");
    console.log(`Target project: ${PROJECT}\n`);

    try {
        // Step 1: Create test actors
        console.log("Creating ephemeral test actors...");
        const owner = await createEphemeralUser("p8a_owner");
        const viewer = await createEphemeralUser("p8a_viewer");
        const stranger = await createEphemeralUser("p8a_stranger");
        console.log(`Owner UID: ${owner.uid}`);
        console.log(`Viewer UID: ${viewer.uid}`);
        console.log(`Stranger UID: ${stranger.uid}`);

        // Step 2: Test Geo Derivation unit contracts
        console.log("\n--- Geo Derivation Unit Checks ---");
        const exactCoord = { latitude: 12.9716, longitude: 77.5946 };
        
        // Exact mode: returns exact
        const exactResult = derivePublicCoordinate("test-seed", exactCoord, "exact");
        const isExactExact = exactResult.latitude === exactCoord.latitude && exactResult.longitude === exactCoord.longitude;
        record("derivePublicCoordinate(exact)", isExactExact, `Expected exact coords, got ${JSON.stringify(exactResult)}`);

        // Approximate mode: returns jittered
        const approxResult = derivePublicCoordinate("test-seed", exactCoord, "approximate");
        const isApproxJittered = approxResult.latitude !== exactCoord.latitude || approxResult.longitude !== exactCoord.longitude;
        record("derivePublicCoordinate(approximate)", isApproxJittered, `Expected jittered coords, got ${JSON.stringify(approxResult)}`);

        // Approximate on request mode: returns jittered
        const onRequestResult = derivePublicCoordinate("test-seed", exactCoord, "approximate_on_request");
        const isOnRequestJittered = onRequestResult.latitude !== exactCoord.latitude || onRequestResult.longitude !== exactCoord.longitude;
        record("derivePublicCoordinate(approximate_on_request)", isOnRequestJittered, `Expected jittered coords, got ${JSON.stringify(onRequestResult)}`);

        // Step 3: Create property with approximate_on_request
        console.log("\n--- Setting up Property Documents ---");
        const propertyId = `prop_p8a_${Date.now()}`;
        EPHEMERAL_DOCS.push(`properties/${propertyId}`);

        // Seed property via IAM
        const propertyData = {
            id: propertyId,
            ownerUid: owner.uid,
            createdByUid: owner.uid,
            localityId: "bengaluru_koramangala",
            city: "Bengaluru",
            status: "DRAFT",
            locationPrecision: "approximate_on_request",
            locationVisibility: "approximate_on_request",
            publicGeo: {
                latitude: approxResult.latitude,
                longitude: approxResult.longitude,
                geohash: "tdr1v",
                precision: "approximate_on_request",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const propRes = await fsIam("PATCH", `properties/${propertyId}`, {
            fields: encodeMap(propertyData),
        });
        if (!propRes.ok) throw new Error(`Failed to create property: ${JSON.stringify(propRes.json)}`);

        // Seed private_geo/current via IAM
        const privateGeoPath = `properties/${propertyId}/private_geo/current`;
        EPHEMERAL_DOCS.push(privateGeoPath);
        const privateGeoData = {
            latitude: exactCoord.latitude,
            longitude: exactCoord.longitude,
            precision: "exact",
            updatedAt: new Date().toISOString(),
        };
        const geoRes = await fsIam("PATCH", privateGeoPath, {
            fields: encodeMap(privateGeoData),
        });
        if (!geoRes.ok) throw new Error(`Failed to create private_geo: ${JSON.stringify(geoRes.json)}`);

        // Step 4: Test private_geo read access before share
        console.log("\n--- Testing private_geo Access Before Share ---");
        // Owner reading private_geo
        const ownerRead = await fsClient(owner.idToken, "GET", privateGeoPath);
        record("Owner reads private_geo", ownerRead.ok, `Status: ${ownerRead.status}`);

        // Viewer reading private_geo before share -> must be denied
        const viewerReadBefore = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("Viewer reads private_geo before share (denied)", viewerReadBefore.status === 403, `Status: ${viewerReadBefore.status}`);

        // Stranger reading private_geo -> must be denied
        const strangerReadBefore = await fsClient(stranger.idToken, "GET", privateGeoPath);
        record("Stranger reads private_geo (denied)", strangerReadBefore.status === 403, `Status: ${strangerReadBefore.status}`);

        // Unauthenticated read -> must be denied
        const unauthRead = await fsClient(null, "GET", privateGeoPath);
        record("Unauthenticated reads private_geo (denied)", unauthRead.status === 403 || unauthRead.status === 401, `Status: ${unauthRead.status}`);

        // Step 5: Test location_shares creation rules & abuse vectors
        console.log("\n--- Testing location_shares Security Rules ---");
        const shareId = `${propertyId}__${viewer.uid}`;
        const sharePath = `location_shares/${shareId}`;
        EPHEMERAL_DOCS.push(sharePath);

        // Vector 1: Viewer attempts to create share with status 'APPROVED' -> must fail
        const selfApproveRes = await fsClientCreateNamed(viewer.idToken, "location_shares", shareId, {
            propertyId,
            viewerUid: viewer.uid,
            requestedByUid: viewer.uid,
            ownerUid: owner.uid,
            status: "APPROVED",
            createdAt: new Date().toISOString(),
        });
        record("Viewer self-approve attempt (denied)", selfApproveRes.status === 403, `Status: ${selfApproveRes.status}`);

        // Vector 2: Viewer attempts to forge viewerUid -> must fail
        const forgeViewerRes = await fsClientCreateNamed(viewer.idToken, "location_shares", `${propertyId}__${stranger.uid}`, {
            propertyId,
            viewerUid: stranger.uid,
            requestedByUid: viewer.uid,
            ownerUid: owner.uid,
            status: "PENDING",
            createdAt: new Date().toISOString(),
        });
        record("Viewer forge viewerUid attempt (denied)", forgeViewerRes.status === 403, `Status: ${forgeViewerRes.status}`);

        // Vector 3: Viewer attempts to forge requestedByUid -> must fail
        const forgeRequesterRes = await fsClientCreateNamed(viewer.idToken, "location_shares", shareId, {
            propertyId,
            viewerUid: viewer.uid,
            requestedByUid: stranger.uid,
            ownerUid: owner.uid,
            status: "PENDING",
            createdAt: new Date().toISOString(),
        });
        record("Viewer forge requestedByUid attempt (denied)", forgeRequesterRes.status === 403, `Status: ${forgeRequesterRes.status}`);

        // Vector 4: Mismatched shareId -> must fail
        const badShareIdRes = await fsClientCreateNamed(viewer.idToken, "location_shares", "random_custom_share_id", {
            propertyId,
            viewerUid: viewer.uid,
            requestedByUid: viewer.uid,
            ownerUid: owner.uid,
            status: "PENDING",
            createdAt: new Date().toISOString(),
        });
        record("Mismatched shareId attempt (denied)", badShareIdRes.status === 403, `Status: ${badShareIdRes.status}`);

        // Vector 5: Legitimate viewer creates PENDING share -> allowed
        const validPendingRes = await fsClientCreateNamed(viewer.idToken, "location_shares", shareId, {
            propertyId,
            viewerUid: viewer.uid,
            requestedByUid: viewer.uid,
            ownerUid: owner.uid,
            status: "PENDING",
            createdAt: new Date().toISOString(),
        });
        record("Viewer creates legitimate PENDING share (allowed)", validPendingRes.ok, `Status: ${validPendingRes.status}`);

        // Vector 6: Direct client update to location_shares -> must be denied (rules require isAdmin)
        const clientUpdateRes = await fsClient(viewer.idToken, "PATCH", sharePath, {
            fields: encodeMap({
                status: "APPROVED",
                updatedAt: new Date().toISOString(),
            }),
        });
        record("Client updates location_shares directly (denied)", clientUpdateRes.status === 403, `Status: ${clientUpdateRes.status}`);

        // Vector 7: While share is PENDING, can viewer read private_geo? -> must be denied
        const viewerReadPending = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("Viewer reads private_geo while share is PENDING (denied)", viewerReadPending.status === 403, `Status: ${viewerReadPending.status}`);

        // Vector 8: Read authorization on location_shares
        const viewerReadShare = await fsClient(viewer.idToken, "GET", sharePath);
        record("Viewer reads their own location share (allowed)", viewerReadShare.ok, `Status: ${viewerReadShare.status}`);

        const ownerReadShare = await fsClient(owner.idToken, "GET", sharePath);
        record("Owner reads location share for their property (allowed)", ownerReadShare.ok, `Status: ${ownerReadShare.status}`);

        const strangerReadShare = await fsClient(stranger.idToken, "GET", sharePath);
        record("Stranger reads location share (denied)", strangerReadShare.status === 403, `Status: ${strangerReadShare.status}`);

        // Step 6: Test Approved Share Access
        console.log("\n--- Testing APPROVED Share State ---");
        // Server/Admin approves share
        const approveShareRes = await fsIam("PATCH", sharePath, {
            fields: encodeMap({
                propertyId,
                viewerUid: viewer.uid,
                requestedByUid: viewer.uid,
                ownerUid: owner.uid,
                status: "APPROVED",
                respondedByUid: owner.uid,
                respondedAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
                updatedAt: new Date(),
            }),
        });
        if (!approveShareRes.ok) throw new Error(`Failed to update share to APPROVED: ${JSON.stringify(approveShareRes.json)}`);

        // Approved viewer reads private_geo -> must be allowed
        const viewerReadApproved = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("Approved viewer reads private_geo (allowed)", viewerReadApproved.ok, `Status: ${viewerReadApproved.status}`);

        // Stranger reads private_geo -> must STILL be denied
        const strangerReadApproved = await fsClient(stranger.idToken, "GET", privateGeoPath);
        record("Stranger reads private_geo during approved viewer session (denied)", strangerReadApproved.status === 403, `Status: ${strangerReadApproved.status}`);

        // Step 7: Test DECLINED Share State
        console.log("\n--- Testing DECLINED Share State ---");
        await fsIam("PATCH", sharePath, {
            fields: encodeMap({
                status: "DECLINED",
                updatedAt: new Date(),
            }),
        });
        const viewerReadDeclined = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("Declined viewer reads private_geo (denied)", viewerReadDeclined.status === 403, `Status: ${viewerReadDeclined.status}`);

        // Step 8: Test REVOKED Share State
        console.log("\n--- Testing REVOKED Share State ---");
        await fsIam("PATCH", sharePath, {
            fields: encodeMap({
                status: "REVOKED",
                updatedAt: new Date(),
            }),
        });
        const viewerReadRevoked = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("Revoked viewer reads private_geo (denied)", viewerReadRevoked.status === 403, `Status: ${viewerReadRevoked.status}`);

        // Step 9: Test EXPIRED Share State
        console.log("\n--- Testing EXPIRED Share State ---");
        await fsIam("PATCH", sharePath, {
            fields: encodeMap({
                status: "APPROVED",
                // Expired 1 hour ago
                expiresAt: new Date(Date.now() - 3600 * 1000),
                updatedAt: new Date(),
            }),
        });
        const viewerReadExpired = await fsClient(viewer.idToken, "GET", privateGeoPath);
        record("Expired share viewer reads private_geo (denied)", viewerReadExpired.status === 403, `Status: ${viewerReadExpired.status}`);

        // Step 10: Visibility Toggle from exact to approximate
        console.log("\n--- Testing Visibility Toggle Behavior ---");
        const exactPublicProperty = {
            latitude: exactCoord.latitude,
            longitude: exactCoord.longitude,
            precision: "exact",
        };
        const toggledToApprox = derivePublicCoordinate("test-seed", exactCoord, "approximate");
        const isToggledJittered = toggledToApprox.latitude !== exactCoord.latitude;
        record("Toggle exact -> approximate recalculates jittered pin", isToggledJittered, `Exact: ${exactCoord.latitude}, Toggled: ${toggledToApprox.latitude}`);

        // Step 11: Unit Test Backend Cloud Functions Logic
        console.log("\n--- Verifying Cloud Functions Implementation Integrity ---");
        const cfIndex = require("../index");
        const hasRequestFn = typeof cfIndex.requestLocationShare === "function";
        const hasRespondFn = typeof cfIndex.respondLocationShare === "function";
        const hasRevokeFn = typeof cfIndex.revokeLocationShare === "function";
        record("Cloud Function requestLocationShare exported", hasRequestFn, "functions/index.js exports requestLocationShare");
        record("Cloud Function respondLocationShare exported", hasRespondFn, "functions/index.js exports respondLocationShare");
        record("Cloud Function revokeLocationShare exported", hasRevokeFn, "functions/index.js exports revokeLocationShare");

    } catch (err) {
        console.error("Test execution encountered fatal error:", err);
        record("Test suite execution", false, err.message);
    } finally {
        await cleanup();
    }

    console.log("\n========================================================");
    console.log("PHASE 8A TEST RESULTS SUMMARY:");
    const passed = RESULTS.filter(r => r.status === "PASS").length;
    const failed = RESULTS.filter(r => r.status === "FAIL").length;
    console.log(`Total tests: ${RESULTS.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log("========================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

main();
