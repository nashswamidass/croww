/**
 * One-shot connectivity check for croww-staging-2026 using Firebase CLI login.
 * Does not print tokens.
 */
const { assertStagingOnly } = require("./projectGuard");
const { initAdmin } = require("./initAdmin");
const admin = require("firebase-admin");

async function main() {
    const guard = assertStagingOnly();
    initAdmin(guard.projectId);
    const snap = await admin.firestore().collection("listings").limit(1).get();
    console.log(JSON.stringify({
        projectId: guard.projectId,
        adminOk: true,
        listingsSampleSize: snap.size,
    }));
}

main().catch((error) => {
    console.error("admin_check_failed", error.code || "", error.message);
    process.exit(1);
});
