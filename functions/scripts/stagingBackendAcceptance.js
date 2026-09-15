/**
 * Staging-only live backend acceptance against deployed Functions.
 * Publication must go through publishListing (admin token). No IAM fake PUBLISHED.
 *
 *   node scripts/stagingBackendAcceptance.js --project croww-staging-2026
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { assertStagingOnly } = require("./projectGuard");
const { buildPublicGeoFields } = require("../propertyGeo");
const { encodeMap, getDoc, patchDoc, queryWhere } = require("./cliFirestore");

const PROJECT = "croww-staging-2026";
const REGION = "us-central1";
const API_KEY = "AIzaSyCmKosmKf0qhQMAPdzwAAVcEyWBe82h6Ok";
const STATE_PATH = path.join(__dirname, ".staging-smoke-state.json");
const EXACT = { latitude: 12.9698123, longitude: 77.7499456 };
const LOCALITY_ID = "staging-smoke-whitefield";
const FN_BASE = `https://${REGION}-${PROJECT}.cloudfunctions.net`;
const RESULTS = [];

function record(flow, result, notes) {
    RESULTS.push({ flow, result, notes });
    console.log(`[${result}] ${flow} — ${notes}`);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function identitySignIn(email, password) {
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
    );
    const json = await response.json();
    if (!json.idToken) throw new Error(json.error?.message || `sign-in failed for ${email}`);
    return { uid: json.localId, idToken: json.idToken, email };
}

async function firestoreWithToken(token, method, urlPath, body) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/${urlPath}`;
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_error) {
        json = { raw: text.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, json };
}

async function clientPatch(idToken, docPath, data) {
    const mask = Object.keys(data).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
    return firestoreWithToken(idToken, "PATCH", `documents/${docPath}?${mask}`, { fields: encodeMap(data) });
}

async function clientGet(idToken, docPath) {
    return firestoreWithToken(idToken, "GET", `documents/${docPath}`);
}

async function callFn(name, { token, body } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${FN_BASE}/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body || {}),
    });
    const text = await response.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_error) {
        json = { raw: text.slice(0, 240) };
    }
    return { ok: response.ok, status: response.status, json };
}

function unverified() {
    const slice = { status: "NOT_VERIFIED", verifiedAt: null, expiresAt: null, updatedAt: new Date() };
    return { identity: { ...slice }, ownership: { ...slice }, property: { ...slice }, location: { ...slice } };
}

async function createProperty(persona) {
    const propertyId = `stg_${crypto.randomBytes(6).toString("hex")}`;
    const publicGeo = buildPublicGeoFields(
        propertyId,
        EXACT.latitude,
        EXACT.longitude,
        "approximate",
        { latitude: EXACT.latitude, longitude: EXACT.longitude }
    );
    const payload = {
        category: "residential",
        subtype: "apartment",
        status: "ACTIVE",
        address: { line1: "Staging backend tower", line2: null, city: "Bengaluru", state: "Karnataka", pincode: null, country: "IN" },
        addressNormalized: "staging backend tower bengaluru karnataka in",
        localityId: LOCALITY_ID,
        city: "Bengaluru",
        state: "Karnataka",
        country: "IN",
        latitude: publicGeo.latitude,
        longitude: publicGeo.longitude,
        geohash: publicGeo.geohash,
        geo: { latitude: publicGeo.latitude, longitude: publicGeo.longitude },
        locationPrecision: "approximate",
        bedrooms: 2,
        bathrooms: 2,
        builtUpAreaSqft: 1100,
        carpetAreaSqft: 900,
        plotAreaSqft: null,
        floor: 5,
        totalFloors: 12,
        furnishing: "semi",
        parking: 1,
        constructionYear: 2018,
        amenities: [],
        description: "Synthetic staging backend-acceptance apartment. Not a real listing.",
        projectName: "Croww Staging Backend",
        possessionStatus: "ready",
        createdByUid: persona.uid,
        ownerUid: persona.uid,
        updatedByUid: persona.uid,
        source: {
            type: "owner",
            channel: "USER_CREATED",
            uid: persona.uid,
            importedAt: new Date(),
            authoritative: false,
            externalId: null,
        },
        verification: unverified(),
        createdAt: new Date(),
        updatedAt: new Date(),
        spatialTourAvailable: false,
        smokeTest: true,
    };
    const created = await clientPatch(persona.idToken, `properties/${propertyId}`, payload);
    let privateGeo = { ok: false, status: 0 };
    if (created.ok) {
        privateGeo = await clientPatch(persona.idToken, `properties/${propertyId}/private_geo/current`, {
            latitude: EXACT.latitude,
            longitude: EXACT.longitude,
            geohash: buildPublicGeoFields(propertyId, EXACT.latitude, EXACT.longitude, "exact").geohash,
            geo: { latitude: EXACT.latitude, longitude: EXACT.longitude },
            addressLine1: "12 Staging Lane, exact private address",
            pincode: "560066",
            updatedAt: new Date(),
            updatedByUid: persona.uid,
        });
    }
    return { propertyId, created, privateGeo, publicGeo, payload };
}

async function createListing(persona, propertyId, propertyPayload, opts) {
    const listingId = `stgL_${crypto.randomBytes(6).toString("hex")}`;
    const payload = {
        propertyId,
        transactionType: opts.transactionType,
        status: "DRAFT",
        listedByUid: persona.uid,
        listedByRole: opts.listedByRole,
        createdByUid: persona.uid,
        updatedByUid: persona.uid,
        title: opts.title,
        description: "Synthetic staging backend listing.",
        askingPrice: opts.transactionType === "buy" ? opts.askingPrice : null,
        rentMonthly: opts.transactionType === "rent" ? opts.rentMonthly : null,
        deposit: opts.deposit ?? null,
        maintenanceMonthly: null,
        leaseDurationMonths: null,
        negotiable: true,
        availableFrom: null,
        contactPreference: "in_app",
        representationStatus: "unverified",
        verification: {
            representation: { status: "NOT_VERIFIED", updatedAt: new Date(), verifiedAt: null, expiresAt: null },
        },
        source: {
            type: opts.listedByRole,
            channel: "USER_CREATED",
            uid: persona.uid,
            importedAt: new Date(),
            authoritative: false,
            externalId: null,
        },
        localityId: propertyPayload.localityId,
        city: propertyPayload.city,
        category: propertyPayload.category,
        subtype: propertyPayload.subtype,
        latitude: propertyPayload.latitude,
        longitude: propertyPayload.longitude,
        geohash: propertyPayload.geohash,
        geo: propertyPayload.geo,
        ownerUid: propertyPayload.ownerUid,
        bedrooms: propertyPayload.bedrooms,
        bathrooms: propertyPayload.bathrooms,
        builtUpAreaSqft: propertyPayload.builtUpAreaSqft,
        plotAreaSqft: null,
        locationPrecision: propertyPayload.locationPrecision,
        coverThumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null,
        expiresAt: null,
        lastVerifiedAt: null,
        spatialTourAvailable: false,
        smokeTest: true,
    };
    const created = await clientPatch(persona.idToken, `listings/${listingId}`, payload);
    if (created.ok) {
        await clientPatch(persona.idToken, `listings/${listingId}/private_meta/current`, {
            moderation: { status: "NONE", reason: null, reviewedAt: null, reviewedByUid: null },
            updatedAt: new Date(),
            updatedByUid: persona.uid,
        });
    }
    return { listingId, created, payload };
}

async function pollMatch(buyerUid, savedSearchId, listingId, timeoutMs = 90000) {
    const matchDocId = `${savedSearchId}_${listingId}_listingPublished`.slice(0, 700);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const snap = await getDoc(PROJECT, `users/${buyerUid}/savedSearchMatches/${matchDocId}`);
        if (snap.exists) return snap;
        await sleep(4000);
    }
    return { exists: false, data: null };
}

async function main() {
    const guard = assertStagingOnly();
    if (guard.projectId !== PROJECT) throw new Error("refusing non-staging project");
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const personas = {};
    for (const [name, row] of Object.entries(state.personas || {})) {
        personas[name] = { ...row, ...(await identitySignIn(row.email, row.password)) };
    }
    const { buyer, owner, agent, builder, admin } = personas;
    if (!buyer || !owner || !agent || !builder || !admin) {
        throw new Error("missing synthetic staging personas");
    }

    const noAuth = await callFn("publishListing", { body: { listingId: "x" } });
    record("HTTP missing auth", noAuth.status === 401 ? "PASS" : "FAIL",
        `publishListing unauthenticated HTTP ${noAuth.status}`);
    const badAuth = await callFn("publishListing", { token: "not-a-token", body: { listingId: "x" } });
    record("HTTP invalid auth", badAuth.status === 401 ? "PASS" : "FAIL",
        `publishListing invalid token HTTP ${badAuth.status}`);

    const ownerProp = await createProperty(owner);
    record("Draft property create", ownerProp.created.ok && ownerProp.privateGeo.ok ? "PASS" : "FAIL",
        `property ${ownerProp.propertyId} HTTP ${ownerProp.created.status}/${ownerProp.privateGeo.status}`);
    const buyListing = await createListing(owner, ownerProp.propertyId, ownerProp.payload, {
        transactionType: "buy",
        listedByRole: "owner",
        title: "Staging backend 2BHK sale",
        askingPrice: 8500000,
    });
    record("Draft listing create", buyListing.created.ok ? "PASS" : "FAIL",
        `listing ${buyListing.listingId} HTTP ${buyListing.created.status}`);

    const selfPublish = await clientPatch(owner.idToken, `listings/${buyListing.listingId}`, {
        status: "PUBLISHED",
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedByUid: owner.uid,
    });
    record("Client self-publish denied", selfPublish.ok ? "FAIL" : "PASS",
        `owner status=PUBLISHED HTTP ${selfPublish.status}`);

    const buyerPublish = await callFn("publishListing", { token: buyer.idToken, body: { listingId: buyListing.listingId } });
    record("Buyer cannot publish", buyerPublish.status === 403 ? "PASS" : "FAIL",
        `buyer publishListing HTTP ${buyerPublish.status} ${buyerPublish.json.error || ""}`);
    const ownerPublishFn = await callFn("publishListing", { token: owner.idToken, body: { listingId: buyListing.listingId } });
    record("Owner cannot publish via Function", ownerPublishFn.status === 403 ? "PASS" : "FAIL",
        `owner publishListing HTTP ${ownerPublishFn.status}`);
    const agentPublishOther = await callFn("publishListing", { token: agent.idToken, body: { listingId: buyListing.listingId } });
    record("Agent cannot publish another user's listing", agentPublishOther.status === 403 ? "PASS" : "FAIL",
        `agent publishListing HTTP ${agentPublishOther.status}`);

    const searchId = `stgS_${crypto.randomBytes(4).toString("hex")}`;
    const savedSearch = await clientPatch(buyer.idToken, `users/${buyer.uid}/savedSearches/${searchId}`, {
        kind: "savedSearch",
        name: "Bengaluru 2BHK buy backend",
        location: { mode: "CITY", city: "Bengaluru", cityKey: "bengaluru", localityId: null, searchLabel: "Bengaluru", viewport: null },
        filters: { transactionType: "buy", category: "residential", subtype: "apartment", bhk: 2, minPrice: 5000000, maxPrice: 12000000 },
        criteriaHash: "stgbackend01",
        alertEnabled: true,
        cityKey: "bengaluru",
        transactionType: "buy",
        ownerUid: buyer.uid,
        alert: { enabled: true },
        createdAt: new Date(),
        updatedAt: new Date(),
        smokeTest: true,
    });
    record("Saved search create", savedSearch.ok ? "PASS" : "FAIL", `HTTP ${savedSearch.status}`);
    const crossSearch = await clientGet(owner.idToken, `users/${buyer.uid}/savedSearches/${searchId}`);
    record("Cross-user savedSearch denied", crossSearch.ok ? "FAIL" : "PASS",
        `owner read buyer savedSearch HTTP ${crossSearch.status}`);

    const adminPublish = await callFn("publishListing", {
        token: admin.idToken,
        body: { listingId: buyListing.listingId },
    });
    record("Admin publication function", adminPublish.ok && adminPublish.json.status === "PUBLISHED" ? "PASS" : "FAIL",
        `HTTP ${adminPublish.status} ${JSON.stringify(adminPublish.json).slice(0, 180)}`);

    const published = await getDoc(PROJECT, `listings/${buyListing.listingId}`);
    const isPublished = published.data?.status === "PUBLISHED";
    record("Published listing document", isPublished ? "PASS" : "FAIL",
        `status=${published.data?.status} publishedAt=${Boolean(published.data?.publishedAt)}`);

    const publicProperty = await clientGet(buyer.idToken, `properties/${ownerProp.propertyId}`);
    const fields = publicProperty.json.fields || {};
    const exposedExact = fields.latitude?.doubleValue === EXACT.latitude
        && fields.longitude?.doubleValue === EXACT.longitude;
    const aliases = Boolean(fields.privateLatitude || fields.exactLatitude || fields.lat);
    record("Public geo only", publicProperty.ok && !exposedExact && !aliases ? "PASS" : "FAIL",
        `exactExposed=${exposedExact} aliases=${aliases}`);
    const buyerPrivate = await clientGet(buyer.idToken, `properties/${ownerProp.propertyId}/private_geo/current`);
    record("Unauthorized private_geo denied", buyerPrivate.ok ? "FAIL" : "PASS",
        `buyer private_geo HTTP ${buyerPrivate.status}`);
    const ownerPrivate = await clientGet(owner.idToken, `properties/${ownerProp.propertyId}/private_geo/current`);
    record("Owner private geo remains readable", ownerPrivate.ok ? "PASS" : "FAIL",
        `owner private_geo HTTP ${ownerPrivate.status}`);

    const republish = await callFn("publishListing", {
        token: admin.idToken,
        body: { listingId: buyListing.listingId },
    });
    record("Idempotent republish allowed", republish.ok ? "PASS" : "FAIL",
        `second publishListing HTTP ${republish.status}`);

    let alertResult = "FAIL";
    let alertNotes = "publication did not succeed; alert not evaluated";
    if (isPublished) {
        const match = await pollMatch(buyer.uid, searchId, buyListing.listingId);
        const notes = await queryWhere(PROJECT, "notifications", "toUserId", "EQUAL", buyer.uid);
        const alertNotesRows = notes.filter((row) =>
            row.data?.data?.type === "saved_search_match"
            && row.data?.data?.listingId === buyListing.listingId
            && row.data?.data?.savedSearchId === searchId
        );
        const payloadLeak = alertNotesRows.some((row) => {
            const blob = JSON.stringify(row.data || {});
            return blob.includes(String(EXACT.latitude))
                || blob.includes("addressLine1")
                || blob.includes("pincode")
                || /password/i.test(blob);
        });
        if (match.exists && alertNotesRows.length === 1 && !payloadLeak) {
            alertResult = "PASS";
            alertNotes = `receipt ${match.exists} notifications=${alertNotesRows.length} leak=${payloadLeak}`;
        } else if (match.exists && alertNotesRows.length > 1) {
            alertResult = "FAIL";
            alertNotes = `duplicate notifications=${alertNotesRows.length}`;
        } else {
            alertResult = match.exists ? "FAIL" : "FAIL";
            alertNotes = `receipt=${match.exists} notifications=${alertNotesRows.length} leak=${payloadLeak}`;
        }
        const afterRepublish = await pollMatch(buyer.uid, searchId, buyListing.listingId, 15000);
        const notes2 = await queryWhere(PROJECT, "notifications", "toUserId", "EQUAL", buyer.uid);
        const again = notes2.filter((row) =>
            row.data?.data?.type === "saved_search_match"
            && row.data?.data?.listingId === buyListing.listingId
            && row.data?.data?.savedSearchId === searchId
        );
        record("Saved-search alert", alertResult, alertNotes);
        record("Duplicate publication does not duplicate alert",
            afterRepublish.exists && again.length === 1 ? "PASS" : (again.length > 1 ? "FAIL" : "FAIL"),
            `receipt still ${afterRepublish.exists}; notifications=${again.length}`);
    } else {
        record("Saved-search alert", "BLOCKED", alertNotes);
        record("Duplicate publication does not duplicate alert", "BLOCKED", "listing was not published via Function");
    }

    const caseVerified = `stgV_${crypto.randomBytes(4).toString("hex")}`;
    const caseRejected = `stgV_${crypto.randomBytes(4).toString("hex")}`;
    const submitV = await clientPatch(owner.idToken, `verification_cases/${caseVerified}`, {
        submittedByUid: owner.uid,
        status: "PENDING",
        type: "PROPERTY",
        subjectId: ownerProp.propertyId,
        propertyId: ownerProp.propertyId,
        listingId: buyListing.listingId,
        evidenceType: "PROPERTY_DOCUMENT",
        evidencePath: "verification_docs/private-not-for-public.pdf",
        reviewedByUid: null,
        reviewedAt: null,
        notes: null,
        createdAt: new Date(),
        submittedAt: new Date(),
        smokeTest: true,
    });
    const submitR = await clientPatch(owner.idToken, `verification_cases/${caseRejected}`, {
        submittedByUid: owner.uid,
        status: "PENDING",
        type: "OWNERSHIP",
        subjectId: ownerProp.propertyId,
        propertyId: ownerProp.propertyId,
        listingId: buyListing.listingId,
        evidenceType: "PROPERTY_DOCUMENT",
        evidencePath: "verification_docs/private-ownership.pdf",
        reviewedByUid: null,
        reviewedAt: null,
        notes: null,
        createdAt: new Date(),
        submittedAt: new Date(),
        smokeTest: true,
    });
    record("Verification submit PENDING", submitV.ok && submitR.ok ? "PASS" : "FAIL",
        `verified-case HTTP ${submitV.status} rejected-case HTTP ${submitR.status}`);
    const clientApprove = await clientPatch(owner.idToken, `verification_cases/${caseVerified}`, { status: "VERIFIED" });
    record("Client cannot self-approve", clientApprove.ok ? "FAIL" : "PASS",
        `client VERIFIED HTTP ${clientApprove.status}`);
    const ownerReview = await callFn("reviewVerification", {
        token: owner.idToken,
        body: { verificationId: caseVerified, decision: "APPROVED" },
    });
    record("Non-admin review denied", ownerReview.status === 403 ? "PASS" : "FAIL",
        `owner reviewVerification HTTP ${ownerReview.status}`);
    const adminVerify = await callFn("reviewVerification", {
        token: admin.idToken,
        body: { verificationId: caseVerified, decision: "APPROVED" },
    });
    const adminReject = await callFn("reviewVerification", {
        token: admin.idToken,
        body: { verificationId: caseRejected, decision: "REJECTED", reason: "staging smoke reject" },
    });
    record("Admin PENDING→VERIFIED", adminVerify.ok && adminVerify.json.status === "VERIFIED" ? "PASS" : "FAIL",
        `HTTP ${adminVerify.status} ${JSON.stringify(adminVerify.json).slice(0, 160)}`);
    record("Admin PENDING→REJECTED", adminReject.ok && adminReject.json.status === "REJECTED" ? "PASS" : "FAIL",
        `HTTP ${adminReject.status} ${JSON.stringify(adminReject.json).slice(0, 160)}`);
    const propertyAfter = await getDoc(PROJECT, `properties/${ownerProp.propertyId}`);
    const vStatus = propertyAfter.data?.verification?.property?.status;
    const oStatus = propertyAfter.data?.verification?.ownership?.status;
    record("Public verification projection", vStatus === "VERIFIED" && oStatus === "REJECTED" ? "PASS" : "FAIL",
        `property=${vStatus} ownership=${oStatus}`);
    const buyerCase = await clientGet(buyer.idToken, `verification_cases/${caseVerified}`);
    record("Private verification case protected", buyerCase.ok ? "FAIL" : "PASS",
        `buyer case read HTTP ${buyerCase.status}`);

    const kycNoAuth = await callFn("getDigiLockerUrl", { body: {} });
    record("KYC HTTP requires token", kycNoAuth.status === 401 ? "PASS" : "FAIL",
        `getDigiLockerUrl unauthenticated HTTP ${kycNoAuth.status}`);
    const kycUrl = await callFn("getDigiLockerUrl", { token: buyer.idToken, body: { userFlow: "signup" } });
    if (kycUrl.status === 401) {
        record("KYC token uid path", "FAIL", "authenticated caller still 401");
        record("KYC external provider", "BLOCKED", "did not reach provider");
    } else if (kycUrl.ok) {
        record("KYC token uid path", "PASS", "authenticated request accepted");
        record("KYC external provider", "FAIL", "staging placeholder secrets unexpectedly succeeded");
    } else {
        record("KYC token uid path", kycUrl.status !== 401 && kycUrl.status !== 403 ? "PASS" : "FAIL",
            `authenticated HTTP ${kycUrl.status} (uid from token)`);
        record("KYC external provider", "BLOCKED",
            `no staging Cashfree Verification credentials; HTTP ${kycUrl.status} ${JSON.stringify(kycUrl.json).slice(0, 160)}`);
    }
    const fakeSession = `kyc_stg_${crypto.randomBytes(4).toString("hex")}`;
    await patchDoc(PROJECT, `kyc_sessions/${fakeSession}`, {
        uid: buyer.uid,
        provider: "cashfree_digilocker",
        createdAt: new Date(),
        smokeTest: true,
    });
    const otherUid = await callFn("getDigiLockerStatus", {
        token: owner.idToken,
        body: { verificationId: fakeSession },
    });
    record("KYC uid substitution rejected", otherUid.status === 403 ? "PASS" : "FAIL",
        `owner status-check on buyer session HTTP ${otherUid.status}`);
    const kycWrite = await clientPatch(owner.idToken, `users/${owner.uid}`, { aadhaarVerified: true, isVerified: true });
    record("Client cannot manufacture verified identity", kycWrite.ok ? "FAIL" : "PASS",
        `client aadhaarVerified HTTP ${kycWrite.status}`);

    const localityUnauth = await callFn("recomputeLocalityMarket", { body: { localityId: LOCALITY_ID } });
    record("Locality recompute requires admin", localityUnauth.status === 401 ? "PASS" : "FAIL",
        `unauthenticated HTTP ${localityUnauth.status}`);
    const localityOwner = await callFn("recomputeLocalityMarket", {
        token: owner.idToken,
        body: { localityId: LOCALITY_ID },
    });
    record("Locality recompute non-admin denied", localityOwner.status === 403 ? "PASS" : "FAIL",
        `owner HTTP ${localityOwner.status}`);
    const localityAdmin = await callFn("recomputeLocalityMarket", {
        token: admin.idToken,
        body: { localityId: LOCALITY_ID },
    });
    const locDoc = await getDoc(PROJECT, `localities/${LOCALITY_ID}`);
    const intel = locDoc.data?.intelligence || {};
    const market = intel.domains?.market || {};
    const flood = intel.domains?.flood;
    const invented = Boolean(intel.domains?.schools || intel.domains?.transport || intel.domains?.hospitals || intel.domains?.healthcare);
    const personal = intel.personalScore != null;
    const marketOk = localityAdmin.ok
        && (market.status === "INSUFFICIENT_SAMPLE" || market.status === "UNAVAILABLE" || market.status === "AVAILABLE" || market.status === "PARTIAL")
        && (market.metrics?.medianSalePrice?.status === "INSUFFICIENT_SAMPLE" || market.metrics?.medianSalePrice?.value === null)
        && !invented
        && !personal;
    record("Locality market path", marketOk ? "PASS" : "FAIL",
        `HTTP ${localityAdmin.status} listingCount=${localityAdmin.json.listingCount} market=${market.status || localityAdmin.json.marketStatus} inventedOtherDomains=${invented} personalScore=${personal} flood=${flood ? flood.classification || flood.status : "absent"}`);

    const mediaId = `stgM_${crypto.randomBytes(4).toString("hex")}`;
    const mediaUpload = await clientPatch(owner.idToken, `property_media/${mediaId}`, {
        createdByUid: owner.uid,
        parentType: "property",
        parentId: ownerProp.propertyId,
        propertyId: ownerProp.propertyId,
        mediaType: "spatial",
        visibility: "private",
        status: "ACTIVE",
        processingStatus: "UPLOADING",
        url: null,
        storagePath: `property_spatial/${owner.uid}/source.bin`,
    });
    record("Spatial private source doc", mediaUpload.ok ? "PASS" : "FAIL",
        `UPLOADING HTTP ${mediaUpload.status}`);
    const mediaReady = await clientPatch(owner.idToken, `property_media/stgM_ready_${crypto.randomBytes(3).toString("hex")}`, {
        createdByUid: owner.uid,
        parentType: "property",
        parentId: ownerProp.propertyId,
        propertyId: ownerProp.propertyId,
        mediaType: "spatial",
        visibility: "public",
        status: "ACTIVE",
        processingStatus: "READY",
        url: "https://example.invalid/fake.splat",
        storagePath: `property_spatial/${owner.uid}/fake.splat`,
    });
    record("Client cannot manufacture READY", mediaReady.ok ? "FAIL" : "PASS",
        `client READY spatial HTTP ${mediaReady.status}`);
    const ownerFinalize = await callFn("finalizeSpatialAsset", {
        token: owner.idToken,
        body: { mediaId, decision: "READY", derivedUrl: "https://example.invalid/fake.splat" },
    });
    record("Spatial READY admin-only", ownerFinalize.status === 403 ? "PASS" : "FAIL",
        `owner finalizeSpatialAsset HTTP ${ownerFinalize.status}`);
    record("Gaussian Splat asset", "SKIPPED", "No real splat uploaded; READY not server-manufactured for this test");

    const saveListing = await clientPatch(buyer.idToken, `users/${buyer.uid}/savedListings/${buyListing.listingId}`, {
        listingId: buyListing.listingId,
        propertyId: ownerProp.propertyId,
        kind: "savedListing",
        snapshot: { title: "Staging backend 2BHK sale", askingPrice: 8500000, transactionType: "buy", city: "Bengaluru" },
        savedAt: new Date(),
    });
    const crossSave = await clientGet(owner.idToken, `users/${buyer.uid}/savedListings/${buyListing.listingId}`);
    record("Cross-user save denied", saveListing.ok && !crossSave.ok ? "PASS" : "FAIL",
        `save HTTP ${saveListing.status}; owner read HTTP ${crossSave.status}`);

    const persist = {
        ...state,
        backendAcceptanceAt: new Date().toISOString(),
        records: {
            ...(state.records || {}),
            backendPropertyId: ownerProp.propertyId,
            backendListingId: buyListing.listingId,
            backendSavedSearchId: searchId,
            backendCaseVerifiedId: caseVerified,
            backendCaseRejectedId: caseRejected,
            backendSpatialMediaId: mediaUpload.ok ? mediaId : null,
            backendKycSessionId: fakeSession,
        },
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(persist, null, 2));

    console.log("\n=== BACKEND ACCEPTANCE SUMMARY ===");
    console.log(JSON.stringify({
        projectId: PROJECT,
        pass: RESULTS.filter((row) => row.result === "PASS").length,
        fail: RESULTS.filter((row) => row.result === "FAIL").length,
        blocked: RESULTS.filter((row) => row.result === "BLOCKED").length,
        skipped: RESULTS.filter((row) => row.result === "SKIPPED").length,
        results: RESULTS,
    }, null, 2));
    if (RESULTS.some((row) => row.result === "FAIL")) process.exitCode = 1;
}

main().catch((error) => {
    console.error("backend_acceptance_failed", error.message);
    process.exit(1);
});
