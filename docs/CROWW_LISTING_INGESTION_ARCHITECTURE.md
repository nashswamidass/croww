# Croww Listing Ingestion Architecture

**Status:** Domain/service foundation plus V1 Post UI in source (2026-09-11). No fake inventory. Rules/indexes/functions are **not deployed**.

---

## 1. Ingestion sources

`source.type` (who the inventory is attributed to): `owner` | `agent` | `builder` | `admin` | `external`

This is not verification. `source.authoritative` remains server/admin only (`false` on all client writes).

## 2. Ingestion channels

`source.channel`:

| Channel | Who writes it |
|---------|----------------|
| `USER_CREATED` | Authenticated owner/agent/builder (rules) |
| `ADMIN_CREATED` | Admin only |
| `ADMIN_IMPORTED` | Admin only (future bulk) |
| `FUTURE_API` | Reserved |
| `FUTURE_BULK_IMPORT` | Reserved |

No scraping. No external API implementation.

## 3. Property creation flow

```
inventoryService.createProperty
  → validatePropertyInput (exact lat/lng required; no city default)
  → optional locality centroid
  → bounded duplicate scan (same locality, 40 docs)
  → propertyService.createProperty
       pre-allocate id
       write PUBLIC pin on properties/{id}
       write EXACT coords on properties/{id}/private_geo/current
```

`ownerUid` = authenticated uid (**claimed** owner). `verification.ownership` stays `NOT_VERIFIED` until an admin-approved `OWNERSHIP` case. Roles are not granted. Identity KYC does not verify ownership.

## 4. Listing creation flow

```
inventoryService.createListing
  → force status DRAFT
  → assertListingActorAllowed
  → listingService.createListing
       copy PUBLIC geo/query fields from the property
       representationStatus = unverified
       lastVerifiedAt = null
       publishedAt = null
```

Clients cannot create `PUBLISHED` listings (service + rules).

## 5. Owner flow

Create property (claimed owner) → create owner listing if `ownerUid`/`createdByUid` matches → attach public media → `requestPublish` writes `listings/{id}/private_meta` `PENDING` → admin `publishListing` function.

Owner role on `users.roles[]` is **not** required for the first property. Creating a property does not add `owner` to `roles`.

## 6. Agent flow

`listedByRole: agent` requires `users.roles` includes `agent` (service + Firestore `userHasPropertyRole`). `userType === provider` is not an agent.

Agents may attach a listing to a property they do not own. Representation is `unverified` until a later authorization prompt. No agency graph.

## 7. Builder flow

`listedByRole: builder` requires `users.roles` includes `builder`. `userType === business` is not a builder. No project-management features.

## 8. Admin ingestion

Rules: `isAdmin()` (`admins/{uid}` or `users.userType == admin`).

Cloud Functions (not deployed):

- `publishListing` — admin; recomputes public geo from `private_geo`; sets `PUBLISHED`; writes moderation `APPROVED`
- `syncPropertyPublicLocation` — owner/admin; recomputes public pin only

No admin inventory UI in this pass.

## 9. Actor authorization

| Role | Requirement |
|------|-------------|
| owner | Claimed `ownerUid` or `createdByUid` |
| agent | `roles[]` contains `agent` |
| builder | `roles[]` contains `builder` |
| admin | `userType == admin` (and rules `isAdmin()`) |

Identity always comes from `auth.currentUser.uid` / ID token. Client `ownerUid` / `listedByUid` cannot impersonate.

## 10. Duplicate detection

`inventoryService.findDuplicateCandidates` queries `properties` where `localityId` + `ACTIVE`, limit 40. Scores addressNormalized, project name, subtype, BHK, floor, area, public-pin distance.

Returns `POTENTIAL_DUPLICATE` with `{ propertyId, score, reasons }`. **Never merges.** Caller may pass `allowDuplicates: true` after review.

## 11. Address normalization

Original `address` is kept. `addressNormalized` is a lowercase/punctuation-stripped comparison string. Approximate/locality public `address.line1` and `pincode` are omitted; street/pincode stay on `private_geo`.

## 12. Location ingestion

Exact coordinates come from the caller (map/Places/admin). Validated as numbers in range. If `country` is IN, coords must fall in a coarse India bbox. **No Mumbai/Chennai fallback.** Missing coords fail validation.

## 13. Public / private geo model

| Store | Fields | Readers |
|-------|--------|---------|
| `properties/{id}` | **Public** `latitude`, `longitude`, `geo`, `geohash`, `locationPrecision` | Public if `ACTIVE` |
| `listings/{id}` | Same **public** pin (denormalized) | Public if `PUBLISHED` |
| `properties/{id}/private_geo/current` | **Exact** `latitude`, `longitude`, `geo`, `geohash`, optional `addressLine1`/`pincode` | Owner / creator / admin only |

`exact`: public pin equals exact.  
`approximate`: public pin is a stable offset (~220m) seeded by property id.  
`locality`: public pin is the locality centroid when known, else a larger offset.

Explore queries **public** `geohash` / lat/lng. Detail maps use stored public pins (`toPublicMapCoordinate` does not jitter again).

## 14. Public read model

Firestore cannot hide fields. Exact location is a **different document**. Public clients never read `private_geo` in Explore or listing detail.

## 15. Listing denormalization

Copied from the property public doc only: city, localityId, category, subtype, public lat/lng/geo/geohash, locationPrecision, bedrooms, areas, ownerUid.

**Never** copy `private_geo`.

## 16. Freshness

`createdAt` / `updatedAt` / `publishedAt` / `expiresAt` / `lastVerifiedAt` remain distinct. Edits bump `updatedAt` + `updatedByUid` only. `lastVerifiedAt` is immutable for clients and is **not** reset when trust cases are submitted. Discovery drops listings whose `expiresAt` is in the past. Trust-dimension `verifiedAt` lives on `verification.*` slices, not on listing edits.

## 17. Status transitions

Transition map unchanged. **Authorization:**

- Client create: `DRAFT` only
- Client cannot introduce `PUBLISHED` (rules: new status is PUBLISHED only if it already was)
- Client may `DRAFT → ARCHIVED`, and from `PUBLISHED` → `PAUSED`/`SOLD`/`RENTED`/`EXPIRED`/`ARCHIVED` (`inventoryService.markUnavailable` / dashboard)
- `DRAFT`/`PAUSED` → `PUBLISHED` is admin/`publishListing` only. Dashboard resume is **request review**, not client publish.

## 18. Moderation foundation

`listings/{id}/private_meta/current.moderation`: `NONE` | `PENDING` | `APPROVED` | `REJECTED`

Clients may write `NONE`/`PENDING` with `reviewedByUid == null`. They cannot self-approve. Not on the public listing document.

## 19. Media ingestion

`inventoryService.attachMedia` → `propertyMediaService.addMedia`. Documents/spatial cannot be public gallery. 3D uploads go through `property3DService`, not `addMedia`. Cover = `sortOrder` 0 + optional `coverThumbnailUrl` on the listing. No sample uploads.

## 20. Provenance

`createdByUid`, `listedByUid`, `updatedByUid`, `source`, `createdAt`, `updatedAt` are not rewritten on offer edits. `ownerUid` transfer is server-only.

## 21. Firestore security

See `croww-app/firestore.rules`. Tightened vs previous: listing create is DRAFT-only; clients cannot publish; `private_geo` / `private_meta` isolated; listing public geo fields immutable for non-admin.

Admin copy: `croww-admin/firestore.rules` property-domain section synced.

## 22. Server authority

| Operation | Path |
|-----------|------|
| Publish | `publishListing` (admin function) |
| Moderation approve | same |
| Public pin rewrite | `syncPropertyPublicLocation` |
| `source.authoritative` | admin/rules |
| `lastVerifiedAt` | still blocked for clients |
| Agent representation `verified` | `reviewVerification` on a `REPRESENTATION` case (in-repo, not deployed) |
| Ownership transfer | not implemented |
| 3D READY / public derived URL | `finalizeSpatialAsset` (admin). Clients cannot mark READY. |

## 23. Migration strategy

`functions/scripts/migratePropertyPublicGeo.js`

- Dry-run by default; `--apply` writes
- Idempotent: copy current public lat/lng into `private_geo` if missing, then rewrite public pin from private + precision
- Does not delete fields
- **Not executed** in this pass
- Until it runs, **legacy** documents may still expose exact coords on public fields

## 24. Indexes

No new composite indexes. Duplicate scan uses existing `properties.localityId + status`. Explore still uses `listings.status + geohash` (now public geohash). Inventory dashboard reuses `listings.listedByUid + updatedAt` and `listedByUid + status + updatedAt`.

## 25. Future bulk import

`source.channel = ADMIN_IMPORTED` plus `externalId`. Reuse `inventoryService.createProperty({ allowDuplicates })` then `createListing`. No CSV UI.

## 26. Known limitations

1. Rules/functions/indexes undeployed.
2. Legacy public docs may still hold exact coordinates until the migration script is run by a human.
3. Malicious clients can still write a misleading public pin on **DRAFT** properties; **publication** recomputes from `private_geo`.
4. Agent representation is unverified; no mandate/authorization graph.
5. First-time owners are claimed owners without `roles: ['owner']`.
6. `users.roles[]` is still self-writable (pre-existing user document rules).
7. No scheduled expiry worker; reads filter `expiresAt`.
8. `listByProperty` can still fail for mixed draft/public queries (unchanged).
9. No emulator/rules harness in repo.
