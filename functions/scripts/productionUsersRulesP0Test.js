/**
 * Production P0 users/{uid} rules test for croww-live-2026.
 *
 * Creates ephemeral Auth users, exercises Firestore security rules with
 * ID tokens, then deletes those Auth users and their Firestore docs.
 * Does not print tokens, passwords, or KYC/PII values.
 * Does not modify the existing 32 customer accounts.
 *
 *   node scripts/productionUsersRulesP0Test.js --project croww-live-2026 --confirm-production
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { PRODUCTION_PROJECT, assertProjectAllowed } = require("./projectGuard");
const { encodeMap, cliAccessToken, patchDoc, listCollection } = require("./cliFirestore");

const PROJECT = PRODUCTION_PROJECT;
const RESULTS = [];

function record(flow, result, notes) {
    RESULTS.push({ flow, result, notes });
    console.log(`[${result}] ${flow} — ${notes}`);
}

function productionWebApiKey() {
    const gsPath = path.join(__dirname, "../../google-services.json");
    const gs = JSON.parse(fs.readFileSync(gsPath, "utf8"));
    const key = gs?.client?.[0]?.api_key?.[0]?.current_key;
    if (!key) throw new Error("Production web API key missing from google-services.json");
    return key;
}

function randomPassword() {
    return `P0!${crypto.randomBytes(12).toString("base64url")}`;
}

async function identity(apiKey, pathSuffix, body) {
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/${pathSuffix}?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const json = await response.json();
    if (!response.ok) {
        throw new Error(json.error?.message || `identity ${response.status}`);
    }
    return json;
}

async function firestoreWithToken(token, method, urlPath, body) {
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
    try { json = text ? JSON.parse(text) : {}; } catch (_error) {
        json = { raw: text.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, json };
}

async function clientWrite(idToken, docPath, data, { exists }) {
    const mask = Object.keys(data).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
    const pre = `currentDocument.exists=${exists ? "true" : "false"}`;
    return firestoreWithToken(
        idToken,
        "PATCH",
        `documents/${docPath}?${pre}&${mask}`,
        { fields: encodeMap(data) }
    );
}

async function clientGet(idToken, docPath) {
    return firestoreWithToken(idToken, "GET", `documents/${docPath}`);
}

async function clientCreateNamed(idToken, collectionId, docId, data) {
    const query = `documentId=${encodeURIComponent(docId)}`;
    return firestoreWithToken(idToken, "POST", `documents/${collectionId}?${query}`, {
        fields: encodeMap(data),
    });
}

async function clientDelete(idToken, docPath) {
    return firestoreWithToken(idToken, "DELETE", `documents/${docPath}`);
}

async function iamDelete(docPath) {
    const token = cliAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 404) {
        const text = await response.text();
        throw new Error(`IAM delete ${docPath} HTTP ${response.status} ${text.slice(0, 180)}`);
    }
}

function expectDenied(res, flow) {
    record(flow, res.ok ? "FAIL" : "PASS", res.ok ? "write was allowed" : `denied HTTP ${res.status}`);
}

function expectAllowed(res, flow) {
    record(flow, res.ok ? "PASS" : "FAIL", res.ok ? "allowed" : `HTTP ${res.status} ${res.json.error?.status || res.json.error?.message || ""}`);
}

async function fetchDeployedRules() {
    const token = cliAccessToken();
    const rel = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const relJson = await rel.json();
    const rulesetName = relJson.rulesetName || relJson.release?.rulesetName;
    if (!rulesetName) throw new Error("Could not read production Firestore release");
    const rs = await fetch(`https://firebaserules.googleapis.com/v1/${rulesetName}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const rsJson = await rs.json();
    const text = rsJson.source?.files?.[0]?.content || "";
    return { rulesetName, text };
}

async function main() {
    const guard = assertProjectAllowed({ apply: true });
    if (guard.projectId !== PROJECT) {
        throw new Error(`Refusing to run against ${guard.projectId}`);
    }

    const deployed = await fetchDeployedRules();
    const hasProperty = deployed.text.includes("match /properties");
    const hasUserLock = deployed.text.includes("'aadhaarVerified'")
        && deployed.text.includes("clientUserTypeOk()")
        && deployed.text.includes("allow write: if isOwner(userId) || isAdmin()") === false;
    const hasOwnerAdminGet = deployed.text.includes("allow get: if isOwner(userId) || isAdmin()");
    const hasAdminList = deployed.text.includes("allow list: if isAdmin()");
    const hasPublicProfiles = deployed.text.includes("match /public_profiles/{userId}");
    const hasSignedInUserRead = /match \/users\/\{userId\}[\s\S]{0,200}allow read: if isSignedIn\(\)/.test(deployed.text);
    const hasAdminHelper = deployed.text.includes("exists(/databases/$(database)/documents/admins/$(request.auth.uid))")
        && deployed.text.includes(".data.userType == 'admin'");
    record(
        "Deployed ruleset is event-era + users lock + owner/admin read",
        !hasProperty && hasUserLock && hasOwnerAdminGet && hasAdminList && hasPublicProfiles && !hasSignedInUserRead && hasAdminHelper ? "PASS" : "FAIL",
        hasProperty ? "property matches present — wrong ruleset" : `ruleset ${deployed.rulesetName.split("/").pop()}`
    );

    const apiKey = productionWebApiKey();
    const stamp = Date.now();
    const personas = {
        a: { email: `croww.p0.${stamp}.a@croww.test` },
        b: { email: `croww.p0.${stamp}.b@croww.test` },
        c: { email: `croww.p0.${stamp}.c@croww.test` },
    };
    const created = [];
    const extraDocs = [];

    try {
        for (const [name, spec] of Object.entries(personas)) {
            const password = randomPassword();
            const authUser = await identity(apiKey, "accounts:signUp", {
                email: spec.email,
                password,
                returnSecureToken: true,
            });
            spec.uid = authUser.localId;
            spec.idToken = authUser.idToken;
            spec.password = password;
            created.push(spec);
            record("Auth signup", spec.uid ? "PASS" : "FAIL", `ephemeral ${name} created`);
        }

        const profileA = {
            email: personas.a.email,
            name: "P0 Rules A",
            userType: "individual",
            role: "individual",
            aadhaarVerified: false,
            isVerified: false,
            isApproved: false,
            isBlocked: false,
            p0Test: true,
        };
        const createA = await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, profileA, { exists: false });
        expectAllowed(createA, "Owner create allowed profile");

        const createAdminType = await clientWrite(personas.b.idToken, `users/${personas.b.uid}`, {
            email: personas.b.email,
            name: "P0 Rules B",
            userType: "admin",
            aadhaarVerified: false,
            isVerified: false,
        }, { exists: false });
        expectDenied(createAdminType, "Owner create userType=admin");

        const createKyc = await clientWrite(personas.b.idToken, `users/${personas.b.uid}`, {
            email: personas.b.email,
            name: "P0 Rules B",
            userType: "individual",
            aadhaarVerified: true,
            isVerified: true,
            kycDetails: { name: "blocked" },
        }, { exists: false });
        expectDenied(createKyc, "Owner create KYC flags/details");

        const createTrust = await clientWrite(personas.b.idToken, `users/${personas.b.uid}`, {
            email: personas.b.email,
            name: "P0 Rules B",
            userType: "individual",
            aadhaarVerified: false,
            isVerified: false,
            trust: { identity: { status: "VERIFIED" } },
        }, { exists: false });
        expectDenied(createTrust, "Owner create trust");

        const createB = await clientWrite(personas.b.idToken, `users/${personas.b.uid}`, {
            email: personas.b.email,
            name: "P0 Rules B",
            userType: "individual",
            role: "individual",
            aadhaarVerified: false,
            isVerified: false,
            isApproved: false,
            isBlocked: false,
            p0Test: true,
        }, { exists: false });
        expectAllowed(createB, "Owner B create allowed profile");

        const profileUpdate = await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, {
            name: "P0 Rules A updated",
            pushToken: null,
        }, { exists: true });
        expectAllowed(profileUpdate, "Owner profile update");

        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, { userType: "admin" }, { exists: true }),
            "Owner userType=admin"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, { userType: "business" }, { exists: true }),
            "Owner userType mutation"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, { isAdmin: true }, { exists: true }),
            "Owner isAdmin field"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `admins/${personas.a.uid}`, { p0Test: true }, { exists: false }),
            "Owner create admins/{uid}"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, { aadhaarVerified: true, isVerified: true }, { exists: true }),
            "Owner KYC flags"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, { kycDetails: { name: "blocked" } }, { exists: true }),
            "Owner kycDetails"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, { trust: { identity: { status: "VERIFIED" } } }, { exists: true }),
            "Owner trust"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.b.uid}`, { name: "hijack" }, { exists: true }),
            "Cross-user profile write"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.b.uid}`, { userType: "admin" }, { exists: true }),
            "Cross-user protected write"
        );

        const pendingOk = await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, {
            verificationData: { status: "pending", businessName: "P0" },
        }, { exists: true });
        expectAllowed(pendingOk, "Owner verificationData pending");

        expectDenied(
            await clientWrite(personas.a.idToken, `users/${personas.a.uid}`, {
                verificationData: { status: "verified", businessName: "P0" },
            }, { exists: true }),
            "Owner verificationData verified"
        );

        const followId = `p0_${stamp}`;
        extraDocs.push(`follows/${followId}`);
        expectAllowed(
            await clientCreateNamed(personas.a.idToken, "follows", followId, {
                followerId: personas.a.uid,
                followingId: personas.b.uid,
                p0Test: true,
            }),
            "Signed-in follow create"
        );

        const chatId = `p0_${stamp}`;
        extraDocs.push(`chats/${chatId}`);
        expectAllowed(
            await clientCreateNamed(personas.a.idToken, "chats", chatId, {
                participantIds: [personas.a.uid, personas.b.uid],
                p0Test: true,
            }),
            "Signed-in chat create"
        );

        const anonGet = await clientGet(null, `users/${personas.a.uid}`);
        record("Anonymous user read", anonGet.ok ? "FAIL" : "PASS", anonGet.ok ? "anonymous read allowed" : `denied HTTP ${anonGet.status}`);

        const anonWrite = await clientWrite(null, `users/${personas.a.uid}`, { name: "x" }, { exists: true });
        record("Anonymous user write", anonWrite.ok ? "FAIL" : "PASS", anonWrite.ok ? "anonymous write allowed" : `denied HTTP ${anonWrite.status}`);

        const signedRead = await clientGet(personas.a.idToken, `users/${personas.a.uid}`);
        expectAllowed(signedRead, "Signed-in owner read");

        expectDenied(
            await clientGet(personas.a.idToken, `users/${personas.b.uid}`),
            "Cross-user user document read"
        );

        extraDocs.push(`public_profiles/${personas.a.uid}`);
        extraDocs.push(`public_profiles/${personas.b.uid}`);
        extraDocs.push(`public_profiles/${personas.c.uid}`);
        expectAllowed(
            await clientWrite(personas.a.idToken, `public_profiles/${personas.a.uid}`, {
                id: personas.a.uid,
                kind: "publicProfile",
                name: "P0 Rules A",
                userType: "individual",
            }, { exists: false }),
            "Owner public profile create"
        );
        expectAllowed(
            await clientWrite(personas.b.idToken, `public_profiles/${personas.b.uid}`, {
                id: personas.b.uid,
                kind: "publicProfile",
                name: "P0 Rules B",
                userType: "individual",
            }, { exists: false }),
            "Owner B public profile create"
        );
        expectAllowed(
            await clientGet(personas.a.idToken, `public_profiles/${personas.b.uid}`),
            "Cross-user public profile read"
        );
        expectDenied(
            await clientWrite(personas.a.idToken, `public_profiles/${personas.a.uid}`, {
                kind: "publicProfile",
                userType: "individual",
                kycDetails: { name: "blocked" },
            }, { exists: true }),
            "Owner cannot put kycDetails on public profile"
        );

        const usersList = await firestoreWithToken(personas.a.idToken, "GET", "documents/users?pageSize=5");
        record("Non-admin users list", usersList.ok ? "FAIL" : "PASS", usersList.ok ? "list was allowed" : `denied HTTP ${usersList.status}`);

        expectDenied(
            await clientWrite(personas.c.idToken, `users/${personas.c.uid}`, {
                email: personas.c.email,
                name: "P0 Rules C",
                userType: "admin",
                isAdmin: true,
            }, { exists: false }),
            "Owner C create admin flags"
        );

        const createC = await clientWrite(personas.c.idToken, `users/${personas.c.uid}`, {
            email: personas.c.email,
            name: "P0 Rules C",
            userType: "individual",
            role: "individual",
            aadhaarVerified: false,
            isVerified: false,
            p0Test: true,
        }, { exists: false });
        expectAllowed(createC, "Owner C create allowed profile");
        await patchDoc(PROJECT, `users/${personas.c.uid}`, { userType: "admin" });
        expectAllowed(
            await clientGet(personas.c.idToken, `users/${personas.b.uid}`),
            "Admin read of another user"
        );

        const customerUsers = await listCollection(PROJECT, "users");
        const kycIds = customerUsers
            .filter((row) => row.data && row.data.kycDetails && row.data.p0Test !== true)
            .map((row) => row.id);
        let kycDenied = 0;
        for (const kycId of kycIds) {
            const res = await clientGet(personas.a.idToken, `users/${kycId}`);
            if (!res.ok) kycDenied += 1;
        }
        record(
            "KYC-bearing docs cross-user read",
            kycIds.length > 0 && kycDenied === kycIds.length ? "PASS" : (kycIds.length === 0 ? "FAIL" : "FAIL"),
            `${kycDenied}/${kycIds.length} denied (ids not printed)`
        );

        const bookingId = `p0_${stamp}`;
        extraDocs.push(`bookings/${bookingId}`);
        expectAllowed(
            await clientCreateNamed(personas.a.idToken, "bookings", bookingId, {
                senderId: personas.a.uid,
                providerId: personas.b.uid,
                p0Test: true,
            }),
            "Signed-in booking create"
        );

        const eventId = `p0_${stamp}`;
        extraDocs.push(`events/${eventId}`);
        expectAllowed(
            await clientCreateNamed(personas.a.idToken, "events", eventId, {
                organizerId: personas.a.uid,
                isPublic: false,
                p0Test: true,
            }),
            "Signed-in event create"
        );

        record(
            "Legitimate admin helper preserved",
            hasAdminHelper ? "PASS" : "FAIL",
            "isAdmin() still uses admins/{uid} OR existing userType=admin (not a client-writable field after this lock)"
        );
    } finally {
        for (const docPath of extraDocs) {
            try {
                await iamDelete(docPath);
            } catch (error) {
                record("Cleanup extra doc", "FAIL", error.message);
            }
        }
        for (const spec of created) {
            try {
                if (spec.idToken) {
                    await identity(apiKey, "accounts:delete", { idToken: spec.idToken });
                }
            } catch (error) {
                record("Cleanup Auth", "FAIL", error.message.split(" ")[0]);
            }
            try {
                if (spec.uid) await iamDelete(`users/${spec.uid}`);
            } catch (error) {
                record("Cleanup user doc", "FAIL", error.message);
            }
        }
    }

    const failed = RESULTS.filter((row) => row.result === "FAIL");
    console.log(JSON.stringify({
        projectId: PROJECT,
        total: RESULTS.length,
        failed: failed.length,
        results: RESULTS,
    }, null, 2));
    if (failed.length) process.exit(1);
}

main().catch((error) => {
    console.error("p0_rules_test_failed", error.message);
    process.exit(1);
});
