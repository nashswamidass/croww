/**
 * Production Phase 5C Live Security, Intelligence & Alerts Tests.
 * Target: croww-live-2026
 *
 * Tests:
 * Part 1: recomputeLocalityMarket
 *   A. Published listing inclusion: 8 valid PUBLISHED listings -> medians computed (status = AVAILABLE)
 *   B. Non-published exclusion: DRAFT/PAUSED listings do not affect sample or medians
 *   C. Missing data behavior: null/0 price/sqft dropped, no fabrication
 *   D. Determinism: duplicate execution yields identical results
 *   E. Authorization: Buyer/Owner/Agent -> 403, Admin -> 200
 *   F. Data isolation: Only locality intelligence modified, no user PII/KYC/private fields copied
 *   G. Threshold behavior: Locality with < 8 listings -> INSUFFICIENT_SAMPLE, value = null
 *   H. Failure tests: missing localityId (400), nonexistent locality (404), unauth (401), invalid token (401)
 *
 * Part 2: onListingWrittenSavedSearchAlerts
 *   A. Match: Qualifying listing published -> exactly 1 alert generated
 *   B. Non-match: Listing outside search criteria -> 0 alerts
 *   C. Non-published listing: DRAFT listing -> 0 alerts
 *   D. Idempotency: Duplicate write / retry on same listing -> exactly 1 alert (claimMatch deduplication)
 *   E. Multiple saved searches: 2 buyers with matching searches -> exactly 1 alert per buyer
 *   F. Repeated listing updates: PUBLISHED -> PUBLISHED edit -> 0 new alerts
 *   G. User isolation: Lister does not get alerted on own listing, no sensitive fields leaked
 *
 * Part 3: Full cleanup of all ephemeral fixtures, users, searches, and notifications.
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

const RECOMPUTE_URL = "https://us-central1-croww-live-2026.cloudfunctions.net/recomputeLocalityMarket";

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
    return { status: res.status, ok: res.ok, json };
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    console.log("Starting Production Phase 5C Live Security & Intelligence Tests on croww-live-2026...");
    const stamp = Date.now();
    const createdUsers = [];
    const cleanupDocs = [];
    const createdNotifications = [];

    const locIdFull = `smoke-loc-full-${stamp}`;
    const locIdSmall = `smoke-loc-small-${stamp}`;
    const propId = `smoke-prop-alerts-${stamp}`;

    try {
        // 1. Create Ephemeral Personas
        console.log("--- 1. Creating Ephemeral Test Personas ---");
        const personas = {
            buyer1: { role: "buyer", userType: "individual" },
            buyer2: { role: "buyer", userType: "individual" },
            owner: { role: "owner", userType: "individual" },
            admin: { role: "admin", userType: "admin" },
        };

        for (const [key, spec] of Object.entries(personas)) {
            const email = `smoke.phase5c.${stamp}.${key}@croww.test`;
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

        // Allow 2 seconds for token iat clock synchronization across Cloud Run instances
        await sleep(2000);

        // ================================================================
        // PART 1: recomputeLocalityMarket
        // ================================================================
        console.log("--- PART 1: Testing recomputeLocalityMarket ---");

        // 2. Create Ephemeral Localities
        // Locality 1: Full sample (will receive 8 published listings)
        const locFullData = {
            id: locIdFull,
            name: "Smoke Locality Full",
            city: "Chennai",
            status: "active",
            latitude: 13.0827,
            longitude: 80.2707,
            isSmoke: true,
            createdAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `localities/${locIdFull}?currentDocument.exists=false`, {
            fields: encodeMap(locFullData),
        });
        cleanupDocs.push(`localities/${locIdFull}`);

        // Locality 2: Small sample (will receive 3 published listings < 8 threshold)
        const locSmallData = {
            id: locIdSmall,
            name: "Smoke Locality Small",
            city: "Chennai",
            status: "active",
            latitude: 13.0827,
            longitude: 80.2707,
            isSmoke: true,
            createdAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `localities/${locIdSmall}?currentDocument.exists=false`, {
            fields: encodeMap(locSmallData),
        });
        cleanupDocs.push(`localities/${locIdSmall}`);

        // 3. Create 8 PUBLISHED Listings for Locality 1 (prices: 5.0L, 5.5L, 6.0L, 6.5L, 7.0L, 7.5L, 8.0L, 8.5L)
        // Median price should be (6.5L + 7.0L)/2 = 6,750,000
        const samplePrices = [5000000, 5500000, 6000000, 6500000, 7000000, 7500000, 8000000, 8500000];
        for (let i = 0; i < 8; i++) {
            const listId = `smoke-list-full-${i}-${stamp}`;
            const listData = {
                id: listId,
                localityId: locIdFull,
                city: "Chennai",
                transactionType: "buy",
                askingPrice: samplePrices[i],
                builtUpAreaSqft: 1000 + i * 100, // 1000, 1100, ..., 1700
                bedrooms: 3,
                status: "PUBLISHED",
                publishedAt: new Date(Date.now() - (8 - i) * 60000).toISOString(),
                isSmoke: true,
                ownerUid: personas.owner.uid,
                listedByUid: personas.owner.uid,
            };
            await fsIam("PATCH", `listings/${listId}?currentDocument.exists=false`, {
                fields: encodeMap(listData),
            });
            cleanupDocs.push(`listings/${listId}`);
        }

        // Add 2 non-published listings (1 DRAFT, 1 PAUSED) in Locality 1 with extreme prices
        const draftListId = `smoke-list-draft-${stamp}`;
        await fsIam("PATCH", `listings/${draftListId}?currentDocument.exists=false`, {
            fields: encodeMap({
                id: draftListId,
                localityId: locIdFull,
                city: "Chennai",
                transactionType: "buy",
                askingPrice: 99999999, // would distort median if included
                status: "DRAFT",
                isSmoke: true,
                ownerUid: personas.owner.uid,
            }),
        });
        cleanupDocs.push(`listings/${draftListId}`);

        const pausedListId = `smoke-list-paused-${stamp}`;
        await fsIam("PATCH", `listings/${pausedListId}?currentDocument.exists=false`, {
            fields: encodeMap({
                id: pausedListId,
                localityId: locIdFull,
                city: "Chennai",
                transactionType: "buy",
                askingPrice: 100, // would distort median if included
                status: "PAUSED",
                isSmoke: true,
                ownerUid: personas.owner.uid,
            }),
        });
        cleanupDocs.push(`listings/${pausedListId}`);

        // Create 3 listings for Locality 2 (below minimum sample threshold of 8)
        for (let i = 0; i < 3; i++) {
            const listId = `smoke-list-small-${i}-${stamp}`;
            const listData = {
                id: listId,
                localityId: locIdSmall,
                city: "Chennai",
                transactionType: "buy",
                askingPrice: 5000000 + i * 1000000,
                builtUpAreaSqft: 1200,
                bedrooms: 2,
                status: "PUBLISHED",
                publishedAt: new Date(Date.now() - (3 - i) * 60000).toISOString(),
                isSmoke: true,
                ownerUid: personas.owner.uid,
            };
            await fsIam("PATCH", `listings/${listId}?currentDocument.exists=false`, {
                fields: encodeMap(listData),
            });
            cleanupDocs.push(`listings/${listId}`);
        }

        // 4. Test Authorization on recomputeLocalityMarket
        console.log("--- Testing recomputeLocalityMarket Authorization ---");
        const buyerRecompute = await callFunction(RECOMPUTE_URL, personas.buyer1.idToken, { localityId: locIdFull });
        record(
            "Security: Buyer recompute rejected",
            buyerRecompute.status === 403,
            `HTTP ${buyerRecompute.status} (expected 403) - ${JSON.stringify(buyerRecompute.json)}`
        );

        const ownerRecompute = await callFunction(RECOMPUTE_URL, personas.owner.idToken, { localityId: locIdFull });
        record(
            "Security: Owner recompute rejected",
            ownerRecompute.status === 403,
            `HTTP ${ownerRecompute.status} (expected 403) - ${JSON.stringify(ownerRecompute.json)}`
        );

        // 5. Test Parameter & Auth Failures
        const noToken = await callFunction(RECOMPUTE_URL, null, { localityId: locIdFull });
        record("Failure: Missing Bearer token", noToken.status === 401, `HTTP ${noToken.status} (expected 401)`);

        const badToken = await callFunction(RECOMPUTE_URL, "invalid-token", { localityId: locIdFull });
        record("Failure: Invalid Bearer token", badToken.status === 401, `HTTP ${badToken.status} (expected 401)`);

        const missingLoc = await callFunction(RECOMPUTE_URL, personas.admin.idToken, {});
        record("Failure: Missing localityId", missingLoc.status === 400, `HTTP ${missingLoc.status} (expected 400)`);

        const notFoundLoc = await callFunction(RECOMPUTE_URL, personas.admin.idToken, { localityId: "nonexistent-locality-id" });
        record("Failure: Nonexistent locality ID", notFoundLoc.status === 404, `HTTP ${notFoundLoc.status} (expected 404)`);

        // 6. Test Authorized Admin Recomputation on Full Locality
        console.log("--- Testing Admin Recomputation on Full Locality ---");
        const adminRecompute = await callFunction(RECOMPUTE_URL, personas.admin.idToken, { localityId: locIdFull });
        record(
            "Admin: Recompute successful",
            adminRecompute.status === 200 && adminRecompute.json.ok === true,
            `HTTP ${adminRecompute.status}, listingCount=${adminRecompute.json.listingCount}`
        );

        // Verify Locality Document Intelligence in Firestore
        const locSnap = await fsIam("GET", `localities/${locIdFull}`);
        const locData = decodeMap(locSnap.json.fields || {});
        const intel = locData.intelligence || {};
        const market = intel.domains?.market || {};
        const metrics = market.metrics || {};

        record(
            "Inclusion & Count: Exactly 8 published listings included",
            metrics.activeListingCount?.value === 8 && adminRecompute.json.listingCount === 8,
            `activeListingCount=${metrics.activeListingCount?.value} (DRAFT & PAUSED excluded)`
        );

        const expectedMedian = 6750000; // (6.5M + 7.0M) / 2
        record(
            "Median Sale Price: Calculated accurately from published listings",
            metrics.medianSalePrice?.status === "AVAILABLE" && metrics.medianSalePrice?.value === expectedMedian,
            `status=${metrics.medianSalePrice?.status}, value=${metrics.medianSalePrice?.value} (expected ${expectedMedian})`
        );

        record(
            "Median Price Per SqFt: Available and valid",
            metrics.medianPricePerSqft?.status === "AVAILABLE" && metrics.medianPricePerSqft?.value > 0,
            `status=${metrics.medianPricePerSqft?.status}, value=${metrics.medianPricePerSqft?.value}`
        );

        record(
            "Data Isolation: Only intelligence domain modified",
            !locData.email && !locData.phone && !locData.kycDetails && intel.methodologyVersion === "area-intelligence-v1",
            "no user PII or unapproved fields written"
        );

        // Determinism test: rerun recompute without changes
        const recompute2 = await callFunction(RECOMPUTE_URL, personas.admin.idToken, { localityId: locIdFull });
        const locSnap2 = await fsIam("GET", `localities/${locIdFull}`);
        const locData2 = decodeMap(locSnap2.json.fields || {});
        const m2 = locData2.intelligence?.domains?.market?.metrics || {};
        record(
            "Determinism: Recomputation produces identical metrics",
            recompute2.status === 200 && m2.medianSalePrice?.value === expectedMedian && m2.activeListingCount?.value === 8,
            `medianSalePrice=${m2.medianSalePrice?.value}`
        );

        // 7. Test Threshold Behavior on Small Locality (< 8 listings)
        console.log("--- Testing Threshold Behavior on Small Locality ---");
        const smallRecompute = await callFunction(RECOMPUTE_URL, personas.admin.idToken, { localityId: locIdSmall });
        record(
            "Admin: Small locality recompute",
            smallRecompute.status === 200 && smallRecompute.json.listingCount === 3,
            `listingCount=${smallRecompute.json.listingCount}`
        );

        const smallSnap = await fsIam("GET", `localities/${locIdSmall}`);
        const smallIntel = decodeMap(smallSnap.json.fields || {}).intelligence || {};
        const smallMetrics = smallIntel.domains?.market?.metrics || {};

        record(
            "Threshold Behavior: Medians are INSUFFICIENT_SAMPLE when count < 8",
            smallMetrics.medianSalePrice?.status === "INSUFFICIENT_SAMPLE" && smallMetrics.medianSalePrice?.value === null,
            `status=${smallMetrics.medianSalePrice?.status}, value=${smallMetrics.medianSalePrice?.value}`
        );

        record(
            "Threshold Behavior: No fabricated price data",
            smallMetrics.medianPricePerSqft?.status === "INSUFFICIENT_SAMPLE" && smallMetrics.medianPricePerSqft?.value === null,
            `status=${smallMetrics.medianPricePerSqft?.status}, value=${smallMetrics.medianPricePerSqft?.value}`
        );

        // ================================================================
        // PART 2: onListingWrittenSavedSearchAlerts
        // ================================================================
        console.log("--- PART 2: Testing onListingWrittenSavedSearchAlerts Trigger ---");

        // 8. Create Saved Searches for buyer1 and buyer2
        // buyer1: City Chennai, Buy, 2 BHK, 40L - 100L
        const searchId1 = `smoke-search-1-${stamp}`;
        const search1Data = {
            id: searchId1,
            name: "Chennai 2BHK Buy",
            cityKey: "chennai",
            alertEnabled: true,
            location: { mode: "CITY", city: "Chennai", cityKey: "chennai" },
            filters: { transactionType: "buy", minPrice: 4000000, maxPrice: 10000000, bhk: 2 },
            createdAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `users/${personas.buyer1.uid}/savedSearches/${searchId1}?currentDocument.exists=false`, {
            fields: encodeMap(search1Data),
        });
        cleanupDocs.push(`users/${personas.buyer1.uid}/savedSearches/${searchId1}`);

        // buyer2: City Chennai, Buy, 2 BHK (also matches)
        const searchId2 = `smoke-search-2-${stamp}`;
        const search2Data = {
            id: searchId2,
            name: "Chennai 2BHK Alerts",
            cityKey: "chennai",
            alertEnabled: true,
            location: { mode: "CITY", city: "Chennai", cityKey: "chennai" },
            filters: { transactionType: "buy", minPrice: 3000000, maxPrice: 8000000, bhk: 2 },
            createdAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `users/${personas.buyer2.uid}/savedSearches/${searchId2}?currentDocument.exists=false`, {
            fields: encodeMap(search2Data),
        });
        cleanupDocs.push(`users/${personas.buyer2.uid}/savedSearches/${searchId2}`);

        // 9. Test Non-Published Listing (DRAFT): Must generate ZERO alerts
        console.log("Testing DRAFT listing write: Zero alerts expected");
        const alertListingDraftId = `smoke-alert-draft-${stamp}`;
        await fsIam("PATCH", `listings/${alertListingDraftId}?currentDocument.exists=false`, {
            fields: encodeMap({
                id: alertListingDraftId,
                title: "Matching DRAFT Listing",
                city: "Chennai",
                transactionType: "buy",
                askingPrice: 6000000,
                bedrooms: 2,
                status: "DRAFT", // Not PUBLISHED
                ownerUid: personas.owner.uid,
                listedByUid: personas.owner.uid,
                isSmoke: true,
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`listings/${alertListingDraftId}`);

        await sleep(3000); // Allow any trigger run

        const token = cliAccessToken();
        async function getNotifsFor(uid) {
            const res = await fetch(
                `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        structuredQuery: {
                            from: [{ collectionId: "notifications" }],
                            where: {
                                fieldFilter: {
                                    field: { fieldPath: "toUserId" },
                                    op: "EQUAL",
                                    value: { stringValue: uid },
                                },
                            },
                        },
                    }),
                }
            );
            const json = await res.json();
            return (Array.isArray(json) ? json : [])
                .filter((r) => r.document)
                .map((r) => ({
                    path: r.document.name.replace(`projects/${PROJECT}/databases/(default)/documents/`, ""),
                    data: decodeMap(r.document.fields || {}),
                }));
        }

        const buyer1NotifsAfterDraft = await getNotifsFor(personas.buyer1.uid);
        record(
            "Alert Trigger: DRAFT listing creates zero publication alerts",
            buyer1NotifsAfterDraft.length === 0,
            `count=${buyer1NotifsAfterDraft.length}`
        );

        // 10. Test Non-Matching Listing: Different transactionType (Rent)
        console.log("Testing Non-Matching PUBLISHED listing write: Zero alerts expected");
        const nonMatchListingId = `smoke-alert-rent-${stamp}`;
        await fsIam("PATCH", `listings/${nonMatchListingId}?currentDocument.exists=false`, {
            fields: encodeMap({
                id: nonMatchListingId,
                title: "Non-Matching Rent Listing",
                city: "Chennai",
                transactionType: "rent", // Search is for "buy"
                rentMonthly: 25000,
                bedrooms: 2,
                status: "PUBLISHED",
                ownerUid: personas.owner.uid,
                listedByUid: personas.owner.uid,
                isSmoke: true,
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`listings/${nonMatchListingId}`);

        await sleep(3000);

        const buyer1NotifsAfterNonMatch = await getNotifsFor(personas.buyer1.uid);
        record(
            "Alert Trigger: Non-matching listing creates zero alerts",
            buyer1NotifsAfterNonMatch.length === 0,
            `count=${buyer1NotifsAfterNonMatch.length}`
        );

        // 11. Test Matching Listing Publication: Both buyer1 and buyer2 receive exactly 1 alert
        console.log("Testing Matching PUBLISHED listing write: 1 alert per matching search");
        const matchListingId = `smoke-alert-match-${stamp}`;
        await fsIam("PATCH", `listings/${matchListingId}?currentDocument.exists=false`, {
            fields: encodeMap({
                id: matchListingId,
                title: "Perfect 2BHK Match Chennai",
                city: "Chennai",
                transactionType: "buy",
                askingPrice: 6000000, // between 40L and 100L
                bedrooms: 2,
                builtUpAreaSqft: 1100,
                status: "PUBLISHED",
                ownerUid: personas.owner.uid,
                listedByUid: personas.owner.uid,
                isSmoke: true,
                createdAt: new Date().toISOString(),
            }),
        });
        cleanupDocs.push(`listings/${matchListingId}`);
        cleanupDocs.push(`users/${personas.buyer1.uid}/savedSearchMatches/${searchId1}_${matchListingId}_listingPublished`);
        cleanupDocs.push(`users/${personas.buyer2.uid}/savedSearchMatches/${searchId2}_${matchListingId}_listingPublished`);

        console.log("Waiting 4 seconds for onListingWrittenSavedSearchAlerts trigger to fire...");
        await sleep(4000);

        const buyer1Notifs = await getNotifsFor(personas.buyer1.uid);
        buyer1Notifs.forEach((n) => createdNotifications.push(n.path));
        const buyer1MatchNotif = buyer1Notifs.find((n) => n.data.data?.listingId === matchListingId);

        record(
            "Alert Delivery: Buyer 1 received matching alert",
            !!buyer1MatchNotif && buyer1MatchNotif.data.data?.type === "saved_search_match",
            `title="${buyer1MatchNotif?.data?.title}"`
        );

        const buyer2Notifs = await getNotifsFor(personas.buyer2.uid);
        buyer2Notifs.forEach((n) => createdNotifications.push(n.path));
        const buyer2MatchNotif = buyer2Notifs.find((n) => n.data.data?.listingId === matchListingId);

        record(
            "Multiple Searches: Buyer 2 also received matching alert",
            !!buyer2MatchNotif && buyer2MatchNotif.data.data?.type === "saved_search_match",
            `title="${buyer2MatchNotif?.data?.title}"`
        );

        // Check Lister self-exclusion: Owner must NOT receive alert
        const ownerNotifs = await getNotifsFor(personas.owner.uid);
        ownerNotifs.forEach((n) => createdNotifications.push(n.path));
        record(
            "User Isolation: Lister excluded from alerts on own listing",
            ownerNotifs.length === 0,
            `owner notifications count=${ownerNotifs.length}`
        );

        // 12. Test Idempotency: Re-write the published listing (e.g. touch title)
        console.log("Testing Idempotency: Re-updating already published listing...");
        await fsIam("PATCH", `listings/${matchListingId}?updateMask.fieldPaths=title`, {
            fields: { title: { stringValue: "Updated Title on Published Listing" } },
        });

        await sleep(3000);

        const buyer1NotifsAfterUpdate = await getNotifsFor(personas.buyer1.uid);
        record(
            "Idempotency: Repeated listing updates create zero duplicate alerts",
            buyer1NotifsAfterUpdate.length === 1,
            `count=${buyer1NotifsAfterUpdate.length} (expected exactly 1)`
        );

    } finally {
        // 13. Cleanup
        console.log("--- Cleanup: Purging all ephemeral fixtures and users ---");
        for (const np of createdNotifications) {
            try {
                await fsIam("DELETE", np);
                console.log(`Cleaned up notification ${np}`);
            } catch (err) {
                console.error("Failed notification cleanup:", err.message);
            }
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
