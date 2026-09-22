# Croww Property & Listing Creation Test Report

**Date:** 2026-09-20  
**Target Environment:** Staging (`croww-staging-2026`) & Local Client (`croww-app`)  
**Scope:** Verification of End-to-End Property and Listing Creation across all 6 Launch Accommodation Categories.

---

## 1. Executive Summary

This test report verifies that the Croww property and listing creation flow is fully operational across all six launch accommodation categories:
1. **Bed** (`stay_bed`)
2. **Shared Room** (`stay_shared_room`)
3. **Private Room** (`stay_private_room`)
4. **PG** (`stay_pg`)
5. **Co-living** (`stay_coliving`)
6. **Roommate Replacement** (`stay_roommate_replacement`)

### Key Achievements:
- **Zero Orphaned Properties:** Client pre-validation catches invalid listing inputs prior to writing to Firestore. A compensating rollback mechanism marks newly created properties as `status: 'INACTIVE'` if listing creation ever fails.
- **Strict Location Privacy Invariants:** Exact coordinates are preserved exclusively in `properties/{id}/private_geo/current`. Public properties and listings receive only the derived, jittered public pin (`derivePublicCoordinate`).
- **Strict Publication Lifecycle Invariants:** Client creates listings strictly in `DRAFT` status. Requesting review sets `reviewRequestedAt: true` and moderation status `PENDING`. Direct client publication is strictly forbidden.
- **Server-Driven Taxonomy Compatibility:** All 6 stay categories pass both property schema validation (`validatePropertyInput`), listing schema validation (`validateListingInput`), and server-driven taxonomy validation (`validateTaxonomyPosting`).

---

## 2. Six-Category Test Matrix

| # | Category | Type ID | Rent (₹) | Deposit (₹) | Occupancy | Available From | Schema Validation | Taxonomy Validation | Status Lifecycle | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Bed** | `stay_bed` | 8,500 | 15,000 | Single | Immediate | PASS | PASS | DRAFT → Review | **PASS** |
| 2 | **Shared Room** | `stay_shared_room` | 12,000 | 20,000 | Double | Immediate | PASS | PASS | DRAFT → Review | **PASS** |
| 3 | **Private Room** | `stay_private_room` | 18,000 | 35,000 | Single | Immediate | PASS | PASS | DRAFT → Review | **PASS** |
| 4 | **PG** | `stay_pg` | 14,000 | 14,000 | Double | Immediate | PASS | PASS | DRAFT → Review | **PASS** |
| 5 | **Co-living** | `stay_coliving` | 22,000 | 40,000 | Single | Immediate | PASS | PASS | DRAFT → Review | **PASS** |
| 6 | **Roommate Replacement** | `stay_roommate_replacement` | 16,000 | 30,000 | Single | Immediate | PASS | PASS | DRAFT → Review | **PASS** |

---

## 3. End-to-End Flow Verification

### Flow Steps Tested:
1. **Entry & Category Selection:**
   - User taps a stay category (e.g. Bed, PG, Co-living) on `PostScreen.js`.
   - `initialType` is passed to `PostListingScreen.js`.
   - State initializes with `category: 'residential'`, `transactionType: 'rent'`, `listedByRole: 'owner'`, `bedrooms: 1`, `bathrooms: 1`, and step starts directly at `'property'` (skipping actor/source/transaction/category steps).

2. **Accommodation Attributes (`property` step):**
   - Renders `Occupancy` chips (Single, Double, Triple, 4+ Sharing).
   - Renders `Attached Bathroom` chips (Yes, No/Shared).
   - Renders `Food Included` chips (Meals Included, Self Cooking).
   - Renders `Gender Preference` chips (Any, Female Only, Male Only).

3. **Location Pin & Privacy (`location` step):**
   - Address search or map pin selection captures `exactLatitude` and `exactLongitude`.
   - `locationPrecision` defaults to `'approximate'`.
   - Public coordinates are derived via `derivePublicCoordinate`, ensuring exact coordinates remain isolated in `private_geo`.

4. **Offering & Terms (`listing` step):**
   - Title auto-generated if left blank (e.g. `"PG in Koramangala"`).
   - Monthly rent input formatted and validated.
   - Deposit defaults to `0` when empty, preventing taxonomy rejection for zero-deposit stays.
   - `Available From` chips (Immediately, Within 15 days, Next month) captured.

5. **Photos & Media (`media` step):**
   - Allows photo selection and cover image selection.
   - Preserves storage separation from verification documents.

6. **Review & Draft Saving (`review` step):**
   - Pre-validation verifies property and listing schemas before writing.
   - **Save draft:** Writes property and listing with `status: 'DRAFT'`. Provides prompt to view in `InventoryDashboard` or keep editing.
   - **Request review:** Submits listing to review queue with `reviewRequestedAt: true` and navigates to `InventoryDashboard`.
   - Listing appears in `InventoryDashboardScreen` and correctly links to `ListingScreen` / `PropertyScreen`.

---

## 4. Architectural & Security Verification

| Requirement | Enforcement Mechanism | Verification Result |
|---|---|---|
| **No Client Self-Publishing** | `listingService.createListing` sets `status: 'DRAFT'`, `publishedAt: null`. `requestPublish` sets `reviewRequestedAt` and `status: 'DRAFT'`. | **VERIFIED** |
| **Public vs Private Geo Separation** | Public property doc receives `derivePublicCoordinate()`. Exact coords stored in `properties/{id}/private_geo/current`. | **VERIFIED** |
| **No Orphaned Properties** | Pre-validation runs before writes; compensating rollback updates property `status: 'INACTIVE'` if listing write fails. | **VERIFIED** |
| **Zero Deposit Allowance** | `validateTaxonomyPosting` defaults missing deposit to `0`, allowing zero-deposit listings. | **VERIFIED** |
| **Stay Role Enforcement** | Owner/individual actors allowed; agent and builder roles strictly require explicit `roles` entitlement. | **VERIFIED** |

---

## 5. Automated Test Suite Results

```bash
# Unit & Domain Tests
node --test src/domain/property/*.test.js
```
- **Total Test Suites:** 20
- **Total Tests:** 60
- **Passed:** 60
- **Failed:** 0
- **Duration:** 197ms

```bash
# Server-Driven Listing Taxonomy Tests
node --test src/domain/taxonomy/*.test.js
```
- **Total Test Suites:** 1
- **Total Tests:** 12
- **Passed:** 12
- **Failed:** 0
- **Duration:** 168ms

```bash
# TypeScript Check
npx tsc --noEmit
# Exit Code: 0 (0 errors)

# Linter Check
npx expo lint
# Exit Code: 0 (0 errors across the entire codebase)
```

---

## 6. Audit & Test Artifacts
- **Detailed Flow Audit:** [`docs/PROPERTY_CREATION_FLOW_AUDIT.md`](file:///Users/nashnewton/Documents/Croww/croww-app/docs/PROPERTY_CREATION_FLOW_AUDIT.md)
- **Six-Category Test Suite:** [`src/domain/property/stayCategoriesCreation.test.js`](file:///Users/nashnewton/Documents/Croww/croww-app/src/domain/property/stayCategoriesCreation.test.js)
- **Posting Domain Contract:** [`src/domain/property/posting.ts`](file:///Users/nashnewton/Documents/Croww/croww-app/src/domain/property/posting.ts)
- **Posting Screen Component:** [`src/screens/property/PostListingScreen.js`](file:///Users/nashnewton/Documents/Croww/croww-app/src/screens/property/PostListingScreen.js)
- **Listing Service:** [`src/services/property/listingService.js`](file:///Users/nashnewton/Documents/Croww/croww-app/src/services/property/listingService.js)
- **Taxonomy Validation:** [`src/domain/taxonomy/validation.ts`](file:///Users/nashnewton/Documents/Croww/croww-app/src/domain/taxonomy/validation.ts)
