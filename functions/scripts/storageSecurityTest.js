/**
 * Staging Storage rules tests against croww-staging-2026.
 * Uses synthetic Auth personas. Does not print tokens or passwords.
 *
 *   node scripts/storageSecurityTest.js --project croww-staging-2026
 */
const fs = require("fs");
const path = require("path");
const { assertStagingOnly } = require("./projectGuard");
const { cliAccessToken } = require("./cliFirestore");

const PROJECT = "croww-staging-2026";
const BUCKET = "croww-staging-2026.firebasestorage.app";
const API_KEY = "AIzaSyCmKosmKf0qhQMAPdzwAAVcEyWBe82h6Ok";
const STATE_PATH = path.join(__dirname, ".staging-smoke-state.json");
const RESULTS = [];

function record(flow, result, notes) {
    RESULTS.push({ flow, result, notes });
    console.log(`[${result}] ${flow} — ${notes}`);
}

async function signIn(email, password) {
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
    return json.idToken;
}

function objectUrl(objectPath, query = "") {
    const encoded = encodeURIComponent(objectPath);
    return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}${query}`;
}

async function storageRequest({ method, objectPath, token, body, contentType, query }) {
    const isUpload = method === "POST" || method === "PUT";
    const url = isUpload
        ? `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(objectPath)}`
        : objectUrl(objectPath, query || "");
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (contentType) headers["Content-Type"] = contentType;
    const response = await fetch(url, { method, headers, body });
    const text = await response.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_error) {
        json = { raw: text.slice(0, 180) };
    }
    return { ok: response.ok, status: response.status, json };
}

async function gcsPut(objectPath, body, contentType) {
    const token = cliAccessToken();
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": contentType || "text/plain",
        },
        body,
    });
    const json = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, json };
}

async function gcsDelete(objectPath) {
    const token = cliAccessToken();
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(objectPath)}`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: response.ok || response.status === 404, status: response.status };
}

async function main() {
    const guard = assertStagingOnly();
    if (guard.projectId !== PROJECT) throw new Error("refusing non-staging project");
    if (!fs.existsSync(STATE_PATH)) {
        throw new Error("missing .staging-smoke-state.json — run stagingSmokeTest first to create personas");
    }
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const owner = state.personas.owner;
    const buyer = state.personas.buyer;
    if (!owner?.email || !buyer?.email) throw new Error("staging personas missing");

    const ownerToken = await signIn(owner.email, owner.password);
    const buyerToken = await signIn(buyer.email, buyer.password);

    const stamp = Date.now();
    const mediaPath = `property_media/${owner.uid}/stg-media-${stamp}.txt`;
    const privateDocPath = `property_documents/${owner.uid}/stg-doc-${stamp}.txt`;
    const spatialPath = `property_spatial/${owner.uid}/stg-source-${stamp}.bin`;
    const publicDerivedPath = `property_spatial_public/stg-derived-${stamp}/placeholder.txt`;
    const created = [];

    try {
        const mediaWrite = await storageRequest({
            method: "POST",
            objectPath: mediaPath,
            token: ownerToken,
            body: "staging-public-media",
            contentType: "text/plain",
        });
        if (mediaWrite.ok) created.push(mediaPath);
        record("Authorized media operation", mediaWrite.ok ? "PASS" : "FAIL",
            `owner write property_media HTTP ${mediaWrite.status}`);

        const mediaPublicRead = await storageRequest({
            method: "GET",
            objectPath: mediaPath,
            query: "?alt=media",
        });
        record("Public listing media read", mediaWrite.ok && mediaPublicRead.ok ? "PASS" : "FAIL",
            `unauthenticated GET property_media HTTP ${mediaPublicRead.status}`);

        const privateWrite = await storageRequest({
            method: "POST",
            objectPath: privateDocPath,
            token: ownerToken,
            body: "private-property-document",
            contentType: "text/plain",
        });
        if (privateWrite.ok) created.push(privateDocPath);

        const unauthorizedRead = await storageRequest({
            method: "GET",
            objectPath: privateDocPath,
            token: buyerToken,
            query: "?alt=media",
        });
        const unauthAnon = await storageRequest({
            method: "GET",
            objectPath: privateDocPath,
            query: "?alt=media",
        });
        record("Unauthorized media read", privateWrite.ok && !unauthorizedRead.ok && !unauthAnon.ok ? "PASS" : "FAIL",
            `buyer HTTP ${unauthorizedRead.status} anon HTTP ${unauthAnon.status} (expect deny)`);

        const unauthorizedWrite = await storageRequest({
            method: "POST",
            objectPath: `property_media/${owner.uid}/stg-hijack-${stamp}.txt`,
            token: buyerToken,
            body: "should-fail",
            contentType: "text/plain",
        });
        record("Unauthorized media write", unauthorizedWrite.ok ? "FAIL" : "PASS",
            `buyer write to owner property_media HTTP ${unauthorizedWrite.status}`);

        const spatialWrite = await storageRequest({
            method: "POST",
            objectPath: spatialPath,
            token: ownerToken,
            body: "private-spatial-source",
            contentType: "application/octet-stream",
        });
        if (spatialWrite.ok) created.push(spatialPath);
        const spatialOwnerRead = await storageRequest({
            method: "GET",
            objectPath: spatialPath,
            token: ownerToken,
            query: "?alt=media",
        });
        record("Private spatial source access", spatialWrite.ok && spatialOwnerRead.ok ? "PASS" : "FAIL",
            `owner write HTTP ${spatialWrite.status} owner read HTTP ${spatialOwnerRead.status}`);

        const spatialCross = await storageRequest({
            method: "GET",
            objectPath: spatialPath,
            token: buyerToken,
            query: "?alt=media",
        });
        record("Cross-user spatial source denial", spatialWrite.ok && !spatialCross.ok ? "PASS" : "FAIL",
            `buyer read property_spatial HTTP ${spatialCross.status}`);

        const clientPublicWrite = await storageRequest({
            method: "POST",
            objectPath: publicDerivedPath,
            token: ownerToken,
            body: "client-cannot-write-derived",
            contentType: "text/plain",
        });
        const iamPublic = await gcsPut(publicDerivedPath, "server-placed-placeholder-not-a-splat", "text/plain");
        if (iamPublic.ok) created.push(publicDerivedPath);
        const publicRead = await storageRequest({
            method: "GET",
            objectPath: publicDerivedPath,
            query: "?alt=media",
        });
        record("Public derived spatial asset behavior",
            !clientPublicWrite.ok && iamPublic.ok && publicRead.ok ? "PASS" : "FAIL",
            `client write HTTP ${clientPublicWrite.status}; IAM placeholder HTTP ${iamPublic.status}; public read HTTP ${publicRead.status}`);
        record("3D client READY (storage)", "SKIPPED",
            "READY is a Firestore processingStatus field, not a Storage ACL. Firestore client READY is tested in the backend smoke.");
    } finally {
        for (const objectPath of created) {
            await gcsDelete(objectPath);
        }
    }

    console.log("\n=== STORAGE SECURITY SUMMARY ===");
    console.log(JSON.stringify({
        projectId: PROJECT,
        bucket: BUCKET,
        pass: RESULTS.filter((row) => row.result === "PASS").length,
        fail: RESULTS.filter((row) => row.result === "FAIL").length,
        blocked: RESULTS.filter((row) => row.result === "BLOCKED").length,
        skipped: RESULTS.filter((row) => row.result === "SKIPPED").length,
        results: RESULTS,
    }, null, 2));
    if (RESULTS.some((row) => row.result === "FAIL")) process.exitCode = 1;
}

main().catch((error) => {
    console.error("storage_security_failed", error.message);
    process.exit(1);
});
