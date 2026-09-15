# Croww 3D Property Experience Architecture

**Status:** V1 foundation in source (2026-09-11). No fake Gaussian Splat assets. No GPU processor. No phone/LiDAR capture. Functions/rules/indexes are **not deployed** until an operator deploys them.

Also read `docs/CROWW_PROPERTY_DOMAIN.md` and `docs/CROWW_PROPERTY_DETAIL_ARCHITECTURE.md`.

---

## 1. Purpose

Croww should eventually let someone **find the place, then explore the property**. Photos remain first-class. 3D is optional media.

This phase establishes a production-oriented **media + processing + viewer** boundary inside Expo / React Native / Firebase. It does **not** rewrite the app in Kotlin/Swift and does **not** claim Gaussian Splatting works.

A listing without 3D remains a complete listing. A 3D asset is **not** proof of ownership, location, or property correctness.

---

## 2. Media model

Reuse `property_media`. Do not create a parallel `3dAssets` collection.

| Field | V1 |
|-------|-----|
| `mediaType` | `spatial` (existing enum; describes the asset, not the renderer) |
| `assetFormat` | `gaussian_splat` \| `glb` \| `panorama` (inside `processing`) |
| `parentType` | `property` (preferred for walkthroughs) or `listing` |
| `processingStatus` | `UPLOADING` \| `PROCESSING` \| `READY` \| `FAILED` \| `ARCHIVED` |

`spatial` does not imply WebGL, Spark, or a native module.

---

## 3. Supported formats

V1 **intends** Gaussian Splat (`assetFormat: gaussian_splat`). GLB and panorama are reserved. No splat decoder is bundled. Filename/MIME checks are not complete validation; a future processor must validate the real file.

---

## 4. Asset lifecycle

```
Actor creates spatial media (UPLOADING, private, url=null)
  → upload source to property_spatial/{uid}/…/source/{mediaId}/
  → queue spatial_processing_jobs QUEUED (PROCESSING)
  → future GPU processor writes derived asset
  → admin/server finalizeSpatialAsset
       READY + public url + spatialTourAvailable
       or FAILED + “3D processing failed.”
```

`onSpatialJobCreated` **logs only**. It does not mark READY. There is no in-Functions splat engine.

---

## 5. Processing states

Clients may set `UPLOADING` / `PROCESSING` / `ARCHIVED` (archive via `archiveSpatialAsset`). Clients **cannot** set `READY`, public visibility, or a public derived URL.

Retry: `FAILED` → new `QUEUED` job, `retryCount` increment, max 3. No automatic retry loop.

---

## 6. Source vs derived

| Kind | Storage | Public |
|------|---------|--------|
| Source capture / intermediates | `property_spatial/{uid}/{propertyId}/source/{mediaId}/` | No (owner/admin) |
| Derived view asset | `property_spatial_public/{mediaId}/` | Yes when READY (write: Admin SDK only) |
| Poster/thumbnail | existing public image URL or listing cover | Yes |

---

## 7. Storage

- Source writes capped at **512 MB** (application + Storage rule).
- Do not run 3D files through `imageOptimizer`.
- Do not store 3D under `property_media/` (photo gallery prefix) or `verification_docs` / `property_documents`.

---

## 8. Public / private media

Public Firestore read of a spatial row requires `ACTIVE` + `public` + `processingStatus == READY`.

Public projection (`toPublicSpatialTour`):

```
{ available, mediaId, assetFormat, posterUrl, assetUrl, fileSizeBytes, parentType, propertyId }
```

Never: source paths, job ids, GPU logs, processor internals, `retryCount`.

Lightweight Explore flag: `properties.spatialTourAvailable` / `listings.spatialTourAvailable` (server-only boolean). Not a search filter.

---

## 9. Property vs listing attachment

Walkthroughs attach to the **property** when `propertyId` exists so sale and rent listings reuse one READY asset (`pickReusablePropertyAsset`). Listing-specific spatial media remains allowed.

---

## 10. Property asset reuse

`createAsset` returns `{ reused: true }` if a READY property-level tour already exists. Do not upload twice.

---

## 11. 3D viewer boundary

`Property3DViewer` / `Property3DViewer.web` receive `{ assetUrl, posterUrl, assetFormat }` only. No Firestore, auth, or listing services.

Controls: close, reset, view photos. No measurement, annotations, AR, or room navigation.

---

## 12. React Native / web architecture

Expo remains the app. Web uses an iframe + WebGL **capability check** (`viewerHtml.js`). Native shows poster + fallback copy. `react-native-webview` is the intended native shell for the same HTML later; it is **not** required for listings without READY assets.

---

## 13. Web / hybrid experiment

Chosen approach: **one HTML viewer + WebGL detect**, not Three.js / PlayCanvas / Spark.

Reason: no real splat asset exists in the repo, and AGENTS.md forbids adding a large renderer (or fake inventory) to demo UI. The viewer **must** show “3D unavailable on this device” / “3D tour unavailable” rather than a fake model.

Replacing the iframe internals later does not change `property_media` or listing documents.

---

## 14. Native escalation criteria

Do **not** add Kotlin/Swift renderers unless:

1. A real READY asset exists
2. The web/hybrid viewer was measured on target devices
3. Performance or format support is demonstrably inadequate

This phase did not meet those criteria. Native rewrite is forbidden.

---

## 15. Performance

Source cap 512 MB. Future `processing.variants.mobile|high|desktop`. No invented GPU memory model. Direct Firebase Storage delivery; a CDN is a later need if derived files are too large for mobile.

---

## 16. Asset variants

`processing.variants` is reserved. V1 does not generate variants.

---

## 17. Processing jobs

Collection `spatial_processing_jobs`:

- Client create: `QUEUED` only, `submittedByUid == auth.uid`
- Update/delete: false (Admin SDK / functions only)
- Public cannot read jobs

Processor metadata: `INTERNAL` \| `EXTERNAL` \| `ADMIN_UPLOAD`, plus `processorVersion`, timestamps. GPU details stay off public docs.

---

## 18. Security

- Actor: owner/creator of the property or `listedByUid` of the listing
- Client cannot READY / public URL / `spatialTourAvailable`
- Archive/finalize derive uid from the ID token
- Verification documents stay separate

Rules/functions **not runtime-tested** (no Firestore emulator in `firebase.json`).

---

## 19. Verification relationship

3D is **not** a trust dimension. No “3D verified” badge. Completeness “3D: Ready” is media quality, not KYC/ownership.

---

## 20. Dashboard integration

Inventory cards: `3D: Ready | Not uploaded` from `spatialTourAvailable`. Processing/Failed detail lives on `SpatialTour`. Photos gallery is unchanged.

---

## 21. Posting integration

Post photos step notes that 3D is optional and added from inventory. Posting is never blocked by missing 3D.

---

## 22. Fallback

Missing READY asset: omit public section, or “3D tour unavailable” for eligible actors. Viewer failure: “3D unavailable on this device” + View photos. Listing detail must not crash.

---

## 23. Future capture architecture

Provider enum: `PHONE` \| `LIDAR` \| `EXTERNAL_CAMERA` \| `PROCESSED_UPLOAD`. V1 upload is `PROCESSED_UPLOAD` / phone file picker only. No photogrammetry camera, ARKit/ARCore, or LiDAR scanner.

---

## 24. GPU processing boundary

```
App → Firebase Storage (source)
  → spatial_processing_jobs QUEUED
  → future GPU/3D worker (not Cloud Functions CPU)
  → property_spatial_public derived
  → finalizeSpatialAsset READY
  → Property3DViewer
```

Do not run splat training inside Firebase Functions.

---

## 25. CDN considerations

Hosting/Storage today is Firebase. If derived splats are large, add CDN/edge later. Not introduced here.

---

## 26. Versioning

`processing.assetVersion` and `processingVersion`. Finalize does not delete source. Regeneration should increment version, not silently overwrite history.

---

## 27. Known limitations

- No real splat was rendered
- Job create does not process anything
- Native WebView renderer not bundled
- MIME/filename checks are incomplete
- Explore “3D” hint is a boolean, not a filter
- `finalizeSpatialAsset` is admin-only until a worker identity exists
- Capture app, AR, measurements, paid 3D, and 3D search are out of scope

---

## Files (primary)

- `src/domain/spatial/`
- `src/services/property/property3DService.js`
- `src/components/property/Property3DViewer.js` (+ `.web.js`)
- `src/screens/property/SpatialTourScreen.js`
- `functions/spatialProcessing.js`
