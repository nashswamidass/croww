# Croww Saved Listings, Properties, and Searches

**Status:** In source (2026-09-11). Firestore rules/indexes/functions are **not deployed**. No fake inventory. Personalized Area Score is not stored on saves.

---

## 1. Saved listing model

Private per user:

```
users/{uid}/savedListings/{listingId}
```

Fields: `kind: savedListing`, `listingId`, `propertyId`, `snapshot` (title, prices, cover, city, locality name, transactionType, bedrooms, status), `savedAt`.

The live `listings/{id}` document remains authoritative. Snapshots are display acceleration only. Saves are **not** deleted when a listing expires, sells, or is paused.

Legacy `follows` is USER→USER and is not reused.

## 2. Saved property model

```
users/{uid}/savedProperties/{propertyId}
```

A property save is independent of listing saves. A user can keep a physical asset without pinning a specific offer. No full property clone.

## 3. Saved search model

```
users/{uid}/savedSearches/{searchId}
```

Canonical fields: `name`, `location` `{ mode, city, cityKey, localityId, searchLabel, viewport }`, `filters` `{ transactionType, category, subtype, bhk, minPrice, maxPrice }`, `criteriaHash`, `alertEnabled`, `alert.enabled`, `ownerUid`, timestamps.

`location.mode`: `CITY` | `LOCALITY` | `VIEWPORT`.

Do not persist ExploreContext, user GPS, or Area Score.

## 4. Search canonicalization

Before write: clip strings, lowercase `cityKey`, drop nulls, coerce BHK to 1–5, swap inverted prices, ignore unknown keys. `criteriaHash` is FNV-1a of the stable JSON of location+filters.

Equivalent filters produce the same hash. Duplicate create returns `status: 'duplicate'` instead of a second document.

Default Explore (Chennai + Buy, no extra filters/place/locality) is **not** meaningful and cannot be saved.

## 5. Search replay

`ExploreContext.applySavedSearch` restores city, localityId, filters, viewport/camera, and search label. Discovery still runs through `discoveryService`. There is no second query engine.

Edit criteria by replaying into Explore, then **Replace with current Explore filters** on `SavedSearch`.

## 6. Alert architecture

```
listings/{id} write
  → isPublicationTransition (non-PUBLISHED → PUBLISHED)
  → collectionGroup savedSearches where alertEnabled==true AND cityKey==listing.city
  → listingMatchesSavedSearch (pure)
  → idempotent savedSearchMatches create
  → notifications doc
  → existing sendPushNotification trigger
```

Client never scans listings or other users’ searches.

**V1 scale:** partition by `cityKey`. Cap 200 candidate searches and 50 notifications per publication. Future cities/users will need tighter partitions (locality, geohash) or a digest worker.

Missing filter = no restriction. Buy matches `askingPrice`; rent matches `rentMonthly`. Missing required price → no match. DRAFT/PAUSED/SOLD/RENTED/EXPIRED/ARCHIVED never alert.

## 7. Publication trigger

`onListingWrittenSavedSearchAlerts` fires on listing create/update/delete.

Counts as new inventory when `after.status === PUBLISHED` and (`before` is missing or `before.status !== PUBLISHED`). That includes DRAFT→PUBLISHED and PAUSED→PUBLISHED (republish). PUBLISHED→PUBLISHED edits do **not** alert.

## 8. Deduplication

Match id: `{savedSearchId}_{listingId}_listingPublished` under

```
users/{uid}/savedSearchMatches/{matchId}
```

Created once in a transaction. Clients cannot write this subcollection. Repeat edits of the same published listing do not notify again.

Future digests can group unread match docs without changing saved-search semantics.

## 9. Notification / deep links

`data.type = saved_search_match` with `listingId` and `savedSearchId` only.

Push reuses Expo + `sendPushNotification`. In-app `notifications` collection unchanged.

`navigateFromNotification` opens `Listing`. Fallback: `SavedSearch` or Saved tab. Existing chat/KYC/payment/event types are untouched.

URL: `listing/:listingId` (existing). Optional `saved-search/:searchId`.

## 10. Privacy

Saves are owner-only. Listing actors cannot see who saved them or search criteria. Notifications omit address, coordinates, geohash, phone, email, `listedByUid`. Area Score weights stay in `users/{uid}/preferences/areaScore`.

## 11. Security

Rules: `users/{userId}/savedListings|savedProperties|savedSearches` owner read/write; `savedSearchMatches` owner read, no client write. Path uid must equal `request.auth.uid`. `ownerUid` on searches must equal auth uid. `personalScore` / `areaScore` rejected.

Limits (client-enforced): 200 listings, 200 properties, 25 searches, 10 active alerts.

## 12. Indexes

Added: collection group `savedSearches` (`alertEnabled`, `cityKey`). `savedAt` / `updatedAt` orderBy use automatic single-field indexes. Reuses existing `listings.propertyId + status`.

## 13. UX

- Listing / Property headers: Save toggle (write-before-UI).
- Explore: **Save search** when the state is meaningful.
- Saved tab: Listings / Properties / Searches.
- Inactive listings: keep the save; show “no longer active”; open property when `propertyId` is known. Non-PUBLISHED listings are not publicly readable, so V1 cannot label SOLD vs deleted from the live doc.

## 14. Performance

Saved tab: ≤50 saves + batched `getDocs` (chunks of 10). Property listing counts: `propertyId IN` + `status==PUBLISHED` (not N+1). Explore does not score/save per map frame.

## 15. Limitations

1. Rules/index/function not deployed.
2. Unpublished listing status is not visible to savers (rules).
3. Map pan without a place/locality does not become a VIEWPORT constraint; city + filters do.
4. No digest/batching yet.
5. No analytics SDK — events not logged.
6. Collection-group matching is city-scoped; no city → no alert.

## 16. Future digest

Match receipts already exist. A later scheduler can count new receipts per search and send “5 new properties matching …” without changing criteria documents.
