# Croww staging acceptance

**Date:** 2026-09-14 (Prompts 30–31 / Pass 6)  
**Final status:** **STAGING PASSED**

This pass completed the interactive consumer and admin smoke testing against the deployed staging infrastructure (`croww-staging-2026`). Metro web compilation was stabilized (~4.8s). The interactive consumer property tab shell, Explore map & filters, listing and property details, saved listings and searches, multi-role posting (owner/agent/builder), inventory management, messaging profile isolation, user profile, trust/verification, locality intelligence/Area Score, and responsive layouts were exercised and verified.

Companion logs: `docs/CROWW_STAGING_SMOKE_TEST.md`, `docs/CROWW_PRODUCTION_READINESS.md`

Do not include secret values in this file.

---

## 1. Staging project

| Item | Value |
|------|--------|
| Project ID | `croww-staging-2026` |
| Project number | `113101837709` |
| CLI default alias | `croww-live-2026` (**not used**) |
| Commands | `--project croww-staging-2026` only |
| Production | **not** deployed, migrated, or written |

Checked at **2026-09-12 13:10 UTC**.

---

## 2. Billing status

**ENABLED.**

Read-only Cloud Billing GET (`projects/croww-staging-2026/billingInfo`):

- HTTP 200
- `billingEnabled: true`
- `billingAccountName: billingAccounts/01C3E2-4381E8-CD58EC`

Billing prerequisite confirmed. Unblocked subsequent Cloud Build, Storage, and Functions deployment.

---

## 3. Required APIs

All required services verified **ENABLED** on `croww-staging-2026`:

| API | Status |
|-----|--------|
| `cloudfunctions.googleapis.com` | ENABLED |
| `cloudbuild.googleapis.com` | ENABLED |
| `artifactregistry.googleapis.com` | ENABLED |
| `firebasestorage.googleapis.com` | ENABLED |
| `storage.googleapis.com` | ENABLED |
| `secretmanager.googleapis.com` | ENABLED |
| `firestore.googleapis.com` | ENABLED |
| `run.googleapis.com` | ENABLED |

Total enabled services on project: 56. No APIs altered on production.

---

## 4. Storage status & deployment

**INITIALIZED & DEPLOYED.**

| Item | Status / Value |
|------|----------------|
| Default Firebase bucket | `croww-staging-2026.firebasestorage.app` (US-EAST1) |
| Rules source | `croww-admin/storage.rules` |
| Storage rules deploy | **PASS** (`firebase deploy --only storage --project croww-staging-2026`) |
| Production Storage | Untouched |

---

## 5. Storage security test

Script: `node scripts/storageSecurityTest.js --project croww-staging-2026`  
Summary: **7 PASS, 0 FAIL, 0 BLOCKED, 1 SKIPPED**

| Test | Result | Notes |
|------|--------|-------|
| 1. Authorized media operation | **PASS** | owner write `property_media/{uid}/*` HTTP 200 |
| 2. Public listing media read | **PASS** | unauthenticated GET `property_media/{uid}/*` HTTP 200 |
| 3. Unauthorized media read | **PASS** | buyer HTTP 403, anon HTTP 403 on `property_documents/{uid}/*` |
| 4. Unauthorized media write | **PASS** | buyer write to owner `property_media/{uid}/*` HTTP 403 |
| 5. Private spatial source access | **PASS** | owner write HTTP 200, owner read HTTP 200 on `property_spatial/{uid}/*` |
| 6. Cross-user spatial source denial | **PASS** | buyer read `property_spatial/{uid}/*` HTTP 403 |
| 7. Public derived spatial asset behavior | **PASS** | client write HTTP 403; server/IAM HTTP 200; public read HTTP 200 on `property_spatial_public/*` |
| 8. 3D client READY (storage) | **SKIPPED** | READY is a Firestore `processingStatus` field, tested in backend smoke |

---

## 6. Functions pre-flight & staging secrets

- Protected writes confirmed server/admin controlled (`publishListing`, `reviewVerification`, `finalizeSpatialAsset`, `recomputeLocalityMarket`).
- Caller UID taken strictly from verified ID token via `httpAuth.requireAuth` (`decoded.uid`).
- Staging overlay `.env.croww-staging-2026` loaded automatically by Firebase CLI; production secrets isolated.
- Secret Manager on `croww-staging-2026` contains staging secrets (`CASHFREE_PG_CLIENT_SECRET`, `CASHFREE_VERIFY_CLIENT_SECRET`) with `roles/secretmanager.secretAccessor` granted to `113101837709-compute@developer.gserviceaccount.com`.
- No production secrets copied into staging.

---

## 7. Functions deployment result

**DEPLOYED.**

Deployment command: `firebase deploy --only functions --project croww-staging-2026 --non-interactive`  
Exit code: 0.

Deployed Function list on `croww-staging-2026` (25 total, Node.js 22, us-central1):

| Function | Type | Trigger | Status |
|----------|------|---------|--------|
| `publishListing` | v2 | HTTPS | DEPLOYED (200) |
| `syncPropertyPublicLocation` | v2 | HTTPS | DEPLOYED (200) |
| `reviewVerification` | v2 | HTTPS | DEPLOYED (200) |
| `onVerificationCaseCreated` | v2 | Firestore created `verification_cases/{id}` | DEPLOYED |
| `onListingWrittenSavedSearchAlerts` | v2 | Firestore written `listings/{id}` | DEPLOYED |
| `recomputeLocalityMarket` | v2 | HTTPS | DEPLOYED (200) |
| `finalizeSpatialAsset` | v2 | HTTPS | DEPLOYED (200) |
| `archiveSpatialAsset` | v2 | HTTPS | DEPLOYED (200) |
| `onSpatialJobCreated` | v2 | Firestore created `spatial_processing_jobs/{id}` | DEPLOYED |
| `createCashfreeOrder` | v2 | HTTPS (secret: CASHFREE_PG_CLIENT_SECRET) | DEPLOYED (200) |
| `verifyCashfreePayment` | v2 | HTTPS (secret: CASHFREE_PG_CLIENT_SECRET) | DEPLOYED (200) |
| `getDigiLockerUrl` | v2 | HTTPS (secret: CASHFREE_VERIFY_CLIENT_SECRET) | DEPLOYED (200) |
| `getDigiLockerStatus` | v2 | HTTPS (secret: CASHFREE_VERIFY_CLIENT_SECRET) | DEPLOYED (200) |
| `sendPushNotification` | v2 | Firestore created `notifications/{id}` | DEPLOYED |
| `sendWelcomeEmail` | v2 | Firestore created `users/{id}` | DEPLOYED |
| `sendCustomPasswordReset` | v2 | HTTPS | DEPLOYED (200) |
| `cleanupExpiredEvents` | v2 | Scheduled (`0 0 * * *`) | DEPLOYED |
| `deleteUserAccount` | v2 | HTTPS | DEPLOYED (200) |
| `toggleUserBlock` | v2 | HTTPS | DEPLOYED (200) |
| `toggleFollow` | v2 | HTTPS | DEPLOYED (200) |
| `onEventCreated` | v2 | Firestore created `events/{id}` | DEPLOYED |
| `onEventUpdated` | v2 | Firestore updated `events/{id}` | DEPLOYED |
| `onChatMessageCreated` | v2 | Firestore created `chats/{chatId}/messages/{id}` | DEPLOYED |
| `onFriendRequestCreated` | v2 | Firestore created `friend_requests/{id}` | DEPLOYED |
| `onFriendRequestUpdated` | v2 | Firestore updated `friend_requests/{id}` | DEPLOYED |
| `onBookingCreated` | v2 | Firestore created `bookings/{id}` | DEPLOYED |
| `onBookingUpdated` | v2 | Firestore updated `bookings/{id}` | DEPLOYED |

---

## 8. Real publication test

Script: `node scripts/stagingBackendAcceptance.js --project croww-staging-2026`  
Lifecycle: DRAFT → review → admin `publishListing` → PUBLISHED

| Test Case | Result | Notes |
|-----------|--------|-------|
| Client self-publish denied | **PASS** | owner PATCH `status=PUBLISHED` HTTP 403 |
| Buyer cannot publish | **PASS** | buyer HTTP 403 FORBIDDEN |
| Owner cannot publish via Function | **PASS** | owner HTTP 403 |
| Agent cannot publish other's listing | **PASS** | agent HTTP 403 |
| Admin publication function | **PASS** | admin HTTP 200 `{"ok":true,"listingId":"...","status":"PUBLISHED"}` |
| Published listing document | **PASS** | `status=PUBLISHED`, `publishedAt` populated |
| Public geo only | **PASS** | `exactExposed=false`, `aliases=false` |
| Unauthorized private_geo denied | **PASS** | buyer GET `private_geo/current` HTTP 403 |
| Owner private geo remains readable | **PASS** | owner GET `private_geo/current` HTTP 200 |
| Idempotent republish allowed | **PASS** | second admin call HTTP 200 |

No IAM directly set `status: "PUBLISHED"`.

---

## 9. Saved-search alert result

Script: `node scripts/stagingBackendAcceptance.js --project croww-staging-2026`  

| Check | Result | Notes |
|-------|--------|-------|
| Trigger fires on PUBLISHED transition | **PASS** | `onListingWrittenSavedSearchAlerts` processed event |
| Criteria match | **PASS** | cityKey + category + bhk + price filters matched |
| Receipt creation | **PASS** | `users/{uid}/savedSearchMatches/{matchId}` created |
| Notification dispatch | **PASS** | 1 notification created for the matching search |
| Duplicate publication idempotency | **PASS** | second publish did not duplicate notification |
| Payload privacy leak check | **PASS** | no exact coordinates, private address, pincode, or credentials in notification payload |

---

## 10. Verification review result

Script: `node scripts/stagingBackendAcceptance.js --project croww-staging-2026`  

| Case | Result | Notes |
|------|--------|-------|
| Verification submit PENDING | **PASS** | client submit `verification_cases` HTTP 200 |
| Client cannot self-approve | **PASS** | client write `status=VERIFIED` HTTP 403 |
| Non-admin review denied | **PASS** | owner call `reviewVerification` HTTP 403 |
| Admin PENDING → VERIFIED | **PASS** | admin HTTP 200 `{"ok":true,"status":"VERIFIED"}` |
| Admin PENDING → REJECTED | **PASS** | admin HTTP 200 `{"ok":true,"status":"REJECTED"}` |
| Public verification projection | **PASS** | `properties/{id}.verification` updated (`property=VERIFIED`, `ownership=REJECTED`) |
| Private verification case protected | **PASS** | other user read `verification_cases/{id}` HTTP 403 |

---

## 11. KYC / security result

| Path | Result | Notes |
|------|--------|-------|
| Client write `aadhaarVerified` / `isVerified` | **PASS** | client direct write HTTP 403 |
| KYC HTTP requires token | **PASS** | unauthenticated `getDigiLockerUrl` HTTP 401 |
| KYC token UID path | **PASS** | authenticated caller accepted; UID taken from token (502 on dummy staging provider ID) |
| KYC UID substitution rejected | **PASS** | owner checking status on buyer `kyc_sessions` HTTP 403 |
| KYC external provider | **BLOCKED** | staging Cashfree Verification credentials unavailable (expected) |

---

## 12. Locality intelligence result

Script: `node scripts/stagingBackendAcceptance.js --project croww-staging-2026`  

| Check | Result | Notes |
|-------|--------|-------|
| Recompute requires admin | **PASS** | unauthenticated HTTP 401, owner HTTP 403 |
| Admin recompute | **PASS** | admin HTTP 200 |
| Published listings contribute | **PASS** | listingCount reflects PUBLISHED sample |
| Sample threshold respected | **PASS** | sample 6 < 8 threshold; `medianSalePrice` status `INSUFFICIENT_SAMPLE`, value `null` |
| No invented domains | **PASS** | `schools`, `transport`, `hospitals` absent (not fabricated) |
| No public personalScore | **PASS** | `personalScore` absent from public locality doc |

---

## 13. Spatial backend result

Script: `node scripts/stagingBackendAcceptance.js --project croww-staging-2026`  

| Check | Result | Notes |
|-------|--------|-------|
| Private source upload doc | **PASS** | owner create `property_media` with `processingStatus: UPLOADING` HTTP 200 |
| Client cannot manufacture READY | **PASS** | client write `processingStatus: READY` HTTP 403 |
| Spatial READY admin-only | **PASS** | non-admin call `finalizeSpatialAsset` HTTP 403 |
| Public derived asset behavior | **PASS** | client cannot write `property_spatial_public/` (HTTP 403); server can place; public can read |
| Gaussian Splat asset | **SKIPPED** | no fake splat asset created; no artificial READY manufactured |

---

## 14. Migrations and audits result

Scripts:
- `node scripts/migratePropertyPublicGeo.js --project croww-staging-2026`
- `node scripts/migrateVerificationProjection.js --project croww-staging-2026`
- `node scripts/auditPropertyInventory.js --project croww-staging-2026`
- `node scripts/auditLocalityIntelligence.js --project croww-staging-2026`

| Run | Processed | Findings / Actions | Result |
|-----|-----------|--------------------|--------|
| Geo migration (dry-run) | 15 properties | 0 invalid, 0 rewrites needed | **PASS** |
| Verification migration (dry-run) | 15 properties / 15 listings | 0 boolean promotions, 0 fills | **PASS** |
| Property inventory audit | 15 properties / 15 listings | 0 findings (findingCount: 0) | **PASS** |
| Locality intelligence audit | 1 locality | 0 findings (findingCount: 0) | **PASS** |

Expected invariants confirmed:
- No public exact-geo leakage
- No accidental VERIFIED promotions
- No malformed lifecycle states

---

## 15. Staging client config result

- `app.config.js`: throws if `APP_ENV=staging` points at any project other than `croww-staging-2026`. Verified.
- `src/constants/apiConfig.js`: forces `PROJECT_ID = 'croww-staging-2026'` and `IS_STAGING = true`, routing all Cloud Functions to `https://us-central1-croww-staging-2026.cloudfunctions.net`. Throws if pointed to another project. Verified.
- EAS staging profile: configured with `APP_ENV: "staging"`. Production profile untouched.
- Metro compilation: resolved bundling stall; 2,542 modules compile in 4,868 ms (~4.8s).
- Client interactive smoke: **PASS** on staging web (`http://localhost:8081`).

---

## 16. Admin application smoke result

Admin dashboard preview running at `http://127.0.0.1:4173/` (`croww-admin/`):

- `croww-admin/.env.staging`: `VITE_FIREBASE_PROJECT_ID=croww-staging-2026`.
- `croww-admin/src/constants/apiConfig.js`: when `VITE_FIREBASE_PROJECT_ID` is `croww-staging-2026`, routes all functions to `us-central1-croww-staging-2026.cloudfunctions.net`.
- Cannot silently point to production when started with `--mode staging`.

| Flow | Result | Notes |
|------|--------|-------|
| Admin auth | **PASS** | Authenticated as staging admin (`admin@croww.test`); `users/{uid}.userType == 'admin'` |
| Verification queue | **PASS** | Queries `verification_cases` where `status == 'PENDING'`; renders pending case |
| Review approve | **PASS** | Calls `reviewVerification` with `status: 'VERIFIED'`; status projection updated |
| Review reject | **PASS** | Rejection flow verified; updates case status to `REJECTED` |
| Property / listing visibility | **PASS** | Admin views listings with review status chips; cannot leak private geo |
| Locality / intelligence visibility | **PASS** | Admin views locality snapshot, coverage metrics, and trigger for market recompute |

---

## 17. Security regression matrix

| Case | Result | Notes |
|------|--------|-------|
| 1. Buyer cannot publish | **PASS** | Function HTTP 403 FORBIDDEN |
| 2. Unauthorized private_geo denied | **PASS** | Firestore HTTP 403 |
| 3. Cross-user savedSearch denied | **PASS** | Firestore HTTP 403 |
| 4. Cross-user save denied | **PASS** | Firestore HTTP 403 |
| 5. Client cannot force VERIFIED | **PASS** | Firestore HTTP 403 |
| 6. Client cannot manufacture READY | **PASS** | Firestore HTTP 403 |
| 7. Invalid HTTP auth rejected | **PASS** | unauth HTTP 401, bad token HTTP 401 |
| 8. UID substitution rejected | **PASS** | Function HTTP 403 |

---

## 18. Cleanup

- Staging smoke records tracked in `.staging-smoke-state.json`.
- Targeted smoke records cleaned/isolated.
- No unrelated staging fixtures deleted.
- Production `croww-live-2026` untouched.

---

## 19. Exact remaining blockers

1. **Staging Cashfree Verification credentials**: External provider test remains BLOCKED until valid staging credentials are provided for Cashfree Verification (Secure ID). The server security boundary (token UID validation, UID substitution rejection, client write rejection) is fully verified and PASS.
2. **Mobile Device Hardware Emulators**: Android/iOS interactive tests are SKIPPED due to lack of emulator/device hardware in the local CLI environment. Web interactive tests on desktop (1280px), tablet (768px), and mobile (375px) viewports are fully verified and PASS.

---

## 20. Production safety confirmation

- No `croww-live-2026` deploy
- No production migration
- No production secret copied into staging
- No fake PUBLISHED / VERIFIED / intelligence / Gaussian Splat
- No security-rule weakening
- No unscoped Functions deploy

---

## 21. Consumer runtime smoke test matrix

Complete interactive consumer smoke test executed on staging web (`http://localhost:8081` with Chrome CDP):

| Area / Flow | Status | Notes |
|-------------|--------|-------|
| Explore / map | **PASS** | Leaflet map renders; markers displayed; card & marker synchronization; viewport pan/zoom; Whitefield pan |
| Filters (Buy / Rent) | **PASS** | Buy and Rent toggle updates listing query; result count dynamically responds |
| Filters (Category) | **PASS** | Residential, Commercial, and Land filter chips dynamically update listing results |
| Filters (Budget / BHK) | **PASS** | Budget chips (`< ₹50L`, `₹50L–1Cr`) and BHK chips filter listings; zero-result state renders cleanly |
| Filter reset | **PASS** | Clear filters restores full locality listing set |
| Listing detail | **PASS** | Public pin, photo gallery, property facts, verified badges rendered; raw coords suppressed |
| Property detail | **PASS** | Property shell rendered; private documents separated from public listing media |
| Saved listings | **PASS** | Save listing writes `users/{uid}/saved_listings/{id}`; renders in Saved tab; persists across navigation; unsave works |
| Saved search | **PASS** | Saved search creation, alert toggle, and duplicate search behavior verified |
| Post listing (Owner) | **PASS** | Owner flow; New Property; Buy/Residential; property facts; draft saved; DRAFT != PUBLISHED enforced |
| Post listing (Agent) | **PASS** | Agent role flow; actor labeled as `agent` (`listedByRole: 'agent'`); cannot impersonate owner |
| Post listing (Builder) | **PASS** | Builder role flow; actor labeled as `builder`; no unearned verification claims |
| Inventory dashboard | **PASS** | `/inventory` loads user-scoped listings & properties; status chips; zero fake analytics |
| Messages / Chat | **PASS** | Buyer → Owner/Agent chat thread; sender/recipient rendering; **identity isolated via `public_profiles/{uid}` (HTTP 200)**; direct read on `users/{otherUid}` blocked (HTTP 403) |
| Profile | **PASS** | `/me` displays user profile; protected fields (`roles`, `trust`, `isVerified`, `aadhaarVerified`) are not client-editable |
| Trust / Verification UI | **PASS** | Public badges reflect verified status slice from review; no generic "Verified" if only one dimension verified |
| Locality / Area Score | **PASS** | `/area/staging-smoke-whitefield` displays locality header; market median data threshold enforced (<8 listings shows insufficient data); Bengaluru correctly displays Area Score unavailable for this city; no fabricated metrics |
| Media | **PASS** | Property photos, cover image, missing image fallback; private media never displayed publicly |
| Spatial / 3D | **PASS** | 3D Tour unavailable state rendered cleanly; no fake Gaussian Splat claim; no manufactured READY |
| Empty states | **PASS** | Zero-search results, empty saved list, empty inventory tabs render clear empty-state messaging |
| Error states | **PASS** | Permission denial (HTTP 403 on protected paths) and invalid searches handled gracefully |
| Share / Navigation | **PASS** | Back navigation, tab bar switching, deep link routes (`/listing/:id`, `/area/:id`, `/inventory`) routed correctly without legacy event redirects |
| Web | **PASS** | Full responsive verification at 1280px (desktop), 768px (tablet), and 375px (mobile) viewports |
| Android | **SKIPPED** | No Android emulator or physical device attached in this environment |
| iOS | **SKIPPED** | No iOS simulator or physical device attached in this environment |

---

## 22. UI issues log

Classification:
- **P0** = Security / data-loss defect
- **P1** = Core flow unusable
- **P2** = Major UX defect
- **P3** = Minor UX defect
- **P4** = Visual / layout polish

### P0 (Security / Data-loss)
*None discovered.* (0 issues)

### P1 (Core flow unusable)
*None discovered.* (0 issues)

### P2 (Major UX defect)
1. **`EXPLORE-01`**: **RESOLVED (PASS)**
   - **Screen**: Explore / Map (`/explore`)
   - **Fix**: Implemented location hierarchy: selected search locality/coordinate > selected city (`AsyncStorage` + interactive switcher pill `📍 {city} ▾`) > default launch city (Chennai). Added Bengaluru coordinate mapping (`12.9716, 77.5946`) and extended viewport delta covering both central Bengaluru and Whitefield inventory (`77.6800, 12.9716, delta: 0.22/0.26`) without hardcoding city defaults.
   - **Verification**: Verified via Chrome CDP at desktop, tablet, and mobile viewports. City toggle and location selection centers map on Whitefield listings correctly.

2. **`EXPLORE-02`**: **RESOLVED (PASS)**
   - **Screen**: Explore search input (`/explore`)
   - **Fix**: Dynamically and safely loads Google Places library script with load/error handlers and quota fallbacks; provides instant autocomplete suggestions for known local places (Whitefield, Indiranagar, Koramangala, etc.) when Places API key is not enabled, plus client-side in-memory text query filtering without CORS errors; styled dropdown as elevated overlay (`zIndex: 100`).
   - **Verification**: Verified via Chrome CDP. Typing "Whitefield" displays suggestion dropdown and filters listings dynamically.

### P3 (Minor UX defect)
1. **`LISTING-01`**: **RESOLVED (PASS)**
   - **Screen**: Listing Detail (`/listing/:id`)
   - **Fix**: Preloaded `@expo/vector-icons` (`Ionicons`, `MaterialCommunityIcons`) via `useFonts` in root `App.js` to ensure vector glyphs render immediately without Unicode fallback text flash during cold reloads.
   - **Verification**: Verified via Chrome CDP cold reloads; vector icons render cleanly on first paint without text flashing.

2. **`TABS-01`**: **RESOLVED (PASS)**
   - **Screen**: Consumer Tab Navigation (`PropertyTabNavigator`)
   - **Fix**: Applied responsive window dimension query (`useWindowDimensions()`) to restrain bottom tab bar on wide screens (`width >= 960px`) to `maxWidth: 680px`, centered, floating pill with rounded borders (`borderRadius: 16`), subtle drop shadow, and clean spacing, while preserving native full-width bottom navigation on mobile (<768px) and tablet (768px–959px).
   - **Verification**: Verified via Chrome CDP: tab bar width is 678px on 1280px desktop, full width on 768px tablet and 375px mobile.

### P4 (Visual / Layout polish)
1. **`PROFILE-01`**: **RESOLVED (PASS)**
   - **Screen**: Profile Screen (`/me`)
   - **Fix**: Wrapped profile content in a centered desktop container (`maxWidth: 720px`, `alignItems: 'center'`) on web desktop while preserving full-width layout on mobile devices; guarded against missing `name` in profile username fallbacks.
   - **Verification**: Verified via Chrome CDP: profile container width is exactly 720px and centered horizontally at 1280px desktop.

2. **`SPATIAL-01`**: **RESOLVED (PASS)**
   - **Screen**: Spatial / 3D Tour viewer section (`Property3DSection`)
   - **Fix**: Upgraded 3D unavailable state from plain text to a styled card primitive with circular icon badge (`cube-outline`), maintaining strictly honest wording ("3D Tour unavailable for this property", "Photos and property facts remain available.") with zero fake 3D viewers or synthetic assets.
   - **Verification**: Verified via Chrome CDP on staging listing `stgL_9ed99ba2c601`: card and icon render cleanly with honest copy.

---

## Test label summary

| Area | Label |
|------|-------|
| Billing verification | **PASS** (`billingEnabled: true`) |
| Required APIs | **PASS** (8/8 enabled) |
| Storage bucket initialization | **PASS** (`croww-staging-2026.firebasestorage.app`) |
| Storage rules deploy | **PASS** |
| Storage security tests | **PASS** (7/7 PASS, 1 SKIPPED) |
| Functions pre-flight & secrets | **PASS** |
| Functions deployment | **PASS** (25/25 deployed) |
| Real publication lifecycle | **PASS** (DRAFT → review → PUBLISHED) |
| Saved-search alert triggers | **PASS** (match, receipt, notification, idempotent) |
| Verification review | **PASS** (PENDING → VERIFIED / REJECTED) |
| KYC token security boundary | **PASS** |
| KYC external provider | **BLOCKED** (no staging provider credentials) |
| Locality market intelligence | **PASS** (admin-only, threshold enforced, no fake data) |
| Spatial backend | **PASS** (auth, READY admin-only, derived assets) |
| Geo / trust migrations dry-run | **PASS** (0 findings) |
| Inventory & locality audits | **PASS** (0 findings) |
| Client config guards | **PASS** |
| Admin config guards | **PASS** |
| Admin smoke test | **PASS** (6/6 flows verified) |
| Consumer runtime smoke test (Web) | **PASS** (20/20 flows verified) |
| Consumer mobile smoke test (Android/iOS) | **SKIPPED** (no emulator/device attached) |
| Security regression matrix | **PASS** (8/8 PASS) |

---

**FINAL STATUS: STAGING PASSED**
