# Croww Area Score Architecture

**Status:** Personalized scoring over the Prompt 9 evidence layer (2026-09-11). Methodology `croww-area-score-v1`. No fake snapshots. No city-wide ranking. Firestore preference rules are **not deployed**.

---

## 1. Purpose

Croww Area Score answers:

> “How does this area look **for my priorities**, given the evidence Croww actually has?”

It is **not** a universal “good area” rating and is **not** stored on the locality.

---

## 2. Evidence vs score

| Layer | What it is | Where |
|-------|------------|--------|
| Evidence | Sourced metrics, UNKNOWN/UNAVAILABLE, sample size, freshness | `localities/{id}.intelligence` (public snapshot) |
| Score | Deterministic function of evidence + **user weights** + city config | Calculated at read time |

```
localityIntelligenceService.loadPublic(localityId)
        ↓  one locality read
areaScoreService.calculate(snapshot, city, preferences)
        ↓
AreaScoreResult  (not written back)
```

The client never scans `listings` / `properties` to score.

---

## 3. Personalized scoring model

```
normalizedWeights  = w_i / Σ w
coverage           = Σ w_i (scored dims) / Σ w_i (weight > 0)
overallScore       = Σ (s_i × w_i) / Σ w_i (scored dims)
```

Unavailable dimensions are omitted from the average. They are **not** filled with 0 or 50.

Same locality + different weights ⇒ different scores (tested).

---

## 4. Dimensions

`affordability` · `transport` · `schools` · `healthcare` · `airport` · `connectivity` · `flood` · `marketFit`

Unknown dimension ids are rejected. Users cannot add custom formula dimensions.

---

## 5. Default weights (product heuristic)

Not scientifically optimal:

| Dimension | Raw |
|-----------|-----|
| affordability | 20 |
| transport | 16 |
| schools | 14 |
| healthcare | 12 |
| airport | 10 |
| connectivity | 10 |
| flood | 10 |
| marketFit | 8 |

Sum 100 before normalization. UI copy: “default priorities (product heuristic)”.

---

## 6. User preferences

Integer weights ≥ 0 per dimension. Missing keys in a patch = 0 (not silent defaults). `null` input = product defaults.

Persisted privately at `users/{uid}/preferences/areaScore` (owner read/write) and cached in AsyncStorage. Never on `localities/{id}`.

---

## 7. Weight normalization

Reject negatives, non-finite numbers, unknown keys. Divide by the raw total. All-zero ⇒ `ZERO_WEIGHTS`, no numeric score.

---

## 8. Evidence normalization

Piecewise linear maps onto 0–100 using **city-scoped** reference ranges.

**Lower-is-better** (`invertLinear`): price, distance. At `favorable` → 100; at `unfavorable` → 0.

**Higher-is-better** (`countLinear`): nearby counts. 0 → 0; at `favorable` → 100.

Source class does **not** change `s_i`. It only affects confidence.

---

## 9. Affordability

Uses Prompt 9 medians: sale price, rent, INR/sq ft. Average of whichever are `AVAILABLE`/`STALE`. One metric ⇒ that metric only (confidence already LOW/MEDIUM from sample).

`INSUFFICIENT_SAMPLE` ⇒ dimension unscored (not 50).

Chennai heuristic ranges (not inventory percentiles): sale ₹60L–₹2.5Cr; rent ₹20k–₹80k/mo; ₹5k–₹18k / sq ft.

No user budget matching in v1.

---

## 10. Transport

Uses sourced `nearestMetroDistanceM` (shorter straight-line distance → higher score) and/or `metroStationsWithinRadius` (count toward a city-specific favorable cap). Station count is **not** treated as metres. No metro “quality.” Missing both ⇒ `UNAVAILABLE`.

---

## 11. Schools

Count within radius and/or nearest distance. Quality is not ranked. Missing ⇒ `UNAVAILABLE`.

---

## 12. Healthcare

Same pattern as schools. No “excellent hospitals” language.

---

## 13. Airport

Straight-line `nearestAirportDistanceM` only. **Not travel time.** No traffic.

---

## 14. Connectivity

`nearestMajorRoadDistanceM`. Distinct from metro.

---

## 15. Flood

`LOW` → 100, `MODERATE` → 50, `HIGH` → 15, **`UNKNOWN` → UNAVAILABLE**. Unknown is never treated as low risk.

---

## 16. Market-fit

Croww `activeListingCount` only. Volume is **not** “a good area.” Score capped at 90/100. Tiny samples remain low-confidence via Prompt 9 sample rules.

---

## 17. Missing data

| Evidence | Dimension |
|----------|-----------|
| UNAVAILABLE / null | unscored |
| INSUFFICIENT_SAMPLE | unscored |
| Flood UNKNOWN | unscored |
| STALE | scored, confidence scaled |

Empty snapshot ⇒ `scoreStatus: UNAVAILABLE`, `overallScore: null`. Never 0/100 or 50/100.

---

## 18. Coverage

```
coverage = (sum of normalized weights of scored dimensions)
         / (sum of normalized weights of dimensions with weight > 0)
```

Zero-weight dimensions are ignored. Coverage is **not** “data accuracy.”

---

## 19. Confidence

Per scored dimension:

```
dimConf = (0.65 × evidenceConfidence + 0.35 × sourceTrust) × staleFactor
staleFactor = 0.6 if STALE else 1
overallNumeric = Σ (dimConf_i × w_i) / Σ w_scored
display = overallNumeric × (0.5 + 0.5 × coverage)
```

Labels: ≥ 0.75 HIGH, ≥ 0.45 MEDIUM, else LOW; 0 → UNKNOWN. Coverage &lt; 0.4 cannot display HIGH.

Evidence confidence and sample sizes reuse Prompt 9 (`n ≥ 40` HIGH, `8–39` MEDIUM, `&lt; 8` LOW).

---

## 20. Freshness

Prompt 9 90-day stale rule. Stale metrics still contribute to `s_i`; confidence drops; `staleDimensions[]` listed.

---

## 21. Source quality

GOVERNMENT/OFFICIAL 1.0, OPEN_DATA/VERIFIED_PROVIDER 0.8, INTERNAL 0.7, DERIVED 0.6, COMMUNITY 0.3. Trust is for confidence only.

---

## 22. Score range

0–100 for the **selected weights and available evidence**. 50 is not “average Chennai.” Displayed as an integer. No star ratings. No excellent/good/average labels.

---

## 23. Baseline / reference

V1 uses **fixed city reference ranges** (product heuristics), not a locality percentile and not a hand-picked comparison set. No empirical Croww distribution exists yet.

---

## 24. City configuration

`getAreaScoreConfig(city)` → `AREA_SCORE_CONFIG.cities[cityKey]`. Only **Chennai** (`madras` alias) is implemented. Other cities ⇒ `LIMITED_CONFIG`, no numeric score. **Chennai ranges are never used as a global fallback.**

---

## 25. Methodology versioning

Every result includes `methodologyVersion: croww-area-score-v1`. Formula changes require a new version string. Users can change weights, not the formula.

---

## 26. Explanation model

`AreaScoreResult` includes overall status, coverage, confidence, notes, and per dimension:

`id, normalizedScore, weight/weightShare, contribution, status, evidenceRef, evidenceSummary`

Unavailable dimensions have `contribution: null`. Copy is template-based (no LLM).

---

## 27. Score suppression

Numeric score is shown only if `scoreStatus === AVAILABLE`, which requires at least one scored dimension **and** `coverage ≥ 0.40` (`MIN_COVERAGE_TO_SHOW_SCORE`). Below that: “Not enough evidence yet” plus breakdown of what is missing.

---

## 28. Storage / persistence

| Data | Storage |
|------|---------|
| Evidence snapshot | `localities/{id}.intelligence` (existing) |
| Personalized score | **Not persisted** |
| User weights | `users/{uid}/preferences/areaScore` + AsyncStorage cache |
| Score formula | Versioned code config |

No score cache keyed by locality+profile in v1.

---

## 29. Privacy

Preferences are owner-only. They are not on public locality docs. Other signed-in users cannot read `users/{uid}/preferences/*`. Root `users/{uid}` remains signed-in readable (pre-existing); preferences are not stored there.

---

## 30. Performance

One locality document read + in-memory `calculateAreaScore`. Memoized in `LocalityScreen` on snapshot/city/weights. No map-frame scoring. No all-Chennai pipeline.

---

## 31. Known limitations

1. Only Chennai has reference ranges.
2. Ranges are heuristics, not percentiles.
3. No user budget matching.
4. Airport is straight-line.
5. Most Prompt 9 domains are still empty in production → scores will often suppress.
6. Preference rules/functions not deployed.
7. No comparison UI / city ranking.
8. Stale detection uses the already-normalized snapshot clock.

---

## 32. Future comparison

`calculateAreaScore` is a pure function. Later: `score(A, prefs)` vs `score(B, prefs)` with the same methodology. Do not rank “best in Chennai” from this.

---

## Code map

| Area | Path |
|------|------|
| Domain | `src/domain/areaScore/` |
| Calculate | `src/services/intelligence/areaScoreService.js` |
| Preferences | `src/services/intelligence/areaScorePreferenceService.js` |
| UI | `CrowwAreaScoreCard`, `LocalityScreen` |
