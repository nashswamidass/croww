/**
 * Production Security Rules Sanity Check
 * Target: croww-live-2026
 *
 * Performs safe, non-destructive validation of live production Firestore security rules.
 * Does NOT create or alter any real production listings or customer data.
 */
const { assertProjectAllowed, PRODUCTION_PROJECT } = require("./projectGuard");

const PROJECT = PRODUCTION_PROJECT;
const RESULTS = [];

function record(check, pass, detail) {
    RESULTS.push({ check, pass, detail });
    const mark = pass ? "PASS" : "FAIL";
    console.log(`[${mark}] ${check}: ${detail}`);
}

async function firestoreRequest(token, method, urlPath, body) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/${urlPath}`;
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = {};
    try {
        json = text ? JSON.parse(text) : {};
    } catch (_e) {
        json = { raw: text.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, json };
}

async function main() {
    assertProjectAllowed({ apply: false });
    console.log(`\n============================================================`);
    console.log(`CROWW — PRODUCTION FIRESTORE RULES SANITY CHECK`);
    console.log(`Target: ${PROJECT}`);
    console.log(`============================================================\n`);

    const dummyListingId = "prod_sanity_check_nonexistent";
    const dummyHistId = "prod_sanity_check_hist_dummy";

    // 1. Unauthorized availability mutation is blocked
    const unauthMutate = await firestoreRequest(
        null,
        "PATCH",
        `documents/listings/${dummyListingId}?updateMask.fieldPaths=availableCount`,
        {
            fields: {
                availableCount: { integerValue: "5" },
            },
        }
    );
    record(
        "Unauthorized availability mutation blocked",
        unauthMutate.status === 403,
        `Unauthenticated mutation returned HTTP ${unauthMutate.status} (Forbidden)`
    );

    // 2. Protected-field mutation is blocked
    const protectedFieldTamper = await firestoreRequest(
        null,
        "PATCH",
        `documents/listings/${dummyListingId}?updateMask.fieldPaths=ownerUid&updateMask.fieldPaths=listedByUid`,
        {
            fields: {
                ownerUid: { stringValue: "malicious_actor" },
                listedByUid: { stringValue: "malicious_actor" },
            },
        }
    );
    record(
        "Protected-field mutation blocked",
        protectedFieldTamper.status === 403,
        `Tamper attempt returned HTTP ${protectedFieldTamper.status} (Forbidden)`
    );

    // 3. History update is blocked (rule: allow update: if false;)
    const histUpdate = await firestoreRequest(
        null,
        "PATCH",
        `documents/listings/${dummyListingId}/availability_history/${dummyHistId}?updateMask.fieldPaths=newAvailableCount`,
        {
            fields: {
                newAvailableCount: { integerValue: "99" },
            },
        }
    );
    record(
        "History update blocked",
        histUpdate.status === 403,
        `History update attempt returned HTTP ${histUpdate.status} (Forbidden)`
    );

    // 4. History delete is blocked (rule: allow delete: if false;)
    const histDelete = await firestoreRequest(
        null,
        "DELETE",
        `documents/listings/${dummyListingId}/availability_history/${dummyHistId}`
    );
    record(
        "History delete blocked",
        histDelete.status === 403,
        `History delete attempt returned HTTP ${histDelete.status} (Forbidden)`
    );

    console.log("\n============================================================");
    const passed = RESULTS.filter((r) => r.pass).length;
    const failed = RESULTS.filter((r) => !r.pass).length;
    console.log(`TOTAL CHECKS: ${RESULTS.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("============================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Fatal sanity check error:", err);
    process.exit(1);
});
