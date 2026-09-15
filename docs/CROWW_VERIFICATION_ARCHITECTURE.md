# Croww Property Trust / Verification Architecture

**Status:** V1 property trust layer in source (2026-09-11). No fake VERIFIED inventory. Identity KYC is reused, not duplicated. Rules, indexes, and Cloud Functions are **not deployed** until an operator deploys them.

Also read `docs/CROWW_PROPERTY_DOMAIN.md`, `docs/CROWW_SECURITY_HARDENING.md`, and `docs/CROWW_PROPERTY_DETAIL_ARCHITECTURE.md`.

This layer answers: **why should I trust this listing?** It does **not** answer with a single `verified = true` flag or a numeric trust score.

---

## 1. Trust model

Croww treats trust as **distinct claims**. Each claim has its own status, evidence, reviewer, and optional expiration.

Identity verified ≠ ownership verified.  
Owner verified ≠ property verified.  
Property verified ≠ asking price is accurate.  
Location verified ≠ flood risk is low.  
`users.roles` includes `agent` ≠ Verified Agent.  
A listing exists ≠ representation verified.  
A 3D tour exists ≠ ownership, location, or property verification. 3D is media (`docs/CROWW_3D_ARCHITECTURE.md`).

`ownerUid` remains a **claimed** relationship. Verification changes **state**, not ownership data. `listedByUid` + `listedByRole = agent` means the agent listed the offer; it does not mean Croww reviewed their authority to represent that property.

Publication and verification are independent. A property may be verified while its listing stays `DRAFT`. A listing may be `PUBLISHED` while property verification is still `NOT_VERIFIED`. This prompt does not change `publishListing` policy.

Listing freshness (`updatedAt`, `publishedAt`, `lastVerifiedAt`) is **not** property trust. Edits must not reset verification timestamps.

Copy must not claim legal ownership, fraud-free inventory, government certification, or “100% trusted.” Prefer: *Verified by Croww based on submitted evidence.*

---

## 2. Verification dimensions

| Type | Subject | Public home | Question |
|------|---------|-------------|----------|
| `IDENTITY` | user | existing KYC flags → `identityStatusFromUser` | Was this person’s identity reviewed through Croww KYC? |
| `OWNER` | user | `users.trust.owner` | Was this owner **account** reviewed? |
| `AGENT` | user | `users.trust.agent` | Was this agent **account** reviewed? |
| `BUILDER` | user | `users.trust.builder` | Was this builder **account** reviewed? |
| `OWNERSHIP` | property | `properties.verification.ownership` | Was ownership evidence for **this property** reviewed? |
| `PROPERTY` | property | `properties.verification.property` | Was evidence that this physical property exists / matches reviewed? |
| `LOCATION` | property | `properties.verification.location` | Was the claimed location reviewed? Independent of `locationPrecision`. |
| `REPRESENTATION` | listing | `listings.verification.representation` + `representationStatus` | Was this agent/builder’s authority to list **this property** reviewed? |

`IDENTITY` is **not** submitted through `verification_cases`. It reuses DigiLocker / business KYC.

Legacy `properties.verification.identity` remains on create as `NOT_VERIFIED` and is **not** used for “Owner verified” badges. Identity badges come from the actor’s KYC flags.

Builder **project** verification is out of scope. V1 stays property-level.

---

## 3. Verification states

Explicit statuses (not booleans):

`NOT_VERIFIED` → `PENDING` → `VERIFIED` | `REJECTED`  
`REJECTED` → `PENDING` (resubmit)  
`VERIFIED` → `EXPIRED` | `REJECTED`  
`EXPIRED` → `PENDING`

Clients may introduce **PENDING only**. They cannot write `VERIFIED`, `EXPIRED`, `reviewedByUid`, `reviewedAt`, or `notes`.

Admin/server decisions: `APPROVED` → `VERIFIED`, `REJECTED` → `REJECTED`, `EXPIRED` → `EXPIRED`. `reviewedByUid` is taken from the Firebase ID token, never from the client body.

---

## 4. Identity verification

Reuse:

- `src/services/verificationService.js`
- `VerifyIdentityScreen` (DigiLocker / Cashfree)
- `BusinessVerificationScreen` (`verification_docs/{uid}/`)
- HTTP `getDigiLockerUrl` / `getDigiLockerStatus`

Do **not** copy Aadhaar payloads, DigiLocker JSON, or KYC document URLs onto properties, listings, or `users.trust`.

Public mapping (`identityStatusFromUser`): `aadhaarVerified` / `isVerified` / `verificationStatus === 'verified'` → `VERIFIED`; business `verificationData.status === 'pending'` → `PENDING`. The public slice is `{ status, verifiedAt, expiresAt }` only.

Profile → Verification → **Verify identity** still opens the existing KYC screens.

Known landmine (pre-existing, not expanded here): DigiLocker finalize still lets the **client** write `aadhaarVerified` / `isVerified` on `users/{uid}`. Property trust does not add a second identity writer.

---

## 5. Owner verification

Two different claims:

1. **`OWNER`** — owner *account* reviewed (`users.trust.owner`).
2. **`OWNERSHIP`** — ownership of *this property* reviewed (`properties.verification.ownership`).

Creating a property still sets `ownerUid` (claimed) and `verification.ownership = NOT_VERIFIED`. Identity KYC, photos, and an address do **not** auto-verify ownership.

Evidence types are not a single hard-coded document: `OWNERSHIP_DOCUMENT` (sale deed, tax record, other approved evidence) or `OTHER`.

---

## 6. Agent verification

`users.roles[]` includes `agent` is **self-writable** and is **not** Verified Agent.

Only admin/`reviewVerification` can set `users.trust.agent.status = VERIFIED`. The role is **not** granted by approval.

Public badge **Agent verified** appears only when the listing’s `listedByRole === 'agent'` **and** `users.trust.agent` is currently `VERIFIED` (and not expired).

---

## 7. Builder verification

Same pattern as agent: `roles` includes `builder` ≠ Verified Builder.

Evidence may be `COMPANY_DOCUMENT` (registration, developer docs, project authority, other). No legal assumption is encoded.

Project/inventory verification is **not** implemented.

---

## 8. Representation verification

An agent may list a property they do not own.

`listedByUid` + `listedByRole = agent|builder` means they listed it.  
`listings.verification.representation` / `representationStatus` means Croww reviewed authority.

V1 starts `unverified` / `NOT_VERIFIED`. Clients cannot set `representationStatus` to `verified`. Server sets `verified` only when a `REPRESENTATION` case is approved.

---

## 9. Property verification

Answers whether Croww has credible evidence the physical property exists and matches supplied information.

Evidence: documents, and later site visits / trusted sources (not implemented). User submission → `PENDING`, never `VERIFIED`.

---

## 10. Location verification

Answers whether the **claimed** location was reviewed. Separate from:

- public pin vs `private_geo`
- `locationPrecision` (`exact` | `approximate` | `locality`)

A property can be `locationPrecision = approximate` **and** `locationVerified = VERIFIED`. Exact coordinates stay in `private_geo/current`. Verification never copies private geo onto public documents.

---

## 11. Public projection

Safe fields only:

**`properties.verification.{ownership,property,location}`** (plus unused legacy `identity`):

```
{ status, verifiedAt, expiresAt, updatedAt }
```

**`listings.verification.representation`:** same slice.  
**`listings.representationStatus`:** `unverified` | `verified` (server).

**`users.trust.{owner,agent,builder}`:** same slice.  
**Identity:** derived from KYC flags; not copied as KYC payload.

**Never public:** evidence arrays, storage paths, `evidenceType` internals beyond what a case owner already knows, `reviewedByUid`, `notes`, rejection taxonomy on listing/property cards, DigiLocker/KYC payloads, Aadhaar, document URLs.

Admin and the submitter may read `verification_cases/{id}` (including evidence paths). UI `listMyCases` returns `publicCaseView` (no evidence, no reviewer).

Public listing detail uses `trustBadges()` — max four explicit labels. Expired `VERIFIED` is treated as not currently verified.

---

## 12. Private evidence

| Store | Who | What |
|-------|-----|------|
| `property_documents/{uid}/verification/{caseId}/…` | uploader + admin | Property/actor/representation evidence |
| `verification_docs/{uid}/…` | uploader + admin | Existing **business KYC** only |
| `verification_cases/{id}` | submitter + admin | Case + evidence metadata |
| `verification_cases/{id}/history/{eventId}` | submitter + admin read; **Admin SDK write only** | Audit events |

Never `property_media` or the public gallery. `property_media.mediaType == document` remains private in Firestore, but trust uploads must not use that collection.

---

## 13. Review workflow and admin authority

```
Actor uploads private evidence
  → propertyTrustService.submit
  → verification_cases create status=PENDING
  → onVerificationCaseCreated
       checks submitter is permitted
       writes public PENDING slice
       history NOT_VERIFIED → PENDING
       notification “submitted”
  → Admin Vite tab “Property trust”
       inspects evidence via Storage (admin read)
       Approve / Reject
  → HTTP reviewVerification (requireAdmin)
       reviewedByUid = token.uid
       VERIFIED | REJECTED
       public projection
       history
       notification
```

Clients **cannot** update or delete cases (Firestore `allow update, delete: if false`). Even the admin UI must call the function so history and projection stay consistent.

Vite admin **Approvals** tab remains event/business KYC. Property trust is a **separate** tab, not a redesign.

---

## 14. History and expiration

History documents are append-only (`history` write: false for clients). Transitions recorded include PENDING → VERIFIED / REJECTED and VERIFIED → EXPIRED / REJECTED.

`expiresAt` is supported on public slices. `isCurrentlyVerified` returns false when expired. No scheduled expiration worker in V1; `reviewVerification` can take `decision: EXPIRED`. A later freshness worker can expire stale claims.

`lastVerifiedAt` on listings is **listing attestation / freshness**, not a trust-dimension timestamp. Listing edits cannot change it. Detail copy uses **Listing reviewed …**, not “Verified …”, so it is not confused with trust badges.

---

## 15. Resubmission

`REJECTED` → new case `PENDING`. `hasOpenPending` blocks a second PENDING of the same type+subject. Historical rejection rows stay in `verification_cases` / `history`. The current public slice is overwritten with the new PENDING/VERIFIED/REJECTED projection; audit history is not deleted.

---

## 16. Notifications

Existing `notifications` collection + `sendPushNotification`. `data.type = property_verification`.

Messages are factual, e.g. “Your property verification was approved.” No evidence paths, reviewer ids, KYC, or “100% trusted.”

---

## 17. Privacy

- Public clients load **only** public slices on property/listing/user trust maps. They do not query `verification_cases` for Explore or listing detail.
- Admin loads evidence **after** opening a pending case.
- Exact coordinates remain `private_geo`.
- Rejection reasons stay on the private case. User notification is generic (“was not approved. You can submit new evidence.”).

---

## 18. Relationship to publication

Unchanged. `publishListing` does not require any trust dimension. Trust approval does not publish.

---

## 19. Relationship to freshness

| Signal | Meaning |
|--------|---------|
| `updatedAt` | Listing/property last edited |
| `publishedAt` | Went live |
| `lastVerifiedAt` | Listing attestation (server); not auto-set here |
| `verification.*.verifiedAt` | When that **dimension** was approved |

Do not say a listing is “verified 5 days ago” because it was updated.

---

## 20. Storage and rules

**Firestore**

- `users` owner update **cannot** touch `trust`.
- Property create: all verification slices `NOT_VERIFIED`. Update: clients cannot change `verification`.
- Listing create: `representationStatus == unverified`; optional `verification.representation.status == NOT_VERIFIED`. Update: clients cannot change `verification` or `representationStatus` or `lastVerifiedAt`.
- `verification_cases`: create PENDING only; `reviewedByUid`/`reviewedAt`/`notes` null; actor types require `subjectId == auth.uid`; update/delete false.
- History: read submitter/admin; write false.

**Storage** (unchanged prefixes): `property_documents` and `verification_docs` stay owner/admin. Public `property_media` is separate.

---

## 21. Existing KYC reuse

Property trust **references** identity results. It does not reimplement Cashfree/DigiLocker, does not add a second KYC picker, and does not store KYC files under `property_media`.

Document picker for property evidence reuses `MultiDocumentPicker`.

---

## 22. Migration

Existing properties already have `verification.*.status = NOT_VERIFIED` from ingestion. Those stay unverified.

Do **not** promote legacy booleans or `properties.verification.identity === VERIFIED` to owner/property trust. That field was never a completed ownership review.

Idempotent helper (dry-run default, **do not run unless asked**):

`croww-app/functions/scripts/migrateVerificationProjection.js`

`--apply` only fills **missing** slices as `NOT_VERIFIED`. It never writes `VERIFIED`.

---

## 23. UI

| Surface | Behavior |
|---------|----------|
| Settings → Verification | `TrustOverview` — Identity / Owner / Agent / Builder (roles the user has). Identity opens existing KYC. |
| `SubmitVerification` | Upload private evidence → PENDING. Property types: Property / Ownership / Location. |
| Listing detail | Explicit badges via `trustBadges`. Agents/builders can submit representation evidence. |
| Property detail | Same badges. Eligible actors: Submit verification. Pending copy for owners. |
| Explore cards | Optional tiny **Reviewed** hint only when listing representation is currently verified. **No** map-marker icons. |
| Inventory dashboard | `Verification: Verified \| Pending \| Not verified` from public slices only. |
| Vite admin | Tab **Property trust**: pending queue, open evidence, approve/reject. |

If nothing is verified, UI shows **Not verified** / no badges. No seed data.

---

## 24. Server boundary

```
UI → propertyTrustService → Firestore (PENDING create) / Storage
Admin UI → reviewVerification (Bearer ID token + requireAdmin)
onVerificationCaseCreated → projection + history + notify
```

No raw `verification_cases` writes in screens. `reviewedByUid` is never a trusted client field.

Functions (in repo, deploy separately): `reviewVerification`, `onVerificationCaseCreated`.

---

## 25. Limitations

- Functions/rules/indexes not deployed from this prompt.
- No Firestore emulator suite in-repo (`firebase.json` has no emulator block).
- No expiration worker.
- Identity KYC client-write hole remains.
- No ownership transfer, agency graph, site visits, automated verification, or legal guarantees.
- Public `PENDING`/`REJECTED` status may exist on property/listing maps; **badges** only show current `VERIFIED`.
- Explore cannot show property-level badges without extra reads; the card hint is representation-only.
- A READY 3D asset is not a verification badge.

---

## Files (primary)

- `src/domain/verification/`
- `src/services/property/propertyTrustService.js`
- `src/screens/property/TrustOverviewScreen.js`, `SubmitVerificationScreen.js`
- `functions/verificationReview.js`
- `croww-admin/src/pages/PropertyVerificationQueue.jsx`
