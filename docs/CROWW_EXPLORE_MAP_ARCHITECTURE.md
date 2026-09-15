# Croww Explore Map Architecture

**Status:** Map-first discovery in source (2026-09-10). Uses real `listings` documents only. No seed data. Indexes are **not deployed** by this change.

Legacy event `MapScreen.js` / `MapScreen.web.js` are **unchanged**.

---

## 1. Explore architecture

```
ExploreScreen
  ├── useExploreLocation     → GPS / launch city (not Mumbai default)
  ├── ExploreContext         → viewport, filters, searchLocation, userLocation, selection
  ├── useExploreDiscovery    → debounce → discoveryService
  ├── PropertySearchBar      → Google Places (India)
  ├── PropertyFilters        → buy/rent, category, subtype, BHK, budget
  ├── PropertyMap [.web]     → react-native-maps / Google Maps JS
  └── PropertyResultCard     → Listing route (IDs only)
```

Domain reads stay in `src/services/property/discoveryService.js`. Explore does not call `collection(db, …)`.

State is split on purpose:

| Concept | Where |
|---------|--------|
| User location | `ExploreContext.userLocation` |
| Search location | `ExploreContext.searchLocation` |
| Map viewport | `ExploreContext.viewport` |
| Filters | `ExploreContext.filters` |
| Selected result | `ExploreContext.selectedListingId` |
| Query results | `useExploreDiscovery` (not context) |

---

## 2. Map implementation

**Native:** `react-native-maps` `MapView` + `PROVIDER_GOOGLE`, same Expo Go Apple Maps fallback as the event map, `DARK_MAP_STYLE`. Price pills are `Text` (not Ionicons) with `tracksViewChanges={false}` to avoid Android marker clipping.

**Web:** `@react-google-maps/api` `GoogleMap` / `MarkerF`, shared loader id `google-map-script` with Places. Center is not a controlled prop after mount (avoids fighting pan). Idle → viewport.

---

## 3. Geo-query strategy

Listings store `geohash` precision **9**. Viewport queries use a **prefix** (precision 3–6 from span):

1. Sample a 5×5 grid over the bounds.
2. Encode each sample to the chosen prefix length.
3. Cap at 9 prefixes; coarsen if needed.
4. For each prefix: `status == PUBLISHED` (+ optional `transactionType`) and `geohash >= prefix` / `geohash < prefix+\uf8ff`, `limit 40`.
5. Deduplicate by listing id.
6. Keep rows whose **public** lat/lng fall in the viewport.

This is not a fake single lat/lng equality filter. It is also not a true GIS index: large zooms over-fetch; very dense tiles can exceed `limit`.

---

## 4. Viewport behavior

- `onRegionChangeComplete` (native) / `onIdle` (web) update viewport.
- Epsilon ignores sub-pixel jitter.
- Discovery debounce **450ms** after the first load.
- Map stay interactive while a lightweight “Updating” / badge refresh runs. No full-screen spinner on pan.

---

## 5. Location behavior

`locationService.getLocation()` is reused, but **`method === 'default'` (Mumbai) is discarded**.

If GPS/IP is unavailable, Explore uses launch context **Chennai** from `CITY_COORDINATES.Chennai` (`src/constants/explore.js`). That is not a Firestore `city == Chennai` restriction. Real GPS in another city is honored.

Explore does not auto-call the iOS permission sheet on tab mount beyond `getLocation`’s existing silent check. **Use my location** calls `requestPermissionExplicitly`.

---

## 6. Search behavior

Places autocomplete (`country: in`), then Place Details → pan viewport (~0.06°). Search sets `searchLocation` only. It does not filter listings by string title.

---

## 7. Filter model

Firestore: `transactionType` when Buy or Rent is selected.

Client-side on the current viewport set:

- category (residential / commercial / land)
- residential subtype (apartment / house / villa / plot)
- BHK 1–4 / 5+
- budget ranges (sale vs rent)

Changing BHK/budget does **not** refetch.

---

## 8. Result normalization

`discoveryService` maps a listing to a card/marker DTO: ids, price, type, denormalized BHK/area, city, privacy-adjusted `mapCoordinate`, freshness timestamps, optional `coverThumbnailUrl`, public `verification.representation`. Map markers do **not** show trust icons. Cards may add a small **Reviewed** hint when representation is currently verified.

No N+1 `getProperty`. Display BHK/area require listing denormalization (copied at listing **create**). Older listings may omit those fields; filters that need them will exclude those rows.

Images: only `coverThumbnailUrl` already on the listing. Cards use `expo-image` when present; otherwise a home icon (no fake photos).

---

## 9. Privacy / location precision

Public listing/property documents store a **public pin**. `toPublicMapCoordinate` is identity (do not jitter again).

Write-time derivation (`derivePublicCoordinate`):

- `exact` (or missing): public pin equals exact coordinate
- `approximate`: ~220 m stable offset seeded by **property id**
- `locality`: locality centroid when known, else ~750 m offset

Exact coordinates are `properties/{id}/private_geo/current` (owner/admin). Explore queries **public** `geohash`.

**Legacy documents** written before this model may still hold exact coords on public fields until `functions/scripts/migratePropertyPublicGeo.js` is applied.

---

## 10. Firestore indexes

Added (not deployed):

- `listings`: `status` + `geohash`
- `listings`: `status` + `transactionType` + `geohash`

---

## 11. Performance

- Max 9 prefix queries × 40 docs; cap 50 results / 40 markers.
- Client filters after fetch.
- Marker `memo`; cards `memo`.
- No query per camera frame.
- Clustering **not** implemented; threshold documented at 40 markers in view.

---

## 12. Mobile / web differences

| | Native | Web |
|--|--------|-----|
| SDK | react-native-maps | Google Maps JS |
| Viewport event | region complete | idle |
| Places | HTTP Places API | JS AutocompleteService |
| Custom price marker | View + Text | Marker label |

---

## 13. Known limitations

1. Indexes must be deployed or queries fail.
2. Empty inventory shows empty state (no fake pins).
3. Prefix covering can miss/over-include at extreme zoom.
4. New listing writes store a **public** geohash/pin. Legacy docs may still hold exact coords until `migratePropertyPublicGeo.js` runs.
5. Listing photos load on the Listing detail route from public `property_media` (not on Explore cards unless `coverThumbnailUrl` is set).
6. BHK on cards only if denormalized on the listing.
7. No clustering.
8. Launch city is Chennai only when GPS is absent.
9. Cards may show a tiny `3D` caption when `spatialTourAvailable` is true. There are **no** 3D map markers and **no** “Has 3D” filter. See `docs/CROWW_3D_ARCHITECTURE.md`.

---

## 14. Future extension points

Keep viewport + localityId in context. Do **not** score every map marker. Area Score is calculated when a locality is opened (`LocalityScreen`). Explore can **Save search** when filters/place/locality make the state meaningful (`docs/CROWW_SAVED_SEARCHES_ARCHITECTURE.md`). Locality → Explore uses `focusLocality` (centroid/`bounds` camera). Evidence lives on `localities.intelligence`, not on listing documents. See `docs/CROWW_AREA_INTELLIGENCE_ARCHITECTURE.md` and `docs/CROWW_AREA_SCORE_ARCHITECTURE.md`.
