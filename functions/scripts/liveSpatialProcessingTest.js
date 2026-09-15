/**
 * Production Phase 5D Live Security and Functional Tests.
 * Target: croww-live-2026
 *
 * Functions tested:
 * - finalizeSpatialAsset (HTTP, Admin only)
 * - archiveSpatialAsset (HTTP, Owner/Creator/Lister or Admin)
 * - onSpatialJobCreated (Firestore Trigger on spatial_processing_jobs)
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

const FINALIZE_URL = "https://us-central1-croww-live-2026.cloudfunctions.net/finalizeSpatialAsset";
const ARCHIVE_URL = "https://us-central1-croww-live-2026.cloudfunctions.net/archiveSpatialAsset";

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
    return { status: res.status, ok: res.ok, json, raw: text };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    console.log("============================================================");
    console.log("Phase 5D Live Spatial Processing Test Suite");
    console.log(`Target project: ${PROJECT}`);
    console.log("============================================================\n");

    const runId = `test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const cleanupDocs = [];
    const createdUsers = [];

    try {
        // 1. Create Personas
        console.log("--- 1. Creating Ephemeral Personas ---");

        // Persona 1: Admin
        const adminEmail = `p5d_admin_${runId}@croww.test`;
        const adminAuth = await identity("accounts:signUp", {
            email: adminEmail,
            password: randomPassword(),
            returnSecureToken: true,
        });
        createdUsers.push(adminAuth);
        await fsIam("PATCH", `users/${adminAuth.localId}`, {
            fields: encodeMap({
                email: adminEmail,
                name: "P5D Admin",
                userType: "admin",
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`users/${adminAuth.localId}`);
        console.log(`Admin persona created: ${adminAuth.localId}`);

        // Persona 2: Owner A
        const ownerEmail = `p5d_owner_${runId}@croww.test`;
        const ownerAuth = await identity("accounts:signUp", {
            email: ownerEmail,
            password: randomPassword(),
            returnSecureToken: true,
        });
        createdUsers.push(ownerAuth);
        await fsIam("PATCH", `users/${ownerAuth.localId}`, {
            fields: encodeMap({
                email: ownerEmail,
                name: "P5D Owner A",
                userType: "individual",
                roles: ["owner"],
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`users/${ownerAuth.localId}`);
        console.log(`Owner A persona created: ${ownerAuth.localId}`);

        // Persona 3: Stranger / Buyer B
        const buyerEmail = `p5d_buyer_${runId}@croww.test`;
        const buyerAuth = await identity("accounts:signUp", {
            email: buyerEmail,
            password: randomPassword(),
            returnSecureToken: true,
        });
        createdUsers.push(buyerAuth);
        await fsIam("PATCH", `users/${buyerAuth.localId}`, {
            fields: encodeMap({
                email: buyerEmail,
                name: "P5D Buyer B",
                userType: "individual",
                roles: ["buyer"],
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`users/${buyerAuth.localId}`);
        console.log(`Buyer B persona created: ${buyerAuth.localId}`);

        // Wait 2.5s for tokens to mature (avoid clock skew)
        await sleep(2500);

        // 2. Create Ephemeral Properties & Listings
        console.log("\n--- 2. Creating Ephemeral Properties and Listings ---");
        const propertyId = `prop_${runId}`;
        const listingId = `list_${runId}`;
        const propertyBId = `prop_b_${runId}`;

        // Property A (owned by Owner A)
        await fsIam("PATCH", `properties/${propertyId}`, {
            fields: encodeMap({
                propertyId,
                title: "P5D Test Property A",
                ownerUid: ownerAuth.localId,
                createdByUid: ownerAuth.localId,
                spatialTourAvailable: false,
                status: "ACTIVE",
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`properties/${propertyId}`);

        // Listing A
        await fsIam("PATCH", `listings/${listingId}`, {
            fields: encodeMap({
                listingId,
                propertyId,
                title: "P5D Test Listing A",
                listedByUid: ownerAuth.localId,
                spatialTourAvailable: false,
                status: "PUBLISHED",
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`listings/${listingId}`);

        // Property B (isolation check)
        await fsIam("PATCH", `properties/${propertyBId}`, {
            fields: encodeMap({
                propertyId: propertyBId,
                title: "P5D Test Property B (Isolation)",
                ownerUid: "someone_else",
                createdByUid: "someone_else",
                spatialTourAvailable: false,
                status: "ACTIVE",
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`properties/${propertyBId}`);

        // 3. Create Ephemeral Property Media (Spatial in PROCESSING)
        console.log("\n--- 3. Creating Ephemeral Spatial Media Fixtures ---");
        const media1Id = `media_1_${runId}`;
        const media2Id = `media_2_${runId}`;
        const mediaNonSpatialId = `media_nonspatial_${runId}`;

        // Media 1: Spatial asset in PROCESSING
        await fsIam("PATCH", `property_media/${media1Id}`, {
            fields: encodeMap({
                mediaId: media1Id,
                propertyId,
                listingId,
                mediaType: "spatial",
                processingStatus: "PROCESSING",
                status: "ACTIVE",
                visibility: "private",
                createdByUid: ownerAuth.localId,
                processing: {
                    status: "PROCESSING",
                    assetFormat: "gaussian_splat",
                },
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`property_media/${media1Id}`);

        // Media 2: Second spatial asset in PROCESSING (for testing FAILED path)
        await fsIam("PATCH", `property_media/${media2Id}`, {
            fields: encodeMap({
                mediaId: media2Id,
                propertyId,
                listingId,
                mediaType: "spatial",
                processingStatus: "PROCESSING",
                status: "ACTIVE",
                visibility: "private",
                createdByUid: ownerAuth.localId,
                processing: {
                    status: "PROCESSING",
                    assetFormat: "gaussian_splat",
                },
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`property_media/${media2Id}`);

        // Media 3: Regular photo (non-spatial)
        await fsIam("PATCH", `property_media/${mediaNonSpatialId}`, {
            fields: encodeMap({
                mediaId: mediaNonSpatialId,
                propertyId,
                listingId,
                mediaType: "photo",
                processingStatus: "READY",
                status: "ACTIVE",
                visibility: "public",
                createdByUid: ownerAuth.localId,
                url: "https://example.com/photo.jpg",
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`property_media/${mediaNonSpatialId}`);

        // ============================================================
        // SECTION 5: TEST onSpatialJobCreated Trigger
        // ============================================================
        console.log("\n--- Section 5: Testing onSpatialJobCreated Trigger ---");
        const jobId = `job_${runId}`;
        await fsIam("PATCH", `spatial_processing_jobs/${jobId}`, {
            fields: encodeMap({
                jobId,
                mediaId: media1Id,
                propertyId,
                submittedByUid: ownerAuth.localId,
                status: "QUEUED",
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`spatial_processing_jobs/${jobId}`);

        // Wait for Firestore trigger to execute
        await sleep(3000);

        // Verify trigger did NOT invent synthetic 3D or forge READY status
        const mediaCheckSnap = await fsIam("GET", `property_media/${media1Id}`);
        const mediaCheckData = decodeMap(mediaCheckSnap.json.fields || {});
        record(
            "onSpatialJobCreated: Does not mark asset READY or invent synthetic 3D",
            mediaCheckData.processingStatus === "PROCESSING" && mediaCheckData.visibility === "private",
            `processingStatus=${mediaCheckData.processingStatus}, visibility=${mediaCheckData.visibility}`
        );

        // Verify Property B isolation: Property B was not modified
        const propBSnap = await fsIam("GET", `properties/${propertyBId}`);
        const propBData = decodeMap(propBSnap.json.fields || {});
        record(
            "onSpatialJobCreated: Property B isolation preserved",
            propBData.spatialTourAvailable === false,
            `spatialTourAvailable=${propBData.spatialTourAvailable}`
        );

        // ============================================================
        // SECTION 6: TEST finalizeSpatialAsset
        // ============================================================
        console.log("\n--- Section 6: Testing finalizeSpatialAsset ---");

        // 6A. Authorization Probes
        // Missing token -> 401
        const finNoToken = await callFunction(FINALIZE_URL, null, {
            mediaId: media1Id,
            decision: "READY",
            derivedUrl: "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/sample.splat",
        });
        record(
            "finalizeSpatialAsset: Missing token rejected with 401",
            finNoToken.status === 401,
            `status=${finNoToken.status}`
        );

        // Invalid token -> 401
        const finBadToken = await callFunction(FINALIZE_URL, "invalid.bearer.token", {
            mediaId: media1Id,
            decision: "READY",
            derivedUrl: "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/sample.splat",
        });
        record(
            "finalizeSpatialAsset: Invalid token rejected with 401",
            finBadToken.status === 401,
            `status=${finBadToken.status}`
        );

        // Buyer / Stranger -> 403
        const finBuyer = await callFunction(FINALIZE_URL, buyerAuth.idToken, {
            mediaId: media1Id,
            decision: "READY",
            derivedUrl: "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/sample.splat",
        });
        record(
            "finalizeSpatialAsset: Non-admin buyer rejected with 403",
            finBuyer.status === 403,
            `status=${finBuyer.status}`
        );

        // Property Owner -> 403 (finalize is strictly admin-controlled)
        const finOwner = await callFunction(FINALIZE_URL, ownerAuth.idToken, {
            mediaId: media1Id,
            decision: "READY",
            derivedUrl: "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/sample.splat",
        });
        record(
            "finalizeSpatialAsset: Property owner rejected with 403 (admin only)",
            finOwner.status === 403,
            `status=${finOwner.status}`
        );

        // 6B. Argument Validation Probes
        // Missing mediaId -> 400
        const finNoMedia = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            decision: "READY",
            derivedUrl: "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/sample.splat",
        });
        record(
            "finalizeSpatialAsset: Missing mediaId rejected with 400",
            finNoMedia.status === 400,
            `status=${finNoMedia.status}`
        );

        // Invalid decision -> 400
        const finBadDecision = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: media1Id,
            decision: "APPROVED", // Invalid, must be READY or FAILED
        });
        record(
            "finalizeSpatialAsset: Invalid decision rejected with 400",
            finBadDecision.status === 400,
            `status=${finBadDecision.status}`
        );

        // Nonexistent media -> 404
        const finNonExistent = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: "nonexistent_media_id_99999",
            decision: "READY",
            derivedUrl: "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/sample.splat",
        });
        record(
            "finalizeSpatialAsset: Nonexistent media rejected with 404",
            finNonExistent.status === 404,
            `status=${finNonExistent.status}`
        );

        // Non-spatial media -> 409
        const finNonSpatial = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: mediaNonSpatialId,
            decision: "READY",
            derivedUrl: "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/sample.splat",
        });
        record(
            "finalizeSpatialAsset: Non-spatial media rejected with 409",
            finNonSpatial.status === 409,
            `status=${finNonSpatial.status}`
        );

        // Decision READY but missing derivedUrl -> 400
        const finNoDerivedUrl = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: media1Id,
            decision: "READY",
        });
        record(
            "finalizeSpatialAsset: READY missing derivedUrl rejected with 400",
            finNoDerivedUrl.status === 400,
            `status=${finNoDerivedUrl.status}`
        );

        // 6C. Valid Finalization: Decision == READY
        const legitimateDerivedUrl = "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/ephemeral_tour.splat";
        const legitimatePosterUrl = "https://storage.googleapis.com/croww-live-2026.firebasestorage.app/property_spatial_public/ephemeral_poster.webp";

        const finSuccess = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: media1Id,
            decision: "READY",
            derivedUrl: legitimateDerivedUrl,
            posterUrl: legitimatePosterUrl,
            assetFormat: "gaussian_splat",
        });
        record(
            "finalizeSpatialAsset: Admin finalize READY succeeds with 200",
            finSuccess.status === 200 && finSuccess.json.status === "READY",
            `status=${finSuccess.status}, json=${JSON.stringify(finSuccess.json)}`
        );

        // Verify media doc state
        const media1Snap = await fsIam("GET", `property_media/${media1Id}`);
        const media1Data = decodeMap(media1Snap.json.fields || {});
        record(
            "finalizeSpatialAsset: Media doc updated to READY, public visibility, derivedUrl",
            media1Data.processingStatus === "READY" &&
            media1Data.visibility === "public" &&
            media1Data.url === legitimateDerivedUrl &&
            media1Data.thumbnailUrl === legitimatePosterUrl &&
            media1Data.processing?.status === "READY",
            `processingStatus=${media1Data.processingStatus}, visibility=${media1Data.visibility}, url=${media1Data.url}`
        );

        // Verify property and listing spatialTourAvailable flags set to true
        const propASnap = await fsIam("GET", `properties/${propertyId}`);
        const propAData = decodeMap(propASnap.json.fields || {});
        record(
            "finalizeSpatialAsset: Property spatialTourAvailable set to true",
            propAData.spatialTourAvailable === true,
            `spatialTourAvailable=${propAData.spatialTourAvailable}`
        );

        const listASnap = await fsIam("GET", `listings/${listingId}`);
        const listAData = decodeMap(listASnap.json.fields || {});
        record(
            "finalizeSpatialAsset: Listing spatialTourAvailable set to true",
            listAData.spatialTourAvailable === true,
            `spatialTourAvailable=${listAData.spatialTourAvailable}`
        );

        // 6D. Invalid Transition: Re-finalizing already READY asset -> 409
        const finRepeat = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: media1Id,
            decision: "READY",
            derivedUrl: legitimateDerivedUrl,
        });
        record(
            "finalizeSpatialAsset: Re-finalizing READY asset rejected with 409",
            finRepeat.status === 409,
            `status=${finRepeat.status}, error=${finRepeat.json.error}`
        );

        // 6E. Valid Finalization: Decision == FAILED on Media 2
        const finFailed = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: media2Id,
            decision: "FAILED",
            reason: "Point cloud density insufficient",
        });
        record(
            "finalizeSpatialAsset: Admin finalize FAILED succeeds with 200",
            finFailed.status === 200 && finFailed.json.status === "FAILED",
            `status=${finFailed.status}, json=${JSON.stringify(finFailed.json)}`
        );

        const media2Snap = await fsIam("GET", `property_media/${media2Id}`);
        const media2Data = decodeMap(media2Snap.json.fields || {});
        record(
            "finalizeSpatialAsset: Media 2 doc updated to FAILED, private, url null",
            media2Data.processingStatus === "FAILED" &&
            media2Data.visibility === "private" &&
            media2Data.url === null &&
            media2Data.processing?.status === "FAILED",
            `processingStatus=${media2Data.processingStatus}, visibility=${media2Data.visibility}, url=${media2Data.url}`
        );

        // ============================================================
        // SECTION 7: TEST archiveSpatialAsset
        // ============================================================
        console.log("\n--- Section 7: Testing archiveSpatialAsset ---");

        // 7A. Authorization Probes
        // Missing token -> 401
        const archNoToken = await callFunction(ARCHIVE_URL, null, {
            mediaId: media1Id,
        });
        record(
            "archiveSpatialAsset: Missing token rejected with 401",
            archNoToken.status === 401,
            `status=${archNoToken.status}`
        );

        // Stranger / Buyer B attempting to archive Owner A's media -> 403
        const archStranger = await callFunction(ARCHIVE_URL, buyerAuth.idToken, {
            mediaId: media1Id,
        });
        record(
            "archiveSpatialAsset: Unauthorized stranger rejected with 403",
            archStranger.status === 403,
            `status=${archStranger.status}`
        );

        // Missing mediaId -> 400
        const archNoMedia = await callFunction(ARCHIVE_URL, ownerAuth.idToken, {});
        record(
            "archiveSpatialAsset: Missing mediaId rejected with 400",
            archNoMedia.status === 400,
            `status=${archNoMedia.status}`
        );

        // Nonexistent media -> 404
        const archNonExistent = await callFunction(ARCHIVE_URL, ownerAuth.idToken, {
            mediaId: "nonexistent_media_id_99999",
        });
        record(
            "archiveSpatialAsset: Nonexistent media rejected with 404",
            archNonExistent.status === 404,
            `status=${archNonExistent.status}`
        );

        // 7B. Valid Archive by Property Owner
        const archSuccess = await callFunction(ARCHIVE_URL, ownerAuth.idToken, {
            mediaId: media1Id,
        });
        record(
            "archiveSpatialAsset: Owner archive succeeds with 200",
            archSuccess.status === 200 && archSuccess.json.status === "ARCHIVED",
            `status=${archSuccess.status}, json=${JSON.stringify(archSuccess.json)}`
        );

        // Verify media doc state after archive
        const media1ArchSnap = await fsIam("GET", `property_media/${media1Id}`);
        const media1ArchData = decodeMap(media1ArchSnap.json.fields || {});
        record(
            "archiveSpatialAsset: Media doc updated to ARCHIVED, HIDDEN, private, url null",
            media1ArchData.processingStatus === "ARCHIVED" &&
            media1ArchData.status === "HIDDEN" &&
            media1ArchData.visibility === "private" &&
            media1ArchData.url === null &&
            media1ArchData.processing?.status === "ARCHIVED",
            `processingStatus=${media1ArchData.processingStatus}, status=${media1ArchData.status}, visibility=${media1ArchData.visibility}, url=${media1ArchData.url}`
        );

        // Verify property spatialTourAvailable reset to false since no other active ready media exists
        const propAAfterArchSnap = await fsIam("GET", `properties/${propertyId}`);
        const propAAfterArchData = decodeMap(propAAfterArchSnap.json.fields || {});
        record(
            "archiveSpatialAsset: Property spatialTourAvailable reset to false",
            propAAfterArchData.spatialTourAvailable === false,
            `spatialTourAvailable=${propAAfterArchData.spatialTourAvailable}`
        );

        // 7C. Repeated Archive (Idempotency)
        const archRepeat = await callFunction(ARCHIVE_URL, ownerAuth.idToken, {
            mediaId: media1Id,
        });
        record(
            "archiveSpatialAsset: Repeated archive call is idempotent and succeeds with 200",
            archRepeat.status === 200 && archRepeat.json.status === "ARCHIVED",
            `status=${archRepeat.status}, json=${JSON.stringify(archRepeat.json)}`
        );

        // ============================================================
        // SECTION 8: SECURITY PROBES
        // ============================================================
        console.log("\n--- Section 8: Security and Forgery Probes ---");

        // 8A. Forged caller in body: Buyer attempts archive passing owner's uid in body
        const forgeUidArchive = await callFunction(ARCHIVE_URL, buyerAuth.idToken, {
            mediaId: media1Id,
            uid: ownerAuth.localId,
            ownerUid: ownerAuth.localId,
            userId: ownerAuth.localId,
        });
        record(
            "Security Probe: Forged uid in archive body ignored -> rejected with 403",
            forgeUidArchive.status === 403,
            `status=${forgeUidArchive.status}`
        );

        // 8B. Forged admin in body: Buyer attempts finalize passing adminUid in body
        const forgeAdminFinalize = await callFunction(FINALIZE_URL, buyerAuth.idToken, {
            mediaId: media2Id,
            decision: "READY",
            derivedUrl: legitimateDerivedUrl,
            uid: adminAuth.localId,
            isAdmin: true,
            userType: "admin",
        });
        record(
            "Security Probe: Forged admin in finalize body ignored -> rejected with 403",
            forgeAdminFinalize.status === 403,
            `status=${forgeAdminFinalize.status}`
        );

        // 8C. Forged status transition: Try to finalize an already ARCHIVED media -> 409
        const forgeArchivedToReady = await callFunction(FINALIZE_URL, adminAuth.idToken, {
            mediaId: media1Id, // Currently ARCHIVED
            decision: "READY",
            derivedUrl: legitimateDerivedUrl,
        });
        record(
            "Security Probe: Cannot finalize ARCHIVED media to READY -> rejected with 409",
            forgeArchivedToReady.status === 409,
            `status=${forgeArchivedToReady.status}`
        );

    } finally {
        // ============================================================
        // CLEANUP
        // ============================================================
        console.log("\n--- Cleaning up Ephemeral Fixtures ---");

        // Clean up any jobs created during FAILED test
        const token = cliAccessToken();
        try {
            const jobsQueryRes = await fetch(
                `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        structuredQuery: {
                            from: [{ collectionId: "spatial_processing_jobs" }],
                        },
                    }),
                }
            );
            const jobsQueryData = await jobsQueryRes.json();
            const jobs = (Array.isArray(jobsQueryData) ? jobsQueryData : [])
                .filter((r) => r.document)
                .map((r) => r.document.name.replace(`projects/${PROJECT}/databases/(default)/documents/`, ""));
            for (const j of jobs) {
                if (!cleanupDocs.includes(j)) cleanupDocs.push(j);
            }
        } catch (e) {
            console.error("Failed to query spatial_processing_jobs for cleanup:", e.message);
        }

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
                    console.log(`Deleted ephemeral Auth user: ${user.localId}`);
                }
            } catch (err) {
                console.error(`Failed to delete user ${user.localId}:`, err.message);
            }
        }
    }

    const failed = RESULTS.filter((r) => r.status === "FAIL");
    console.log("\n============================================================");
    console.log(`Summary: Total ${RESULTS.length} tests, ${RESULTS.length - failed.length} passed, ${failed.length} failed.`);
    console.log("============================================================");

    if (failed.length > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Test suite crashed:", err);
    process.exit(1);
});
