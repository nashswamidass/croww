# Croww Property Domain

**Status:** Domain/data foundation in the source tree (2026-09-10). No UI, map, scoring, or Cloud Functions for this domain. Firestore/Storage rules are **not deployed** by this change.

This document is the contract for later property prompts. Live code: `croww-app/src/domain/property/` and `croww-app/src/services/property/`.

---

## 1. Domain hierarchy

```
City
  → Locality / Area
    → Property          (physical real-world asset)
      → Listing         (one market offering for that asset)
        → Property media (photos, plans, videos; optional documents)
```

- **City** is a string on locality and property documents (`address.city` / `city`), not a Firestore collection. A city catalog can be added later without rewriting properties.
- **Locality** is `localities/{localityId}`.
- **Property** is `properties/{propertyId}`.
- **Listing** is `listings/{listingId}` with `propertyId`.
- **Media** is `property_media/{mediaId}` with `parentType` + `parentId` (+ always `propertyId`).

`events/{eventId}` is **not** part of this hierarchy and must stay isolated.

---

## 2. Property vs listing

| | Property | Listing |
|--|----------|---------|
| What it is | The physical asset | A market offering for that asset |
| Example | 3 BHK, 1,450 sq ft, 4th floor, 2 baths, Whitefield | For sale, ₹1.35 crore, negotiable, owner-listed, published today |
| Lifetime | Outlives any one advertisement | Many over time (sale, rent, different agents, price changes) |
| Status | `ACTIVE` / `INACTIVE` / `ARCHIVED` | `DRAFT` → `PUBLISHED` / `PAUSED` / `SOLD` / `RENTED` / `EXPIRED` / `ARCHIVED` |

**Belongs on the property:** category, subtype, address, locality, coordinates, BHK/baths, areas, floor, furnishing, parking, age, amenities, description of the asset, project name, possession, location precision, ownership reference, property-level verification.

**Belongs on the listing:** transaction type (buy/rent), asking price / rent / deposit / maintenance, lease terms, negotiability, availability, title, listing description override, listed-by actor, contact preference, publication/expiry/freshness timestamps, listing source, listing status.

**Query denormalization (intentional copy):** listings copy `city`, `localityId`, `category`, `subtype`, `latitude`, `longitude`, `geohash`, `geo`, `ownerUid` from the property at write time so map/feed queries do not join. These copies are **locked on listing update** in security rules. They are not a second source of physical truth — edit the property, then a later prompt can refresh listing copies.

Do not store bedrooms, bathrooms, or area on listings.

---

## 3. Firestore collection structure

| Collection | Document ID | Why this shape |
|------------|-------------|----------------|
| `properties` | auto ID | First-class asset; not a subcollection of users or localities (many owners/agents will query across cities). |
| `listings` | auto ID | Sibling collection, not `properties/{id}/listings`. Enables city/status/price feeds without collection-group queries. |
| `localities` | auto ID | Catalog + future stats. Admin-written. |
| `property_media` | auto ID | Top-level so property *and* listing media share one rules/index model. `parentType` is `property` or `listing`. |

**Not used:** `events`, event subcollections, embedding listings inside the property document (would blow document size and mix lifecycles), media as a subcollection of both parents (duplicate rules).

**Embedded maps (not collections):** `address`, `source`, `verification`, locality `bounds`, locality `intelligence` (current public snapshot; admin/server). Legacy locality `stats` is unused.

**No new Auth system.** Actors are `users/{uid}`.

---

## 4. Field definitions

### `properties/{propertyId}`

| Field | Type | Notes |
|-------|------|--------|
| `category` | `residential` \| `commercial` \| `land` | Required |
| `subtype` | see taxonomy below | Must match category |
| `status` | `ACTIVE` \| `INACTIVE` \| `ARCHIVED` | Create: ACTIVE or INACTIVE only |
| `address` | `{ line1, line2?, city, state, pincode?, country }` | `country` default `IN` |
| `localityId` | string | Required FK to `localities` |
| `city`, `state`, `country` | string | Copied from address for queries |
| `latitude`, `longitude` | number | **Public pin** (not private exact coords) |
| `geo` | GeoPoint | Same numbers as the public pin |
| `geohash` | string | Precision 9 of the **public** pin |
| `locationPrecision` | `exact` \| `approximate` \| `locality` | How the public pin was derived |
| `addressNormalized` | string | Comparison form; original user address is preserved in input / private_geo |
| `updatedByUid` | string | Last editor |
| `bedrooms`, `bathrooms` | int 0–20 \| null | BHK = bedrooms for residential |
| `builtUpAreaSqft`, `carpetAreaSqft`, `plotAreaSqft` | number ≥ 0 \| null | |
| `floor`, `totalFloors` | int 0–200 \| null | floor ≤ totalFloors |
| `furnishing` | `unfurnished` \| `semi` \| `fully` \| `unknown` | |
| `parking` | number ≥ 0 \| null | Count, not a boolean |
| `constructionYear` | 1800–2100 \| null | Age derived later |
| `amenities` | string[] | Open list; do not enum every amenity |
| `description`, `projectName` | string \| null | Asset text |
| `possessionStatus` | `ready` \| `under_construction` \| `unknown` | |
| `createdByUid` | string | Auth uid at create; immutable |
| `ownerUid` | string | Claimed owner; transfer is server-only |
| `source` | see §10 | `authoritative` client-false |
| `verification` | see §9 | Client create: all `NOT_VERIFIED` |
| `createdAt`, `updatedAt` | timestamp | |
| `spatialTourAvailable` | boolean | Server-only. True when a READY public 3D tour exists. Not a trust badge. |

### `listings/{listingId}`

| Field | Type | Notes |
|-------|------|--------|
| `propertyId` | string | Immutable after create |
| `transactionType` | `buy` \| `rent` | Rent covers lease |
| `status` | listing statuses | Client create: **DRAFT only**. `PUBLISHED` is admin/`publishListing` |
| `listedByUid` | string | Auth uid; cannot impersonate |
| `listedByRole` | `owner` \| `agent` \| `builder` \| `admin` | Admin only if `isAdmin()`. Agent/builder require `users.roles[]` |
| `createdByUid` | string | Auth uid at create; immutable |
| `updatedByUid` | string | Last editor |
| `ownerUid` | string | Copied from property |
| `title` | string | Required |
| `description` | string \| null | Override; property keeps asset copy |
| `askingPrice` | number \| null | Required positive when buy + PUBLISHED |
| `rentMonthly` | number \| null | Required positive when rent + PUBLISHED |
| `deposit`, `maintenanceMonthly` | number ≥ 0 \| null | |
| `leaseDurationMonths` | 0–600 \| null | |
| `negotiable` | boolean | Default true |
| `availableFrom` | timestamp \| null | |
| `contactPreference` | `in_app` \| `phone` \| `both` | |
| `source` | see §10 | |
| denormalized geo/category fields | from property | Locked on update |
| `createdAt`, `updatedAt` | timestamp | Record clocks |
| `publishedAt` | timestamp \| null | Set on first PUBLISHED |
| `expiresAt` | timestamp \| null | Stale engine later |
| `lastVerifiedAt` | timestamp \| null | Croww attestation; client cannot set |
| `spatialTourAvailable` | boolean | Server-only READY 3D hint. Not a search filter. |

### `properties/{propertyId}/private_geo/current`

Exact coordinates. **Not** publicly readable. Owner, creator, or admin only.

| Field | Notes |
|-------|--------|
| `latitude`, `longitude`, `geo`, `geohash` | Exact location |
| `addressLine1`, `pincode` | Optional; omitted from public address when precision is not `exact` |
| `updatedByUid` | Last writer |

### `listings/{listingId}/private_meta/current`

Moderation internals. Lister, owner, or admin. Clients may set `NONE`/`PENDING` only.

### `property_media/{mediaId}`

| Field | Type | Notes |
|-------|------|--------|
| `parentType` | `property` \| `listing` | |
| `parentId` | string | Property id or listing id |
| `propertyId` | string | Always the asset id (even for listing media) |
| `mediaType` | `photo` \| `floor_plan` \| `video` \| `document` \| `spatial` | `spatial` is 3D media; `processingStatus` READY is server-only |
| `storagePath` | string | Firebase Storage path |
| `url` | string \| null | Public CDN/download URL only when `visibility=public` |
| `thumbnailUrl` | string \| null | |
| `sortOrder` | number ≥ 0 | |
| `visibility` | `public` \| `private` | Documents **cannot** be public |
| `mimeType`, `sizeBytes`, `originalName` | optional | |
| `createdByUid` | string | Immutable |
| `status` | `ACTIVE` \| `HIDDEN` \| `DELETED` | |
| `createdAt` | timestamp | |

### `localities/{localityId}`

| Field | Type | Notes |
|-------|------|--------|
| `name`, `city`, `state`, `country` | string | |
| `aliases` | string[] | Neighborhood names |
| `latitude`, `longitude`, `geo`, `geohash` | same as property | Center point |
| `bounds` | `{ north, south, east, west }` \| null | Optional AABB; full polygons later |
| `status` | `ACTIVE` \| `INACTIVE` | |
| `source` | see §10 | Admin may mark authoritative |
| `stats` | map \| null | **Legacy reserved. Client must not write.** New evidence is `intelligence` |
| `intelligence` | snapshot \| null | Current public area-intelligence snapshot. Admin/server only. See `docs/CROWW_AREA_INTELLIGENCE_ARCHITECTURE.md` |
| `createdAt`, `updatedAt` | timestamp | |

### Taxonomy (extensible arrays, not a graph)

- Residential: `apartment`, `independent_house`, `villa`, `plot`
- Commercial: `office`, `shop`, `warehouse`, `industrial`, `commercial_land`
- Land: `residential_plot`, `agricultural`, `commercial_plot`, `other`

Add values to `src/domain/property/constants.ts` when the product needs them.

---

## 5. Actor / role relationships

**Authentication identity remains `users/{uid}`.** There is no new Auth product.

### Keep (legacy event product)

`userType` / `role`: `individual` | `business` | `provider` | `admin`. Signup, dashboards, and KYC still use these. Do not rename or delete them.

### Additive (property product)

Optional `users.roles[]`: `buyer` | `owner` | `agent` | `builder`.

A user may have more than one. `propertyActorService.addMyPropertyRole` uses `arrayUnion` and **refuses `admin`**. Admin remains `userType == 'admin'` or `admins/{uid}` (existing `isAdmin()`).

### Listing vs ownership

| Concept | Field | Meaning |
|---------|-------|---------|
| Who created the property record | `properties.createdByUid` | Immutable |
| Claimed asset owner | `properties.ownerUid` | Transfer later via Cloud Function |
| Who is responsible for this offering | `listings.listedByUid` + `listedByRole` | Agent can list a property they do not own |

Owner listings may be created only if `listedByRole == owner` **and** the caller is `ownerUid` or `createdByUid`. Agent/builder listings may attach to an existing property without ownership (relationship graph is a later prompt). Listing an offer is **not** representation verification.

Property ownership **does not** grant update rights on another user’s listing.

### Migration of existing users

| Existing | Reuse | Do not mix |
|----------|-------|------------|
| Auth + `users/{uid}` | Identity, chat, notifications, KYC docs path | Do not turn users into properties |
| `individual` | Implicit buyer; may add `roles: ['buyer']` later | Not auto-written in this prompt |
| `business` | Venue/organizer for **events**; not automatically a builder | Do not map business → builder without product decision |
| `provider` | Service vendor for **events**; not automatically an agent | Do not map provider → agent |
| `admin` | Same admin model | Do not put admin in `roles[]` |
| `isVerified` / DigiLocker KYC | Identity signal later | Not the same as `verification.ownership` on a property |

No destructive user migration is performed. Event `userType` stays the source of truth for the current app UI.

---

## 6. Media architecture

**Why top-level `property_media`:** one query/security model; listing galleries and property galleries are different parents; 3D assets (`spatial`) can attach to the property without a listing.

**Storage prefixes** (compatible with existing `{uid}/…` owner rules):

| Prefix | Public? | Use |
|--------|---------|-----|
| `property_media/{uid}/…` | Read public; write owner | Photos, floor plans, videos |
| `property_documents/{uid}/…` | Owner + admin | Ownership proofs, private PDFs |
| `property_spatial/{uid}/…` | Owner + admin | 3D **source** (private) |
| `property_spatial_public/{mediaId}/…` | Public read | Derived READY view assets (Admin SDK write) |
| `verification_docs/{uid}/…` | **Unchanged** | Business KYC only. **Never** listing media |

`buildPropertyStoragePath()` in `propertyMediaService.js` encodes this. Documents cannot have `visibility: public`. Public list queries filter `visibility == public` so private docs never appear in a public `list()` (Firestore would otherwise deny the whole query).

No sample uploads in this prompt.

---

## 7. Locality model

Localities are a **catalog**, not derived from property strings. Properties store `localityId` plus denormalized `city`.

Area intelligence (market metrics, transport/school/hospital proximity, flood risk, airport access, connectivity, affordability **inputs**) belongs on `localities.intelligence` (current public snapshot). **Those metrics are not fields on `properties`.** Clients must not write `intelligence` or the legacy `stats` map. Missing data is UNAVAILABLE / UNKNOWN — never fabricated.

Bounding boxes are optional. A centroid camera span used by Explore is **not** an official locality polygon. Do not store large GeoJSON on every locality until a geo prompt needs it.

Writes: **admin only**. Reads: `ACTIVE` is public (needed for pickers and the Locality screen). Details: `docs/CROWW_AREA_INTELLIGENCE_ARCHITECTURE.md`.

---

## 8. Status lifecycle

### Property

```
ACTIVE ⇄ INACTIVE → ARCHIVED
              ACTIVE → ARCHIVED
```

`ARCHIVED` is terminal in client transitions (`PROPERTY_STATUS_TRANSITIONS`).

### Listing

```
DRAFT → PUBLISHED | ARCHIVED
PUBLISHED → PAUSED | SOLD | RENTED | EXPIRED | ARCHIVED
PAUSED → PUBLISHED | EXPIRED | ARCHIVED
SOLD | RENTED → ARCHIVED
EXPIRED → DRAFT | ARCHIVED
ARCHIVED → (none)
```

Owner self-publish `DRAFT` → `PUBLISHED` is allowed for now. Moderated/featured publish and untrusted ingestion should move to a Cloud Function (`PROPERTY_SERVER_OPERATIONS.PUBLISH_LISTING_MODERATED`).

### Media

`ACTIVE` → `HIDDEN` or `DELETED`. Public reads require `ACTIVE` + `public` + non-document.

---

## 9. Verification foundation

Distinct dimensions — not `verified = true`. See `docs/CROWW_VERIFICATION_ARCHITECTURE.md`.

Public property map (clients cannot write `VERIFIED`):

```
verification: {
  identity:   { status, verifiedAt, expiresAt, updatedAt }  // legacy unused for badges
  ownership:  { status, verifiedAt, expiresAt, updatedAt }
  property:   { status, verifiedAt, expiresAt, updatedAt }
  location:   { status, verifiedAt, expiresAt, updatedAt }
}
```

`status`: `NOT_VERIFIED` | `PENDING` | `VERIFIED` | `REJECTED` | `EXPIRED`.

Private cases: `verification_cases/{id}` + `history`. Evidence in `property_documents/{uid}/verification/…`.

Actor: `users.trust.{owner,agent,builder}` (server). Identity reuses DigiLocker/KYC flags — not copied onto properties.

Listing: `verification.representation` + `representationStatus` (`unverified` until server approval). `lastVerifiedAt` is listing freshness/attestation, not a trust badge timestamp.

Create: all property checks `NOT_VERIFIED`. Identity KYC ≠ ownership. `roles[]` ≠ Verified Agent/Builder. Approval is `reviewVerification` only.

KYC files stay in `verification_docs`. They are not property media.

---

## 10. Source / ingestion model

```
source: {
  type: 'owner' | 'agent' | 'builder' | 'admin' | 'external',
  uid: string | null,
  importedAt: timestamp,
  authoritative: boolean,
  externalId?: string | null
}
```

- Client creates always write `authoritative: false` and `uid: auth.uid`.
- `external` + `externalId` reserved for future feeds. Scraped/external data is **not** trusted and must never flip `authoritative` on the client.
- Admin locality creates may set `authoritative: true` (catalog).
- No scrapers or import jobs in this prompt.

---

## 11. Freshness model

| Clock | Where | Meaning |
|-------|-------|---------|
| `createdAt` / `updatedAt` | property & listing | Record mutation |
| `publishedAt` | listing | First time the offer went public |
| `expiresAt` | listing | Optional hard end |
| `lastVerifiedAt` | listing | Croww last attested the offer; **not** `updatedAt` |
| `status` | listing | `EXPIRED` / `PAUSED` / `SOLD` / `RENTED` |

A future stale-listing engine can compare `lastVerifiedAt` / `publishedAt` / `expiresAt` without schema redesign. It is **not** implemented here.

---

## 12. Geolocation representation

**Public documents** store a **public pin**: `{ latitude, longitude }`, GeoPoint `geo`, and `geohash` (precision 9) of that pin.

**Exact coordinates** live only on `properties/{id}/private_geo/current` (owner/creator/admin). They are never denormalized onto public listings.

- `exact`: public pin equals exact.
- `approximate`: stable ~220 m offset seeded by property id (write-time).
- `locality`: locality centroid when known, else a larger offset.

Explore queries the public `geohash`. `toPublicMapCoordinate` is identity after the split (do not jitter stored public pins again).

**Do not** store `lat` / `lng` / `coordinate` on property-domain documents. `toGeoCoordinate()` may *read* legacy aliases when adapting old GPS payloads; it does not write them.

**Do not** copy `locationService.js` defaults (Mumbai `19.0760, 72.8777`, Bangalore vs Bengaluru keys, Trivandrum constants) into properties. Missing GPS must fail validation, not silently geocode to Mumbai.

`locationService.js` is **unchanged**. Event maps keep their existing inconsistencies until a dedicated location cleanup prompt.

No new map SDK.

See `docs/CROWW_LISTING_INGESTION_ARCHITECTURE.md`.

---

## 13. Security model

Rules: `croww-app/firestore.rules` (copied to `croww-admin/firestore.rules`). Storage: `croww-admin/storage.rules`. **Not deployed.**

### Public

- `listings` with `status == PUBLISHED` (entire document — Firestore cannot redact fields)
- `properties` with `status == ACTIVE`
- `localities` with `status == ACTIVE`
- `property_media` with `ACTIVE` + `public` + `mediaType != 'document'`
- Storage `property_media/{uid}/**` read

Do not put phone numbers, private notes, or verification document URLs on those documents.

### Authenticated

- Create/update own properties (`createdByUid` / `ownerUid`)
- Create/update own listings (`listedByUid == auth.uid`); cannot change `listedByUid`, `propertyId`, denormalized public geo/category, `lastVerifiedAt`, `source.authoritative`; cannot introduce `PUBLISHED`
- Agent/builder listing create requires `users.roles[]` to include that role (roles remain self-writable on `users`)
- Cannot set verification to `VERIFIED`
- Cannot transfer `ownerUid`
- Media: owner create/update; documents forced private

### Admin

Existing `isAdmin()` (`admins/{uid}` or `users.userType == 'admin'`). Locality writes, deletes, moderation updates.

### Limitations (not papered over with insecure fallbacks)

1. **No field-level public projection.** Whole published docs are readable.
2. **ACTIVE properties are public even if every listing is DRAFT.** Keep the asset `INACTIVE` until it should be visible, or a later prompt adds `discoverable`.
3. **Agent/builder listing create requires `users.roles[]`.** Roles are still self-writable on `users/{uid}` (pre-existing owner-wide user writes). Representation stays `unverified`. No mandate graph.
4. **`users/{uid}` writes remain owner-wide** (pre-existing). `roles[]` is not a verified credential.
5. **`storagePath` is not cryptographically bound** to the Storage object in Firestore rules; Storage rules still gate the bytes.

Legacy event rules were not weakened.

---

## 14. Index strategy

Source of truth: `croww-app/firestore.indexes.json`. Indexes added **only** for queries in `src/services/property/*`. Legacy event indexes were left in place (this is not an event-index cleanup).

| Collection | Fields | Query |
|------------|--------|-------|
| `listings` | `status` + `publishedAt` DESC | `listPublished()` |
| `listings` | `city` + `status` + `publishedAt` DESC | published by city |
| `listings` | `localityId` + `status` + `publishedAt` DESC | published by locality |
| `listings` | `transactionType` + `status` + `publishedAt` DESC | published buy vs rent |
| `listings` | `listedByUid` + `updatedAt` DESC | `listMinePage()` / dashboard |
| `listings` | `listedByUid` + `status` + `updatedAt` DESC | dashboard filters + counts |
| `listings` | `status` + `geohash` | Explore viewport |
| `listings` | `status` + `transactionType` + `geohash` | Explore buy vs rent |
| `listings` | `propertyId` + `status` | `listPublishedForProperty` |
| `properties` | `localityId` + `status` | `listPropertiesByLocality` |
| `properties` | `city` + `status` | `listPropertiesByCity` |
| `property_media` | `parentType` + `parentId` + `visibility` + `status` + `sortOrder` | public gallery |
| `property_media` | `parentType` + `parentId` + `createdByUid` + `sortOrder` | owner gallery |
| `localities` | `city` + `status` + `name` | `listActiveByCity` |

`croww-admin/firestore.indexes.json` remains a **subset** of event indexes. Deploy indexes from the **app** project file so property indexes are not dropped.

---

## 15. Service boundaries

UI (when built) must call these — not raw `collection(db, 'properties')` in screens:

| Module | Path |
|--------|------|
| Contracts | `src/domain/property/` (`constants`, `types`, `schema`, `geo`, `validate`, `address`, `duplicates`, `actorPolicy`, `errors`, `serverBoundaries`, `posting`, `saved`, `dashboard`) |
| Inventory (create/update product API) | `src/services/property/inventoryService.js` |
| Inventory dashboard | `src/services/property/inventoryDashboardService.js` |
| Post / dashboard UI | `src/screens/property/PostScreen.js`, `PostListingScreen.js`, `InventoryDashboardScreen.js`, `InventoryMediaScreen.js` |
| Properties | `src/services/property/propertyService.js` |
| Listings | `src/services/property/listingService.js` |
| Discovery | `src/services/property/discoveryService.js` |
| Detail | `src/services/property/propertyDetailService.js` |
| Localities | `src/services/property/localityService.js` |
| Media | `src/services/property/propertyMediaService.js` |
| Additive roles | `src/services/property/propertyActorService.js` |
| Property trust | `src/domain/verification/`, `src/services/property/propertyTrustService.js` |
| Barrel | `src/services/property/index.js` |

Event services (`eventService.js`, tickets, buddies) stay isolated.

**Cloud Functions (in repo, not deployed):** `publishListing` (admin), `syncPropertyPublicLocation` (owner/admin), `recomputeLocalityMarket` (admin), `reviewVerification` (admin), `onVerificationCaseCreated`. Still server-only later: ownership transfer, listing `lastVerifiedAt` attestation worker, `source.authoritative`, external ingest, non-market intelligence datasets. Identity from Firebase ID token (`functions/httpAuth.js`), never `body.uid`.

Client listing create is **DRAFT only**. `DRAFT`/`PAUSED` → `PUBLISHED` is `publishListing`, not a client update.

---

## 16. TypeScript / JavaScript approach

- Existing app remains JavaScript.
- **New domain contracts are TypeScript** under `src/domain/property/`. Expo/Metro compiles them; services import the barrel.
- Services stay JS to match `eventService.js` (timeouts, `auth.currentUser`, `serverTimestamp`).
- No repo-wide TS migration. No new validation library (no Zod); `package.json` had none. Validation is `validate.ts`.
- Canonical types: `PropertyRecord`, `ListingRecord`, `PropertyMediaRecord`, `LocalityRecord`. Do not add parallel interfaces in screens.

`tsconfig.json` excludes `app_backup`, `functions`, and `dist-web` so domain `tsc` is not blocked by template leftovers.

---

## 17. Migration strategy

| Asset | Action |
|-------|--------|
| `events`, tickets, bookings, buddies | **Stay legacy.** Do not migrate into properties. |
| `users` Auth + profile | **Reuse** as identity. |
| `userType` | **Keep** for the event app. |
| `roles[]` | **Additive**, empty until users opt in. |
| Chat, notifications, maps, upload, KYC | **Reuse later**; do not mix IDs today. |
| Event coordinates / locationService | **Do not copy** into property writes. |
| Production data | **No seed listings. No destructive migration.** |

---

## 18. Future compatibility — area intelligence

- Locality is a stable ID properties already point at.
- Current evidence is `localities.intelligence` (see `docs/CROWW_AREA_INTELLIGENCE_ARCHITECTURE.md`). Legacy `stats` is unused.
- Personalized Croww Area Score and user weights are **not** stored on the locality. Score is calculated at read time (`docs/CROWW_AREA_SCORE_ARCHITECTURE.md`).
- Do not put score fragments on each property.
- Geohash + GeoPoint + locality bounds support later aggregation jobs without renaming fields.
- Groundwater and other future domains can be added as sections without a new locality collection.

---

## 19. 3D / Gaussian Splatting

See `docs/CROWW_3D_ARCHITECTURE.md`. `mediaType: spatial` on `property_media`. Source in `property_spatial/` (private). Derived READY files in `property_spatial_public/`. Clients cannot mark READY. No splat decoder is bundled. Do not run 3D files through the image optimizer.

---

## 20. Known limitations

1. Rules and indexes are in-repo only until a human deploys them.
2. `reviewVerification` / `onVerificationCaseCreated` exist in-repo and are not deployed. No freshness/expiration worker.
3. Explore + listing/property detail + locality evidence + personalized Area Score v1 + saved searches + inventory dashboard + property trust + 3D media foundation exist. GPU splat processing and capture apps are not built.
4. `listPublished` applies one of city **or** locality **or** transactionType, not combinations (would need more indexes).
5. Listing denormalized copies are not auto-refreshed when a property’s coordinates change.
6. Agent listing remains self-declared until a `REPRESENTATION` case is approved. `users.roles[]` is not Verified Agent.
7. Public property/listing documents store a public pin. Exact coordinates are `private_geo` (owner/admin). Legacy docs may still expose exact public coords until migration. See `docs/CROWW_LISTING_INGESTION_ARCHITECTURE.md`.
8. `users` document writes can still set many fields (pre-existing). `users.trust` is not client-writable.
9. Price/range search indexes are deferred.
10. Locality `createLocality` does not check admin in JS; Firestore will reject non-admins.

---

## Explicitly out of scope (this prompt)

Property screens, navigation redesign, map experience, area scoring/intelligence, 3D viewer, fake seed data, deploying Firebase, deleting event code, rewriting the app to TypeScript, new backends/databases/map SDKs.
