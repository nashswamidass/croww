# Croww — Agent instructions

This repository is the **Croww** product: a React Native / Expo consumer app (`croww-app/`) and a Vite admin dashboard (`croww-admin/`).

Before changing architecture, read:

- `docs/CROWW_CODEBASE_ARCHITECTURE.md` (current-state audit)
- `docs/CROWW_SECURITY_HARDENING.md` (secrets, Functions auth, rules)
- `docs/CROWW_PROPERTY_DOMAIN.md` (property vs listing, collections, geo, verification)
- `docs/CROWW_PROPERTY_NAVIGATION.md` (consumer shell tabs and legacy isolation)
- `docs/CROWW_EXPLORE_MAP_ARCHITECTURE.md` (map-first discovery, geohash queries)
- `docs/CROWW_PROPERTY_DETAIL_ARCHITECTURE.md` (listing/property detail, location privacy)
- `docs/CROWW_LISTING_INGESTION_ARCHITECTURE.md` (inventory create/update, public/private geo)
- `docs/CROWW_PROPERTY_POSTING_ARCHITECTURE.md` (DRAFT listing create UI)
- `docs/CROWW_AREA_INTELLIGENCE_ARCHITECTURE.md` (locality evidence layer)
- `docs/CROWW_AREA_SCORE_ARCHITECTURE.md` (personalized Area Score; not a fixed locality rating)
- `docs/CROWW_SAVED_SEARCHES_ARCHITECTURE.md` (saved listings/properties/searches and publication alerts)
- `docs/CROWW_BROKER_DASHBOARD_ARCHITECTURE.md` (owner/agent/builder inventory dashboard)
- `docs/CROWW_VERIFICATION_ARCHITECTURE.md` (property trust dimensions, review, public badges)
- `docs/CROWW_3D_ARCHITECTURE.md` (spatial media, processing jobs, viewer boundary)
- `docs/CROWW_PRODUCTION_READINESS.md` (staging deploy, migrations, KYC server path)

That document is the technical baseline. This file is the **constraint list**. If the two disagree on *what the code does today*, trust the code and update the architecture doc.

**Paths:** `src/`, `App.js`, and `functions/` are relative to the Expo app root. In the Cursor wrapper workspace that folder is `croww-app/`. If you cloned `nashswamidass/croww`, that clone *is* the Expo app root. Admin lives at `croww-admin/` beside the app in the wrapper. The wrapper itself has no `.git`.

---

## Architecture rules

- **React Native + Expo remains the primary application.** Do not migrate to separate Kotlin and Swift apps unless the user explicitly instructs it.
- If a capability truly cannot be done in RN (for example advanced 3D / Gaussian Splat rendering **after** the web/hybrid viewer is proven inadequate), add a **selective native module** inside the Expo app. Do not rewrite the product.
- **Do not introduce a second navigation architecture.** Production navigation is React Navigation in `src/navigation/AppNavigator.js`. The authenticated consumer shell is `PropertyTabNavigator` (Explore, Saved, Post, Messages, Profile). Expo Router is an unused dependency; leftover files live in `app_backup/` and template `components/` / `hooks/` at the Expo app root. Do not enable Expo Router alongside React Navigation.
- **Do not restore Events, Tickets, Map, or Buddy as primary tabs** unless explicitly asked. Keep those screens on the Main stack for deep links and legacy flows. Do not delete them.
- Explore state belongs in `src/context/ExploreContext.js`. Listing queries go through `discoveryService` — never raw Firestore in Explore UI. Do not use `locationService` Mumbai defaults for Explore. Do not convert legacy `MapScreen` into the property map.
- **Do not create new event-domain functionality** (new event types, ticket features, buddy features) unless explicitly asked. The event product is legacy-in-place.
- **Do not repurpose the `events` collection for properties.** Property listings need a new domain model and new collections.
- Reuse existing services (auth, users, chat, notifications, maps, location, upload, KYC, bookings, Cashfree) when they are technically sound.
- Prefer **incremental migration** over wholesale rewrites, framework swaps, or greenfield navigation.
- Do not change production identifiers: Android package **`com.croww.app`**, iOS bundle **`com.croww.app`**, EAS project ID, URL scheme `crowwapp`.
- Do not install a large set of new dependencies without a clear, local need.
- TypeScript: convert files incrementally. Do not wholesale-migrate `src/` in one change. Property-domain **contracts** live in `src/domain/property/` (TypeScript). Area intelligence contracts live in `src/domain/intelligence/`. Area Score contracts live in `src/domain/areaScore/`. Property trust contracts live in `src/domain/verification/`. Spatial / 3D contracts live in `src/domain/spatial/`. Property **services** are JavaScript. Do not add a second competing property model.

---

## Safety rules

- **Do not expose secrets** in chat, commits, logs, or docs. Never paste API keys, Cashfree secrets, Mailgun keys, or private keys.
- **Do not commit `.env` files.** Current `.gitignore` only ignores `.env*.local` — that is a known gap. Do not add new env files to git.
- **Do not weaken Firebase security rules.** Tightening requires an explicit request and a rules-vs-code review.
- **Do not delete production data** (Firestore, Auth, Storage).
- **Do not delete legacy functionality** (event screens, collections, Cloud Functions) without explicit approval.
- **Do not change production package/bundle identifiers.**
- **Do not modify payment or verification infrastructure casually** (Cashfree PG, DigiLocker, `functions/index.js` payment/KYC handlers, fee calculator). Treat as high-risk.
- **Do not rotate or delete secrets automatically** unless the user asks.
- HTTP Cloud Functions that mutate users, payments, KYC, or follows must authenticate callers. Do not add new unauthenticated destructive endpoints.

---

## Security Requirements

- Never commit `.env` files. Use `.env.example` with placeholders only.
- Never expose server secrets through `EXPO_PUBLIC_*` (Expo inlines those into the client).
- Never trust client-supplied admin/user identity (`uid`, `userType`, `isAdmin`, `followerId`). Verify the Firebase ID token and authorize on the server.
- Authenticate sensitive Cloud Functions; take the acting user from `decoded.uid`.
- Enforce ownership in Firestore (tickets, bookings, notifications). Do not use `allow read, write: if request.auth != null`.
- Never weaken rules just to fix a client query — change the query to match a tight rule.
- Never commit generated logs, `dist-web/`, or build artifacts.
- Never print secrets in AI responses, comments, or commit messages.
- Production credential rotation is a human-controlled operational task. Do not rotate or deploy from an agent session unless explicitly asked.
- Do not rewrite Git history (`filter-repo`, BFG, `push --force`) unless explicitly instructed.

---

## Product domain rules

**Current product (do not break):** event discovery, tickets, bookings, buddy system, venues, service providers, admin verification.

**Property domain (Explore + listing/property detail + locality evidence; do not add the items below unless asked):**

- Collections: `properties`, `listings`, `localities`, `property_media`, `verification_cases`, `spatial_processing_jobs`. **Never** `events`.
- UI and Cloud Functions must use `src/services/property/*`, `src/services/intelligence/*`, and `src/domain/property` / `src/domain/intelligence` / `src/domain/verification` / `src/domain/spatial` contracts, not ad-hoc Firestore in screens.
- Canonical coordinates: public documents store a **public pin** (`latitude` / `longitude` / `geo` / `geohash`). Exact coordinates live in `properties/{id}/private_geo/current` (owner/admin). Do not copy private geo onto listings. No `lat`/`lng` aliases. Do not copy `locationService` Mumbai/Bengaluru fallbacks onto property writes.
- Locality intelligence is the current `localities.intelligence` snapshot (admin/server). Clients read it; they must not write metrics, flood class, or medians. Missing data is **Data unavailable** / **UNKNOWN**. Never fabricate flood, metro, schools, hospitals, or market stats. Never default flood UNKNOWN to LOW. Do not scan all listings on LocalityScreen.
- Croww Area Score is a **personalized read-time calculation** (`src/domain/areaScore/`) over that snapshot plus private user weights. Do not store `personalScore` on public locality documents. Do not treat UNKNOWN evidence as favorable. Do not rank “best area in Chennai.” Users may change weights, not the scoring methodology.
- `userType` stays (`individual` / `business` / `provider` / `admin`). Additive `users.roles[]` may include `buyer` | `owner` | `agent` | `builder`. Listing actor copy uses `listedByRole`, never `business`=`builder` or `provider`=`agent`. Do not auto-grant roles when posting.
- Clients create listings as **DRAFT** only. Publication is admin/`publishListing`. Clients must not set `verification.*.status` to `VERIFIED`, `source.authoritative` to true, `lastVerifiedAt`, or transfer `ownerUid`. Submissions go to `verification_cases` as **PENDING**. Only `reviewVerification` (admin token) may set `VERIFIED`.
- Identity KYC (DigiLocker / Cashfree) is **server-written**. Clients must not set `aadhaarVerified`, `isVerified`, or `users.trust`. `getDigiLockerStatus` binds `kyc_sessions` to the token uid. `users.roles[]` is **not** Verified Agent / Verified Builder and is not client-writable.
- Private documents, `verification_docs`, and `property_documents` are never public listing media. Public clients see only verification **status slices**, never evidence paths, reviewer ids, or KYC payloads.
- Detail UI must not print raw coordinates. Explore/detail use the public pin. Do not treat client jitter as privacy.
- Do not implement Croww Area Score as a **fixed locality rating**, user-review mix-in, or property-level score unless explicitly asked. Ingestion, Post listing, locality evidence, personalized Area Score v1, saved searches/alerts, inventory dashboard, property trust, and the 3D **media/viewer foundation** exist. Do not auto-publish, auto-verify, auto-READY 3D, or grant roles from Post. Do not seed fake splat assets or claim Gaussian Splatting works without a real READY asset. The dashboard is inventory management, not CRM or the Vite admin app. Do not add a numeric `trustScore`. 3D is media, not verification.

**Not yet (do not implement unless asked):** locality comparison UI, city-wide rankings, CRM/leads pipelines, ownership transfer, automated verification, site visits, phone/LiDAR 3D capture, GPU splat processing, 3D search filters, groundwater, freshness workers, external intelligence APIs, user budget matching, alert digests, boosts/featured/subscriptions.

Keep event code compiling and shipping until a sunset is approved.

---

## Development rules

Before making architectural changes:

1. Inspect the existing implementation (screens, services, functions, rules).
2. Identify dependencies (who imports this, which collections, which indexes).
3. Identify affected screens / services / Cloud Functions / admin pages.
4. Make the **smallest coherent change**.
5. Run relevant checks (`npx expo lint` in `croww-app`, targeted tests/scripts if they exist).
6. Report what changed.
7. Report remaining issues.

Do not:

- Redesign UI unprompted
- Rewrite navigation
- Replace Firebase or Google Maps
- Add a new backend
- Implement Gaussian Splatting engines, heatmaps, or city-wide area rankings unprompted
- “Clean up” committed logs, `dist-web/`, or `app_backup/` unless asked. Logs/`dist-web` were untracked in the 2026-09-10 hardening pass; do not re-add them.

---

## Where things live

Paths below are from the **Expo app root** (`croww-app/` in the wrapper). Prefix with `croww-app/` only when the Cursor workspace root is the wrapper.

| Area | Path |
|------|------|
| App entry | `App.js` |
| Navigation | `src/navigation/AppNavigator.js`, `PropertyTabNavigator.js` |
| Auth state | `src/context/AuthContext.js` |
| Screens | `src/screens/` |
| Services | `src/services/` |
| Property domain | `src/domain/property/`, `src/services/property/` |
| Area intelligence | `src/domain/intelligence/`, `src/services/intelligence/` |
| Area Score | `src/domain/areaScore/`, `areaScoreService.js` |
| Saved / alerts | `src/domain/property/saved/`, `saveService.js`, `savedSearchService.js` |
| Inventory dashboard | `src/domain/property/dashboard/`, `inventoryDashboardService.js`, `InventoryDashboardScreen.js` |
| Property trust | `src/domain/verification/`, `propertyTrustService.js`, `TrustOverviewScreen.js` |
| 3D / spatial | `src/domain/spatial/`, `property3DService.js`, `Property3DViewer.js`, `SpatialTourScreen.js` |
| Theme | `src/constants/theme.js` |
| Expo config | `app.config.js` |
| EAS | `eas.json` |
| Firestore rules | `firestore.rules` |
| Indexes | `firestore.indexes.json` |
| Cloud Functions | `functions/index.js` |
| Storage rules | `../croww-admin/storage.rules` (wrapper) |
| Admin app | `../croww-admin/src/` (wrapper) |

Firebase projects: production `croww-live-2026`, staging `croww-staging-2026`.

---

## Known landmines

- Ticket buyer `finalizePendingTickets` may update only `status` `PENDING_PAYMENT` → `valid` plus `updatedAt` (see `firestore.rules`). Organizer scan updates remain organizer-only.
- `friend_requests` and `users/{id}/friends` now have ownership rules. Screens still use buddy joins for the inbox.
- Indexes exist for `events.isPrivate`, `tickets.purchasedAt`, `bookings.userId` — code uses `isPublic`, `issuedAt`, `senderId`/`providerId`.
- Public pin vs exact location: public `latitude`/`longitude`/`geohash` are the **public pin**. Exact coords are `properties/{id}/private_geo/current`. Rules/functions for this split are **not deployed**. Legacy docs may still expose exact public coords until `migratePropertyPublicGeo.js` runs.
- Location defaults (events) remain **Mumbai**; live cities are **Bengaluru** / **Trivandrum**; `constants/location.js` keys **Bangalore**. Do not copy those defaults onto property writes.
- `ProfileScreen` business Dashboard navigates to `BusinessDashboard` (the old unregistered `Analytics` route).
- `LandingScreen` is unregistered.
- `WebPaymentScreen` historically called ticket/booking finalize without imports — verify before relying on that screen.
- Admin UI uses `userType == 'admin'` or `admins/{uid}`, matching Firestore. Email matching was removed.
- Sensitive HTTP functions require `Authorization: Bearer <ID token>` (`src/utils/authenticatedFetch.js`). They are not effective in production until Functions are deployed.
- Locality `intelligence` is admin/server-written. A missing snapshot is Data unavailable — do not invent flood/metro/school/hospital/market facts. Flood UNKNOWN must not become LOW. `recomputeLocalityMarket` is in-repo and not deployed.
- Croww Area Score is personalized and must not be written onto `localities/{id}`. Private weights live at `users/{uid}/preferences/areaScore` (owner-only). Cities without `getAreaScoreConfig` must not inherit Chennai thresholds.
- Saved listings/properties/searches are owner-only under `users/{uid}`. Do not reuse `follows` (USER→USER). Do not expose who saved a listing. Alerts fire only on non-PUBLISHED → PUBLISHED. Do not store Area Score on saved searches.
- Owner/agent/builder inventory lives at `InventoryDashboard` (Post → Your listings, Profile → Property inventory). Scope by `listedByUid` / created-or-owned properties. Do not treat `BusinessDashboard` as the property dashboard. Clients cannot self-publish from the dashboard. Do not expose save counts or Area Score preferences to listing actors.
- Property trust lives in `verification_cases` (private) with a public status projection. Identity KYC is written by `getDigiLockerStatus` (Admin SDK) plus `users.trust.identity`. Clients cannot write `aadhaarVerified` / `isVerified`. Do not convert old booleans to `VERIFIED`. `reviewVerification` is in-repo and not deployed.
- 3D tours are `property_media` with `mediaType: spatial`. Clients cannot set `READY`, public derived URLs, or `spatialTourAvailable`. Source files stay in `property_spatial/`; derived public files in `property_spatial_public/`. Do not treat a 3D asset as verification. `finalizeSpatialAsset` is in-repo and not deployed.
- Secrets were untracked from Git; **history still contains them**. Do not echo values. See `docs/CROWW_SECURITY_HARDENING.md`.

---

## Verification

If you change UI, routing, client state, or rendered data: verify in the browser or on a device/simulator before declaring done. Appearance-only screenshots are not enough.
