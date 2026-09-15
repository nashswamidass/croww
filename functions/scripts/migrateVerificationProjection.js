/**
 * Idempotent property-trust projection helper.
 *
 * Does NOT convert legacy booleans or unverified maps to VERIFIED.
 * Missing public slices may be filled as NOT_VERIFIED only.
 *
 *   cd functions
 *   node scripts/migrateVerificationProjection.js --project croww-staging-2026
 *   node scripts/migrateVerificationProjection.js --project croww-staging-2026 --apply
 *
 * Production:
 *   node scripts/migrateVerificationProjection.js --project croww-live-2026 --apply --confirm-production
 *
 * Never manufacture trust.
 */
const { assertProjectAllowed, hasFlag } = require("./projectGuard");
const { listCollection, patchDoc } = require("./cliFirestore");

const APPLY = hasFlag("--apply");

function emptySlice() {
    return {
        status: "NOT_VERIFIED",
        verifiedAt: null,
        expiresAt: null,
        updatedAt: new Date(),
    };
}

function needsEmptySlice(value) {
    return !value || typeof value !== "object" || !value.status;
}

function looksBooleanVerified(value) {
    return value === true || value?.status === true || value?.status === "true";
}

async function migrate() {
    const guard = assertProjectAllowed({ apply: APPLY });
    let filledProperties = 0;
    let filledListings = 0;
    let skippedVerifiedAssumption = 0;

    const properties = await listCollection(guard.projectId, "properties");
    for (const snap of properties) {
        const data = snap.data || {};
        const verification = data.verification && typeof data.verification === "object"
            ? { ...data.verification }
            : {};
        let changed = false;
        ["identity", "ownership", "property", "location"].forEach((key) => {
            if (needsEmptySlice(verification[key])) {
                verification[key] = emptySlice();
                changed = true;
            }
            if (looksBooleanVerified(data.verification?.[key])) skippedVerifiedAssumption += 1;
        });
        if (changed) {
            filledProperties += 1;
            if (APPLY) await patchDoc(guard.projectId, `properties/${snap.id}`, { verification });
        }
    }

    const listings = await listCollection(guard.projectId, "listings");
    for (const snap of listings) {
        const data = snap.data || {};
        const verification = data.verification && typeof data.verification === "object"
            ? { ...data.verification }
            : {};
        if (looksBooleanVerified(verification.representation) || data.representationStatus === true) {
            skippedVerifiedAssumption += 1;
        }
        if (needsEmptySlice(verification.representation)) {
            filledListings += 1;
            if (APPLY) {
                await patchDoc(guard.projectId, `listings/${snap.id}`, {
                    verification: { ...verification, representation: emptySlice() },
                });
            }
        }
    }

    console.log(JSON.stringify({
        mode: APPLY ? "apply" : "dry-run",
        projectId: guard.projectId,
        propertiesProcessed: properties.length,
        listingsProcessed: listings.length,
        filledMissingNotVerifiedProperties: filledProperties,
        filledMissingNotVerifiedListings: filledListings,
        booleanLikeSkipped: skippedVerifiedAssumption,
        note: "Booleans were not promoted to VERIFIED",
    }, null, 2));
}

migrate().catch((error) => {
    console.error("migration_failed", error.message);
    process.exit(1);
});
