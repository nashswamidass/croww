/**
 * Additive public_profiles backfill for croww-live-2026.
 * Does not modify users/{uid} documents. Does not print PII or KYC values.
 *
 *   node scripts/backfillPublicProfiles.js --project croww-live-2026 --confirm-production
 */
const { PRODUCTION_PROJECT, assertProjectAllowed } = require("./projectGuard");
const { listCollection, patchDoc } = require("./cliFirestore");

const PROJECT = PRODUCTION_PROJECT;
const NEVER = new Set([
    "email", "phone", "pushToken",
    "kycDetails", "kycStatus", "kycProvider",
    "aadhaarVerified", "aadhaarVerifiedAt", "isVerified", "isApproved",
    "verifiedAt", "verificationData", "verificationStatus", "verificationType",
    "trust", "roles", "isAdmin", "admin",
    "policyAccepted", "policyAcceptedAt", "staff",
]);
const ALWAYS = [
    "name", "username", "avatar", "photoURL", "profileImage", "profilePhotos",
    "coverImage", "role", "category", "bio", "joinedDate", "followersCount", "isBlocked",
];
const MARKETPLACE = [
    "about", "location", "address", "coordinates", "socialLinks", "interests",
    "stats", "packages", "isBusiness", "isProvider", "rating", "reviews",
];

function publicUserType(value) {
    return value === "provider" || value === "business" || value === "individual"
        ? value
        : "individual";
}

function availabilityFromUser(data) {
    if (data.availability && typeof data.availability === "object" && !Array.isArray(data.availability)) {
        return data.availability;
    }
    const dotted = {};
    Object.keys(data || {}).forEach((key) => {
        if (key.startsWith("availability.") && key.length > "availability.".length) {
            dotted[key.slice("availability.".length)] = data[key];
        }
    });
    return Object.keys(dotted).length ? dotted : undefined;
}

function toPublic(uid, data) {
    const userType = publicUserType(data.userType);
    const next = {
        id: uid,
        kind: "publicProfile",
        userType,
        updatedAt: new Date().toISOString(),
    };
    ALWAYS.forEach((key) => {
        if (data[key] !== undefined) next[key] = data[key];
    });
    if (next.role === "admin") next.role = userType;
    if (userType === "provider" || userType === "business") {
        MARKETPLACE.forEach((key) => {
            if (data[key] !== undefined) next[key] = data[key];
        });
        const availability = availabilityFromUser(data);
        if (availability) next.availability = availability;
    }
    NEVER.forEach((key) => {
        delete next[key];
    });
    return next;
}

async function main() {
    const guard = assertProjectAllowed({ apply: true });
    if (guard.projectId !== PROJECT) throw new Error("refusing non-production project");

    const users = await listCollection(PROJECT, "users");
    let wrote = 0;
    users.forEach((_row) => {});
    for (const row of users) {
        const projection = toPublic(row.id, row.data || {});
        const leaked = Object.keys(projection).some((key) => NEVER.has(key));
        if (leaked) throw new Error("refusing to write a public profile that still has private keys");
        await patchDoc(PROJECT, `public_profiles/${row.id}`, projection);
        wrote += 1;
    }
    console.log(JSON.stringify({
        projectId: PROJECT,
        sourceUserDocs: users.length,
        publicProfilesUpserted: wrote,
        parentUserDocumentsModified: false,
        kycCopied: false,
    }));
}

main().catch((error) => {
    console.error("backfill_failed", error.message);
    process.exit(1);
});
