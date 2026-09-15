/**
 * Production Phase 5B Live Security and Functional Tests.
 * Target: croww-live-2026
 *
 * Tests:
 * 1. Unauthorized verification review:
 *    - Buyer attempting reviewVerification -> 403
 *    - Owner attempting reviewVerification -> 403
 *    - Agent attempting reviewVerification -> 403
 * 2. Authorized review (Approval):
 *    - Admin approves case -> 200, status = VERIFIED
 *    - Server-controlled reviewer identity (reviewedByUid) and review timestamp (reviewedAt)
 *    - Public projection updated to VERIFIED with verifiedAt
 *    - Case history written
 * 3. Rejection path:
 *    - Admin rejects case -> 200, status = REJECTED
 *    - Server-controlled reviewer identity, timestamp, and reason
 *    - Public projection updated to REJECTED with verifiedAt = null
 * 4. Trigger execution (onVerificationCaseCreated):
 *    - Fires on case create
 *    - Public projection updated to PENDING
 *    - History written
 *    - Submitter notified
 * 5. Authentication failures:
 *    - Missing token -> 401
 *    - Invalid token -> 401
 *    - Missing required parameters -> 400
 *    - Nonexistent case -> 404
 * 6. Cross-user security / authorization boundaries:
 *    - Submitter not permitted -> 409
 *    - Invalid status transitions -> 409
 * 7. Full cleanup and data invariance check.
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

const REVIEW_URL = "https://us-central1-croww-live-2026.cloudfunctions.net/reviewVerification";

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
    console.log("Starting Production Phase 5B Verification Functions Live Tests on croww-live-2026...");
    const stamp = Date.now();
    const createdUsers = [];
    const cleanupDocs = [];
    const createdNotifications = [];

    const propId = `smoke-prop-verif-${stamp}`;
    const caseId1 = `smoke-case-approve-${stamp}`;
    const caseId2 = `smoke-case-reject-${stamp}`;
    const invalidSubCaseId = `smoke-case-badsub-${stamp}`;

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
            const email = `smoke.phase5b.${stamp}.${key}@croww.test`;
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

        // 2. Create Ephemeral Property for OWNERSHIP Verification
        console.log("--- 2. Creating Ephemeral Property for Verification ---");
        const propertyData = {
            id: propId,
            title: "Phase 5B Verification Smoke Property",
            propertyType: "apartment",
            ownerUid: personas.owner.uid,
            createdByUid: personas.owner.uid,
            locationPrecision: "approximate",
            latitude: 13.0827,
            longitude: 80.2707,
            geohash: "tf34upt",
            geo: { latitude: 13.0827, longitude: 80.2707 },
            isSmoke: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `properties/${propId}?currentDocument.exists=false`, {
            fields: encodeMap(propertyData),
        });
        cleanupDocs.push(`properties/${propId}`);

        // 3. Create Ephemeral Case 1 (OWNERSHIP, PENDING)
        console.log("--- 3. Testing onVerificationCaseCreated Trigger ---");
        const case1Data = {
            id: caseId1,
            type: "OWNERSHIP",
            propertyId: propId,
            subjectId: propId,
            submittedByUid: personas.owner.uid,
            status: "PENDING",
            isSmoke: true,
            createdAt: new Date().toISOString(),
            submittedAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `verification_cases/${caseId1}?currentDocument.exists=false`, {
            fields: encodeMap(case1Data),
        });
        cleanupDocs.push(`verification_cases/${caseId1}`);

        // Wait for onVerificationCaseCreated trigger to execute
        console.log("Waiting 4 seconds for onVerificationCaseCreated trigger...");
        await sleep(4000);

        // Check public projection on property
        const propAfterSnap = await fsIam("GET", `properties/${propId}`);
        const propAfter = decodeMap(propAfterSnap.json.fields || {});
        const propOwnershipVerif = propAfter.verification?.ownership;
        record(
            "Trigger: Public projection set to PENDING on property",
            propOwnershipVerif?.status === "PENDING",
            `status=${propOwnershipVerif?.status}`
        );

        // Check history on caseId1
        const historySnap = await fsIam("GET", `verification_cases/${caseId1}/history`);
        const historyDocs = (historySnap.json.documents || []).map((d) => decodeMap(d.fields || {}));
        const hasPendingHistory = historyDocs.some(
            (h) => h.fromStatus === "NOT_VERIFIED" && h.toStatus === "PENDING" && h.actorUid === personas.owner.uid
        );
        record(
            "Trigger: History subcollection written",
            hasPendingHistory,
            `history docs count=${historyDocs.length}`
        );
        if (historySnap.json.documents) {
            historySnap.json.documents.forEach((d) => {
                cleanupDocs.push(d.name.replace(`projects/${PROJECT}/databases/(default)/documents/`, ""));
            });
        }

        // Check notification generated for owner
        const token = cliAccessToken();
        const notifRes = await fetch(
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
                                value: { stringValue: personas.owner.uid },
                            },
                        },
                    },
                }),
            }
        );
        const notifData = await notifRes.json();
        const notifications = (Array.isArray(notifData) ? notifData : [])
            .filter((row) => row.document)
            .map((row) => ({
                path: row.document.name.replace(`projects/${PROJECT}/databases/(default)/documents/`, ""),
                data: decodeMap(row.document.fields || {}),
            }));

        const pendingNotif = notifications.find(
            (n) => n.data.data?.verificationId === caseId1 && n.data.data?.verificationStatus === "PENDING"
        );
        record(
            "Trigger: Submitter notification generated",
            !!pendingNotif,
            `notification title="${pendingNotif?.data?.title}"`
        );
        notifications.forEach((n) => createdNotifications.push(n.path));

        // 4. Test Unauthorized Paths on reviewVerification
        console.log("--- 4. Testing Unauthorized reviewVerification Calls ---");

        // A. Buyer attempts review
        const buyerReview = await callFunction(REVIEW_URL, personas.buyer.idToken, {
            verificationId: caseId1,
            decision: "APPROVED",
        });
        record(
            "Security: Buyer review rejected",
            buyerReview.status === 403,
            `HTTP ${buyerReview.status} (expected 403) - ${JSON.stringify(buyerReview.json)}`
        );

        // B. Owner attempts self-review
        const ownerReview = await callFunction(REVIEW_URL, personas.owner.idToken, {
            verificationId: caseId1,
            decision: "APPROVED",
        });
        record(
            "Security: Owner self-review rejected",
            ownerReview.status === 403,
            `HTTP ${ownerReview.status} (expected 403) - ${JSON.stringify(ownerReview.json)}`
        );

        // C. Agent attempts review
        const agentReview = await callFunction(REVIEW_URL, personas.agent.idToken, {
            verificationId: caseId1,
            decision: "APPROVED",
        });
        record(
            "Security: Agent review rejected",
            agentReview.status === 403,
            `HTTP ${agentReview.status} (expected 403) - ${JSON.stringify(agentReview.json)}`
        );

        // 5. Test Authentication & Parameter Failures
        console.log("--- 5. Testing Authentication and Parameter Failures ---");

        // Missing token
        const noToken = await callFunction(REVIEW_URL, null, { verificationId: caseId1, decision: "APPROVED" });
        record("Failure: Missing Bearer token", noToken.status === 401, `HTTP ${noToken.status} (expected 401)`);

        // Invalid token
        const badToken = await callFunction(REVIEW_URL, "invalid-bearer-token", { verificationId: caseId1, decision: "APPROVED" });
        record("Failure: Invalid Bearer token", badToken.status === 401, `HTTP ${badToken.status} (expected 401)`);

        // Missing verificationId
        const missingId = await callFunction(REVIEW_URL, personas.admin.idToken, { decision: "APPROVED" });
        record("Failure: Missing verificationId", missingId.status === 400, `HTTP ${missingId.status} (expected 400)`);

        // Invalid decision
        const badDecision = await callFunction(REVIEW_URL, personas.admin.idToken, { verificationId: caseId1, decision: "MAYBE" });
        record("Failure: Invalid decision value", badDecision.status === 400, `HTTP ${badDecision.status} (expected 400)`);

        // Nonexistent case
        const notFound = await callFunction(REVIEW_URL, personas.admin.idToken, { verificationId: "nonexistent-case-id", decision: "APPROVED" });
        record("Failure: Nonexistent case ID", notFound.status === 404, `HTTP ${notFound.status} (expected 404)`);

        // 6. Test Cross-User / Submitter Authorization Boundary
        console.log("--- 6. Testing Submitter Authorization Boundary ---");
        // Create case where submittedByUid does NOT own the property
        const badSubCase = {
            id: invalidSubCaseId,
            type: "OWNERSHIP",
            propertyId: propId,
            subjectId: propId,
            submittedByUid: personas.buyer.uid, // Buyer does NOT own propId!
            status: "PENDING",
            isSmoke: true,
            createdAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `verification_cases/${invalidSubCaseId}?currentDocument.exists=false`, {
            fields: encodeMap(badSubCase),
        });
        cleanupDocs.push(`verification_cases/${invalidSubCaseId}`);

        const badSubReview = await callFunction(REVIEW_URL, personas.admin.idToken, {
            verificationId: invalidSubCaseId,
            decision: "APPROVED",
        });
        record(
            "Boundary: Unauthorized submitter rejected on review",
            badSubReview.status === 409 && badSubReview.json.error === "SUBMITTER_NOT_PERMITTED",
            `HTTP ${badSubReview.status}, error=${badSubReview.json.error}`
        );

        // 7. Test Authorized Approval Path (Case 1)
        console.log("--- 7. Testing Authorized Admin Approval ---");
        const adminApprove = await callFunction(REVIEW_URL, personas.admin.idToken, {
            verificationId: caseId1,
            decision: "APPROVED",
        });
        record(
            "Admin: Approval successful",
            adminApprove.status === 200 && adminApprove.json.status === "VERIFIED",
            `HTTP ${adminApprove.status}, status=${adminApprove.json.status}`
        );

        // Verify case document in Firestore
        const case1Snap = await fsIam("GET", `verification_cases/${caseId1}`);
        const case1DataAfter = decodeMap(case1Snap.json.fields || {});
        record(
            "Verification Case 1: Status is VERIFIED",
            case1DataAfter.status === "VERIFIED" && case1DataAfter.reviewedByUid === personas.admin.uid && !!case1DataAfter.reviewedAt,
            `status=${case1DataAfter.status}, reviewedByUid=${case1DataAfter.reviewedByUid}`
        );

        // Verify public projection on property
        const propApprovedSnap = await fsIam("GET", `properties/${propId}`);
        const propApproved = decodeMap(propApprovedSnap.json.fields || {});
        const propVerifApproved = propApproved.verification?.ownership;
        record(
            "Public Projection: Property ownership is VERIFIED",
            propVerifApproved?.status === "VERIFIED" && !!propVerifApproved?.verifiedAt,
            `status=${propVerifApproved?.status}, verifiedAt=${propVerifApproved?.verifiedAt}`
        );

        // Verify history doc added for approval
        const historyApprovedSnap = await fsIam("GET", `verification_cases/${caseId1}/history`);
        const historyApprovedDocs = (historyApprovedSnap.json.documents || []).map((d) => decodeMap(d.fields || {}));
        const hasVerifiedHistory = historyApprovedDocs.some(
            (h) => h.fromStatus === "PENDING" && h.toStatus === "VERIFIED" && h.actorUid === personas.admin.uid
        );
        record(
            "History: Approval record written",
            hasVerifiedHistory,
            `verified history found=${hasVerifiedHistory}`
        );
        if (historyApprovedSnap.json.documents) {
            historyApprovedSnap.json.documents.forEach((d) => {
                cleanupDocs.push(d.name.replace(`projects/${PROJECT}/databases/(default)/documents/`, ""));
            });
        }

        // Test invalid transition: Cannot approve already VERIFIED case
        const doubleApprove = await callFunction(REVIEW_URL, personas.admin.idToken, {
            verificationId: caseId1,
            decision: "APPROVED",
        });
        record(
            "Transition Boundary: Cannot re-approve VERIFIED case",
            doubleApprove.status === 409 && doubleApprove.json.error === "INVALID_STATUS_TRANSITION",
            `HTTP ${doubleApprove.status}, error=${doubleApprove.json.error}`
        );

        // 8. Test Authorized Rejection Path (Case 2: User Role OWNER)
        console.log("--- 8. Testing Authorized Admin Rejection ---");
        const case2Data = {
            id: caseId2,
            type: "OWNER",
            subjectId: personas.owner.uid,
            submittedByUid: personas.owner.uid,
            status: "PENDING",
            isSmoke: true,
            createdAt: new Date().toISOString(),
            submittedAt: new Date().toISOString(),
        };
        await fsIam("PATCH", `verification_cases/${caseId2}?currentDocument.exists=false`, {
            fields: encodeMap(case2Data),
        });
        cleanupDocs.push(`verification_cases/${caseId2}`);

        await sleep(3000); // Allow onCreate trigger to register

        const rejectReason = "Insufficient identity documentation";
        const adminReject = await callFunction(REVIEW_URL, personas.admin.idToken, {
            verificationId: caseId2,
            decision: "REJECTED",
            reason: rejectReason,
        });
        record(
            "Admin: Rejection successful",
            adminReject.status === 200 && adminReject.json.status === "REJECTED",
            `HTTP ${adminReject.status}, status=${adminReject.json.status}`
        );

        // Verify case document
        const case2Snap = await fsIam("GET", `verification_cases/${caseId2}`);
        const case2DataAfter = decodeMap(case2Snap.json.fields || {});
        record(
            "Verification Case 2: Status is REJECTED with reason",
            case2DataAfter.status === "REJECTED" &&
                case2DataAfter.reason === rejectReason &&
                case2DataAfter.reviewedByUid === personas.admin.uid,
            `status=${case2DataAfter.status}, reason="${case2DataAfter.reason}"`
        );

        // Verify public projection on user trust
        const ownerSnap = await fsIam("GET", `users/${personas.owner.uid}`);
        const ownerData = decodeMap(ownerSnap.json.fields || {});
        const ownerTrustSlice = ownerData.trust?.owner;
        record(
            "Public Projection: User trust.owner is REJECTED",
            ownerTrustSlice?.status === "REJECTED" && ownerTrustSlice?.verifiedAt === null,
            `status=${ownerTrustSlice?.status}, verifiedAt=${ownerTrustSlice?.verifiedAt}`
        );

        // Track history subcollection docs for caseId2
        const historyRejectSnap = await fsIam("GET", `verification_cases/${caseId2}/history`);
        if (historyRejectSnap.json.documents) {
            historyRejectSnap.json.documents.forEach((d) => {
                cleanupDocs.push(d.name.replace(`projects/${PROJECT}/databases/(default)/documents/`, ""));
            });
        }

    } finally {
        // 9. Cleanup
        console.log("--- 9. Cleaning up Ephemeral Fixtures, Notifications, and Users ---");
        // Gather any notifications for test personas
        for (const user of createdUsers) {
            try {
                const token = cliAccessToken();
                const notifRes = await fetch(
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
                                        value: { stringValue: user.uid },
                                    },
                                },
                            },
                        }),
                    }
                );
                const notifData = await notifRes.json();
                const notifs = (Array.isArray(notifData) ? notifData : [])
                    .filter((row) => row.document)
                    .map((row) => row.document.name.replace(`projects/${PROJECT}/databases/(default)/documents/`, ""));
                for (const np of notifs) {
                    await fsIam("DELETE", np);
                    console.log(`Cleaned up notification ${np}`);
                }
            } catch (err) {
                console.error("Failed to clean up notifications:", err.message);
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
