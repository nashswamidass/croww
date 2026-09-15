/**
 * npm run deploy in functions/ used to call `firebase deploy --only functions`
 * with whatever CLI alias was selected. That is unsafe because the local
 * alias is often production (`croww-live-2026`).
 *
 * Staging:
 *   firebase deploy --only functions --project croww-staging-2026 --non-interactive
 *
 * Production deploys are human-only and must never go through this script.
 */
const { PRODUCTION_PROJECT, STAGING_PROJECT } = require("./projectGuard");

console.error("Refusing unscoped Cloud Functions deploy.");
console.error(`Staging: firebase deploy --only functions --project ${STAGING_PROJECT} --non-interactive`);
console.error(`Production (${PRODUCTION_PROJECT}) is not available via npm run deploy.`);
process.exit(1);
