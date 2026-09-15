# Croww Property Posting Architecture

**Status:** V1 Post workflow in source (2026-09-11). Uses Prompt 7 inventory services. No fake inventory. No auto-publish. Rules/functions remain undeployed.

---

## 1. Posting flow

```
Post tab (hub: your listings)
  → PostListing (Main stack)
       actor → new/existing property → buy/rent
       → category/subtype → property facts
       → location (Places + map pin + precision)
       → listing offer → photos
       → review → Save draft | Request review
```

Deep link: `post/edit/:listingId` → `PostListing`. Public `listing/:listingId` is not an editor.

Form state is local to `PostListingScreen`. No global Context. No write on every keystroke.

## 2. Owner flow

Always available to a signed-in user. Does **not** require `users.roles` to include `owner`. Does not add that role.

Copy: “I’m listing my property” / “List your property”.

Creates a claimed-owner property (`ownerUid` = auth uid, ownership `NOT_VERIFIED`) then a `DRAFT` listing with `listedByRole: owner`. Posting does **not** submit or approve verification.

## 3. Agent flow

Shown to everyone; **enabled** only if `users.roles` includes `agent`. `userType === provider` is not an agent. Role is not auto-granted.

Copy: “I’m listing on behalf of a client”. Representation stays `unverified`. No agency graph. Agents may only attach to properties from `listMyProperties` (properties they created), or create a new property (V1 still claims them as `ownerUid` — known ingestion limitation).

## 4. Builder flow

Enabled only if `users.roles` includes `builder`. `userType === business` is not a builder. No project management.

## 5. Form architecture

Controlled `useState` on `PostListingScreen`. Domain helpers live in `src/domain/property/posting.ts` (steps, field visibility, INR parse, payloads). Screens do not call Firestore.

Dynamic fields: land/plots hide BHK/bathrooms; commercial hides BHK; amenities are a short controlled list.

## 6. Location workflow

Primary: Google Places search (existing `GooglePlacesInput`). Secondary: tap `PostPinMap` to place a pin. City + neighborhood fields remain editable. Catalog localities from `inventoryService.listLocalitiesForCity` when the admin catalog has rows; otherwise a slug `city__neighborhood` is stored as `localityId` (no fake locality documents).

Coordinates are collected in **session state** (`exactLatitude` / `exactLongitude`) and never rendered as numbers.

## 7. Public / private geo

On save, `inventoryService.createProperty` / `updateProperty` receive the session exact coords. The service writes:

- exact → `properties/{id}/private_geo/current`
- public pin → public property (and listing denormalization)

Precision:

- Exact — public pin equals exact
- Approximate — derived public pin (~220 m)
- Locality — locality centroid when known

The Post UI does not jitter. Review does not show exact coordinates. Approximate/locality review has no map of the private pin.

## 8. Media workflow

Local previews until Save draft. Then `inventoryService.attachLocalPhotos` → `uploadService` + `propertyMediaService` (photos only, public gallery). Cover = `setCoverMedia`. Documents / KYC / spatial are not in this picker. 3D is optional (`SpatialTour` from inventory); posting is never blocked by missing 3D. See `docs/CROWW_3D_ARCHITECTURE.md`.

## 9. Draft behavior

Save draft calls create/update through inventory services. Status stays `DRAFT`. Hub lists `inventoryService.listMyListings()`. Opening a draft loads listing + property + public gallery via `loadForEdit` (**no** `private_geo`). Location edits require a new map/Places pick.

## 10. Publication request

`inventoryService.requestPublish` → `private_meta.moderation = PENDING` + listing `reviewRequestedAt`. Status remains `DRAFT`. UI says **Submitted for review**, never Published. Admin `publishListing` is unchanged and not called from the client. Publication does not require or grant property trust. Verification evidence uses Profile / Property / Listing **Submit verification**, not this wizard.

## 11. Duplicate handling

`POTENTIAL_DUPLICATE` shows a neighborhood-level warning (subtype + “similar property”). No other owner’s street address or private geo. User may go back or **Save anyway** (`allowDuplicates: true`). No merge.

## 12. Actor authorization

Identity from `auth.currentUser`. Form has no `ownerUid` / `listedByUid` / `status=PUBLISHED` fields. Agent/builder choices are disabled without the matching `users.roles[]` entry.

## 13. Existing-property behavior

Optional path: properties from `listMyProperties` (caller’s `createdByUid`). No global property search. Selecting one skips category/facts/location and creates a new listing on that property.

## 14. Error handling

`inventoryErrorMessage` maps service codes to copy. No Firebase stack traces in the UI.

## 15. Inventory dashboard

Post hub CTAs: **New listing** and **Your listings** (`InventoryDashboard`). Profile has **Property inventory** (not event `BusinessDashboard`). Edit still uses `PostListing({ listingId })`. See `docs/CROWW_BROKER_DASHBOARD_ARCHITECTURE.md`.

## 16. Known limitations

1. Runtime/emulator not assumed; Functions/rules undeployed.
2. Agent-created properties still claim the agent as `ownerUid` (ingestion V1).
3. Empty locality catalog: slug id, no centroid until admin adds localities.
4. Abandoned local photos are not garbage-collected.
5. Leaving the wizard without saving drops session state.
6. Map camera may open near Chennai if no pin is chosen yet; those coords are **not** written unless the user searches or taps.
7. 3D is optional and not part of the Post wizard. See `docs/CROWW_3D_ARCHITECTURE.md`.
