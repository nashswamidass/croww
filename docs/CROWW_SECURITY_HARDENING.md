# Croww Security Hardening

**Date:** 2026-09-10  
**Scope:** Repository hardening only. No production deploy. No credential rotation. No property-product work.

This document records what was changed in source control and what still requires a human operator.

---

## 1. Executive summary

Croww’s Expo app and Cloud Functions were hardened in place:

- True secrets were **unstaged from Git** (local `.env` files were kept).
- Client env files no longer contain Cashfree/Mailgun **secret** keys (those belong only on the Functions host).
- Sensitive HTTP Cloud Functions now require a **verified Firebase ID token**. Identity is taken from the token, not from `body.uid` / `followerId`.
- Firestore rules now enforce ticket/booking ownership on **list**, constrain ticket payment finalization, require `fromUserId` on client-created notifications, and add `friend_requests` / `users/*/friends` rules.
- Storage rules allow **admin** read of verification documents without making them public.
- Generated logs, `dist-web/`, and `test_cashfree.js` were removed from Git tracking.
- Admin UI admin-detection now matches Firestore (`userType == 'admin'` or `admins/{uid}`), not a hardcoded email.

**Historical secret exposure remains.** Deleting files from the current tree does **not** remove them from Git history. Rotation is a separate operational step.

---

## 2. Credential inventory

Values are never listed here.

### A. True secrets (server-only)

| FILE | SECRET TYPE | SEVERITY | ACTION REQUIRED |
|------|-------------|----------|-----------------|
| `functions/.env` (local, now untracked) | Cashfree PG client secret | CRITICAL | Keep server-side only; **rotate** (was in git history) |
| `functions/.env` | Cashfree Verification client secret | CRITICAL | Rotate; Functions secret manager |
| `functions/.env` | Mailgun API key | CRITICAL | Rotate; server-only |
| Previously tracked `croww-app/.env*` | `EXPO_PUBLIC_CASHFREE_SECRET_KEY` | CRITICAL | Must never be `EXPO_PUBLIC_*`; rotate |
| Previously tracked `croww-app/.env*` | Cashfree verification secret | CRITICAL | Rotate |
| Previously tracked `test_cashfree.js`, `logs*.txt`, `build_log*.txt` | Payment secret material | CRITICAL | Rotate; do not re-commit |

### B. Client-safe configuration

| FILE | TYPE | NOTES |
|------|------|--------|
| `eas.json` `env` | Firebase web config, Maps key, Cashfree **public** App ID / env / app URL | Intentionally public in the binary. **Restrict** Maps (Android SHA + package, iOS bundle, HTTP referrers) and Firebase API key in Google Cloud. |
| `google-services.json`, `GoogleService-Info.plist` | Firebase Android/iOS client config | Normal for mobile apps; restrict by package/SHA/bundle |
| Expo `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Client SDK config | Allowed in the app. Not a substitute for Maps/API restrictions. |
| `EXPO_PUBLIC_CASHFREE_ENV`, public Cashfree app/client id | PG environment / public id | Not the PG secret |

### C. Unknown / review

| FILE | TYPE | NOTES |
|------|------|--------|
| `croww-admin/debug_db.js` | Hardcoded Firebase **web** API key | Client-class key; still should not be copied around. Prefer env. |
| `croww-app/scripts/check_event_uris.js` | Hardcoded Firebase web API key | Same as above |

`sendCustomPasswordReset` remains **unauthenticated by design** (forgot-password). It does not accept a success flag from the client; it always generates the reset via Admin SDK. Email enumeration is mitigated by a generic success message when the user is missing.

---

## 3. Secret exposure

### Found (current tree, pre-hardening)

- Tracked `.env`, `.env.production`, `.env.staging` in the Expo app, including an `EXPO_PUBLIC_*` **payment secret**.
- Tracked `functions/.env` with PG, verification, and Mailgun secrets.
- Tracked logs and `test_cashfree.js` containing secret material.
- Tracked `dist-web/` JS bundle with client Firebase/Maps keys (expected in a web build, not in git).

### What we did

- `git rm --cached` on those files (working copies of `.env*` **kept**).
- `.gitignore` updated so they are not re-added.
- Client `.env*` **working copies** had secret key **names** stripped so Expo cannot bake them into a client bundle.
- Example files added with placeholders only.

### What we did not do

- Git history rewrite (`filter-repo` / BFG / force-push).
- Automatic rotation of Cashfree, Mailgun, Maps, or Firebase keys.
- Production deploy of Functions or rules.

---

## 4. Environment strategy

```
client-safe configuration
  Expo: EXPO_PUBLIC_*  (Firebase web, Maps, Cashfree env/public app id)
  Admin Vite: VITE_FIREBASE_*
  EAS build env: same client-safe keys (needed at build time)

server-only secrets
  functions/.env locally (gitignored)
  Firebase/Google Cloud Functions secrets in production (recommended)
  Cashfree PG secret, Cashfree verification secret, Mailgun API key
```

**Rule:** if a value would let an attacker charge payments, send email, or complete KYC as Croww, it must not use `EXPO_PUBLIC_*` and must not be in the app repo.

Copy:

- `croww-app/.env.example` → `.env`
- `croww-app/functions/.env.example` → `functions/.env`
- `croww-admin/.env.example` → `.env`

Scripts `set-env:staging` / `set-env:production` still copy local untracked env files.

---

## 5. Cloud Function security

IAM `invoker: "public"` is **unchanged**. Mobile clients cannot call IAM-private Cloud Run without Google service credentials. Authentication is **application-layer** via `Authorization: Bearer <Firebase ID token>` (`functions/httpAuth.js`).

| Function | Method | Auth | Authorization | Sensitive? | Callers |
|----------|--------|------|---------------|------------|---------|
| `createCashfreeOrder` | POST | Firebase ID token | `customer_id` = `decoded.uid` (body `customerId` ignored) | Yes | `paymentService.js`, `.web.js` |
| `verifyCashfreePayment` | POST | Firebase ID token | Status from Cashfree `PGOrderFetchPayments` only | Yes | payment services |
| `getDigiLockerUrl` | GET | None (KYC browser return HTML) | N/A | Low | Cashfree redirect |
| `getDigiLockerUrl` | POST | Firebase ID token | Session created for signed-in user | Yes | `verificationService` |
| `getDigiLockerStatus` | POST | Firebase ID token | KYC write uses `decoded.uid`, not body `userId` | Yes | `verificationService` |
| `sendCustomPasswordReset` | POST | None (forgot password) | Generic response if email missing | Medium | `authService.resetPassword` |
| `deleteUserAccount` | POST | Firebase ID token | Default target = caller. Other UID only if server-side admin | Destructive | `authService.deleteAccount`, admin `Dashboard.jsx` |
| `toggleUserBlock` | POST | Firebase ID token | Server-side admin (`userType` or `admins/{uid}`) | Destructive | admin `Dashboard.jsx` |
| `toggleFollow` | POST | Firebase ID token | `followerId` = `decoded.uid` | Medium | `userService.followUser/unfollowUser` |

Firestore triggers (`sendPushNotification`, bookings, chat, events, friends) still use the Admin SDK and are not HTTP-callable.

**Deploy required:** these HTTP checks do not apply until Functions are deployed. Until then, production still runs the old unauthenticated functions.

---

## 6. Firestore security

**Files:** `croww-app/firestore.rules` (source of truth) copied to `croww-admin/firestore.rules`.

| Collection | Access boundary after this change |
|------------|-----------------------------------|
| `tickets` list | Buyer (`userId`), organizer, or admin — not all signed-in users |
| `tickets` update | Organizer/admin **or** buyer may set `status` `PENDING_PAYMENT` → `valid` and `updatedAt` only |
| `bookings` list | `senderId`, `providerId`, or admin |
| `notifications` create | Admin **or** signed-in with `fromUserId == auth.uid` and a non-empty `toUserId` |
| `follows` write | `followerId == auth.uid` |
| `friend_requests` | Parties only (`fromUserId` / `toUserId`) |
| `users/{id}/friends` | Owner of the user doc, or the friend being written (`friendId == auth.uid`) |
| `buddyRequests` delete | Uses `resource.data.userId` (fixed invalid `request.resource` on delete) |

`getEventStats` now queries `eventId` **and** `organizerId` so it matches the tighter ticket list rule.

**Remaining gap:** client-created notifications can still target another user if the sender is signed in (needed for buddy/booking/scan flows). Impersonating another `fromUserId` is blocked. Moving those writes fully server-side is a follow-up.

**Remaining gap:** any signed-in user can still update event `remainingTickets` / `attendeesCount` (required by ticket purchase). Constraining that further likely needs a Cloud Function.

Rules are **not deployed** by this task.

---

## 7. Storage security

**File:** `croww-admin/storage.rules` (this is what `croww-admin/firebase.json` deploys).

- Profile / event / portfolio images: public read, owner write (unchanged).
- `verification_docs/{userId}/**`: owner read/write; **admin read** added via Firestore `userType` / `admins/{uid}`. Not public.
- `property_documents/{userId}/**`: owner/admin read; owner write. Used for property trust evidence. Not public listing media.

Property trust cases (`verification_cases`) are submitter+admin read; clients create PENDING only; update/delete false. `users.trust` is not client-writable. Public property/listing `verification` maps are status slices only. See `docs/CROWW_VERIFICATION_ARCHITECTURE.md`. `reviewVerification` requires `requireAdmin` + Bearer token (`reviewedByUid` from the token).

---

## 8. Repository hygiene

Removed from Git **tracking** (files may still exist locally):

- `.env`, `.env.production`, `.env.staging`
- `functions/.env`
- `dist-web/**`
- `build_log*.txt`, `ios_build_log.txt`, `android_build_log.json`
- `logs.txt`, `logs_debug.txt`, `lint_*.txt`
- `test_cashfree.js`

`.gitignore` now covers `.env`, `.env.*` with `!.env.example`, plus those artifacts.

Admin repo: same env untrack + `.env.example`.

---

## 9. Remaining risks

1. **Git history still contains secrets.** Assume compromise until rotation + optional history purge.
2. **Functions/rules not deployed.** Production behavior is unchanged until a human deploys.
3. **Admin access** now requires `users.userType == 'admin'` or `admins/{uid}`. A login that only matched `admin@croww.ai` in the UI will be locked out if that Firestore role is missing. Set the role in Firestore (do not re-hardcode email).
4. Notification spam to arbitrary `toUserId` is reduced (must stamp `fromUserId`) but not eliminated.
5. `createCashfreeOrder` still accepts client `orderAmount` (authenticated). Amount tampering is a residual PG risk; fixing it needs server-side price lookup (out of scope).
6. `verifyCashfreePayment` is authenticated but does not bind `orderId` to the caller’s tickets (Cashfree remains source of paid/not paid). Residual: probing other order IDs while signed in.
7. Maps/Firebase keys in `eas.json` are client-public; they need **API restrictions**, not deletion.
8. `debug_db.js` / `check_event_uris.js` still hardcode web API keys.
9. No automated rules unit tests in the repo.
10. Later 3D work added `property_spatial` (private source, 512 MB) and `property_spatial_public` (public derived, client write false). Clients still cannot mark spatial media READY. Rules remain undeployed. See `docs/CROWW_3D_ARCHITECTURE.md`.
11. Identity KYC client-write hole is **closed in source** (2026-09-11): rules lock `aadhaarVerified`/`isVerified`; DigiLocker sessions bind uid; finalize no longer `updateDoc`s KYC. **Not effective until Functions + rules deploy.** See `docs/CROWW_PRODUCTION_READINESS.md`.

---

## 10. Operational actions required

**Do these manually. This repository change does not rotate anything.**

1. **ROTATE EXPOSED CREDENTIALS**
   - Cashfree PG secret
   - Cashfree Verification secret
   - Mailgun API key
   - Treat any `EXPO_PUBLIC_CASHFREE_SECRET_KEY` that was ever committed as leaked
2. Put server secrets in **Firebase Functions secrets** / Secret Manager, not git.
3. Restrict Google Maps and Firebase API keys (package `com.croww.app`, iOS bundle `com.croww.app`, web referrers).
4. Confirm the admin operator’s Firestore user has `userType: "admin"` or an `admins/{uid}` document.
5. Deploy Functions, then Firestore rules, then Storage rules — in a controlled window, after staging.
6. Optional later: history purge (`git filter-repo`) **only** with an explicit force-push plan.
7. After Functions deploy, smoke-test: login, pay (sandbox), KYC start, follow, delete own account, admin block.

**Historical secret exposure detected. Credential rotation is required. Git history purge is a separate controlled operation.**
