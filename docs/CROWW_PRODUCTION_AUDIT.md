# Croww production audit

**Date:** 2026-09-12  
**Mode:** Prompts 20–22 production audit and Firestore users locks, Prompt 23 **secret inventory / source untrack**, Prompt 24A **Cashfree Secret Manager binding preparation**. No Functions, Storage, indexes, hosting, or rules deploy in Prompts 23–24A. Customer documents were not modified. Old Cashfree keys were **not** revoked. Mailgun was **not** changed.

**Target:** `croww-live-2026` (project number `871336486604`)  
Every Firebase/Google call used `--project croww-live-2026` or an explicit REST URL for that project.

**Final status:** see end of this file. **Production is not clean.**

Companion: `docs/CROWW_PRODUCTION_READINESS.md`, `docs/CROWW_STAGING_ACCEPTANCE.md`, `docs/CROWW_SECURITY_HARDENING.md`

Do not include secret values.

Read-only inventory script: `croww-app/functions/scripts/productionReadOnlyAudit.js`

---

## 1. Project identity

| Item | Value |
|------|--------|
| Display name | Croww Live |
| Project ID | `croww-live-2026` |
| Project number | `871336486604` |
| CLI default alias | `croww-live-2026` (not relied on alone) |
| Apps | Android `1:871336486604:android:884087089c1b59a2350469`, iOS `…ios:9e9a3cdfd7cc0f10350469`, Web `…web:80e2f6b627aa8224350469` |
| Hosting | `https://croww-app.web.app`, `https://croww-live-2026.web.app` |
| Auth | Email+password enabled; phone config present (Identity Toolkit config GET) |
| Firestore | `(default)` database exists |

Checked 2026-09-12 ~08:27–08:29 UTC.

---

## 2. Billing status

**ENABLED** (`billingEnabled: true`, billing account name present). Production is not blocked by billing.

Staging (`croww-staging-2026`) remains `billingEnabled: false` — separate project.

---

## 3. Deployed services

| API | State |
|-----|--------|
| Cloud Functions | ENABLED |
| Cloud Build | ENABLED |
| Artifact Registry | ENABLED |
| Firebase Storage | ENABLED |
| Cloud Storage | ENABLED |
| Firestore | ENABLED |
| Identity Toolkit | ENABLED |
| Firebase Hosting | ENABLED |

---

## 4. Firestore state

**Rules release:** `cloud.firestore`  
Ruleset `875317fd-20e7-4e29-8bc0-d2cc4a3811b6`  
Release created 2026-02-10, **last updated 2026-09-12T09:04:36.425029Z** (Prompt 22 users read lock). Previous: Prompt 21 `b1400230-96c1-47ef-9883-f5d5916ed665` (2026-09-12T08:51:23Z); original event-era `8336d4d5-452c-441c-b0a0-abc9e51c8278` (2026-05-30).

This is still the **event-era** ruleset. It does **not** contain:

- `properties` / `listings` / `localities` / `property_media` / `verification_cases`
- `private_geo`
- `savedListings` / `savedSearches`
- `clientCannotPublishListing`
- `kyc_private` subcollection match

It **does** contain: `users` (owner/admin get, admin list, create/update field locks), `public_profiles`, `events`, `tickets`, `bookings`, `app_settings`, `notifications`, `chats`/`messages`, `buddyRequests` / `buddy_requests` / `buddy_join_requests`, `follows`, `services`, `reviews`, `admins`, plus catch-all deny.

**Deployed `users` rule (after Prompt 22):**

- `allow get:` owner or `isAdmin()`
- `allow list:` `isAdmin()` only
- `allow create:` owner only; `userType` in `individual|business|provider`; KYC/trust/admin flags forbidden
- `allow update:` `isAdmin()` **or** owner with frozen `userType` / `role` and locked KYC/trust/admin fields
- `allow delete:` `isAdmin()` only

**`public_profiles/{uid}`:** signed-in read; owner/admin write of display fields only (`kind == publicProfile`). Forbidden keys include `kycDetails`, `email`, `phone`, `pushToken`, KYC flags, `trust`, `roles`, `isAdmin`.

**`isAdmin()`:** unchanged — `admins/{uid}` **or** `users.userType == 'admin'`. Clients can no longer set `userType` or write `admins/{uid}`.

Production deploy file: `croww-app/firestore.live.rules` via `firebase.live.json`. Do **not** deploy source `firestore.rules` (property domain) to live.

**Indexes:** 18 composites. Groups: bookings, buddy_*, chats, events, follows, notifications, reviews, tickets. **No** listings/properties/property_media/savedSearches/verification_cases indexes.

**Root collections present:** `app_settings`, `bookings`, `buddy_join_requests`, `buddy_requests`, `chats`, `follows`, `notifications`, `public_profiles`, `reviews`, `tickets`, `users`.

**Counts (aggregation, read-only):**

| Collection | Count |
|------------|------:|
| users | 32 |
| public_profiles | 32 |
| admins | 0 |
| events | 0 |
| tickets | 26 |
| bookings | 14 |
| chats | 49 |
| notifications | 138 |
| follows | 51 |
| friend_requests | 0 |
| reviews | 2 |
| properties | 0 |
| listings | 0 |
| localities | 0 |
| property_media | 0 |
| verification_cases | 0 |
| spatial_processing_jobs | 0 |
| kyc_sessions | 0 |
| savedListings (group) | 0 |
| savedProperties (group) | 0 |
| savedSearches (group) | 0 |
| savedSearchMatches (group) | 0 |
| private_geo (group) | 0 |

---

## 5. Storage state

| Item | Value |
|------|--------|
| App bucket | `croww-live-2026.firebasestorage.app` (US-CENTRAL1, REGIONAL) |
| Other buckets | `gcf-v2-sources-871336486604-us-central1`, `gcf-v2-uploads-…` (Functions build; not app media) |
| Ruleset | `44b25e8c-8b81-4119-b837-21711aa014db` last updated **2026-03-22** |

Deployed Storage rules include `profile_pictures`, `event_images`, `verification_docs`, and a catch-all deny. They do **not** include `property_media`, `property_documents`, `property_spatial`, or `property_spatial_public`.

No files were listed, uploaded, or deleted.

---

## 6. Functions state

**18 functions**, all v2, `us-central1`, `nodejs22`, last update **2026-05-24**.

| Name | Trigger |
|------|---------|
| createCashfreeOrder | HTTPS |
| verifyCashfreePayment | HTTPS |
| getDigiLockerUrl | HTTPS |
| getDigiLockerStatus | HTTPS |
| sendCustomPasswordReset | HTTPS |
| deleteUserAccount | HTTPS |
| toggleFollow | HTTPS |
| toggleUserBlock | HTTPS |
| sendPushNotification | Firestore created `notifications` |
| sendWelcomeEmail | Firestore created `users` |
| cleanupExpiredEvents | scheduled |
| onEventCreated / onEventUpdated | Firestore events |
| onChatMessageCreated | Firestore chat messages |
| onFriendRequestCreated / onFriendRequestUpdated | Firestore friend_requests |
| onBookingCreated / onBookingUpdated | Firestore bookings |

**NOT deployed in production (exist in source only):**

- `publishListing`
- `syncPropertyPublicLocation`
- `reviewVerification`
- `onVerificationCaseCreated`
- `onListingWrittenSavedSearchAlerts`
- `recomputeLocalityMarket`
- `finalizeSpatialAsset` / `archiveSpatialAsset` / `onSpatialJobCreated`

Source HTTP auth (`httpAuth.js`) is **not** what production is running until Functions are redeployed. Production Functions date to 2026-05-24; later source auth hardening is **SOURCE ONLY** relative to live.

---

## 7. Authentication / admin state

| Item | Production fact |
|------|-----------------|
| Email/password | Enabled, password required |
| Phone | Config present |
| `users.userType` | individual 17, provider 12, business 2, **admin 1** |
| `admins` collection | **0 documents** |
| `users.roles[]` | **none** (0 agent/builder/buyer/owner role arrays) |
| `aadhaarVerified == true` | 5 |
| `isVerified == true` | 5 |
| `kycDetails` present | 5 |

Admin path in live rules is `userType == 'admin'` (collection empty). **Owner write-all is closed** (Prompt 21). **Cross-user `users/{id}` read is closed** (Prompt 22). DigiLocker Functions remain live; the 5 KYC-bearing parent documents were not modified. Other users now read `public_profiles/{uid}` (no `kycDetails` / email / phone).

---

## 8. Production property inventory

**Empty.** Zero properties, listings, localities, media, verification cases, spatial jobs, saved* documents.

No lifecycle distribution. No actor-role listings. No malformed property documents because none exist.

---

## 9. Production geo privacy findings

**NOT APPLICABLE** to property documents (count 0).

There is no production public pin / private_geo split to migrate. The **risk is future**: if the current client ships Post against live, creates would be **denied** by catch-all until new rules deploy. After a rules deploy, geo leakage would depend on client writes + migration — not current data.

Legacy event/ticket documents were not scanned for coordinates in this pass (out of property-domain scope; events count 0).

---

## 10. Listing publication findings

**Live backend does not implement the property listing lifecycle.** Catch-all deny means clients **cannot** create `listings` at all on production today.

How PUBLISHED would be created **after** a source deploy:

- Source rules: create **DRAFT** only; `clientCannotPublishListing()`; `publishedAt` frozen; `publishListing` admin HTTP Function.
- That Function is **not** in production.
- Deploying the **app** without deploying **rules + publishListing** would leave Post broken (permission denied / 404).

**Can a client currently bypass server publication on production?**  
For listings: **no**, because listing writes are denied.  
For **users/admin/KYC flags:** owner write-all is **closed**. Cross-user read of the full user document (including `kycDetails`) is **closed**.

---

## 11. Verification findings

- `verification_cases`: 0  
- Property trust slices: n/a  
- `reviewVerification`: **not deployed**  
- Identity: 5 users with `aadhaarVerified` / `isVerified` / `kycDetails` on the **private user document**. Ordinary signed-in users **cannot** read those documents (Prompt 22). Admin can. Public cards use `public_profiles`.

---

## 12. Saved-search findings

Zero saved listings/properties/searches/matches. Feature is **SOURCE ONLY** relative to production data and live rules (no `savedSearches` match in deployed rules; would be catch-all deny).

---

## 13. Spatial findings

Zero `property_media` / `spatial_processing_jobs`. Storage has no spatial prefixes. Spatial Functions not deployed. **No Gaussian Splat. No READY assets.**

---

## 14. Secrets / config findings

**Do not print values. Do not rotate in this task.**

| Item | Where | Class |
|------|--------|--------|
| Cashfree PG secret | Functions env / git history | Server secret — **rotate** (hardening doc) |
| Cashfree verification secret | Functions env / git history | Server secret — **rotate** |
| Mailgun API key | Functions env / git history | Server secret — **rotate** |
| Firebase web API keys | `eas.json`, google-services, client env | Client-public — restrict by package/SHA/referrer |
| Maps key | `eas.json` / `EXPO_PUBLIC_*` | Client-public — restrict |
| Cashfree public App ID | EAS production profile | Client-public |
| Cloud Run host `6vktyfoeaa` | `apiConfig.js` production URLs | Matches live Functions region |

Production EAS profiles bake `croww-live-2026`. Staging profile + `APP_ENV=staging` guards remain in source (`app.config.js` throws if staging points elsewhere).

---

## 15. Live app feature matrix

**Backend live today = event/ticket/chat/payment/KYC HTTP.**  
**Source primary shell = property tabs** (Explore, Saved, Post, Messages, Profile).

Whether the **store binary** already includes the property shell was not verified from a device in this audit. Classification below is **backend + source**, not a store screenshot.

| Feature | Classification |
|---------|----------------|
| Event discovery / tickets / bookings | LEGACY LIVE (data: tickets 26, bookings 14, events 0) |
| Chat / notifications / follows | LIVE |
| Cashfree / DigiLocker HTTP | LIVE (Functions 2026-05-24) |
| Explore / property map / filters | SOURCE ONLY (no data, no rules, no indexes) |
| Listing/property detail | SOURCE ONLY |
| Saved / Saved Search | SOURCE ONLY |
| Post / inventory / owner-agent-builder | SOURCE ONLY |
| Trust / verification cases | SOURCE ONLY |
| Area Score / localities | SOURCE ONLY |
| Spatial / 3D | SOURCE ONLY |
| Admin Vite | SOURCE; must not use empty project fallback to live accidentally |

---

## 16. Source vs staging vs production

| Surface | SOURCE | STAGING (`croww-staging-2026`) | PRODUCTION (`croww-live-2026`) |
|---------|--------|--------------------------------|--------------------------------|
| Property domain model | IMPLEMENTED | DEPLOYED rules/indexes; **0? wait staging has smoke data** | NOT DEPLOYED (0 docs, no rules) |
| Listings | IMPLEMENTED | DEPLOYED rules; smoke fixtures | NOT DEPLOYED |
| Firestore rules (property + KYC lockdown) | IMPLEMENTED | DEPLOYED 2026-09-12 | **USERS WRITE+READ LOCK DEPLOYED 2026-09-12** (event-era `firestore.live.rules` + `public_profiles`; property matches **not** deployed) |
| Indexes (property) | IMPLEMENTED | DEPLOYED (41) | NOT DEPLOYED (18 event-era) |
| Functions (property) | IMPLEMENTED | **BLOCKED** (billing) | **NOT DEPLOYED** |
| Functions (events/KYC/pay) | IMPLEMENTED | BLOCKED | DEPLOYED 2026-05-24 |
| Storage (property prefixes) | IMPLEMENTED | BLOCKED (0 buckets) | LEGACY paths only |
| Geo privacy split | IMPLEMENTED | DEPLOYED rules; smoke-tested | NOT APPLICABLE (no properties) |
| Verification review Function | IMPLEMENTED | BLOCKED | NOT DEPLOYED |
| Saved-search alerts | IMPLEMENTED | BLOCKED | NOT DEPLOYED |
| Area intelligence | IMPLEMENTED | BLOCKED / no snapshot | NOT DEPLOYED |
| Spatial Functions | IMPLEMENTED | BLOCKED | NOT DEPLOYED |
| Admin | IMPLEMENTED | SKIPPED runtime | LIVE `userType` admin; empty `admins` |
| Client config | IMPLEMENTED | staging EAS profile | production EAS → `croww-live-2026` |

Staging still **BLOCKED** on billing for Functions/Storage. Staging **does** have property rules/indexes and synthetic smoke inventory.

---

## 17. Risks (ordered)

### P0 — security / privacy / privilege

1. **FIXED (Prompt 21).** Production `users/{id}` owner write-all. Closed 2026-09-12T08:51:23Z.
2. **FIXED (Prompt 22).** Any signed-in user could read every user document, including `kycDetails` on 5 accounts. Closed 2026-09-12T09:04:36Z. Cross-user reads go to `public_profiles/{uid}`.
3. **OPEN (Prompt 23).** Git history and live Cloud Functions env still hold Cashfree PG, Cashfree Verification, and Mailgun server secrets. Current HEAD no longer tracks `.env` files. **Rotation is manual and not done.**
4. **Shipping the current property client to production without a coordinated rules/Functions/Storage/index deploy** would either fail closed (today’s catch-all) or, if rules were deployed without Functions, allow DRAFT inventory with **no** `publishListing` server path.

### P1 — correctness / authorization

1. **Rules/source drift:** live `firestore.live.rules` (event-era + users lock, 2026-09-12) vs current `firestore.rules` (property + KYC lockdown + tighter tickets/friends).
2. **Storage/source drift:** live 2026-03-22 vs current property prefixes.
3. **Functions/source drift:** live 2026-05-24 vs current `httpAuth` + property Functions.
4. **No production property indexes** — Explore geohash queries would fail once data exists.
5. **`admins` collection empty** while one `userType=admin` user exists.

### P2 — deployment / infrastructure

1. Staging Functions/Storage still billing-blocked — no green staging server path.
2. Production Functions deploy would replace the May 24 event/KYC/payment set; must not skip a staging Functions green run.
3. Hosting sites `croww-app` / `croww-live-2026` — do not point a staging build at them by accident.

### P3 — product completeness

1. Zero production property inventory (expected if not launched).
2. Events collection empty while tickets/bookings remain — leftover event product.
3. No locality intelligence in production.

### P4 — code quality

```
ESLINT_EXIT=1
35 errors
199 warnings
```

Not cleaned in this audit.

---

## 18. Required production deployment sequence (when staging is green)

Do **not** execute this sequence in this task.

1. Rotate historically exposed production secrets (human).
2. Staging: enable billing → Storage bucket → Storage rules → Functions → real `publishListing` / review / alerts smoke.
3. Diff **deployed production event rules** vs current source; preserve ticket/booking/chat invariants.
4. Deploy production Firestore **property** rules only after staging Functions are green. Users write-all is already closed via `firestore.live.rules`; do **not** replace that with the full source file until the event/ticket review is done.
5. Deploy production indexes (additive property indexes).
6. Deploy production Storage rules (additive property prefixes; keep `verification_docs` private).
7. Deploy production Functions (property + existing HTTP). Confirm no unauthenticated mutation.
8. Geo/verification migrations: dry-run first; currently **no-op** (0 properties).
9. Production smoke with synthetic users — never real customer KYC docs.
10. Only then consider a production EAS binary that uses the property shell.

---

## 19. Explicit DO NOT DEPLOY YET

- Do **not** deploy current source `firestore.rules` to `croww-live-2026` (property domain). Production users lock lives in `firestore.live.rules`.
- Do **not** deploy property Functions to production while staging Functions are undeployed.
- Do **not** deploy Storage property prefixes without confirming `verification_docs` stay private.
- Do **not** run geo/verification `--apply --confirm-production` (empty anyway; still requires human confirm).
- Do **not** copy staging smoke users/listings into production.
- Do **not** weaken production rules to make Explore work.
- Do **not** treat 5 `aadhaarVerified` users as “verified owners/agents/builders.”
- Do **not** rewrite Git history or rotate secrets from an agent session unless separately instructed.

---

## 20. Exact next engineering step

**Human:** Prompt 27 paired Secure ID `CF1206869DAII0KUNK84C73FH79NG` with SM `CASHFREE_VERIFY_CLIENT_SECRET` v1. DigiLocker live auth **PASS**. Old Verification credentials may be revoked in the Cashfree Secure ID dashboard when ready. **Do not revoke the old PG secret** (14 Functions still carry it in plaintext env; PG live pair is the new SM secret). Mailgun still plaintext. Staging billing / Prompt 19 and `public_profiles` app binary remain.

Do not deploy the property platform to `croww-live-2026` until staging server acceptance is no longer BLOCKED.

---

## Business-critical production data (do not disturb)

- 32 Auth/Firestore users (including KYC-bearing docs)
- 26 tickets, 14 bookings, 49 chats, 138 notifications, 51 follows
- Cashfree and DigiLocker live Functions
- Production Storage bucket and Hosting sites

Property collections are empty and are **not** yet business-critical. The event/chat/payment surface **is**.

---

## 21. Prompt 21 — users/{uid} P0 remediation

**Status:** privilege-escalation **write** path FIXED. Production audit is **not** clean.

### Original P0

Deployed rules (ruleset `8336d4d5-452c-441c-b0a0-abc9e51c8278`, updated 2026-05-30) were:

```
match /users/{userId} {
  allow read: if isSignedIn();
  allow write: if isOwner(userId) || isAdmin();
}
```

`isAdmin()` = `admins/{uid}` exists **or** `users/{caller}.userType == 'admin'`. Owner write-all meant a client could set `userType` to `admin` and then pass `isAdmin()` for every admin-gated path, and could set KYC/trust flags on their own document.

### Field policy (from repository writes, not invented aliases)

**CLIENT-MUTABLE (owner):** `name`, `email` (create), `pushToken`, `policyAccepted`, `policyAcceptedAt`, `category`, `stats`, `staff`, `packages`, `verificationData` (status `pending` only), `avatar`, `photoURL`, `profilePhotos`, `address`, `bio`, `coordinates`, `coverImage`, `interests`, `location`, `phone`, `socialLinks`, `username`, `followersCount`, `availability.*`, `isBusiness`, `isProvider`, `joinedDate`, `id`

**SERVER-ONLY / frozen on client create+update:** `userType` (create may set `individual|business|provider` only; update must not change it), `role` (create must not be `admin`; update frozen), `roles`, `trust`, `isApproved`, `isBlocked`, `isAdmin`, `admin`, `aadhaarVerified`, `isVerified`, `aadhaarVerifiedAt`, `kycStatus`, `kycDetails`, `kycProvider`, `verifiedAt`, `verificationStatus`, `verificationType`

**ADMIN-ONLY:** user document delete; any protected-field mutation; `admins/{uid}` read/write. Existing production admin remains `userType == 'admin'` (`admins` collection still empty). `isAdmin()` was **not** changed.

**LEGACY:** string `role` (31/32 users); `isBusiness` / `isProvider` remain writable because the live event app already writes them.

Legitimate client writers: `authService.signup` (create), `authService.logout` (`pushToken`), `authService.acceptPolicy`, `userService.saveUser` / `updateProfile` / staff / packages, `verificationService` (`verificationData.status = pending`). DigiLocker continues via Admin SDK (`getDigiLockerStatus`) and bypasses rules.

Five production accounts with `kycDetails` were **not modified**. Their owner profile fields (`name`, `pushToken`, `policyAccepted`, `verificationData` pending) remain writable; KYC keys are unchanged if omitted from a merge.

### Rule change

Smallest patch of the **then-deployed event-era rules**, not source `firestore.rules`:

- File: `croww-app/firestore.live.rules`
- Config: `croww-app/firebase.live.json` (rules only; no indexes/functions/storage)
- Deploy: `firebase deploy --only firestore:rules --project croww-live-2026 --config firebase.live.json --non-interactive`
- Events, tickets, bookings, chats, payments, follows, reviews, buddy_* matches were not rewritten.

Source `firestore.rules` users helpers were tightened the same way (`clientUserTypeOk` now requires unchanged `userType`) so staging/source policy matches. That source file was **not** deployed to production.

Client `stripServerOnlyUserFields` now strips `userType` / `role` / KYC / trust / admin flags so profile merges do not attempt frozen fields.

### Tests (before deploy)

`node --test --experimental-strip-types tests/users.rules.p0.test.js tests/firestore.rules.matrix.test.js src/domain/verification/verification.test.js`

**27 passed, 0 failed.** Firestore emulator was not used (OpenJDK 17; firebase-tools wants 21).

### Deployment

| Item | Value |
|------|--------|
| Project | `croww-live-2026` |
| Timestamp | **2026-09-12T08:51:23.681338Z** |
| Ruleset | `b1400230-96c1-47ef-9883-f5d5916ed665` |
| Command | `--only firestore:rules` with `firebase.live.json` |
| Property matches in live rules | none |
| Functions / Storage / indexes / hosting | not deployed |

### Production verification (after deploy)

`node functions/scripts/productionUsersRulesP0Test.js --project croww-live-2026 --confirm-production`

Ephemeral Auth users only; cleaned up. Customer count remained **32**. KYC-bearing docs remained **5**. No leftover `p0Test` user/follow/chat docs.

| Case | Result |
|------|--------|
| Owner profile update | PASS |
| Owner userType mutation (including admin) | DENIED (403) |
| Owner admin escalation (`isAdmin` / `admins/{uid}`) | DENIED (403) |
| Owner KYC flags / `kycDetails` | DENIED (403) |
| Owner trust | DENIED (403) |
| Cross-user mutation | DENIED (403) |
| Create with admin/KYC/trust | DENIED (403) |
| Create + `verificationData` pending | PASS |
| Follow + chat create | PASS |
| Anonymous read/write | DENIED (403) |
| `isAdmin()` helper preserved | PASS |

`sendWelcomeEmail` may have fired for the ephemeral addresses (users-created trigger). Those Auth users and Firestore docs were deleted.

### Remaining P0 blockers (as of Prompt 21)

1. **FIXED in Prompt 22.** All-user access to `users/{id}` / `kycDetails`.
2. **Historical secrets requiring rotation** (Cashfree, Mailgun in git history). Not rotated in this task.

---

## 22. Prompt 22 — users/{uid} read exposure

**Status:** cross-user full-document read **FIXED**. Production audit is **not** clean (historical secrets remain).

### Original P0

After Prompt 21, live users rules still had `allow read: if isSignedIn();`, so any authenticated caller could `get` every `users/{id}`, including `kycDetails` on 5 accounts.

Firestore cannot hide fields on a document. The live event app **does** need other-user display data:

| Read | Classification | Replacement |
|------|----------------|-------------|
| AuthContext `onSnapshot(users/self)` | SELF | unchanged |
| authService login `getDoc(users/self)` | SELF | unchanged |
| verification / edit profile / policy / pushToken | SELF | unchanged |
| `getUserById` in chat, friends, bookings, buddy, inquiries | OTHER USER | `public_profiles/{uid}` |
| `getServiceProviders` marketplace query | OTHER USER (list) | query `public_profiles` where `userType in [provider,business]` |
| Admin Dashboard `getDocs(users)` | ADMIN | `allow list: if isAdmin()` |
| DigiLocker / push / follow Cloud Functions | SYSTEM/SERVER | Admin SDK, rules bypass |

No existing public projection was in the repo. `users/{uid}/public/profile` would have needed a collection-group **index deploy** (forbidden here). Equivalent: top-level `public_profiles/{uid}` (automatic single-field indexes).

### Field policy on `public_profiles`

**Copied when required by current UI:** name, username, avatars/photos, userType (`individual|business|provider` only), role (not `admin`), category, bio, joinedDate, followersCount, isBlocked; for provider/business also about, location, address, coordinates, socialLinks, interests, stats, packages, availability, rating/reviews.

**Never copied:** email, phone, pushToken, kycDetails / kycStatus / kycProvider, aadhaar* / isVerified / isApproved, verificationData / verificationStatus / verificationType, trust, roles, isAdmin/admin, policyAccepted*.

Parent `users/{uid}` documents were **not** modified. Additive `public_profiles` upsert: 32. Private-key hits on those docs: **0**.

### Rule change

`croww-app/firestore.live.rules` only (Prompt 21 write locks preserved):

- users: `get` owner/admin; `list` admin; no signed-in blanket read
- `public_profiles/{userId}`: signed-in read; owner/admin create/update with `kind == publicProfile` and forbidden private keys

Client: `getUserById` reads `users/{id}` only for self, otherwise `public_profiles/{id}`. Signup / saveUser / updateProfile / packages sync the projection. Admin dashboard self-check uses `getDoc` of own user.

### Tests

Domain: **30 passed, 0 failed** (`users.rules.p0`, `public.profile.p0`, matrix, verification).

Live: `productionUsersRulesP0Test.js` — **39 passed, 0 failed**.

| Case | Result |
|------|--------|
| Owner own `users/{id}` read | PASS |
| Cross-user `users/{id}` read | DENIED (403) |
| KYC-bearing docs (5) cross-user read | DENIED 5/5 |
| Admin read of another user | PASS |
| Public profile cross-user read | PASS |
| `kycDetails` on public profile | DENIED (403) |
| Non-admin `users` list | DENIED (403) |
| Owner profile / pushToken / verificationData pending | PASS |
| Follow create / chat create | PASS |
| Booking create / event create | PASS |
| Prompt 21 write denials | PASS |

### Deployment

| Item | Value |
|------|--------|
| Project | `croww-live-2026` |
| Timestamp | **2026-09-12T09:04:36.425029Z** |
| Ruleset | `875317fd-20e7-4e29-8bc0-d2cc4a3811b6` |
| Command | `--only firestore:rules --config firebase.live.json` |
| Functions / Storage / indexes / hosting | not deployed |
| Customer user docs | unmodified |
| Ephemeral P0 leftovers | 0 |

A **store binary that still `getDoc`s `users/{otherId}`** will get 403 for chat avatar hydration and marketplace until the next EAS build. Chat already falls back to `participantNames`. Source client is updated.

### Remaining P0 blockers

1. **OPEN (Prompt 23).** Cashfree PG secret, Cashfree Verification secret, and Mailgun API key — in Git history and apparently still in live Functions environment variables. Manual rotation required. History rewrite not done.

A **store binary that still `getDoc`s `users/{otherId}`** will get 403 for chat avatar hydration and marketplace until the next EAS build. Chat already falls back to `participantNames`. Source client is updated. This is a client-rollout issue, not a remaining users-rules P0.

---

## 23. Prompt 23 — historical secret exposure / credential rotation

**Status:** current HEAD **untracked** the secret files. **Rotation not performed.** Production is **not** clean.

Values are never listed here.

### Inventory (no values)

| Provider | Credential type | File | Commit / date | Currently tracked? | Apparently active? | Rotation required? | Class |
|----------|-----------------|------|---------------|--------------------|--------------------|--------------------|-------|
| Cashfree PG | Client secret | `functions/.env` | `b891458` 2026-04-26 through `463a1c8` 2026-05-31; also `test_cashfree.js`, `logs.txt` | NO (removed from HEAD in `3a5397c` 2026-09-12, local `staging` only) | YES — Cloud Functions env `CASHFREE_PG_CLIENT_SECRET` on all 18 live functions (2026-05-24) | YES | SERVER SECRET |
| Cashfree Verification / DigiLocker | Client secret | `functions/.env`; historically also `CASHFREE_VERIFICATION_SECRET_KEY` in app `.env*` | same | NO | YES — `CASHFREE_VERIFY_CLIENT_SECRET` on live functions | YES | SERVER SECRET |
| Cashfree PG | Secret previously named `EXPO_PUBLIC_CASHFREE_SECRET_KEY` | `.env`, `.env.production`, `.env.staging` | `e875316` 2026-02-27 through `463a1c8` | NO | Treat as **same PG secret leaked into a client env name** | YES (with PG secret) | SERVER SECRET (must never be `EXPO_PUBLIC_*`) |
| Mailgun | API key | `functions/.env`; `logs.txt` | `b891458` onward | NO | YES — `MAILGUN_API_KEY` on live functions | YES | SERVER SECRET |
| Mailgun | SMTP user | `functions/.env`; Secret Manager name `SMTP_USER` | same | NO | YES (Secret Manager + Functions env) | UNKNOWN / review with Mailgun | CREDENTIAL |
| Cashfree | Public app / client id | `eas.json`, client `.env*` | current | YES in `eas.json` | YES | NO | PUBLIC CLIENT CONFIG |
| Cashfree | Public key PEM | `functions/cashfree_public_key.pem` | gitignored `*.pem` | NO | N/A | NO | PUBLIC CLIENT CONFIG |
| Firebase | Web API key | `eas.json`, `google-services.json`, `GoogleService-Info.plist`, `debug_db.js`, `scripts/check_event_uris.js` | current | YES | YES | NO as a server secret; **restrict** by package/SHA/referrer | PUBLIC CLIENT CONFIG |
| Google Maps | Browser/Android key | `eas.json` `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | current | YES | YES | NO as a server secret; **restrict** | PUBLIC CLIENT CONFIG |
| Google OAuth | Web client id | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | current | YES | YES | NO | PUBLIC CLIENT CONFIG |
| Firebase CLI | Published OAuth client secret in `functions/scripts/initAdmin.js` | current | YES | N/A | NO | FALSE POSITIVE (public `firebase-tools` client) |
| Google service account JSON / private keys | — | not found in tree or HEAD | — | — | NO | — |
| Separate DigiLocker-only API key | — | not found; KYC uses Cashfree Verification | — | — | — | — |

Local gitignored `functions/.env` still holds server secrets for local Functions. That is the intended local mechanism. Do not re-commit it.

Admin `croww-admin` `.env*` in history (`24e1ba4`) contained only `VITE_FIREBASE_*` public web config. Untracked in `9a3287e`.

### Current-source cleanup (this session)

`nashswamidass/croww` (`croww-app`) commit `3a5397c` on local `staging`:

- Stopped tracking `.env`, `.env.production`, `.env.staging`, `functions/.env`, `test_cashfree.js`, `logs.txt`, `logs_debug.txt`, `dist-web/`, build/lint logs
- `.gitignore` now ignores `.env`, `.env.*` (keeps `.env.example`)
- Added placeholder `.env.example` and `functions/.env.example`

`croww-admin` commit `9a3287e` on local `staging`: same untrack for Vite `.env*` + `.env.example`.

**Not pushed.** Origin still serves the old blobs. History rewrite was **not** done.

### Production secret destination (live)

All 18 production Functions (last update **2026-05-24**) have **plaintext environment variables** for:

`MAILGUN_API_KEY`, `CASHFREE_PG_CLIENT_SECRET`, `CASHFREE_VERIFY_CLIENT_SECRET`, plus public ids / SMTP host fields.

`secretEnvironmentVariables` / `secretVolumes`: **empty**.

Secret Manager secrets in `croww-live-2026` as of Prompt 23: **`SMTP_USER` only**. Prompt 24A added/confirmed `CASHFREE_PG_CLIENT_SECRET` and `CASHFREE_VERIFY_CLIENT_SECRET` (see §24A).

**Additional live store (found after §23):** Firebase **Runtime Config** (`firebase functions:config:get` on `croww-live-2026`) still holds a `cashfree.client_id` / `cashfree.client_secret` pair. The client id is **TEST-prefixed** (sandbox-looking). Current `functions/index.js` reads `process.env.CASHFREE_*` only — it does **not** call `functions.config()`. Treat the Runtime Config blob as leftover plaintext that must be unset after rotation. Runtime Config is deprecated (shutdown March 2027). Do not print the values.

On GCP, `functions/index.js` skips `dotenv` (`K_SERVICE` / `FUNCTION_TARGET`). Live payment/KYC/email secrets therefore come from Cloud Functions env, not from git at runtime. Runtime Config is a second plaintext copy of Cashfree credentials.

**Do not put these in** `EXPO_PUBLIC_*`, the RN/Vite bundle, Firestore, or Storage. Client currently uses only Cashfree **public** app id / env / app URL.

After rotation, destination should be **Google Secret Manager** bound as Functions `secretEnvironmentVariables`, then a Functions deploy. **Functions were not deployed in this task.**

### Rotation matrix

| Provider | Credential | Historical exposure | Currently active? | Rotation required? | Rotation location | New secret destination | Affected service | Validation |
|----------|------------|---------------------|-------------------|--------------------|-------------------|------------------------|------------------|------------|
| Cashfree | PG client secret | git `functions/.env`, `EXPO_PUBLIC_CASHFREE_SECRET_KEY` in app `.env*`, `test_cashfree.js`, logs | YES | YES — **MANUAL ROTATION REQUIRED** | Cashfree Merchant Dashboard → Developers / API keys (Production PG) | Secret Manager + Functions env `CASHFREE_PG_CLIENT_SECRET` | `createCashfreeOrder`, `verifyCashfreePayment` | Sandbox then one live test payment **after** Functions redeploy |
| Cashfree | Verification client secret (DigiLocker) | git `functions/.env`, `CASHFREE_VERIFICATION_SECRET_KEY` in app `.env*` | YES | YES — **MANUAL** | Cashfree Verification / KYC API keys | Secret Manager `CASHFREE_VERIFY_CLIENT_SECRET` | `getDigiLockerUrl`, `getDigiLockerStatus` | Start KYC session as a test user |
| Mailgun | API key | git `functions/.env`, logs | YES | YES — **MANUAL** | Mailgun Dashboard → Settings → API keys (rotate / new key, revoke old) | Secret Manager `MAILGUN_API_KEY` | `emails.js` (welcome, password reset) | Trigger `sendCustomPasswordReset` to a mailbox you control |
| Mailgun | SMTP_USER | git + Secret Manager name | YES | Review | Mailgun SMTP credentials | Secret Manager (already has `SMTP_USER`) | email | Same as Mailgun |
| Cashfree | Public app id | `eas.json` | YES | NO | — | Client `EXPO_PUBLIC_CASHFREE_*` | checkout UI | — |
| Firebase / Maps | Web / Maps keys | `eas.json`, google-services | YES | Restrict, don’t “rotate as secrets” | Google Cloud Console → APIs & credentials; Android package `com.croww.app`, iOS bundle `com.croww.app`, HTTP referrers | stay client-public | Auth, Maps | App still boots |

Do **not** deactivate a production key until the replacement is in Functions env and a deploy has been validated. This task did **not** rotate or deploy.

### Scanner

Installed gitleaks/trufflehog/detect-secrets: **not present**. `npx gitleaks` hung / was not used to dump output.

Custom scan (pattern names only, no values):

| Scope | Result |
|-------|--------|
| HEAD after `3a5397c` | No `cfsk_ma_`, no `EXPO_PUBLIC_CASHFREE_SECRET`, no `BEGIN PRIVATE KEY`, no `firebase-adminsdk`. `MAILGUN_API_KEY=` / `CASHFREE_*_SECRET=` only in `functions/.env.example` placeholders. |
| Tracked worktree | Same. `functions/index.js` / `emails.js` reference env **names** only. |
| Gitignored local `functions/.env` | Server secrets present (local runtime). |
| Git history | Secret **names and values** remain in commits listed above. |

### Git history

- Rotation of live keys is **sufficient** to stop abuse of the leaked values; it does **not** erase GitHub clones.
- **History rewrite recommended as a separate manual operation** after rotation (`git filter-repo` / GitHub support) with an explicit force-push plan. **Not done. No force-push.**

### Client compatibility (unchanged)

Installed production binaries may still `getDoc` `users/{otherId}` and receive **403**. Current source uses `public_profiles/{uid}`. **Do not EAS-build/deploy in this task.**

### Remaining P0

1. Optional: revoke the **old** Cashfree Verification client id `CF1206869D6QFJH12A26C73CI1I2G` and its secret in the Secure ID dashboard (DigiLocker now uses `CF1206869DAII0KUNK84C73FH79NG` + SM v1). **Do not revoke the old PG secret** yet.
2. Rotate Mailgun API key (**deferred**).
3. Unset Firebase Runtime Config `cashfree` (`functions.config()`).
4. Optional later: Git history purge.

PRODUCTION AUDIT HAS BLOCKERS

---

## 24A. Prompt 24A — prepare Cashfree Secret Manager bindings

**Date:** 2026-09-12  
**Project:** `croww-live-2026` (explicit). No Functions/Storage/indexes/Hosting/rules deploy. Mailgun untouched. Old Cashfree keys not revoked. Property platform not deployed.

### Secret Manager (names and metadata only; no values)

| Secret | Exists | Usable version | Runtime access |
|--------|--------|----------------|----------------|
| `CASHFREE_PG_CLIENT_SECRET` | YES | version `1` ENABLED (created 2026-09-12T09:49:23Z) | YES — `secretAccessor` granted to Cloud Functions runtime `871336486604-compute@developer.gserviceaccount.com`, plus Cloud Run / GCF service agents |
| `CASHFREE_VERIFY_CLIENT_SECRET` | YES | version `1` ENABLED (created 2026-09-12T09:50:51Z) | YES — same identities |
| `SMTP_USER` | YES (resource created 2026-02-26; automatic replication) | listVersions returned **no** version records; not inspected; not modified | IAM not changed |
| `MAILGUN_API_KEY` | NO Secret Manager secret | — | still plaintext Functions env |

Live `createCashfreeOrder` / `getDigiLockerUrl` still have **plaintext** `environmentVariables` for Cashfree + Mailgun. `secretEnvironmentVariables` on those services is still **empty** (Functions not redeployed).

Public PG client id on live Functions **equals** `eas.json` `EXPO_PUBLIC_CASHFREE_APP_ID`. Mobile Cashfree config was not changed.

### Functions that need each secret

Runtime: **Firebase Functions v2** (`firebase-functions` `^6.3.2`, Node 22, `onRequest`). Binding: `defineSecret` + `onRequest({ secrets: [...] })`, which mounts the secret as the **same** `process.env` name.

| Function | Secret | Notes |
|----------|--------|--------|
| `createCashfreeOrder` | `CASHFREE_PG_CLIENT_SECRET` | `getCashfreeInstance` / PG HTTP |
| `verifyCashfreePayment` | `CASHFREE_PG_CLIENT_SECRET` | Cashfree PG SDK fetch |
| `getDigiLockerUrl` | `CASHFREE_VERIFY_CLIENT_SECRET` | Cashfree Verification / DigiLocker |
| `getDigiLockerStatus` | `CASHFREE_VERIFY_CLIENT_SECRET` | same |

Public ids stay env: `CASHFREE_PG_CLIENT_ID`, `CASHFREE_VERIFY_CLIENT_ID`. Client: `EXPO_PUBLIC_CASHFREE_APP_ID` / `ENV` / `APP_URL` only. Native checkout uses the backend payment session, not the secret.

Mailgun: `functions/emails.js` still reads `process.env.MAILGUN_API_KEY`. No Mailgun source or Secret Manager change.

### Local development

`functions/.env` remains gitignored and was **not** deleted. Production skips dotenv when `K_SERVICE` is set (Cloud Run). Local/emulator still load `.env` then optional `.env.local`. `.env` / `.env.*` / `.secret.local` are gitignored and excluded from the Functions source upload.

### Validation

- `node --check functions/index.js` OK
- Tracked source: no `cfsk_ma_` / `EXPO_PUBLIC_CASHFREE_SECRET` values
- `eas.json` public App ID unchanged
- `functions/.env` still ignored; not staged

### Deploy (not done in 24A)

Do **not** run `firebase deploy --only functions` (would publish undeployed property Functions).

When a human deploys Cashfree:

```
firebase deploy --only functions:createCashfreeOrder,functions:verifyCashfreePayment,functions:getDigiLockerUrl,functions:getDigiLockerStatus --project croww-live-2026 --non-interactive
```

Before that deploy: the two Cashfree **secret** keys must not be in the dotenv Firebase CLI loads (`functions/.env`), or Cloud Run will see plaintext + Secret Manager on the same name. Keep Mailgun keys in that dotenv so email env stays plaintext. If dotenv is absent, Firebase merges existing Cloud plaintext env — those Cashfree keys must still be dropped or they collide with the new bindings.

Do not revoke old Cashfree credentials until this scoped deploy is validated.

### 24A scorecard

Cashfree PG:
- Secret Manager configured: **YES**
- Source binding prepared: **YES**

Cashfree Verification:
- Secret Manager configured: **YES**
- Source binding prepared: **YES**

Mailgun:
- Changed: **NO**
- Rotation: **DEFERRED**

Production Functions:
- DEPLOYED: **NO**

Old Cashfree credentials:
- REVOKED: **NO**

Property platform:
- DEPLOYED: **NO**

---

## 25. Prompt 25 — scoped Cashfree Secret Manager deploy

**Date:** 2026-09-12  
**Project:** `croww-live-2026` (explicit). Command:

`firebase deploy --only functions:createCashfreeOrder,functions:verifyCashfreePayment,functions:getDigiLockerUrl,functions:getDigiLockerStatus --project croww-live-2026 --non-interactive`

Did **not** run `firebase deploy --only functions`. No Storage/indexes/Hosting/rules. Mailgun not rotated. Old Cashfree keys not revoked. Property Functions not created.

Pre-deploy: moved `CASHFREE_PG_CLIENT_SECRET` and `CASHFREE_VERIFY_CLIENT_SECRET` out of `functions/.env` into gitignored `functions/.env.local`. Deploy dotenv kept `MAILGUN_API_KEY`, `SMTP_USER`, and public Cashfree client ids. Firebase CLI logged `Loaded environment variables from .env`.

First analysis attempts failed (10s discovery timeout; then Node 25 heap OOM). Source change so CLI discovery can finish: skip `admin.initializeApp()` / dotenv when `FUNCTIONS_CONTROL_API=true`; lazy-load `cashfree-pg` and Expo. Runtime still initializes Admin and reads `process.env` secret names.

### Deploy result

| Function | Result | updateTime (us-central1, nodejs22) | Secret Manager binding |
|----------|--------|--------------------------------------|------------------------|
| `createCashfreeOrder` | Successful update | 2026-09-12T10:46:08Z | `CASHFREE_PG_CLIENT_SECRET` v1 |
| `verifyCashfreePayment` | Successful update | 2026-09-12T10:46:08Z | `CASHFREE_PG_CLIENT_SECRET` v1 |
| `getDigiLockerUrl` | Successful update | 2026-09-12T10:46:08Z | `CASHFREE_VERIFY_CLIENT_SECRET` v1 |
| `getDigiLockerStatus` | Successful update | 2026-09-12T10:46:08Z | `CASHFREE_VERIFY_CLIENT_SECRET` v1 |

URLs unchanged (`*-6vktyfoeaa-uc.a.run.app`). Plaintext `CASHFREE_*_SECRET` env keys **removed** from those four. `MAILGUN_API_KEY` / `SMTP_USER` still present on them (from dotenv). Production function count still **18**. No property Functions. The other 14 Functions still have 2026-05-24 updateTime and still have old plaintext Cashfree env keys.

### Live validation (ephemeral Auth user, then deleted; no payment/KYC completion)

Unauthenticated POST to all four: **401 UNAUTHENTICATED** (new ID-token gate from current source).

| Function | Authenticated result | Meaning |
|----------|----------------------|---------|
| `createCashfreeOrder` | 400 `order_amount_invalid` (amount 0) | Cashfree **accepted** the new PG secret; no order created |
| `verifyCashfreePayment` | 404 `Order Reference Id does not exist` | Cashfree **accepted** the new PG secret |
| `getDigiLockerStatus` | 400 `Missing verificationId` | Function initialized; did not call Cashfree |
| `getDigiLockerUrl` | 502 Cashfree `authentication_failed` / `authentication_error` | New Verification secret **did not** authenticate against the deployed public verify client id. No `kyc_sessions` write (fails before that) |

Public `eas.json` App ID was not changed.

### Unrelated product

Events, tickets, bookings, chat, push Functions **not redeployed** (updateTime still 2026-05-24). Mailgun Functions not redeployed.

### 25 scorecard

Cashfree secret migration: **FAIL** (PG pass; Verification fail)

- createCashfreeOrder: **PASS**
- verifyCashfreePayment: **PASS**
- getDigiLockerUrl: **FAIL**
- getDigiLockerStatus: **PASS** (init only)
- Secret Manager bindings: **PASS**
- Existing event/ticket/booking/chat product: **PASS**
- Mailgun: **UNCHANGED**
- Old Cashfree keys: **DO NOT REVOKE**
- Property platform: **NOT DEPLOYED**

---

## 26. Prompt 26 — Cashfree Verification credential pairing

**Date:** 2026-09-12  
**Project:** `croww-live-2026`. No Functions deploy. No Mailgun/PG secret changes. No KYC session created. Old keys not revoked.

### How DigiLocker authenticates (current source)

| Item | Value |
|------|--------|
| Client id env | `CASHFREE_VERIFY_CLIENT_ID` (plaintext Functions env / `functions/.env`) |
| Secret env | `CASHFREE_VERIFY_CLIENT_SECRET` from Secret Manager v1 |
| Headers | `x-client-id`, `x-client-secret`, optional `x-cf-signature` (RSA-OAEP-SHA1 of `clientId.unix` using `functions/cashfree_public_key.pem`) |
| Endpoint | `POST/GET https://api.cashfree.com/verification/digilocker` when `environment === "PRODUCTION"` **or** secret contains `_prod_` |
| Sandbox URL | `https://sandbox.cashfree.com/verification/digilocker` otherwise |
| SDK | None for DigiLocker (raw `fetch`). PG SDK `cashfree-pg` / API version `2023-08-01` is **PG-only** |

Cashfree documents `authentication_failed` + `authentication_error` as **invalid client ID and client secret combination** (HTTP 401). Missing `x-cf-signature` is a different `validation_error`. IP whitelist failure is `ip_validation_failed` (403).

### Public IDs (not secrets)

| Kind | Identifier | Where |
|------|------------|--------|
| PG App ID | `1206869833208382a0c03e5759a9686021` | `eas.json` `EXPO_PUBLIC_CASHFREE_APP_ID`; Functions `CASHFREE_PG_CLIENT_ID` |
| Verification / Secure ID | `CF1206869D6QFJH12A26C73CI1I2G` | Functions `CASHFREE_VERIFY_CLIENT_ID`; git `functions/.env` history (only id ever used) |

These are **not** the same credential. Do **not** send the PG App ID to the Verification API.

### Secret Manager vs historical secrets (hashes only; no values)

All four secrets are `_prod_` / `cfsk_ma_prod_` / length 54, and **all four hashes differ**: SM verify v1, SM PG v1, old live plaintext verify (still on the 14 untouched Functions), old live plaintext PG.

SM verify v1 is **not** a copy of the PG secret.

OLD VERIFICATION CLIENT ID: `CF1206869D6QFJH12A26C73CI1I2G`  
NEW VERIFICATION SECRET: **PRESENT** (SM v1)  
HISTORICAL PAIR: **FOUND** (that client id + old `cfsk_ma_prod_` verify secret in git / leftover Function env)

### Safe probes (GET `/verification/digilocker?verification_id=PROMPT26_NO_KYC` — no KYC write)

| Pair | Host | Result |
|------|------|--------|
| SM verify + `CF1206869…` + prod ± signature | `api.cashfree.com` | 401 `authentication_failed` — **Invalid clientId and clientSecret combination** |
| SM verify + `CF1206869…` + sandbox | `sandbox.cashfree.com` | 400 `x-client-secret_value_invalid` (prod-shaped secret rejected by sandbox) |
| Old verify secret + `CF1206869…` + prod ± signature | production | 401 same combo failure (historical pair **no longer accepted**) |
| SM PG secret + PG App ID + verification URL | production | 404 `api_error` (PG keys are the wrong product for DigiLocker) |
| SM verify + PG App ID | production | 401 combo failure |
| SM PG + `CF1206869…` | production | 401 combo failure |

Environment used by the live Function: **PRODUCTION** (`environment: PRODUCTION` and secret contains `_prod_`). Not a sandbox/prod URL mismatch.

### Configuration correction

**Not applied.** There is no in-repo replacement Verification client id. Substituting the PG App ID is incorrect (probe 404 / 401).

Operator action (Cashfree **Secure ID / Verification Suite** dashboard, not Payment Gateway): copy the client id that belongs to the secret already in `CASHFREE_VERIFY_CLIENT_SECRET` v1 into `functions/.env` as `CASHFREE_VERIFY_CLIENT_ID`, then scoped-deploy only `getDigiLockerUrl` and `getDigiLockerStatus`. If they meant to rotate the secret **for** `CF1206869D6QFJH12A26C73CI1I2G`, SM v1 is not that pair.

`functions/.env.example` now states Verify id ≠ PG App ID. No DigiLocker Functions redeploy in Prompt 26.

### 26 scorecard

- Verification client ID (as paired with SM v1): **INCORRECT**
- Verification secret: **INCORRECT PAIR**
- Environment: **PRODUCTION**
- getDigiLockerUrl: **FAIL**
- getDigiLockerStatus: **PASS** (init; same pair would 401 if it reached Cashfree)
- Old Verification key: **DO NOT REVOKE**
- Mailgun: **UNCHANGED**
- Property platform: **NOT DEPLOYED**

---

## 27. Prompt 27 — Secure ID client ID/secret pair live

**Date:** 2026-09-12  
**Project:** `croww-live-2026`.

Set `functions/.env` `CASHFREE_VERIFY_CLIENT_ID=CF1206869DAII0KUNK84C73FH79NG` (public). Deploy dotenv had **no** Verification secret. Secret remained SM `CASHFREE_VERIFY_CLIENT_SECRET` v1. PG App ID untouched. Mailgun untouched.

Scoped deploy (not `--only functions`):

`firebase deploy --only functions:getDigiLockerUrl,functions:getDigiLockerStatus --project croww-live-2026 --non-interactive`

| Function | Result | updateTime | Runtime id | SM |
|----------|--------|------------|------------|----|
| `getDigiLockerUrl` | Successful update | 2026-09-12T11:06:47Z | `CF1206869DAII0KUNK84C73FH79NG` | `CASHFREE_VERIFY_CLIENT_SECRET` v1 |
| `getDigiLockerStatus` | Successful update | 2026-09-12T11:06:51Z | same | same |

`createCashfreeOrder` / `verifyCashfreePayment` still 2026-09-12T10:46:08Z. Event/Mailgun Functions still 2026-05-24.

### Live auth

Direct GET `/verification/digilocker?verification_id=PROMPT27_NO_KYC`:

- New id + SM secret + signature → **404** `verification_id_value_invalid` (credentials accepted)
- New id, no signature → 400 missing `x-cf-signature` (2FA required; not a combo failure)
- Old id `CF1206869D6QFJH12A26C73CI1I2G` → still 401 invalid combination

Live Functions: unauthenticated POST 401; `getDigiLockerStatus` missing id 400; `getDigiLockerUrl` authenticated POST **200** with a consent URL. One leftover `kyc_sessions` doc from that check was **deleted**. Ephemeral Auth user deleted.

### 27 scorecard

- Verification client ID: **CORRECTED**
- Verification secret: **CORRECT PAIR**
- getDigiLockerUrl: **PASS**
- getDigiLockerStatus: **PASS**
- Cashfree PG: **UNCHANGED**
- Mailgun: **UNCHANGED**
- Old Verification key: **SAFE TO REVOKE** (not revoked this task)
- Old PG key: **DO NOT REVOKE**
- Property platform: **NOT DEPLOYED**

PRODUCTION AUDIT HAS BLOCKERS



