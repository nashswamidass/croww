# Croww Broker / Actor Inventory Dashboard

**Status:** In source (2026-09-11). Uses existing `properties`, `listings`, `property_media`, and `chats`. No new inventory collection. Firestore rules were not weakened. No fake listings, inquiries, or analytics.

This is the first **supply-side inventory** surface. It is not a generic SaaS admin, not the Vite admin app, and not CRM.

Hierarchy:

```
Actor
  → Properties   (physical assets)
  → Listings     (market offerings)
  → Inquiries    (existing listing-scoped chats)
```

One property may have multiple listings (sale and rent on the same asset).

---

## 1. Dashboard purpose

Let an **owner**, **agent**, or **builder** see and manage **their** inventory from a phone:

- counts that come from bounded queries
- listings and drafts
- properties with their listings grouped
- status actions that the client is actually allowed to perform
- public media
- freshness / completeness from real fields
- recent listing inquiries via existing chat

Entry:

- **Post → Your listings** → `InventoryDashboard`
- **Profile → Property inventory** → `InventoryDashboard`

There is no new primary tab. `BusinessDashboard` remains the **event** organizer dashboard and is not this product.

---

## 2. Actor capabilities

| Actor | How inventory is scoped | Copy |
|-------|-------------------------|------|
| Owner | `listings.listedByUid == uid`; properties `ownerUid` or `createdByUid` | Your properties |
| Agent | `listings.listedByUid == uid` | Your listings |
| Builder | `listings.listedByUid == uid` | Your inventory |
| Signed-in without `roles[]` | Same listing scope (own `listedByUid`) | Your properties |
| Admin | Vite admin remains authoritative. This dashboard only shows listings **they** listed. | — |

`userType` is never reinterpreted: `provider` ≠ agent, `business` ≠ builder. Role grants come from `users.roles[]`.

Agents may represent a property they do not own. Representation stays **unverified** until `reviewVerification` approves a `REPRESENTATION` case. The dashboard never labels **Verified Agent** merely because `roles` includes `agent`.

Builders manage listings like other actors. No projects / towers / phases.

---

## 3. Owner behavior

Owners manage properties they own or created and listings they listed. They can continue drafts, request review, pause published sale/rent listings, mark sold/rented, archive, and manage public photos they uploaded.

They cannot publish, verify, or transfer ownership.

---

## 4. Agent behavior

Agents see listings where `listedByUid` is themselves. Property cards may include properties referenced by those listings (public property docs). That is **not** property edit rights. `updateProperty` still requires `ownerUid` or `createdByUid`.

---

## 5. Builder behavior

Same listing-scoped queries as agents, with builder copy. No unit inventory model.

---

## 6. Inventory overview

`inventoryDashboardService.loadSummary()` uses `getCountFromServer` on `listedByUid` (+ `status` when counting a bucket). Missing counts are **omitted**, not invented.

| Metric | Source |
|--------|--------|
| Active | `status == PUBLISHED` |
| Drafts | `status == DRAFT` |
| Under review | Counted from a bounded DRAFT page **only when** the DRAFT total is ≤ 50. Otherwise omitted. Under review is `DRAFT` + `reviewRequestedAt`, not a listing status. |
| Paused | `PAUSED` |
| Sold/Rented | `SOLD` + `RENTED` |
| Archived | `ARCHIVED` |

`EXPIRED` is counted separately in the service and shown inside the Archived filter with expired rows. Analytics (views, saves, conversion) are **Analytics unavailable**.

---

## 7. Listing management

`InventoryDashboard` listings tab. Each card: cover, title, locality (from `city` / `localityId`), Buy/Rent, price/rent, `listerStatusCopy` (Live only when status is `PUBLISHED`), `updatedAt` / `publishedAt` / `lastVerifiedAt` via existing `freshnessLines`, completeness gaps, attention flags.

Actions come from `availableDashboardActions` — invalid transitions are not shown.

Open:

- Draft / paused → `PostListing({ listingId })`
- Otherwise → `Listing({ listingId })`

No listing payload in navigation params.

---

## 8. Property management

Properties tab: `listMyProperties` (createdByUid, limit 25) plus public property docs for ids referenced by the actor’s current listing page. Listings grouped by `propertyId` from **that actor’s listings only**.

Listing counts on a property card are counts of **loaded** actor listings for that property, not a global aggregation across every listing in Firestore.

Tap opens `Property({ propertyId })`.

---

## 9. Draft workflow

Drafts are `status == DRAFT` without `reviewRequestedAt`. “Under review” is the same status with `reviewRequestedAt` set (`listerStatusCopy` → Submitted for review).

Continue editing always reuses `PostListingScreen`. There is no second form.

---

## 10. Edit integration

`PostListing` already loads via `inventoryService.loadForEdit(listingId)` (listing + property + **public** gallery). Dashboard only navigates with `listingId`. Protected fields, private geo, actor identity, and moderation stay on the existing ingestion boundary.

---

## 11. Status transitions

Domain table (`LISTING_STATUS_TRANSITIONS`) plus `clientMaySetListingStatus`:

| From | Client may |
|------|------------|
| DRAFT | Archive; request review (not publish) |
| PUBLISHED | Pause, Sold (buy), Rented (rent), Archive |
| PAUSED | Archive; **Request review to go live** (status stays PAUSED until admin/`publishListing`) |
| SOLD / RENTED | Archive only. No client republish. |
| EXPIRED | Archive in the action set if the transition is allowed; no EXPIRED toggle in the UI |
| ARCHIVED | None |

Clients **cannot** set `PUBLISHED`. Resume never claims Live until Firestore status is `PUBLISHED`.

`applyListingAction` reloads the listing before applying so a stale PUBLISHED card cannot mark sold after the server already moved it.

Ownership transfer is **not** implemented. Property trust status is shown as `Verification: Verified | Pending | Not verified` from public slices only (no reviewer notes). Submit evidence from listing/property screens, not by writing `VERIFIED`.

---

## 12. Media management

`InventoryMedia` + `propertyMediaService` / `inventoryService.attachLocalPhotos`.

Allowed: view public gallery, add photos, reorder, set cover (`sortOrder` 0), hide (soft-hide, not hard delete). 3D tours are a separate `SpatialTour` flow (`property3DService`); cards may show `3D: Ready | Not uploaded` from `spatialTourAvailable`. That is media completeness, not a trust badge.

Forbidden: verification docs, ownership docs, private spatial source assets, other users’ media.

Mutations require listing `listedByUid == auth.uid` and media `createdByUid == auth.uid`.

---

## 13. Freshness

Thresholds live in `src/domain/property/dashboard/constants.ts` (not a worker):

- **Needs update:** PUBLISHED/PAUSED and `updatedAt` older than 14 days
- **Needs verification:** only when `lastVerifiedAt` **exists** and is older than 14 days
- **Expires soon:** `expiresAt` within 7 days
- **Listing expired:** status `EXPIRED` or `expiresAt` in the past

`updatedAt` is never labeled as a trust badge. Completeness (photos, location, price, description, key facts) is **not** verification. See `docs/CROWW_VERIFICATION_ARCHITECTURE.md`.

---

## 14. Inquiry integration

`chatService.listUserChats(uid, 40)` then keep chats that have `listingId` and whose listing has `listedByUid == uid`.

Does not read message subcollections. Does not scan all chats. Does not show who saved a listing. Does not read Area Score preferences or other users’ saved searches.

Open conversation → existing `Chat` screen.

This is **not** CRM. No lead stages, notes, follow-ups, or site visits.

---

## 15. Analytics limitations

The repository has **no** reliable view, impression, conversion, or saved-count telemetry for listings.

The dashboard must not:

- scan `users/{uid}/savedListings`
- show who saved inventory
- fabricate “1,240 views”

Inquiry rows are a **bounded recent-chat** sample, not a lifetime lead total.

---

## 16. Security

- Reads/writes scoped to the authenticated uid via services; screens do not query Firestore.
- Client cannot self-publish (`listingService.updateListing`, rules `clientCannotPublishListing`, dashboard actions).
- Protected provenance / geo / verification fields remain protected.
- Private geo is not loaded on the dashboard (same as Post edit).
- Public media only.
- Rules were not changed for this feature.

Runtime Firestore emulator tests were **not** run in this pass.

---

## 17. Pagination / query strategy

| Query | Index used |
|-------|------------|
| listings `listedByUid` + `updatedAt` desc, limit 25 | existing |
| listings `listedByUid` + `status` + `updatedAt` desc | existing |
| listings count by `listedByUid` / status | same fields; no new index |
| properties `createdByUid` limit 25 | single-field |
| chats `participantIds` contains uid + `lastMessageTimestamp` limit 40 | existing |

Page size 25 (max 50). Search is **client-side on the loaded page** (title / locality / property name), not full-text search.

Sold/Rented and Archived filters merge two bounded status pages (up to 50 rows) without a composite cursor. Further pages are not loaded for those filters.

---

## 18. Indexes

**No new Firestore indexes** were added. Implemented queries fit indexes already present for listing ingestion / Post.

Do not add `ownerUid` composites unless a future prompt implements owner-scoped property pagination that needs `orderBy`.

---

## 19. Future CRM boundary

Leave listing ids, `listedByUid`, and chat `listingId` / `propertyId` clean. Do **not** add speculative CRM fields to `chats` (stages, lead scores, sources).

Later: lead stages, notes, follow-ups, site visits, contact history.

---

## 20. Future monetization boundary

Do not implement featured, boost, subscription, lead credits, or pay-for-leads here. Actor–listing ownership is already explicit enough to attach those products later.

---

## 21. Known limitations

1. Rules/indexes/functions still **not deployed** from earlier property work.
2. Under-review **count** is omitted when there are more than 50 drafts.
3. Property listing counts are from the current bounded listing page, not a global per-property aggregation.
4. `listMyProperties` is `createdByUid` only (no `ownerUid` composite). Agents see represented properties via listing `propertyId` fetches.
5. Resume cannot set PUBLISHED; UI must wait for server publication.
6. No freshness worker. Thresholds are dashboard-only constants.
7. Inquiry list is the latest 40 participant chats, filtered, not a complete inquiry history.
8. Search does not query Firestore.
9. Ownership transfer, CRM, billing, boosts, bulk import, capture apps, and GPU splat processing are out of scope. 3D media foundation: `docs/CROWW_3D_ARCHITECTURE.md`. Property trust: `docs/CROWW_VERIFICATION_ARCHITECTURE.md`.
10. Device/Firebase runtime was not assumed in this pass.

---

## Files

| Area | Path |
|------|------|
| Domain | `src/domain/property/dashboard/` |
| Service | `src/services/property/inventoryDashboardService.js` |
| UI | `src/screens/property/InventoryDashboardScreen.js`, `InventoryMediaScreen.js` |
| Entry | `PostScreen.js`, `ProfileScreen.js` |
| Routes | `InventoryDashboard`, `InventoryMedia` (`/inventory`, `/inventory/media/:listingId`) |
