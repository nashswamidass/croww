# Croww staging smoke test

**Date:** 2026-09-12 (Pass 3)  
**Verdict:** **STAGING STILL BLOCKED — BILLING**  
**Target:** `croww-staging-2026` only. Production (`croww-live-2026`) was not deployed, migrated, or written.

Companion: `docs/CROWW_PRODUCTION_READINESS.md`

Do not include secret values in this file.

---

## Pass 1 vs Pass 2

| Pass | When (UTC) | What | Result |
|------|------------|------|--------|
| **1** | 2026-09-12 06:58–07:05 | Firestore rules + indexes + client REST smoke | Rules/indexes live. Client self-publish/geo/KYC-write denies pass. Functions/Storage not deployed. |
| **2** | 2026-09-12 07:28–07:43 | Billing re-check, Storage init, Functions deploy, server-side smoke | **Stopped.** Billing account for project `113101837709` is not open. Storage still uninitialized. No Functions. No server `publishListing` / alerts / `reviewVerification`. TypeScript predicate fix landed; full `tsc` exit **0**. |
| **3** | 2026-09-12 08:12 UTC | Billing re-check only (read-only `cloudbilling` GET + `functions:list`) | **Stopped.** `billingEnabled: false` on `croww-staging-2026`. A billing account name is present but not enabled. No functions. No Storage/Functions deploy attempted. |
| **4** | 2026-09-12 08:16 UTC | Prompt 19: billing + API + bucket list | **Stopped.** Billing still false. Cloud Functions API enabled; Cloud Build + Artifact Registry disabled. Storage APIs enabled; **0 buckets**. See `docs/CROWW_STAGING_ACCEPTANCE.md`. |

Pass 2 did **not** IAM-write PUBLISHED and did **not** re-apply migrations (dry-run: **MIGRATION ALREADY CLEAN**).

---

## Pass 2 — billing / services (2026-09-12 07:28–07:29 UTC)

Resolved project for every command: `croww-staging-2026`. CLI default alias remained `croww-live-2026` (unused).

| Probe | Command | Result |
|-------|---------|--------|
| Functions list | `firebase functions:list --project croww-staging-2026` | No functions found |
| Storage | `firebase deploy --only storage --project croww-staging-2026` from `croww-admin` | **Blocked** — Storage has not been set up |
| Functions | `firebase deploy --only functions --project croww-staging-2026` | **Blocked** — HTTP 400 enabling Artifact Registry / Cloud Build: **Billing account for project '113101837709' is not open** |
| Cloud Functions / Cloud Build / Artifact Registry | enable via Functions deploy | Not enabled (billing) |
| Firebase Storage API | Storage deploy | Not initialized (console Get Started still required after billing) |

No production secrets were copied. Staging Functions overlay remains blank (fail-closed).

Server-side tests that require live Functions/Storage were **not run** (would be source-only if claimed).

---

## Pass 2 — TypeScript / ESLint

| Check | Command | Exit | Notes |
|-------|---------|------|-------|
| Spatial unit tests | `node --test src/domain/spatial/spatial.test.js` | **0** | 5/5 pass |
| Full TypeScript | `./node_modules/.bin/tsc --noEmit --pretty false` (no pipe) | **0** | ~803s. `isCurrentlyReadySpatial` is now a type predicate so `toPublicSpatialTour` narrows `row`. |
| `npx expo lint` | hung | n/a | Loaded local production `.env` then stalled ~15m at 0% CPU (`expo lint` → eslint of `src` + `components`). **Not** used as a staging runtime. |
| Targeted ESLint | `./node_modules/.bin/eslint src/domain/spatial/projection.ts` | hung | Concurrent with hung `expo lint`; 0% CPU. Scope: that file only; no result. |

---

## Pass 2 — migrations / audits (dry-run only)

`--project croww-staging-2026`. **No apply.**

| Script | Result |
|--------|--------|
| `migratePropertyPublicGeo.js` dry-run | processed **8**, would-write 0 — **MIGRATION ALREADY CLEAN** |
| `migrateVerificationProjection.js` dry-run | processed 8/8, filled 0, booleans skipped 0 — **MIGRATION ALREADY CLEAN** |
| `auditPropertyInventory.js` | 8 properties / 8 listings / **0 findings** |
| `auditLocalityIntelligence.js` | 1 locality `staging-smoke-whitefield`, `NO_INTELLIGENCE_SNAPSHOT` (expected) |

Locality `staging-smoke-whitefield` was **not** deleted.

---

## 1. Environment

| Item | Value |
|------|--------|
| Firebase project | `croww-staging-2026` (number `113101837709`) |
| CLI user | logged in (email not repeated here) |
| Firebase CLI | 15.15.0 |
| gcloud | **not installed** |
| Java | OpenJDK 17.0.18 — emulator still blocked (firebase-tools wants 21) |
| App local `.env` | still production by default; not switched this session |
| Functions secrets | `functions/.env` classified as containing production-looking Cashfree/Mailgun keys. Staging overlay `functions/.env.croww-staging-2026` blanks them (fail-closed). **Not copied into staging.** `firebase.json` functions ignore includes `.env` and `.env.*`. |

CLI active alias remained `croww-live-2026`. Every deploy/migration used `--project croww-staging-2026`. Do not rely on `firebase use`.

---

## 2. Project ID

`.firebaserc` aliases: `staging` → `croww-staging-2026`, `production` → `croww-live-2026`. No `default` key.

Harmless resolution: `firebase projects:list` shows both projects. Staging deploys printed `Deploying to 'croww-staging-2026'`.

---

## 3. Pre-flight

| Check | Result |
|-------|--------|
| `firebase.json` (app) | Firestore rules+indexes, functions, hosting `croww-app`, emulators. No Storage rules. `.env` / `.env.*` ignored in the Functions zip. |
| `firebase.json` (admin) | Hosting + Firestore + **Storage rules** |
| EAS | `development` / `preview` / `production` still bake `croww-live-2026`. Dedicated **`staging`** profile (`APP_ENV=staging`, staging Firebase public ids, Cashfree `TEST`) unchanged this pass. Production profile not retargeted. |
| `app.config.js` | Throws if `APP_ENV=staging` and project id is not `croww-staging-2026`. |
| `apiConfig.js` | Staging `APP_ENV` refuses a non-staging project id. Staging HTTP host is `us-central1-croww-staging-2026.cloudfunctions.net`. Production keeps Cloud Run URLs. |
| `google-services.staging.json` | `project_id: croww-staging-2026` |
| Functions npm `deploy` | Now refuses unscoped deploy (`refuseUnscopedDeploy.js`). Staging requires explicit `--project croww-staging-2026`. |
| Required staging Cashfree/Mailgun/DigiLocker secrets | **Absent by design.** Overlay blanks them. Do not copy production secrets. |
| Hardcoded production endpoints remaining | Client fallback is live **unless** `APP_ENV=staging` or `EXPO_PUBLIC_FIREBASE_PROJECT_ID` is set. Admin Vite empty `VITE_FIREBASE_PROJECT_ID` still falls back to live Cloud Functions host — do not start admin without staging env. |

---

## 4. Deployment

| Surface | Command target | Result | Timestamp (UTC) |
|---------|----------------|--------|-----------------|
| Firestore rules | `croww-app` `--only firestore:rules --project croww-staging-2026` | **Success** — compiled and released (`latest version already up to date, skipping upload` then `released rules`) | 2026-09-12 06:58:23–06:58:32 |
| Storage rules | `croww-admin` `--only storage --project croww-staging-2026` | **Blocked** — `Firebase Storage has not been set up on project 'croww-staging-2026'` | 2026-09-12 06:59:04–06:59:06 |
| Indexes | `croww-app` `--only firestore:indexes --project croww-staging-2026` | **Success** — `deployed indexes in firestore.indexes.json successfully` | 2026-09-12 06:58:41–06:58:47 |
| Cloud Functions | `croww-app` `--only functions --project croww-staging-2026` | **Blocked** — enabling Cloud Build / Artifact Registry failed: **billing account for project 113101837709 is not open** | 2026-09-12 06:59:19–06:59:25 |

Index listing: **41** composite indexes returned by `firebase firestore:indexes --project croww-staging-2026`. The CLI JSON has **no `state` field**, so BUILDING vs READY cannot be confirmed from that listing. No BUILDING errors were returned. Collection groups include `listings` (9), `properties` (2), `property_media` (4), `savedSearches` (1), `verification_cases` (2), `spatial_processing_jobs` (1), plus legacy event indexes.

Functions that did **not** deploy (all of them): `publishListing`, `syncPropertyPublicLocation`, `reviewVerification`, `onVerificationCaseCreated`, `onListingWrittenSavedSearchAlerts`, `recomputeLocalityMarket`, `finalizeSpatialAsset`, `archiveSpatialAsset`, `onSpatialJobCreated`, DigiLocker HTTP, Cashfree HTTP, push/email/chat triggers.

Post-deploy `firebase functions:list --project croww-staging-2026`: **No functions found**.

Unauthenticated HTTP probes all returned **404**: `publishListing`, `reviewVerification`, `recomputeLocalityMarket`, `finalizeSpatialAsset`, `archiveSpatialAsset`, `getDigiLockerUrl`.

---

## 5. Migration

Pre-apply audits (2026-09-12, existing 2026-09-11 smoke inventory):

| Script | Result |
|--------|--------|
| `auditPropertyInventory.js` | 4 properties / 4 listings / **0 findings** |
| `auditLocalityIntelligence.js` | 1 locality `staging-smoke-whitefield`, `NO_INTELLIGENCE_SNAPSHOT` (expected; no fabricated metrics) |
| `migratePropertyPublicGeo.js` dry-run | processed 4, write private 0, rewrite public 0, align listings 0 |
| `migrateVerificationProjection.js` dry-run | processed 4/4, filled 0/0, booleans skipped 0 |

No unexpected destructive conditions. Apply was a no-op on already-migrated smoke data:

| Script | Apply |
|--------|--------|
| `migratePropertyPublicGeo.js --apply` | processed 4, writes 0 |
| `migrateVerificationProjection.js --apply` | processed 4/4, filled 0, booleans not promoted |

Post-smoke inventory audit: **8 properties / 8 listings / 0 findings**. Locality still has no intelligence snapshot.

Staging contains synthetic smoke inventory only (plus Auth test users). Nothing was deleted. No fabricated intelligence, verification, or 3D assets.

---

## 6. Persona setup

Synthetic Auth users (no real PII). Passwords live only in gitignored `functions/scripts/.staging-smoke-state.json`.

| Persona | Email | Notes |
|---------|-------|--------|
| buyer | `croww.staging.buyer@croww.test` | `individual`, no roles |
| owner | `croww.staging.owner@croww.test` | BUY + RENT drafts |
| agent | `croww.staging.agent@croww.test` | `provider` + IAM `roles: ['agent']` |
| builder | `croww.staging.builder@croww.test` | `business` + IAM `roles: ['builder']` |
| admin | `croww.staging.admin@croww.test` | IAM `userType=admin` + `admins/{uid}` |
| provider-no-role | `croww.staging.provider@croww.test` | `provider` without `roles[]` |

Admin `userType` remains **not** client-writable (403).

---

## 7. Tests

Runtime path: Firestore REST with Firebase ID tokens (security rules) plus IAM REST for admin setup. **Not** Expo UI / device / admin Vite.

IAM was used to set one listing `PUBLISHED` **only** so public-read/privacy tests could run after `publishListing` failed to deploy. That is **not** a pass of the Cloud Function.

Script: `functions/scripts/stagingSmokeTest.js --project croww-staging-2026`

Follow-up: `functions/scripts/retestSpatialUpload.js` after the first run reused `stgM_uploading` and hit an update-parent mismatch (403). Unique media id `stgM_c95e6096` created with HTTP 200.

---

## 8. Results

**39 PASS / 1 FAIL / 4 BLOCKED / 4 SKIPPED** on the main script, then **3D upload retest PASS**.

The FAIL was a **test-harness collision** (reused spatial media document id against a new property). Product rules behaved correctly (deny parentId change on update). Unique-id create succeeded.

---

## 9. Failures

| Item | Detail |
|------|--------|
| 3D upload (first run) | `property_media/stgM_uploading` already existed from 2026-09-11; PATCH tried to change `parentId`/`propertyId` → 403. Retest with unique id **PASS**. |
| Storage deploy | Storage not set up on the project. |
| Functions deploy | Billing account not open. |
| `publishListing` / alerts / `reviewVerification` / DigiLocker | Not live (404). |
| Expo web / mobile / admin Vite | Not launched; local `.env` still production. |

---

## 10. Remaining blockers

1. **Enable billing** on `croww-staging-2026` (human / billing account). Until then Cloud Functions, Artifact Registry, Cloud Build, and typically Storage cannot be activated.
2. **Create the default Storage bucket** in the Firebase console, then `firebase deploy --only storage --project croww-staging-2026`.
3. Deploy Functions with ignored production `.env` (do not upload Cashfree/Mailgun). Add **staging-only** secrets later; do not copy production.
4. Re-run `publishListing`, `reviewVerification`, saved-search alerts, HTTP 401 checks, DigiLocker (needs staging Cashfree verification credentials that are not production).
5. Expo web / device: `eas build --profile staging` or `npm run set-env:staging` **and** `APP_ENV=staging`. Do not launch the current local production `.env` against staging.
6. Java 21 if emulator rules evaluation is required.

---

## 11. Cleanup

Records **left in place** for inspection. Targeted delete:

```
cd croww-app/functions
node scripts/cleanupStagingSmoke.js --project croww-staging-2026
```

The script deletes the current state-file IDs plus known leftover smoke IDs. Auth users are **not** deleted.

### 2026-09-11 leftovers (still present unless cleaned)

- Locality: `staging-smoke-whitefield` (also used by 2026-09-12)
- Properties: `stg_ac9cc89c6dca`, `stg_2bd1bfd53f37`, `stg_30bd2498ce78`, `stg_a5ad8aba4ac1`
- Listings: `stgL_15f7a061be3c`, `stgL_a7fe4c7582c0`, `stgL_e62ce437aa58`, `stgL_9602c1cdf363`
- Verification case: `stgV_3e73ea9b`
- Spatial media: `stgM_uploading`
- Saved search: `stgS_cd8bcd3b`

### 2026-09-12 records

- Properties: `stg_4516c6d84ef3`, `stg_838bbb99d92f`, `stg_28cb3fbc9b48`, `stg_01fc3ed0ee6c`
- Listings: `stgL_333b2d3fb079` (PUBLISHED via IAM), `stgL_06784be2805a` (DRAFT rent), `stgL_bc303091664d` (agent), `stgL_015c25f2aa9b` (builder)
- Verification case: `stgV_198b113f` (PENDING)
- Spatial media: `stgM_c95e6096` (UPLOADING, private)
- Saved search: `stgS_dbe4e61b`
- Chat: `stgC_BvlPeioj6TaMLfjH48Clf5IB5Ph1_kzTwIWRpghh`

Do not wipe the staging database.

---

## Explicitly not done

- No production Firebase deployment
- No production migration
- No production EAS retargeting
- No fake production inventory
- No fake verification approval
- No fake intelligence snapshot
- No fake Gaussian Splat asset
