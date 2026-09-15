/**
 * Targeted cleanup of staging smoke-test records created by stagingSmokeTest.js.
 * Does not wipe unrelated staging data.
 *
 *   node scripts/cleanupStagingSmoke.js --project croww-staging-2026
 */
const fs = require("fs");
const path = require("path");
const { assertStagingOnly } = require("./projectGuard");
const { cliAccessToken } = require("./cliFirestore");

const STATE_PATH = path.join(__dirname, ".staging-smoke-state.json");

/** Leftover IDs from the 2026-09-11 smoke if a later run overwrote the state file. */
const PRIOR_SMOKE_PATHS = [
    "localities/staging-smoke-whitefield",
    "properties/stg_ac9cc89c6dca/private_geo/current",
    "properties/stg_ac9cc89c6dca",
    "properties/stg_2bd1bfd53f37/private_geo/current",
    "properties/stg_2bd1bfd53f37",
    "properties/stg_30bd2498ce78/private_geo/current",
    "properties/stg_30bd2498ce78",
    "properties/stg_a5ad8aba4ac1/private_geo/current",
    "properties/stg_a5ad8aba4ac1",
    "listings/stgL_15f7a061be3c/private_meta/current",
    "listings/stgL_15f7a061be3c",
    "listings/stgL_a7fe4c7582c0/private_meta/current",
    "listings/stgL_a7fe4c7582c0",
    "listings/stgL_e62ce437aa58/private_meta/current",
    "listings/stgL_e62ce437aa58",
    "listings/stgL_9602c1cdf363/private_meta/current",
    "listings/stgL_9602c1cdf363",
    "verification_cases/stgV_3e73ea9b",
    "property_media/stgM_uploading",
    "chats/stgC_BvlPeioj6TaMLfjH48Clf5IB5Ph1_kzTwIWRpghh/messages/m1",
    "chats/stgC_BvlPeioj6TaMLfjH48Clf5IB5Ph1_kzTwIWRpghh",
    "users/BvlPeioj6TaMLfjH48Clf5IB5Ph1/savedSearches/stgS_cd8bcd3b",
    "properties/stg_4516c6d84ef3/private_geo/current",
    "properties/stg_4516c6d84ef3",
    "properties/stg_838bbb99d92f/private_geo/current",
    "properties/stg_838bbb99d92f",
    "properties/stg_28cb3fbc9b48/private_geo/current",
    "properties/stg_28cb3fbc9b48",
    "properties/stg_01fc3ed0ee6c/private_geo/current",
    "properties/stg_01fc3ed0ee6c",
    "listings/stgL_333b2d3fb079/private_meta/current",
    "listings/stgL_333b2d3fb079",
    "listings/stgL_06784be2805a/private_meta/current",
    "listings/stgL_06784be2805a",
    "listings/stgL_bc303091664d/private_meta/current",
    "listings/stgL_bc303091664d",
    "listings/stgL_015c25f2aa9b/private_meta/current",
    "listings/stgL_015c25f2aa9b",
    "verification_cases/stgV_198b113f",
    "property_media/stgM_c95e6096",
    "users/BvlPeioj6TaMLfjH48Clf5IB5Ph1/savedSearches/stgS_dbe4e61b",
];

async function deletePath(projectId, docPath) {
    const token = cliAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    return { path: docPath, status: response.status, ok: response.status === 200 || response.status === 404 };
}

async function main() {
    const guard = assertStagingOnly();
    const state = fs.existsSync(STATE_PATH)
        ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
        : { records: {}, personas: {} };
    const rec = state.records || {};
    const personas = state.personas || {};
    const paths = [
        rec.localityId && `localities/${rec.localityId}`,
        rec.ownerPropertyId && `properties/${rec.ownerPropertyId}/private_geo/current`,
        rec.ownerPropertyId && `properties/${rec.ownerPropertyId}`,
        rec.rentPropertyId && `properties/${rec.rentPropertyId}/private_geo/current`,
        rec.rentPropertyId && `properties/${rec.rentPropertyId}`,
        rec.agentPropertyId && `properties/${rec.agentPropertyId}/private_geo/current`,
        rec.agentPropertyId && `properties/${rec.agentPropertyId}`,
        rec.builderPropertyId && `properties/${rec.builderPropertyId}/private_geo/current`,
        rec.builderPropertyId && `properties/${rec.builderPropertyId}`,
        rec.buyListingId && `listings/${rec.buyListingId}/private_meta/current`,
        rec.buyListingId && `listings/${rec.buyListingId}`,
        rec.rentListingId && `listings/${rec.rentListingId}/private_meta/current`,
        rec.rentListingId && `listings/${rec.rentListingId}`,
        rec.agentListingId && `listings/${rec.agentListingId}/private_meta/current`,
        rec.agentListingId && `listings/${rec.agentListingId}`,
        rec.builderListingId && `listings/${rec.builderListingId}/private_meta/current`,
        rec.builderListingId && `listings/${rec.builderListingId}`,
        rec.verificationCaseId && `verification_cases/${rec.verificationCaseId}`,
        rec.spatialMediaId && `property_media/${rec.spatialMediaId}`,
        rec.chatId && `chats/${rec.chatId}/messages/m1`,
        rec.chatId && `chats/${rec.chatId}`,
        rec.savedSearchId && personas.buyer?.uid && `users/${personas.buyer.uid}/savedSearches/${rec.savedSearchId}`,
        personas.buyer?.uid && `users/${personas.buyer.uid}/preferences/areaScore`,
        personas.admin?.uid && `admins/${personas.admin.uid}`,
        personas.agent?.uid && `users/${personas.agent.uid}/preferences/areaScore`,
    ].filter(Boolean);

    PRIOR_SMOKE_PATHS.forEach((docPath) => paths.push(docPath));

    Object.values(personas).forEach((persona) => {
        if (persona?.uid) paths.push(`users/${persona.uid}`);
    });

    const uniquePaths = [...new Set(paths)];
    const results = [];
    for (const docPath of uniquePaths) {
        results.push(await deletePath(guard.projectId, docPath));
    }
    console.log(JSON.stringify({
        projectId: guard.projectId,
        deleted: results.filter((row) => row.ok).length,
        failed: results.filter((row) => !row.ok),
        note: "Auth users are not deleted. Delete them in Firebase Auth console if desired.",
    }, null, 2));
}

main().catch((error) => {
    console.error("cleanup_failed", error.message);
    process.exit(1);
});
