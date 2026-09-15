# Croww Area Intelligence Architecture

**Status:** Evidence-layer foundation in source (2026-09-11). No fake locality statistics. No scraping. Personalized Croww Area Score is a **separate read-time layer** (`docs/CROWW_AREA_SCORE_ARCHITECTURE.md`) and is **not** written onto this snapshot. Firestore rules/indexes/functions in this pass are **not deployed**.

Product hierarchy:

```
CITY → LOCALITY → AREA INTELLIGENCE → PROPERTY → LISTING
```

A locality is an intelligence entity (`localities/{localityId}`), not only an address label.

---

## 1. Locality intelligence model

Canonical collection remains **`localities/{localityId}`**. There is no second locality catalog.

```
localities/{localityId}
  identity: name, city, state, country, aliases, status (ACTIVE | INACTIVE)
  geometry: latitude, longitude, geo (GeoPoint), geohash, bounds? (AABB)
  source: catalog provenance (admin create, etc.)
  intelligence: current public snapshot | null
  stats: legacy reserved map | null  (do not write new metrics here)
```

**Current snapshot** lives on the locality document so the Locality screen is **one bounded read**.

**Future history** (not auto-written):

```
localities/{localityId}/intelligence_history/{snapshotId}
```

**Unpublished / raw / internal** (admin-only subcollections, no public client writes):

```
localities/{localityId}/intelligence_draft/current
localities/{localityId}/intelligence_internal/current
```

Choice: current public evidence on the parent document; history as a subcollection later. That supports methodology versioning without a time-series database.

`createLocality` writes `intelligence: null` and `stats: null`. Clients cannot pass either field through `validateLocalityInput`.

Geometry for intelligence uses the **locality centroid** (and official `bounds` when present). Do not compute area metrics from a single property pin. Public property/listing coordinates remain the public pin; exact coords stay in `private_geo`.

---

## 2. Metric model

Each metric answers what / where / when / how confident:

| Field | Role |
|-------|------|
| `key` | Stable id (`medianSalePrice`, `nearestMetroDistanceM`, …) |
| `value` | Number or short string. **Not** “good metro”. |
| `unit` | `INR`, `INR_PER_MONTH`, `INR_PER_SQFT`, `m`, `count`, `class`, … |
| `status` | `AVAILABLE` \| `PARTIAL` \| `UNAVAILABLE` \| `STALE` \| `INSUFFICIENT_SAMPLE` |
| `sourceClass` | See §3 |
| `sourceLabel` / `sourceRef` / `sourceUrl` | Public dataset id or “Croww published listings”. No secrets. |
| `fetchedAt` / `computedAt` / `sourceUpdatedAt` | Freshness |
| `methodology` / `methodologyVersion` / `datasetVersion` | Reproducibility |
| `confidence` | `HIGH` \| `MEDIUM` \| `LOW` \| `UNKNOWN` |
| `coverage` | `sampleSize`, `minimumSampleThreshold`, `geographic`, `percent`, `capped` |

Clients must not store `userWeight`, `personalScore`, or `areaScore` on the locality.

---

## 3. Source model

```
OFFICIAL | GOVERNMENT | OPEN_DATA | VERIFIED_PROVIDER | DERIVED | INTERNAL | COMMUNITY
```

Acceptable hierarchy (highest first):

| Domain | Acceptable sources |
|--------|-------------------|
| Flood | GOVERNMENT, OFFICIAL, OPEN_DATA |
| Metro / transport | OFFICIAL, GOVERNMENT, OPEN_DATA, VERIFIED_PROVIDER |
| Schools (proximity only) | GOVERNMENT, OFFICIAL, OPEN_DATA, VERIFIED_PROVIDER |
| Hospitals (proximity only) | GOVERNMENT, OFFICIAL, OPEN_DATA, VERIFIED_PROVIDER |
| Airport | OFFICIAL, OPEN_DATA, INTERNAL (documented airport point + haversine) |
| Major roads | GOVERNMENT, OPEN_DATA, OFFICIAL |
| Property market / affordability inputs | **DERIVED** from Croww `PUBLISHED` listings only |

Do not scrape websites. Do not treat SEO pages, agent copy, or community anecdotes as flood/school/hospital truth. COMMUNITY is never enough for flood class.

---

## 4. Confidence model

Confidence is computed, not decorative.

| Situation | Confidence |
|-----------|------------|
| No source / UNAVAILABLE | `UNKNOWN` |
| GOVERNMENT or OFFICIAL dataset, AVAILABLE | `HIGH` |
| OPEN_DATA or VERIFIED_PROVIDER | `MEDIUM` |
| INTERNAL documented calculation (e.g. haversine to a known airport) | `MEDIUM` |
| DERIVED Croww listings, n ≥ 40 | `HIGH` |
| DERIVED, 8 ≤ n < 40 | `MEDIUM` |
| DERIVED, n < 8, or INSUFFICIENT_SAMPLE | `LOW` |
| COMMUNITY | `LOW` |

Do not invent HIGH for empty metrics.

---

## 5. Coverage model

Coverage describes how complete the underlying data is:

- `sampleSize` / `minimumSampleThreshold` for listing statistics
- `geographic` text (e.g. “within 2000 m of locality centroid”)
- `percent` when a dataset states coverage
- `capped: true` when the server query hit `MARKET_SERVER_QUERY_LIMIT` (250)

A cap means PARTIAL coverage, not a comprehensive census of every listing in India.

---

## 6. Freshness

Timestamps: `sourceUpdatedAt` (when known), `fetchedAt`, `computedAt`, snapshot `generatedAt`.

If `generatedAt` is older than **90 days** (`INTELLIGENCE_STALE_AFTER_MS`), domain/metric status becomes **STALE**. Values are still shown, labeled “may be out of date”. Missing timestamps are **Date unknown**, not “current”.

No scheduled refresh worker in this prompt.

---

## 7. Versioning

| Field | Example |
|-------|---------|
| `intelligence.version` | `1` |
| `intelligence.methodologyVersion` | `area-intelligence-v1` |
| Market metrics | `croww-median-v1` |
| Proximity | `haversine-centroid-v1` |
| Flood | `source-passthrough-v1` |
| `datasetVersion` | External flood/transport dataset id when present |

Future Area Score engines must pin these versions so a score can be explained. Personalized scoring (`croww-area-score-v1`) consumes this snapshot; it does not rewrite it.

---

## 8. Market methodology

**Label:** Croww-derived. Not an external price index.

**Inputs:** `listings` with `localityId` + `status == PUBLISHED` only. Exclude DRAFT, PAUSED, SOLD, RENTED, EXPIRED, ARCHIVED. Do not include test/fake listings (none are seeded).

**Prices:** numeric `askingPrice` (buy) and `rentMonthly` (rent). Never parse `₹1.35 Cr`.

**Area unit:** **sq ft**. Prefer `builtUpAreaSqft`, else `plotAreaSqft`, else `carpetAreaSqft`. Skip non-positive / non-finite values.

**Statistic:** median (odd: middle; even: mean of two central values). Not the mean. Valid expensive/cheap listings are kept. Only domain-invalid numbers are dropped.

**Minimum sample for medians:** `MARKET_MEDIAN_MIN_SAMPLE = 8`. Below that: `status = INSUFFICIENT_SAMPLE`, `value = null`, UI “Insufficient data” + sample size. Listing **counts** may still display (they are a census of Croww inventory, labeled as such).

**Schema (minimum):** `activeListingCount`, `activeSaleCount`, `activeRentCount`, `medianSalePrice`, `medianRent`, `medianPricePerSqft` (sale INR / sq ft). Optional `medianRentPerSqft` (INR / sq ft / month) exists in the TS compute path.

**Where it runs:** `computeMarketDomain` in `src/domain/intelligence/market.ts`. Admin HTTP `recomputeLocalityMarket` (in repo, not deployed) queries at most 250 published listings using the existing `localityId + status + publishedAt` index. **LocalityScreen does not scan listings.**

---

## 9. Transport metrics

Fields when a sourced station set exists: `nearestMetroName`, `nearestMetroDistanceM`, `metroStationsWithinRadius` (radius `METRO_RADIUS_M` = 1500 m). Straight-line from **locality centroid**. No “good connectivity” label. Empty POI list → UNAVAILABLE. No metro dataset is bundled in the repo, so the UI shows Data unavailable until a snapshot is written.

---

## 10. School metrics

Proximity/availability only: `schoolsWithinRadius` (2000 m), `nearestSchoolDistanceM`, optional name. **No school quality scores.** No ranking.

---

## 11. Healthcare metrics

`hospitalsWithinRadius` (2000 m), `nearestHospitalDistanceM`, optional name. **No “best hospitals”.**

---

## 12. Airport metrics

`nearestAirportName`, `nearestAirportDistanceM`, `calculationMethod = haversine`. Straight-line only. Do not claim travel time or live traffic. Architecture is city-agnostic (not Chennai-hardcoded schema). No airport list is ingested in this prompt.

---

## 13. Connectivity

Separate from metro: `nearestMajorRoadName`, `nearestMajorRoadDistanceM`, `majorRoadsWithinRadius` (1000 m). No subjective road-connectivity score.

---

## 14. Flood risk

Classes: `LOW` | `MODERATE` | `HIGH` | **`UNKNOWN`**.

- Missing snapshot / missing dataset / unacceptable source (including COMMUNITY) → classification **UNKNOWN**, status **UNAVAILABLE**. **Never coerced to LOW.**
- Elevation, water proximity, agent claims, and anecdotes are not inputs.
- A sourced dataset may itself classify a cell as UNKNOWN; that is AVAILABLE evidence that the dataset did not assign Low/Moderate/High.

No flood dataset is in the repository, so production UI is UNKNOWN / Data unavailable until one is ingested through admin/server.

---

## 15. Affordability inputs

Affordability is **not** “cheap = good” and is **not** personalized yet.

This prompt stores measurable inputs: median sale price, median rent, median INR / sq ft (copied from the market domain when present). User budget weighting belongs to the Area Score prompt. No `userWeight` on the locality.

---

## 16. Groundwater deferral

**GROUNDWATER = FUTURE.**

Deferred because the repository has no credible, documented groundwater dataset or methodology. The locality document is extensible by adding a domain section later without renaming `localities`. `validateIntelligenceSnapshot` rejects `domains.groundwater` in v1 so it is not quietly filled with guesses.

Other future domains (crime, pollution, noise, walkability, employment, rental yield, appreciation, amenities, demographics) follow the same rule: no placeholder scores.

---

## 17. Public / private data boundaries

| Surface | Who |
|---------|-----|
| ACTIVE locality identity + public `intelligence` snapshot | Public read |
| INACTIVE locality | Admin read |
| `intelligence_draft`, `intelligence_history`, `intelligence_internal` | Admin only |
| Catalog create/update/delete | Admin only (`isAdmin()`) |
| Market recompute HTTP | Admin Bearer token (`requireAdmin`) |
| Normal signed-in user writing `floodRisk = LOW` | Denied |

Firestore cannot hide fields on a document: unpublished intelligence must stay off the public locality doc (draft subcollection). History is admin-only until a later prompt publishes selected snapshots.

Property/listing rules are unchanged.

---

## 18. Server / client calculation boundary

```
UI (LocalityScreen)
  → localityIntelligenceService.loadPublic   // one getLocality
  → normalizeSnapshot                        // fill UNAVAILABLE, never invent
  → buildLocalityViewModel                   // evidence copy only

Admin/server
  → recomputeLocalityMarket                  // bounded PUBLISHED query
  → computeMarketDomain
  → write localities.intelligence.domains.market
```

The client is **not** the source of truth for medians or listing counts. If no snapshot exists, the UI shows Data unavailable — it does not aggregate inventory.

Proximity helpers exist for future jobs (`transportIntelligenceService`, etc.) and return UNAVAILABLE on empty inputs.

---

## 19. Locality UI

`LocalityScreen` is intelligence-aware. Personalized Area Score sits **above** evidence (summary of evidence × private weights) and must remain labeled “for your priorities.” Evidence cards stay evidence-first.

- Identity: name, city, state
- Croww Area Score (personalized, read-time; suppressed when coverage is too low)
- **Explore this area** / **View properties in this area** → `ExploreContext.focusLocality` (viewport + localityId + search label)
- Market (Croww-derived, sample size on medians)
- Getting around (metro, roads, airport) when sourced
- Everyday essentials (schools, hospitals) when sourced
- Environment (flood class or Data unavailable)
- Data notes (confidence, freshness, methodology hint)

Copy is evidence-first: numbers, Insufficient data, Data unavailable. No “excellent”, “safest”, or universal locality rating. Flood does not use color alone (status text). Empty domains are compact unavailable states, not fabricated cards with zeros.

Slug `localityId` values without a catalog document cannot show a centroid map CTA.

---

## 20. Area Score consumption

Prompt 10 (`docs/CROWW_AREA_SCORE_ARCHITECTURE.md`) weights metro, schools, hospitals, flood, airport, affordability, connectivity, and Croww listing activity **at read time**. This layer keeps **raw/normalized metrics independent of weights**.

Do not store `personalScore` or user weights on `localities/{id}`. Missing Prompt 9 metrics remain UNAVAILABLE / UNKNOWN; the score engine must not invent them.

Do not store presentation labels as the only record.

---

## 21. Limitations

1. No authoritative flood, metro, school, hospital, or road dataset is in the repo — those domains display Data unavailable until ingested.
2. No Chennai (or any city) intelligence is seeded.
3. `recomputeLocalityMarket` is not deployed; market cards stay unavailable until an admin/server write.
4. Query cap 250 published listings per locality; over-cap is `capped: true`.
5. Locality AABB is not a polygon; centroid camera delta is not an official boundary.
6. Rules/functions/indexes still need a human deploy.
7. History snapshots are not written automatically.
8. Airport haversine is not travel time.
9. Explore discovery remains viewport geohash queries; localityId is context, not a second listing database.

---

## 22. Unsupported data sources

Not used and not planned without an explicit product/legal decision:

- Website scraping / arbitrary SEO pages
- Property-agent marketing copy as facts
- User opinions as public flood/school/hospital truth
- LLM-generated neighborhood narratives
- Paid data providers (no credentials introduced)
- Undocumented third-party APIs
- Inferring flood from elevation or “near water”
- Client-side full-inventory aggregation

---

## Code map

| Area | Path |
|------|------|
| Contracts | `src/domain/intelligence/` |
| Score contracts | `src/domain/areaScore/` (consumes snapshot; does not write it) |
| UI service | `src/services/intelligence/localityIntelligenceService.js` |
| Score service | `src/services/intelligence/areaScoreService.js` |
| Market compute (future server) | `src/services/intelligence/marketIntelligenceService.js` |
| Locality UI | `src/screens/property/LocalityScreen.js` |
| View model | `src/utils/localityIntelligenceView.js` |
| Explore focus | `ExploreContext.focusLocality` |
| Admin recompute | `functions/localityIntelligence.js` |

Constants (thresholds, radii, stale window) live in `src/domain/intelligence/constants.ts`, not in UI components.
