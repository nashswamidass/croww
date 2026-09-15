/**
 * Targeted staging retest: unique property_media spatial UPLOADING create.
 * Does not print tokens or passwords.
 *
 *   node scripts/retestSpatialUpload.js --project croww-staging-2026
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { assertStagingOnly } = require("./projectGuard");
const { encodeMap } = require("./cliFirestore");

const PROJECT = "croww-staging-2026";
const API_KEY = "AIzaSyCmKosmKf0qhQMAPdzwAAVcEyWBe82h6Ok";
const STATE_PATH = path.join(__dirname, ".staging-smoke-state.json");

async function main() {
    assertStagingOnly();
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const owner = state.personas.owner;
    const propertyId = state.records.ownerPropertyId;
    const signed = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: owner.email,
                password: owner.password,
                returnSecureToken: true,
            }),
        }
    ).then((response) => response.json());
    if (!signed.idToken) {
        throw new Error(signed.error?.message || "sign-in failed");
    }
    const mediaId = `stgM_${crypto.randomBytes(4).toString("hex")}`;
    const mask = [
        "createdByUid", "parentType", "parentId", "propertyId", "mediaType",
        "visibility", "status", "processingStatus", "url", "storagePath",
    ].map((key) => `updateMask.fieldPaths=${key}`).join("&");
    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/property_media/${mediaId}?${mask}`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${signed.idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                fields: encodeMap({
                    createdByUid: owner.uid,
                    parentType: "property",
                    parentId: propertyId,
                    propertyId,
                    mediaType: "spatial",
                    visibility: "private",
                    status: "ACTIVE",
                    processingStatus: "UPLOADING",
                    url: null,
                    storagePath: `property_spatial/${owner.uid}/source.bin`,
                }),
            }),
        }
    );
    const json = await response.json();
    console.log(JSON.stringify({
        projectId: PROJECT,
        mediaId,
        propertyId,
        status: response.status,
        ok: response.ok,
        error: json.error?.message || null,
    }));
    if (response.ok) {
        state.records.spatialMediaId = mediaId;
        const persist = {
            ...state,
            personas: Object.fromEntries(
                Object.entries(state.personas).map(([name, persona]) => [
                    name,
                    { email: persona.email, uid: persona.uid, password: persona.password },
                ])
            ),
        };
        fs.writeFileSync(STATE_PATH, JSON.stringify(persist, null, 2));
    }
}

main().catch((error) => {
    console.error("retest_failed", error.message);
    process.exit(1);
});
