# Croww Property Detail Architecture

**Status:** Listing and Property detail in source (2026-09-11). Uses real `listings` / `properties` / `property_media` documents. No seed data. No Firestore rules weakened. Indexes for `listings.propertyId + status` are in-repo and **not deployed** by this change.

Locality is an evidence-layer page (market / mobility / essentials / flood when sourced) plus a personalized Croww Area Score above that evidence. The score is not a fixed locality rating (`docs/CROWW_AREA_SCORE_ARCHITECTURE.md`).

---

## 1. Listing detail architecture

Primary entry from Explore is **Listing**, because Explore discovers market inventory.

```
Explore (listingId only)
  → ListingScreen
      → listingService.getListing(listingId)
      → propertyDetailService.loadListingContext(listing)
          → property (if propertyId)
          → public gallery (listing parent, else property parent)
          → locality name
          → public actor projection
```

Route: `Listing` / `listing/:listingId`. Screens do not call `collection(db, …)`.

Load is two-phase:

1. Listing document → header, price, denormalized facts can render.
2. Context reads in parallel (property, media, locality, actor).

A published listing with an unreadable property still shows denormalized offer fields and a banner. Contact is disabled.

---

## 2. Property detail architecture

Route: `Property` / `property/:propertyId`.

```
PropertyScreen
  → propertyDetailService.loadPropertyDetail(propertyId)
      → property
      → public property media
      → locality name
      → published listings for this property (not history)
```

This is the physical-asset page: facts, media, location, amenities, current published offerings. It does not assume a single listing. Expired/sold listing history is not built.

---

## 3. Property vs listing presentation

| | Property | Listing |
|--|----------|---------|
| What it is | Real-world asset | Market offering |
| Price | Not a property field | `askingPrice` (buy) or `rentMonthly` (rent) |
| Description | Asset copy | Offer copy (shown first; identical text is not duplicated) |
| Actor | `ownerUid` | `listedByUid` + `listedByRole` |
| Status | `ACTIVE` / `INACTIVE` / `ARCHIVED` | `PUBLISHED` and the rest |

UI copy:

- Listing: “The offer” vs “The property”
- Link: “View property details”
- Property: “Current listings” (published only)

`userType` is never used to relabel Owner / Agent / Builder.

---

## 4. Media architecture

Collection: `property_media`. Service: `propertyMediaService.listPublicGallery`.

Included: `visibility == public`, `status == ACTIVE`, `mediaType` in `photo` | `video` | `floor_plan`, with `url` or `thumbnailUrl`.

Excluded: `document`, `spatial` (3D is a separate section, never rendered as a photo), private rows, KYC `verification_docs`, `property_documents`.

Gallery prefers listing-attached media. If that query is empty, one property-parent query runs. No N+1 per image.

Thumbnails are used in the strip; full `url` opens in a modal (videos open the source URL). Missing media is an empty photo treatment, not fake images.

`Property3DSection` loads READY public spatial tours via `property3DService.getPublicReadyAsset`. No READY asset: omit for the public, or “3D tour unavailable” for eligible actors. See `docs/CROWW_3D_ARCHITECTURE.md`. Gaussian Splatting is **not** claimed to work without a real asset.

---

## 5. Location / privacy behavior

Display uses `formatPublicLocation` + `toPublicMapCoordinate`.

| Precision | UI |
|-----------|----|
| `exact` | Locality, city, street/`line1` when present, mini-map at stored coordinates |
| `approximate` / `locality` | Locality + city only. No street, no pincode, no coordinate text. Mini-map uses the **stored public pin**. |

The mini-map is not a second Explore surface (`scrollEnabled={false}` / web `gestureHandling: 'none'`). Same map SDKs as Explore (`react-native-maps` / Google Maps JS). Canonical fields remain `latitude` / `longitude` / `geo` / `geohash`. No `lat`/`lng` aliases. No Mumbai fallback.

**Jitter is no longer the privacy mechanism.** New writes store a public pin on `properties`/`listings` and exact coordinates on `properties/{id}/private_geo/current`. See `docs/CROWW_LISTING_INGESTION_ARCHITECTURE.md`. Unmigrated legacy documents may still expose exact public coords until `functions/scripts/migratePropertyPublicGeo.js` is applied.

---

## 6. Actor / contact behavior

`listing.listedByRole` drives copy:

- Owner → “Listed by Owner” / “Contact owner”
- Agent → “Listed by Agent” / “Contact agent”
- Builder → “Listed by Builder” / “Contact builder”

`propertyActorService.getPublicActor` returns `{ uid, displayName, photoURL, trust }` only. Email, phone, KYC payloads, `userType`, and admin flags are stripped. `trust` is public status slices.

`users/{uid}` remains signed-in read (unchanged). Contact uses existing `chatService` / `ChatScreen`. No second messenger.

The CTA does **not** auto-send a message. It navigates to Chat with `recipientId`, `listingId`, `propertyId`. `createChat` stores those IDs on the existing 1:1 `chats` document when present. One thread per participant pair; latest listing context overwrites `listingId` / `propertyId`. Phone contact is not implemented even if `contactPreference` is `phone`.

Own listings and inactive/expired/unpublished offerings do not show the contact CTA.

---

## 7. Freshness

Distinct lines from real timestamps:

| Field | Label |
|-------|--------|
| `updatedAt` | Updated today / N days ago / … |
| `publishedAt` | Listed … (omitted if it would duplicate Updated) |
| `lastVerifiedAt` | Listing reviewed … |

An update is never labeled as a trust badge. Explore cards may show a tiny **Reviewed** hint only when listing representation is currently verified. Map markers stay uncluttered.

---

## 8. Verification display

Badges come from `trustBadges()` and render only when a dimension is **currently** `VERIFIED` (not expired):

- Owner verified (`properties.verification.ownership`)
- Agent verified / Builder verified (`users.trust` + `listedByRole`)
- Property verified
- Location verified
- Identity verified (KYC flags; not `properties.verification.identity`)
- Representation verified (agent/builder listings only)

Never a generic “Verified”. `property.verification.identity` is **not** “Owner verified”. Roles and claimed `ownerUid` do not mint badges. Clients cannot write `VERIFIED`. Evidence and reviewer notes are not shown. Copy: “Verified by Croww based on submitted evidence.” See `docs/CROWW_VERIFICATION_ARCHITECTURE.md`.

---

## 9. Deep links

Unchanged prefixes: Expo URL, `https://croww.ai`, `https://croww-app.web.app`, scheme `crowwapp`.

| Path | Screen |
|------|--------|
| `listing/:listingId` | Listing (loads by ID; Explore visit not required) |
| `property/:propertyId` | Property |
| `area/:localityId` | Locality evidence page |

Share URLs: `https://croww.ai/listing/{id}` and `https://croww.ai/property/{id}`. Shared text is title, public price, city — no coordinates, no street for approximate listings, no phone.

The app shell still requires authentication (`Auth` vs `Main`). A cold listing URL lands on Login, then Main linking. Chat, KYC, and payment return paths are unchanged.

---

## 10. Chat integration

Smallest compatible change:

- Optional `listingId` / `propertyId` on `chats/{chatId}`
- Same `messages` subcollection
- Existing 1:1 matching unchanged

Firestore chat rules already allow participant writes. No new collection.

---

## 11. Public read model

Unchanged rules:

| Document | Public get |
|----------|------------|
| `listings/{id}` | `status == PUBLISHED` (else lister / owner / admin) |
| `properties/{id}` | `status == ACTIVE` (else creator / owner / admin) |
| `property_media/{id}` | public + ACTIVE and not `document` |
| `localities/{id}` | `status == ACTIVE` |
| `users/{id}` | signed-in only |

Drafts are not readable by ID for strangers (`getListing` maps permission-denied → null → “not found”). Published + past `expiresAt` still reads (status may still be `PUBLISHED`) and is shown as expired without contact.

Published listing + inactive property: listing remains readable; property get fails for the public; UI banners and disables contact. Records are not revived.

---

## 12. Performance considerations

- 1 listing get, then parallel property / gallery / locality / actor (4 extra, not N+1).
- Gallery: 1 query, 2 only if listing media is empty.
- Property page: 1 property + media + locality + published-listings query.
- Thumbnails first; full image on demand.
- Listing denormalized fields avoid blocking the first paint on the property get.
- No new cache layer.

---

## 13. Known limitations

1. Indexes (including `listings.propertyId + status`) must be deployed or some queries fail (the property page degrades to “no published listings”).
2. Empty inventory is empty — no fake listings or photos.
3. `users` is not publicly readable; unsigned users cannot reach Main today, so actor names still require auth.
4. Phone numbers are never shown, even when `contactPreference` includes phone.
5. Chat does not yet render a listing card inside the thread.
6. Save is not persisted; the detail UI has no fake Save control.
7. Locality is an evidence page; missing datasets show Data unavailable (no fabricated neighborhood copy).
8. New writes keep exact coords off public docs (`private_geo`). Legacy documents may still expose exact public coords until migration.
9. Listing denormalized geo/facts can drift if the property is later edited; `publishListing` / `syncPropertyPublicLocation` refresh public pins.
10. A `PUBLISHED` listing whose property is `INACTIVE` is an inconsistency; the client does not auto-unpublish.

---

## 14. Location-coordinate exposure status

**New writes (this ingestion pass):** Public `properties` / `listings` store only the public pin. Exact coordinates are `properties/{id}/private_geo/current`, readable by owner/creator/admin. Explore queries public `geohash`. Detail maps use the stored public pin (no second jitter).

**Legacy documents:** If any properties were written before this model, their public `latitude`/`longitude` may still be exact. Run `functions/scripts/migratePropertyPublicGeo.js` (dry-run, then `--apply`) before treating approximate inventory as private. The script is **not** auto-run.

**Publication:** Admin `publishListing` recomputes the public pin from `private_geo` so a draft cannot smuggle exact coords into live Explore.

See `docs/CROWW_LISTING_INGESTION_ARCHITECTURE.md`.

---

## 15. Future extension points

Do not implement these in the detail screen until asked:

- Compact Area Score on Property/Listing detail (score lives on Locality; see `docs/CROWW_AREA_SCORE_ARCHITECTURE.md`)
- Broker dashboard, posting workflow (see those docs). Verification: `docs/CROWW_VERIFICATION_ARCHITECTURE.md`.
- In-thread listing cards, site visits, payments
- 3D capture / GPU splat processing (viewer foundation: `docs/CROWW_3D_ARCHITECTURE.md`)
- Public location DTO / private_geo migration (§14)
- Recommendation engine
