/**
 * Shared guard for read-only / migration scripts.
 * Never run production writes from an agent session unless a human passes --confirm-production.
 */

const PRODUCTION_PROJECT = "croww-live-2026";
const STAGING_PROJECT = "croww-staging-2026";

function hasFlag(name) {
    return process.argv.includes(name);
}

function argValue(name) {
    const index = process.argv.indexOf(name);
    if (index === -1 || !process.argv[index + 1]) return null;
    return process.argv[index + 1];
}

function resolveProjectId() {
    return argValue("--project")
        || process.env.GCLOUD_PROJECT
        || process.env.GOOGLE_CLOUD_PROJECT
        || process.env.FIREBASE_PROJECT_ID
        || process.env.GCLOUD_PROJECT_ID
        || null;
}

function assertProjectAllowed({ apply }) {
    const projectId = resolveProjectId();
    if (!projectId) {
        throw new Error("Set --project <id> or FIREBASE_PROJECT_ID. Refusing to guess staging vs production.");
    }
    if (projectId !== PRODUCTION_PROJECT && projectId !== STAGING_PROJECT) {
        throw new Error(
            `Refusing unknown Firebase project ${projectId}. Allowed: ${STAGING_PROJECT}, ${PRODUCTION_PROJECT}.`
        );
    }
    if (projectId === PRODUCTION_PROJECT && apply && !hasFlag("--confirm-production")) {
        throw new Error("Refusing production writes. Pass --confirm-production after a successful staging dry-run.");
    }
    return {
        projectId,
        apply: Boolean(apply),
        confirmProduction: hasFlag("--confirm-production"),
        isProduction: projectId === PRODUCTION_PROJECT,
        isStaging: projectId === STAGING_PROJECT,
    };
}

function assertStagingOnly() {
    const guard = assertProjectAllowed({ apply: false });
    if (!guard.isStaging) {
        throw new Error(`This command is staging-only. Target must be ${STAGING_PROJECT}.`);
    }
    return guard;
}

module.exports = {
    PRODUCTION_PROJECT,
    STAGING_PROJECT,
    hasFlag,
    argValue,
    resolveProjectId,
    assertProjectAllowed,
    assertStagingOnly,
};
