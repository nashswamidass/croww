# Croww Production Readiness

**Status:** Source remains production-incomplete. Staging Firebase is **partially deployed**. Overall smoke-test verdict: **STAGING BLOCKED**.

**Date:** 2026-09-12 (Pass 4 / Prompt 19)  
**Scope:** Staging deploy + smoke test against `croww-staging-2026` only. Production was not touched.

Full operational log: `docs/CROWW_STAGING_SMOKE_TEST.md`  
Acceptance (Prompt 19): `docs/CROWW_STAGING_ACCEPTANCE.md`  
Production audit (Prompt 20, read-only): `docs/CROWW_PRODUCTION_AUDIT.md`

Also read `AGENTS.md` and the property architecture docs listed there.

---

## 1. Production readiness summary

The property platform exists in source with explicit server boundaries. Staging **Firestore rules and indexes are live** (Pass 1, 2026-09-12). Pass 2 re-checked billing: still **closed**. Storage rules and Cloud Functions did **not** deploy.

| Area | In source | Staging deployed | Staging-tested |
|------|-----------|------------------|----------------|
| Firestore rules | Yes | **Yes** (Pass 1, 2026-09-12 06:58 UTC) | Yes (client ID-token REST, Pass 1) |
| Storage rules | Yes | **No** — Storage not set up (re-confirmed Pass 2) | No |
| Indexes | Yes | **Yes** (Pass 1, 41 composites listed) | Deploy succeeded; CLI listing has no BUILDING/READY field |
| Cloud Functions | Yes | **No** — billing not open (re-confirmed Pass 2 07:29 UTC) | HTTP 404 |
| Geo migration | Yes | Applied Pass 1; Pass 2 dry-run **MIGRATION ALREADY CLEAN** (8/8, 0 writes) | Yes |
| Verification projection migration | Yes | Applied Pass 1; Pass 2 dry-run clean; booleans not promoted | Yes |
| Identity KYC client-write hole | Fixed in rules | Rules live; DigiLocker Functions **not** live | Client write 403; provider runtime blocked |
| Spatial public projection types | Yes | n/a | `tsc --noEmit` exit **0** after type-predicate fix |

**Verdict: STAGING BLOCKED** — Pass 1 client/rules work; Pass 2 cannot deploy Storage/Functions until a human opens billing on `croww-staging-2026` and creates the default Storage bucket.  
**Not production ready.**

---

## 2. Deployment surfaces

### Firebase (app project)

| Artifact | Path | Notes |
|----------|------|--------|
| Firestore rules | `croww-app/firestore.rules` (copied to `croww-admin/firestore.rules`) | Identical MD5 after this pass |
| Indexes | `croww-app/firestore.indexes.json` | Copied to admin |
| Storage rules | `croww-admin/storage.rules` | Only copy |
| Functions | `croww-app/functions/` | Node 22, v2 `onRequest` / Firestore triggers |
| Hosting (web app) | `croww-app/firebase.json` site `croww-app` | `dist/` |
| Hosting (admin) | `croww-admin/firebase.json` | `dist/` |
| Emulators | `croww-app/firebase.json` `emulators` | Firestore 8080, Auth 9099, Storage 9199, UI 4000 |

### App

| Artifact | Path |
|----------|------|
| Expo/EAS | `croww-app/app.config.js`, `eas.json` |
| Android / iOS | package/bundle `com.croww.app`; `google-services.json` / `.staging.json` |
| Web | Expo web + Firebase Hosting |
| API map | `src/constants/apiConfig.js` |
| Firebase client | `EXPO_PUBLIC_FIREBASE_*` |
| Maps | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Cashfree client | `EXPO_PUBLIC_CASHFREE_*` (public ids / env only) |
| Notifications | Expo push + `onDocumentCreated(notifications)` |

### Admin

Vite + `VITE_FIREBASE_*`. Firestore/Storage rules as above. Admin HTTP: `reviewVerification`, `publishListing`, `finalizeSpatialAsset`, `recomputeLocalityMarket`, `toggleUserBlock` — URLs now follow `VITE_FIREBASE_PROJECT_ID` / `EXPO_PUBLIC_FIREBASE_PROJECT_ID`. Staging must not use production Cloud Run hosts.

Staging Functions deploy is **blocked on billing** (see smoke-test doc). Do not deploy production from an agent session.

---

## 3. Environment matrix

| | Staging | Production |
|--|---------|------------|
| Firebase | `croww-staging-2026` | `croww-live-2026` |
| App hosting | `croww-staging-2026.web.app` | `croww-app.web.app` |
| Admin hosting | `croww-staging-2026.web.app` | `croww-live-2026.web.app` |
| Cashfree | `TEST` / `SANDBOX` | `PRODUCTION` |
| Local switch | `npm run set-env:staging` | `npm run set-env:production` |

**Mismatch (addressed this pass):** `eas.json` now has a dedicated **`staging`** profile with `APP_ENV=staging` and `croww-staging-2026` public Firebase ids. `development` / `preview` / `production` still bake `croww-live-2026`. Do not retarget production. `app.config.js` throws if `APP_ENV=staging` points at any other Firebase project. `apiConfig.js` refuses a non-staging project when `APP_ENV=staging`. `npm run deploy` in `functions/` refuses unscoped deploys.

**Mismatch (addressed this pass):** when `EXPO_PUBLIC_FIREBASE_PROJECT_ID === croww-staging-2026`, `apiConfig.js` uses staging `cloudfunctions.net` for DigiLocker/Cashfree/follow HTTP as well as property functions. Production keeps existing Cloud Run URLs.

Property scripts refuse to guess a project: `--project` or `FIREBASE_PROJECT_ID` is required. Production `--apply` also requires `--confirm-production`.

---

## 4. Secrets / credential status

Do not print values.

| Item | Status |
|------|--------|
| `.env` / `.env.production` / `.env.staging` | Gitignored; historically committed. **Assume leaked.** |
| `functions/.env` (Cashfree PG, verification, Mailgun) | Gitignored; historically committed. **Rotate.** |
| `EXPO_PUBLIC_*` secrets | Must never exist. Prompt 2 stripped names from examples. |
| Maps / Firebase web API keys | Client-public; **restrict** by package/SHA/bundle/referrer. |
| Rotation | **Not assumed.** Treat Prompt 2 rotation list as still open until an operator confirms. |
| Generated logs / `dist-web/` / `test_cashfree.js` | Stay gitignored. Do not re-add. |

BLOCKER for production: Cashfree PG secret, Cashfree verification secret, Mailgun API key rotation.  
Staging can proceed with **staging** secrets that were never in git history.

---

## 5. Security findings

### Fixed in this pass (source)

- Clients cannot write `aadhaarVerified` / `isVerified` / KYC payload / `trust` / `roles` / `isApproved`.
- Clients cannot set `userType` to `admin`.
- DigiLocker `verificationId` is bound to `uid` in `kyc_sessions` (client read/write denied).
- DigiLocker status response no longer returns raw Aadhaar PII.
- `listedByRole` and `publishedAt` frozen on listing client updates.
- `property_media` create requires parent property/listing authorization.
- Spatial jobs must reference media owned by the caller.
- `addMyPropertyRole` no longer self-grants `roles[]`.

### Remaining (do not ignore)

- Any **signed-in** user can still **read** full `users/{id}` (email/phone/legacy `kycDetails`). Field redaction is impossible; UI omission is not safety. Future: stop writing KYC PII on the public user doc (private `kyc_private` is now also written).
- `isAdmin()` still accepts `users.userType == 'admin'` **or** `admins/{uid}`. Escalation is blocked because `userType` can no longer become `admin` from the client.
- Agents/builders can still attach listings to any `propertyId` (V1 product). Not a KYC hole; document as representation risk.
- Legacy: ticket `PENDING_PAYMENT` → `valid`; event capacity bump; chat create with arbitrary participants.
- HTTP auth in git ≠ HTTP auth in production until Functions are deployed.

---

## 6. KYC issue status

**Was:** DigiLocker success **and** any signed-in `updateDoc` could set `users/{uid}.aadhaarVerified` / `isVerified`. Rules only blocked `trust`.

**Now (source):**

```
KYC provider (Cashfree DigiLocker)
  → authenticated getDigiLockerUrl stores kyc_sessions/{verificationId}.uid
  → authenticated getDigiLockerStatus checks session.uid == token.uid
  → Admin SDK writes aadhaarVerified + users.trust.identity VERIFIED + kyc_private
  → client finalizeAadhaarVerification only calls the function (no Firestore KYC write)
```

Public identity badges prefer `users.trust.identity`, then server flags. Clients cannot self-assert. Business document submit may still set `verificationData.status == 'pending'` only.

**Not effective in production until rules + `getDigiLockerUrl` / `getDigiLockerStatus` deploy.**

---

## 7. Firestore rules readiness

Semantically reviewed. App and admin copies synced.

Allow: public ACTIVE properties / PUBLISHED listings; public gallery media; READY public spatial; owner private_geo; owner saves; submitter verification cases (PENDING create).

Deny: client PUBLISHED introduction; client verification maps; client spatial READY/public URL; client `spatialTourAvailable`; jobs update; locality intelligence writes; `kyc_sessions`.

Highest residual: world-readable user docs; agent listing attach; undeployed rules.

---

## 8. Storage rules readiness

| Prefix | Public read | Write |
|--------|-------------|--------|
| `property_media/{uid}` | Yes | Owner |
| `property_documents/{uid}` | Owner/admin | Owner |
| `verification_docs/{uid}` | Owner/admin | Owner |
| `property_spatial/{uid}` | Owner/admin | Owner, &lt; 512 MB |
| `property_spatial_public/{mediaId}` | Yes | **false** (Admin SDK) |

Do not store KYC under `property_media/`. Predictable URLs are not an access grant for private prefixes.

---

## 9. Indexes readiness

Aligned with Explore geohash, dashboard `listedByUid`, saved-search collection group, verification cases, spatial media/jobs.

Added (matching live legacy queries, not speculative): `tickets.userId+issuedAt`, `bookings.senderId+createdAt`, `bookings.providerId+createdAt`.

Unused leftovers (`events.isPrivate`, `tickets.purchasedAt`, `bookings.userId`) were **kept** to avoid breaking unknown consumers.

Deploy indexes **before** or with first staging query traffic.

---

## 10. Functions readiness

| Function | Auth | Notes |
|----------|------|--------|
| `publishListing` | Admin token | Sets PUBLISHED |
| `syncPropertyPublicLocation` | Auth + owner/admin | Public pin |
| `reviewVerification` | Admin | `reviewedByUid` from token |
| `onVerificationCaseCreated` | Trigger | Notify only |
| `onListingWrittenSavedSearchAlerts` | Trigger | PUBLISHED transition only, 200/50 caps |
| `recomputeLocalityMarket` | Admin | CPU, not GPU |
| `finalizeSpatialAsset` | Admin | Only READY path |
| `archiveSpatialAsset` | Auth + owner/lister | Clears flag |
| `onSpatialJobCreated` | Trigger | **Logs only — never READY** |
| `getDigiLockerUrl` POST | Auth | Binds session |
| `getDigiLockerUrl` GET | None | Redirect HTML |
| `getDigiLockerStatus` | Auth | Session + sanitized body |
| Cashfree PG | Auth | Residual: client `orderAmount` |
| `toggleFollow` / `deleteUserAccount` | Auth | uid from token |
| `sendCustomPasswordReset` | None by design | |

Idempotency: saved-search match receipts; geo/verification migrations. Spatial finalize is admin-gated, not a worker.

---

## 11. Geo migration

Script: `functions/scripts/migratePropertyPublicGeo.js`  
**Staging executed 2026-09-12** (`--project croww-staging-2026`). Dry-run then `--apply` on 4 existing smoke properties: 0 private writes, 0 public rewrites, 0 listing alignments. Production was **not** run.

Behavior: copy current public lat/lng into `private_geo/current` if missing; rewrite public pin from `locationPrecision` + locality centroid; align listing pins. Idempotent. Does not delete exact coords.

```
cd croww-app/functions
node scripts/migratePropertyPublicGeo.js --project croww-staging-2026
# expected JSON: mode dry-run, processed, wouldWritePrivateGeo, wouldRewritePublicPin, wouldAlignListingPins
node scripts/migratePropertyPublicGeo.js --project croww-staging-2026 --apply
```

Production: same with `--project croww-live-2026` then `--apply --confirm-production`.

Rollback: restore public lat/lng from a pre-migration export. `private_geo` copies are additive (not reversed automatically).

Verify: sample properties with `approximate`/`locality` no longer equal exact private coords; listings share property public geohash; Explore still returns pins.

---

## 12. Verification migration

Script: `functions/scripts/migrateVerificationProjection.js`  
**Staging executed 2026-09-12.** Dry-run then `--apply`: filled 0 missing slices; `booleanLikeSkipped` 0; no VERIFIED promotions. Production was **not** run.

Fills missing `verification.*` slices as **NOT_VERIFIED** only. **Never** promotes booleans to VERIFIED. Also fills listing `verification.representation`.

```
node scripts/migrateVerificationProjection.js --project croww-staging-2026
node scripts/migrateVerificationProjection.js --project croww-staging-2026 --apply
```

---

## 13. Inventory integrity

Read-only: `functions/scripts/auditPropertyInventory.js`

Detects orphan listings, invalid statuses, missing pins, published buy/rent without price, expired-but-published, owner actor mismatch, listing/property geohash mismatch, boolean trust, private geo aliases.

Default: **read only**. Do not auto-fix.

---

## 14. Intelligence integrity

Read-only: `functions/scripts/auditLocalityIntelligence.js`

Flags missing snapshots, personalScore on public docs, invalid flood class, LOW flood without official/open source, published median with sample &lt; 8, invalid confidence, missing methodology version.

Do not fabricate metrics.

---

## 15. Area Score integrity

Unchanged methodology. City configs do not fall back to Chennai. UNKNOWN flood is not LOW. `personalScore` is not written to `localities`. Weights live at `users/{uid}/preferences/areaScore` (owner-only). Deterministic unit tests remain in `areaScore.test.js`.

---

## 16. Saved-data integrity

Owner-only `users/{uid}/savedListings|savedProperties|savedSearches`. Matches are server-written. Alerts fire only on non-PUBLISHED → PUBLISHED. Payloads: listingId + searchId, no private geo, no Area Score, no criteria dump. Caps 200 queries / 50 notifications remain.

---

## 17. Dashboard integrity

Scope is `listedByUid` / created-or-owned properties. No save counts, no fabricated analytics, no private geo, no self-publish. 3D status is media completeness, not trust.

---

## 18. Verification integrity

Cases: client PENDING only; update false. `reviewVerification` admin-only. Identity KYC no longer client-writable. Do not promote legacy booleans.

---

## 19. Spatial integrity

Clients cannot READY / public URL / `spatialTourAvailable`. Source prefix private. Derived prefix client-write false. Jobs create QUEUED + media ownership; update false. `onSpatialJobCreated` does not mark READY. No fake splat in the repo. Property-level reuse remains in `property3DService.createAsset`.

---

## 20. Deep-link audit (static)

Registered in `src/navigation/linking.js` + `AppNavigator.js`:

| Path | Screen |
|------|--------|
| `/listing/:listingId` | Listing |
| `/property/:propertyId` | Property |
| `/area/:localityId` | Locality |
| `/saved-search/:searchId` | SavedSearch |
| `/inventory` | InventoryDashboard |
| `/inventory/media/:listingId` | InventoryMedia |
| `/messages/:chatId` | Chat |
| `/kyc-complete` | VerifyIdentity |
| `/payment-return` | WebPayment |
| `/event/:id`, `/home`, `/map`, `/my-tickets` | Legacy |

---

## 21. Runtime QA

**Pass 1** (2026-09-12 ~07:02 UTC): Auth + Firestore REST against `croww-staging-2026`, not Expo UI. 39 PASS / 1 FAIL (reused spatial media id) / 4 BLOCKED / 4 SKIPPED; unique-id spatial create PASS.

**Pass 2** (2026-09-12 07:28 UTC): billing still closed. No Storage/Functions deploy. No `publishListing` / alert / `reviewVerification` server tests. `tsc --noEmit` exit 0. Expo web/device/admin not launched (local `.env` is production).

---

## 22. Emulator / rules testing

`firebase.json` now has an emulator block. Live emulator evaluation was **not** run.

Exact blocker (2026-09-11): `firebase emulators:exec --only firestore --project demo-croww` starts, finds `firebase.json`, then exits:

`firebase-tools no longer supports Java version before 21`

This machine has OpenJDK 17 (`/opt/homebrew/opt/openjdk@17`). Domain rule-matrix tests still ran via `node --test tests/firestore.rules.matrix.test.js`. That is **not** a substitute for `evaluate` against the emulator.

---

## 23. Deployment order

Staging (2026-09-12): steps 3 and 5 done. Steps 4 and 6 **blocked** (Storage uninitialized; billing not open). Migrations 7–8 ran on existing smoke inventory (no-op). Client smoke (9) ran; Function-backed smoke did not.

1. Confirm staging secrets (never production leaked secrets). Staging overlay blanks Cashfree/Mailgun.
2. Point local/staging `.env` at `croww-staging-2026` (`npm run set-env:staging` or EAS `staging` profile).
3. Deploy **Firestore rules** to staging. **Done.**
4. Deploy **Storage rules** to staging. **Blocked — create default bucket first.**
5. Deploy **indexes** to staging. **Done.**
6. Deploy **Functions** to staging. **Blocked — enable billing.**
7. Dry-run geo + verification + inventory + intelligence audits. **Done 2026-09-12 (4 then 8 inventory rows).**
8. Apply geo then verification migrations on staging if dry-run is sane. **Done (no-op).**
9. Staging smoke tests. **Client/rules done; Functions blocked.**
10. Production only after staging sign-off: rotate remaining production secrets → rules → storage → indexes → functions → migrations → smoke.

---

## 24. Migration order

1. `auditPropertyInventory.js` (read-only baseline)
2. `migratePropertyPublicGeo.js` dry-run → apply
3. Re-audit geo mismatch codes
4. `migrateVerificationProjection.js` dry-run → apply
5. `auditLocalityIntelligence.js` (no auto-write)

All scripts: `--project`, dry-run default, `--apply`, production `--confirm-production`.

---

## 25. Rollback

| Change | Rollback | Irreversible? |
|--------|----------|----------------|
| Rules / Storage | Redeploy previous rules file | No |
| Indexes | Indexes are additive; unused indexes are cheap | Effectively no |
| Functions | Redeploy previous Functions revision | No |
| Geo apply | Restore public pins from export; private_geo remains | Partial |
| Verification fill NOT_VERIFIED | Harmless additive | No |
| KYC session bind | In-flight DigiLocker IDs created before deploy fail closed | In-flight sessions only |

Do not promise rollback for exact-coordinate exposure that already happened historically.

---

## 26. Monitoring

Use Firebase/Google Cloud (no new vendor):

- Functions: error rate on `publishListing`, `reviewVerification`, `getDigiLockerStatus`, `onListingWrittenSavedSearchAlerts`, `finalizeSpatialAsset`
- Firestore: permission-denied spikes after rules deploy
- Notifications: `sendPushNotification` failures
- Spatial: `onSpatialJobCreated` logs must stay “GPU not configured”, never READY

---

## 27. Cost risks

- Explore geohash prefix queries (bounded, still the hottest read)
- Saved-search alerts: 200 searches × publications
- `recomputeLocalityMarket` listing scans per locality (admin)
- Dashboard listing pages (50)
- Spatial files up to 512 MB source (storage + egress)
- Unauthenticated public listing/property full-doc reads

Do not loosen 200/50 alert caps.

---

## 28. Retention (future; do not delete now)

| Data | Expectation |
|------|-------------|
| `verification_docs` / `property_documents` | Keep while case is appealable; later TTL |
| Failed spatial source | Keep for retry; archive flag already exists |
| `verification_cases/history` | Keep |
| `savedSearchMatches` | Keep for idempotency |
| Notifications | Product TTL later |
| Old listing media | Soft-hide (`HIDDEN`/`ARCHIVED`), not hard-delete |

---

## 29. Release blockers

1. **Staging Cloud Functions not deployed** — billing account for `croww-staging-2026` is not open. `publishListing`, alerts, `reviewVerification`, DigiLocker HTTP, spatial finalize are not live.
2. **Staging Storage not initialized** — cannot deploy `storage.rules` until the default bucket exists.
3. **Production secrets historically exposed** — do not ship production until rotation is confirmed. Do not copy live Cashfree/Mailgun into staging.
4. **Function-backed smoke still incomplete** — admin publication, alerts, KYC provider, push.
5. **Geo migration not run on production** — staging had no legacy inventory.

KYC self-write is blocked by **deployed staging rules**. It is still a **production** blocker until production rules + Functions deploy.

---

## 30. Release warnings

- No scheduled freshness worker
- No live Gaussian Splat decoder / no GPU processor
- Thin locality intelligence datasets
- No full analytics / CRM
- Users collection still readable by any signed-in user
- Agent may list any propertyId
- DigiLocker Cloud Run URLs are production-specific **unless** the client project id is staging
- Legacy ticket/booking index leftovers
- `createCashfreeOrder` still trusts client amount
- Admin Dashboard still client-toggles `isVerified` (admin rule path only)
- Staging project billing is not open

---

## 31. Known limitations

- Cloud Functions / Storage not live on staging
- Firestore emulator rules not runtime-evaluated (Java 17)
- Expo web / iOS / Android binaries not executed this pass
- No fake verification, intelligence metrics, or 3D splat assets added
- Event product remains in-place and isolated from property services
- One IAM `PUBLISHED` write was used as a test harness because `publishListing` could not deploy

---

## Staging smoke-test plan (personas)

**Buyer:** login → Explore/map/filters → listing detail → save listing/property/search → Locality/Area Score → Saved → alert deep link (after admin publish).

**Owner:** Post draft → resume → photos → request review → dashboard → submit property verification. Must **not** self-publish or self-verify.

**Agent:** role already on `users.roles` (admin-granted) → listing → dashboard → representation case. Must **not** `arrayUnion` roles.

**Builder:** listing + builder verification submit.

**Admin:** `publishListing`, `reviewVerification` (inspect evidence, no public paths), `recomputeLocalityMarket`, `finalizeSpatialAsset` only with a real derived URL.

Empty states: Explore empty map, Saved empty, Post without 3D, Locality Data unavailable, verification Not verified, dashboard no listings.

---

## Feature × runtime matrix

| Feature | Staging tested | Mobile | Web | Notes |
|---------|----------------|--------|-----|-------|
| Auth | Yes (API) | No | No | Signup/login, block flag, admin escalate 403 |
| Explore / map / search | Partial | No | No | Public listing GET after IAM publish; no map UI |
| Listing / Property | Yes (API) | No | No | Rules + public pin; no private geo |
| Saved | Yes (API) | No | No | Listing + property + search |
| Post / Draft | Yes (API) | No | No | BUY+RENT drafts; review PENDING |
| Dashboard | Yes (API) | No | No | Actor scope; buyer cannot read others' drafts |
| Chat | Yes (API) | No | No | Inquiry + isolation |
| Verification / KYC | Partial | No | No | PENDING submit + client VERIFIED/KYC 403; review/DigiLocker Functions blocked |
| Area Score / Locality | Yes (API) | No | No | Unavailable snapshot; Bengaluru has no city config |
| Alerts | No | No | No | Trigger not deployed |
| 3D fallback | Yes (API) | No | No | READY blocked; unique-id UPLOADING create 200 after first-run id collision |
| 3D viewer | No | No | No | No real asset |
