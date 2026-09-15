# Croww Codebase Architecture

**Status:** Current-state after the 2026-09-11 production-readiness pass. Source is staging-deployable; Functions/rules/indexes/migrations are **not** applied to Firebase until an operator runs them. See `docs/CROWW_PRODUCTION_READINESS.md`.  
**Scope:** Factual baseline for future AI coding agents.

Also read `docs/CROWW_SECURITY_HARDENING.md`, `docs/CROWW_PROPERTY_DOMAIN.md`, `docs/CROWW_PROPERTY_NAVIGATION.md`, `docs/CROWW_EXPLORE_MAP_ARCHITECTURE.md`, `docs/CROWW_PROPERTY_DETAIL_ARCHITECTURE.md`, `docs/CROWW_LISTING_INGESTION_ARCHITECTURE.md`, `docs/CROWW_PROPERTY_POSTING_ARCHITECTURE.md`, `docs/CROWW_AREA_INTELLIGENCE_ARCHITECTURE.md`, `docs/CROWW_AREA_SCORE_ARCHITECTURE.md`, `docs/CROWW_SAVED_SEARCHES_ARCHITECTURE.md`, `docs/CROWW_BROKER_DASHBOARD_ARCHITECTURE.md`, `docs/CROWW_VERIFICATION_ARCHITECTURE.md`, `docs/CROWW_3D_ARCHITECTURE.md`, and `docs/CROWW_PRODUCTION_READINESS.md` after this file.

This document describes **what the code actually does today**. Sections labeled **RECOMMENDED FUTURE** are migration guidance only. Do not treat future sections as implemented.

---

## How to use this document

1. Read `AGENTS.md` at the workspace root for hard constraints.
2. Use this file as the source of truth for boot flow, navigation, Firebase, and reuse decisions.
3. Before changing architecture: inspect the live files listed here. This document can drift; the code cannot.
4. Do not assume a library is active because it is in `package.json`. Expo Router is a dependency and is **not** used by production navigation.

### Workspace vs git

| Path | Git? | Role |
|------|------|------|
| Wrapper `Croww/` | **No** `.git` | Cursor workspace; contains both apps |
| Expo app (`croww-app/` in the wrapper, or GitHub repo root) | Yes — `origin` → `https://github.com/nashswamidass/croww.git`, branch observed: `staging` | Production Expo app + Cloud Functions + Firestore rules/indexes |
| `croww-admin/` | Local git only, **no remotes** | Vite admin dashboard |

**Paths below** (`src/`, `App.js`, `functions/`) are relative to the **Expo app root**. In the wrapper workspace that is `croww-app/`.

---

## 1. Executive summary

Croww is a **React Native / Expo 54** consumer app for **event discovery, ticketing, buddy matching, and a service-provider marketplace**, plus a **Vite React admin dashboard**. Backend is **Firebase** (Auth, Firestore, Storage, Cloud Functions, Hosting) with **Cashfree** payments/KYC and **Google Maps / Places**.

**What is actually running**

- Entry: classic Expo `App.js` → `AuthProvider` → React Navigation (`@react-navigation/native` v7).
- **Expo Router is not the production navigator.** There is no `app/` directory. Template leftovers live in `app_backup/`.
- Roles today: `individual`, `business` (venues/organizers), `provider` (service vendors), `admin`.
- Geographic product is India-locked. GPS/IP fallbacks default to **Mumbai**. Live city picker is **Bengaluru** and **Trivandrum**.
- Production identifiers: Android package and iOS bundle **`com.croww.app`**. Do not change them.

**What this is not**

- Owner/agent/builder inventory dashboard (`InventoryDashboard`) is in source. It is not the Vite admin app and not event `BusinessDashboard`. Explore, listing/property detail, ingestion, Post listing, locality evidence, personalized Area Score v1, and saved searches exist. Area Score is not a fixed locality rating.
- Not a Kotlin/Swift native rewrite. Native modules may be added later only for capabilities RN cannot provide (e.g. advanced 3D).
- Not TypeScript across `src/` — live screens remain JavaScript. Property-domain **contracts** are TypeScript under `src/domain/property/`.

---

## 2. Current tech stack

### Consumer app (`croww-app/`)

| Layer | Actual technology |
|-------|-------------------|
| Framework | React Native `0.81.5`, React `19.1.0` |
| Runtime | Expo SDK `~54.0.33`, New Architecture enabled (`newArchEnabled: true`) |
| Entry | `"main": "expo/AppEntry"` → `App.js` |
| Navigation | React Navigation 7: native stack + bottom tabs. **Not Expo Router.** |
| State | React Context (`AuthContext`) + local component state + AsyncStorage caches |
| Backend client | Firebase JS SDK `^12.8.0` (Auth, Firestore, Storage) |
| Maps native | `react-native-maps` `1.20.1` |
| Maps web | `@react-google-maps/api` |
| Location | `expo-location` + browser Geolocation + `ipapi.co` |
| Payments | `react-native-cashfree-pg-sdk` (native); web checkout via `paymentService.web.js` |
| Push | `expo-notifications` + Expo Push via Cloud Function |
| Media | `expo-image-picker`, `expo-document-picker`, `expo-image-manipulator`, `expo-camera` (scanner), `expo-sharing` |
| Observability | `@sentry/react-native` (DSN from env; empty if unset) |
| Styling | StyleSheet + `src/constants/theme.js` (dark palette, accent `#C1FF72`) |
| Language | JavaScript in screens/services. TypeScript contracts in `src/domain/property/`, `src/domain/intelligence/`, and `src/domain/areaScore/`. Expo template leftovers in root `hooks/` / `constants/theme.ts`. |

### Admin (`croww-admin/`)

| Layer | Actual technology |
|-------|-------------------|
| Framework | Vite 7 + React 19 + React Router 7 |
| Styling | Tailwind CSS v4 |
| Auth | Firebase email/password; UI admin gate is `userType == 'admin'` or `admins/{uid}` |
| Deploy | `firebase deploy --only hosting,firestore:rules` |

### Backend

| Layer | Actual technology |
|-------|-------------------|
| Firebase projects | Production `croww-live-2026`; staging `croww-staging-2026` |
| Functions | Node 22, `firebase-functions` v2, codebase `default` |
| Payments / KYC | Cashfree PG + Cashfree Verification (DigiLocker) |
| Email | Mailgun HTTP API (`functions/emails.js`) |
| Hosting (app web) | Firebase Hosting site `croww-app` → `croww-app.web.app` |
| Hosting (admin) | `croww-live-2026.web.app` / staging equivalent |

### Environments (from root `README.md`)

| | Production | Staging |
|--|------------|---------|
| App URL | `https://croww-app.web.app` | `https://croww-staging-2026.web.app` |
| Admin | `https://croww-live-2026.web.app` | `https://croww-staging-2026.web.app` |
| Firebase | `croww-live-2026` | `croww-staging-2026` |
| Cashfree | `PRODUCTION` | `TEST` |

Switch app env locally: `npm run set-env:staging` / `set-env:production` (copies `.env.staging` / `.env.production` → `.env`).

---

## 3. Application boot flow

```
expo/AppEntry
  → App.js
      Sentry.init (EXPO_PUBLIC_SENTRY_DSN or empty)
      HelmetProvider (web SEO)
      SafeAreaProvider
      AuthProvider
        AppNavigator
        AppDownloadPopup (web store nudge)
```

### AuthProvider (`src/context/AuthContext.js`)

1. `onAuthStateChanged(auth)`.
2. If signed in: `onSnapshot(users/{uid})` → `user`, `isBlocked`.
3. Anti-freeze: 5s fallback to AsyncStorage cache or a minimal `{ id, email, role: 'individual' }`; 12s absolute `loading=false`.
4. `isAuthenticated` is `!!user` (Firestore profile present, or fallback session).
5. Logout path: `userService.logout()` (clears storage).

### AppNavigator gate (`src/navigation/AppNavigator.js`)

```
loading → black splash with assets/croww-logo.png
isBlocked → BlockedScreen
!isAuthenticated → AuthNavigator
else → MainNavigator
```

After auth: 3s delayed push-notification registration if settings allow; otherwise a once-per-day prompt. Taps go through `navigateFromNotification`.

**CURRENT:** No Redux/Zustand, no React Query. `ExploreContext` holds Explore city/locality/viewport/filters/userLocation/searchLocation. Listing discovery uses `discoveryService` (geohash prefixes). Event screens still fetch location locally. Explore does **not** use the Mumbai `locationService` default.

---

## 4. Navigation architecture

### CURRENT (production)

**Library:** `@react-navigation/native` + `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`.

**Container:** `NavigationContainer` with `linking.js` and `navigationRef`.

**Deep-link prefixes:** Expo linking URL, `https://croww.ai`, `https://croww-app.web.app`. Custom scheme: `crowwapp`.

```
Root Stack
├── Blocked
├── Auth (stack)
│     Login | Signup | LegalPolicy
└── Main (stack)
      ├── Tabs (PropertyTabNavigator)
      │     Explore | Saved | Post | Messages | Profile
      ├── Property | Listing | Locality (evidence + personalized Area Score; not a fixed rating)
      ├── Home | Map | Search (legacy event/marketplace, not tabs)
      └── 35+ stack screens (events, chat, bookings, verification, settings, …)
```

Primary consumer IA is property-oriented. Event/ticket/buddy screens remain registered but are **not** tabs. See `docs/CROWW_PROPERTY_NAVIGATION.md`.

Business/provider event dashboards are stack-only (`BusinessDashboard`), reached from Settings / Profile.

### Expo Router — unused

| Check | Result |
|-------|--------|
| `package.json` `main` | `expo/AppEntry` (not `expo-router/entry`) |
| `app/` directory | Does not exist |
| `expo-router` in dependencies | Present (`~6.0.23`) |
| Imports of `expo-router` under `src/` | **None** |
| `app.config.js` plugins | Does **not** include `expo-router` |
| Leftovers | `app_backup/`, root `components/`, `hooks/`, `constants/theme.ts` |

Do **not** introduce a second navigation system. Do not enable Expo Router without an explicit rewrite plan.

### Dual registrations (same component, two route names)

- `BusinessDashboardScreen` → stack `BusinessDashboard` (and Profile Dashboard / Settings)
- `MyTicketsScreen` → stack `MyTickets` (and web payment return)
- `ChatListScreen` → tab `Messages` **and** stack `ChatList`
- `LegalPolicyScreen` → Auth **and** Main

### Linking map (`src/navigation/linking.js`)

| Path | Screen |
|------|--------|
| `login` / `signup` | Auth |
| `policy/:type` | Auth LegalPolicy |
| `legal/:type` | Main LegalPolicy |
| `explore` / `saved` / `post` / `inbox` / `me` | Property tabs |
| `home` / `my-tickets` / `map` / `marketplace` | Legacy stack (event home, tickets, event map, marketplace) |
| `property/:propertyId` / `listing/:listingId` / `area/:localityId` | Property detail, listing detail, locality evidence + personalized Area Score |
| `event/:id` | EventDetail |
| `provider/:serviceId` | ServiceDetail |
| `settings` / `help` / `notifications` / `friend-requests` | stack |
| `messages/:chatId` | Chat |
| `kyc-complete` | VerifyIdentity |
| `payment-return` | WebPayment |
| `buddies/:eventId` | EventBuddy |
| `buddy-request/:requestId` | BuddyRequestDetail |
| `blocked` | Blocked |

### Broken / dead routes

| Issue | Detail |
|-------|--------|
| `Analytics` | **Fixed** — Profile business Dashboard → `BusinessDashboard` |
| `LandingScreen` | Exists; **never registered**; not in linking |
| `Privacy` | Registered; Settings does not navigate to it (uses LegalPolicy) |

---

## 5. Screen inventory

Recommendation values: **KEEP** (needed as-is) · **MODIFY** (keep shell, change domain) · **REUSE** (usable for property with light change) · **REPLACE** (rebuild for property) · **DEPRECATE** (stub/overlap) · **DELETE LATER** (do not delete in this phase).

Platform: **both** unless noted. Navigator: Auth / Root / Tab / Main stack.

### Auth

| File | Navigator | Purpose | Firebase / services | Destinations | Event? | Property? | Legacy? | Rec |
|------|-----------|---------|---------------------|--------------|--------|-----------|---------|-----|
| `src/screens/auth/LoginScreen.js` | Auth | Email/password login | `authService`, Auth | Signup, LegalPolicy | no | yes | no | KEEP |
| `src/screens/auth/SignupScreen.js` | Auth | Signup individual/business/provider | `authService`, `SERVICE_CATEGORIES` | Login, LegalPolicy | partial | partial | no | MODIFY (roles) |
| `src/screens/auth/BlockedScreen.js` | Root | Suspended account | `authService` | logout | no | yes | no | KEEP |
| `src/screens/auth/LegalPolicyScreen.js` | Auth + Main | Terms/privacy/security/refund copy | none | goBack | no | yes | no | KEEP |

### Verification

| File | Navigator | Purpose | Firebase / services | Destinations | Event? | Property? | Legacy? | Rec |
|------|-----------|---------|---------------------|--------------|--------|-----------|---------|-----|
| `src/screens/verification/VerifyIdentityScreen.js` | Main | Aadhaar / DigiLocker KYC | `verificationService` → `users` | Tabs/Home | no | yes | no | KEEP |
| `src/screens/verification/BusinessVerificationScreen.js` | Main | Business docs upload | `verificationService`, Storage | goBack | no | yes | no | KEEP |

### Tabs / discovery

| File | Navigator | Purpose | Firebase / services | Destinations | Event? | Property? | Legacy? | Rec |
|------|-----------|---------|---------------------|--------------|--------|-----------|---------|-----|
| `src/screens/main/HomeScreen.js` | Tab Home (consumer) | Event feed, city filter | `eventService`, `userService`, `chatService`, `locationService` | EventDetail, Notifications, EventSearch, ChatList, EventList, CreateEvent | yes | no | unused FS imports | REPLACE (feed) / KEEP until sunset |
| `src/screens/main/BusinessDashboardScreen.js` | Tab Home (biz) + stack | Organizer/provider dashboard | events, tickets, bookings, chats, verification | many management screens | yes | partial | no | MODIFY |
| `src/screens/main/MapScreen.js` | Tab Map **native** | Event map | `eventService`, `buddyService`, `locationService` | EventDetail, CreateEvent | yes | no | no | MODIFY (reuse map shell) |
| `src/screens/main/MapScreen.web.js` | Tab Map **web** | Same via Google Maps JS | same + `@react-google-maps/api` | EventDetail, CreateEvent | yes | no | no | MODIFY (reuse map shell) |
| `src/screens/main/SearchScreen.js` | Tab Search | Provider marketplace | `userService`, `locationService` | Map, Profile, ServiceDetail | partial | partial | no | MODIFY |
| `src/screens/main/ProfileScreen.js` | Tab Profile | Profile, listings, social | users, events, bookings, tickets, reviews, buddies | CreateEvent, BookingDetail, EditProfile, ReviewList, FriendsList, ServiceDetail, Chat, Settings, **Analytics (broken)** | yes | partial | no | MODIFY |
| `src/screens/main/MyTicketsScreen.js` | Tab Tickets + stack | Tickets + bookings | `ticketService`, `bookingService`, `paymentService` | EventTickets, BookingDetail, EventList, Search | yes | partial | no | MODIFY (bookings half) |

### Events / tickets (event-domain)

| File | Navigator | Purpose | Collections | Destinations | Rec |
|------|-----------|---------|-------------|--------------|-----|
| `EventDetailScreen.js` | Main | Event detail, buy tickets | events, tickets | Login, WebPayment, ServiceDetail, EventBuddy | KEEP until sunset / DELETE LATER |
| `CreateEventScreen.js` | Main | Create/edit event | events, Storage | BusinessVerification, VerifyIdentity, EventDetail | KEEP until sunset |
| `EventListScreen.js` | Main | Filtered event list | events | EventDetail | KEEP until sunset |
| `EventSearchScreen.js` | Main | Search events + people | events, users | EventDetail, ServiceDetail | KEEP until sunset |
| `EventStatsScreen.js` | Main | Organizer analytics | tickets, events | CreateEvent | KEEP until sunset |
| `ManageEventsScreen.js` | Main | Organizer event list | events | EventStats, CreateEvent | KEEP until sunset |
| `TicketScannerScreen.js` | Main | QR consume | tickets, events, notifications | EventStats | KEEP until sunset |
| `EventTicketsScreen.js` | Main | Tickets for one event | params only | TicketDetail | KEEP until sunset |
| `TicketDetailScreen.js` | Main | Ticket QR + share | none (params) | goBack | KEEP until sunset |
| `LandingScreen.js` | **unregistered** | SEO city/category landing | events | EventDetail | DELETE LATER or register |

### Buddy / social (mostly event-domain)

| File | Navigator | Purpose | Collections | Rec |
|------|-----------|---------|-------------|-----|
| `EventBuddyScreen.js` | Main | Buddy groups for an event | `buddy_requests` | KEEP until sunset |
| `CreateBuddyRequestScreen.js` | Main | Create buddy request | `buddy_requests` | KEEP until sunset |
| `BuddyRequestDetailScreen.js` | Main | Join/approve | `buddy_requests` | KEEP until sunset |
| `FriendRequestsScreen.js` | Main | Buddy **join** inbox (uses `buddyService`, not `friendService`) | `buddy_join_requests` | KEEP until sunset / naming debt |
| `FriendsListScreen.js` | Main | Followers / following / buddies | follows, users | REUSE / MODIFY |
| `NotificationsScreen.js` | Main | In-app inbox | `notifications` | KEEP |

### Marketplace / bookings (reusable)

| File | Navigator | Purpose | Collections | Rec |
|------|-----------|---------|-------------|-----|
| `ServiceDetailScreen.js` | Main | User/provider profile + reviews | users, reviews, events | REUSE |
| `CreateBookingScreen.js` | Main | Book a package | bookings | REUSE |
| `BookingDetailScreen.js` | Main | Booking status | bookings | REUSE |
| `ProviderBookingsScreen.js` | Main | Provider inbox | bookings | REUSE |
| `ManagePackagesScreen.js` | Main | CRUD `users.packages[]` | users | REUSE |
| `ManageStaffScreen.js` | Main | CRUD `users.staff[]` | users | MODIFY |
| `ReviewListScreen.js` | Main | Reviews list | reviews | REUSE |
| `InquiryListScreen.js` | Main | Biz chat list | chats | MODIFY / overlaps ChatList |

### Chat / payments / settings

| File | Navigator | Purpose | Rec |
|------|-----------|---------|-----|
| `ChatListScreen.js` | Main | All chats | KEEP |
| `ChatScreen.js` | Main | 1:1 messages | KEEP |
| `WebPaymentScreen.js` | Main | Cashfree web return; uses ticket/booking finalize **without imports** (bug) | MODIFY |
| `EditProfileScreen.js` | Main | Profile + media | KEEP |
| `SettingsScreen.js` | Main | Settings, logout, delete, legal | KEEP |
| `PrivacyScreen.js` | Main | Local toggles, not persisted, few/no callers | DEPRECATE |
| `BlockedUsersScreen.js` | Main | Stub UI, no backend | DEPRECATE |
| `HelpCenterScreen.js` | Main | FAQ copy | MODIFY copy |

---

## 6. Component architecture

All production UI components: `src/components/` (21 files). Root `components/` is Expo template leftover — **not used**.

### Core UI

| Component | Role | Property reuse |
|-----------|------|----------------|
| `ScreenWrapper.js` | Safe-area / keyboard screen chrome | High |
| `Typography.js` | Text variants | High |
| `AntigravityButton.js` | Primary button | High |
| `NotionCard.js` | Card surface | High |
| `NotionInput.js` | Text input | High |
| `TabBarIcon.js` | Tab icons | High |
| `SuccessOverlay.js` | Success modal | High |
| `PhoneInput.js` | Phone + country codes | High |
| `PolicyAcceptanceModal.js` | Policy gate for business/provider | High (adapt copy) |
| `SEO.js` | `react-helmet-async` web meta | High |
| `AppDownloadPopup.js` | Web → store popup | High |

### Location

| Component | Role | Property reuse |
|-----------|------|----------------|
| `GooglePlacesInput.js` | Places autocomplete → `{ name, coordinate }` | High (address entry) |
| `LocationSelectorModal.js` | City picker; live cities Bengaluru/Trivandrum | High after locality catalog |

### Media

| Component | Role | Property reuse |
|-----------|------|----------------|
| `ImagePickerButton.js` | Gallery pick only (no camera) | High (photos) |
| `MultiDocumentPicker.js` | Images + PDF, max 3 default | High (docs, floor plans as PDF/image) |
| `StickerPicker.js` | Remote GIFs for chat | Low |

### Social

| Component | Role | Property reuse |
|-----------|------|----------------|
| `BuddyRequestCard.js` / `BuddyActionCard.js` | Event buddy cards | Low (event-domain) |
| `GenderPreferenceSelector.js` | Buddy gender filter | Low |

### Event-specific

| Component | Role | Property reuse |
|-----------|------|----------------|
| `EventSummaryCard.js` | Map/list event card + distance | Replace with property card; keep layout patterns |

### Business / provider

| Component | Role | Property reuse |
|-----------|------|----------------|
| `VerificationBadge.js` | Verified chip | High (owner/agent/builder badges) |

**CURRENT:** No design-system package, no Native Base despite root README mention. Theme is `src/constants/theme.js`.

---

## 7. Firebase architecture

### Client init (`src/services/firebaseConfig.js`)

Config from `EXPO_PUBLIC_FIREBASE_*` env vars. Auth persistence: AsyncStorage (native), `browserLocalPersistence` (web). Exports: `auth`, `db`, `storage`.

### HTTP function URLs (`src/constants/apiConfig.js`)

Hardcoded Cloud Run URLs for project `croww-live-2026` / region `us-central1`:

- Auth: `sendCustomPasswordReset`, `deleteUserAccount`, `toggleUserBlock`, `toggleFollow`
- KYC: `getDigiLockerUrl`, `getDigiLockerStatus`
- Payments: `createCashfreeOrder`, `verifyCashfreePayment`

**No callable (`onCall`) functions.** HTTP functions use Cloud Run `invoker: "public"` so the mobile client can reach them. **Application-layer auth** (Firebase ID token) is required for payment, KYC POST, delete, block, and follow. See `functions/httpAuth.js` and `docs/CROWW_SECURITY_HARDENING.md`. These checks apply only after Functions are deployed.

### Hosting / deploy (`firebase.json`)

- Hosting site `croww-app`, public `dist`, SPA rewrite
- Firestore rules + indexes from this folder
- Functions source `functions/`

Storage rules live in **`croww-admin/storage.rules`** (admin `firebase.json` includes storage). App `firebase.json` does **not** deploy storage rules.

### Admin Firebase

Same projects via `croww-admin/.firebaserc`. Client SDK in `croww-admin/src/services/firebaseConfig.js`. `firebase-admin` is in admin `package.json` but **not imported in `src/`**.

---

## 8. Firestore collections

Do **not** repurpose `events` for properties. Property domain uses `properties`, `listings`, `localities`, `property_media` — see `docs/CROWW_PROPERTY_DOMAIN.md`.

### `users`

| | |
|--|--|
| **Purpose** | Identity + profile. Doc ID = Auth UID |
| **Fields (from writes)** | `id`, `email`, `name`, `userType` / `role` (`individual` \| `provider` \| `business` \| `admin`), `category`, `isProvider`, `isBusiness`, `stats`, `policyAccepted`, `isVerified`, `isApproved`, `isBlocked`, `pushToken`, `location`, coordinates, `avatar`/`photoURL`, `staff[]`, `packages[]`, KYC (`aadhaarVerified`, `kycStatus`, `kycDetails`, `verificationData`), `followersCount`, `rating`, `reviews`, `availability` |
| **Subcollection** | `users/{uid}/friends/{friendId}` (written by `friendService` / CF) |
| **Services** | `authService`, `userService`, `AuthContext`, `verificationService`, review rollup, CF KYC/follow/delete/block |
| **Screens** | Almost all |
| **Event-domain?** | Partial | **Property reuse?** | **High** as identity. Remap `userType`. Do not store listings as events on the user. |

### `events`

| | |
|--|--|
| **Purpose** | Hosted events |
| **Fields** | `title`, `date`, `locationName`, `coordinate` / coords, `organizerId`, `organizerName`, `isPublic`, `isPaid`, `price`, `maxTickets`, `remainingTickets`, `attendeesCount`, `capacity`, `imageUri`, `eventType`, `ticketType`, `paxPerTicket`, `status`, verification fields, `isFeatured`, timestamps |
| **Reads** | `eventService.getEvents()`: `where('isPublic','==',true)` then client 12h expiry filter. Organizer queries by `organizerId`. |
| **Event-domain?** | **Yes** | **Property reuse?** | **Do not reuse.** Use `properties` / `listings`. |

### `properties` / `listings` / `localities` / `property_media`

**CURRENT in repo (no UI):** physical assets, market offerings, area catalog, and media metadata. Services: `src/services/property/`. Rules and indexes added; not deployed. **Event-domain? No.**

### `tickets`

Admission / QR. Fields include `userId`, `eventId`, `status` (`valid` \| `scanned` \| `PENDING_PAYMENT` \| …), `organizerId`, `quantity`, `cashfreeOrderId`, `feeBreakdown`, `issuedAt`. **Event-domain. Do not reuse for property.**

### `bookings`

Customer ↔ provider package requests. Fields: `senderId`, `providerId`, `serviceName`, `eventDate`, `eventType`, `notes`, `packageDetails`, `paymentStatus`, `cashfreeOrderId`, `status` (`pending` \| `accepted` \| `rejected` \| `cancelled` \| `completed`), `totalPrice`. **Reusable** as inquiry/booking if roles remap; field names are event-flavored (`eventDate`).

### `notifications`

`toUserId`, `title`, `message`, `data`, `read`, `createdAt`. Admin also writes `userId` / `isRead` (schema drift). **High reuse** for property alerts.

### `chats` + `messages`

Chat: `participantIds`, `participantNames`, `type` (`private`\|`group`), `lastMessage`, `lastMessageTimestamp`, `unreadCounts` map. Messages: `text`, `senderId`, `senderName`, `createdAt`, `readBy`. **High reuse.** No `propertyId` / `listingId` today.

### `buddy_requests` / `buddy_join_requests`

Event buddy groups + join approvals. **Event-domain. Low reuse.**

### `follows`

Doc ID `{followerId}_{targetUserId}`. **High reuse** (follow agents/builders).

### `reviews`

`businessId` (user id), `userId`, `rating`, `comment`. **Medium reuse** — property reviews need `listingId`.

### `friend_requests`

`fromUserId`, `toUserId`, `status`. Used by `friendService` + CF. **Ownership rules added** (parties only). Screens still use buddy joins for the in-app inbox.

### `app_settings`

Public read. Doc `marketplace` for category toggles. Admin writes. **Reusable** for feature flags / locality config.

### `admins`

ACL docs keyed by UID. Rules-only access. Complements `users.userType == 'admin'`.

### `services`

**Rules exist. App does not use this collection.** Packages live on `users.packages[]`.

### Legacy alias

`buddyRequests` (camelCase) has rules; app uses `buddy_requests`.

### Not found as collections

No `inquiries`, `reports`, `packages`, or `staff` collections. Staff/packages are **arrays on user docs**.

---

## 9. Firestore security model

**File:** `croww-app/firestore.rules` (synced to `croww-admin/firestore.rules`). **Do not weaken these rules.** Production still runs the previously deployed file until a human deploys.

### Helpers

- `isSignedIn()` — `request.auth != null`
- `isOwner(userId)` — uid match
- `isAdmin()` — `admins/{uid}` exists **OR** `users/{uid}.userType == 'admin'`

### Collection permissions (CURRENT in this repo)

| Collection | Read | Write |
|------------|------|-------|
| `users` | Any signed-in | Owner or admin; subcollection `friends` owner or `friendId == auth` |
| `events` | get: signed-in; list: public **or** organizer **or** admin | create: organizerId == auth; update: organizer/admin **or** only `remainingTickets`+`attendeesCount`; delete: organizer/admin |
| `tickets` | get/list: buyer, organizer, or admin | create: buyer; update: organizer/admin **or** buyer `PENDING_PAYMENT`→`valid` + `updatedAt` only; delete: admin |
| `bookings` | get/list: sender, provider, or admin | create: sender; update: parties; delete: sender/admin |
| `app_settings` | **Public** | Admin |
| `notifications` | Recipient (`toUserId` or `userId`) | create: admin **or** `fromUserId == auth`; update/delete: recipient/admin |
| `chats` | Participants (`resource == null` on create) | Participants |
| `messages` | Chat participants | create as self |
| `buddy_requests` | Signed-in | create as userId; update owner/admin; delete owner |
| `buddyRequests` | Same | delete uses `resource.data.userId` |
| `buddy_join_requests` | requester or owner | parties |
| `follows` | Signed-in | create/delete only if `followerId == auth` |
| `friend_requests` | Parties | create as fromUserId; update toUserId; delete parties |
| `services` | Signed-in | providerId == auth (unused collection) |
| `reviews` | Signed-in | create as userId |
| `admins` | Admin | Admin |
| `listings` | Public if `PUBLISHED`; else listedBy/owner/admin | create: DRAFT only; `listedByUid==auth`; owner must own property; agent/builder require `users.roles[]`; `lastVerifiedAt==null`; cannot introduce PUBLISHED; public geo immutable for non-admin; delete: admin. Subcollection `private_meta` for moderation |
| `properties` | Public if `ACTIVE`; else creator/owner/admin | create: uid + unverified + `authoritative==false`; public pin on the doc; exact coords in `private_geo/current`; update: owner cannot change verification/`ownerUid`; delete: admin |
| `localities` | Public if `ACTIVE`; else admin | Admin only |
| `property_media` | Public if ACTIVE+public+(photo/floor_plan/video **or** spatial+READY); else creator/admin | create as self; documents cannot be public; spatial create is private + UPLOADING/PROCESSING + `url==null`; clients cannot READY/public; delete: admin |
| `spatial_processing_jobs` | Submitter or admin | Client create QUEUED only; update/delete false |
| Catch-all | Deny | Deny |

### Remaining gaps (CURRENT)

1. Client notifications can still target another `toUserId` if `fromUserId` is the caller (buddy/booking/scan).
2. Any signed-in user can still update event `remainingTickets` / `attendeesCount` (ticket purchase).
3. Rules are not deployed by the hardening pass.

---

## 10. Firestore indexes

**File:** `croww-app/firestore.indexes.json`. Admin indexes file is a **subset**. Deploy source of truth for the app project is the app file if that is what gets deployed.

### Declared vs code

| Index | Status |
|-------|--------|
| `notifications` `toUserId` + `createdAt` DESC | **Valid** |
| `notifications` `userId` + `createdAt` DESC | **Legacy/partial** (admin schema) |
| `reviews` `businessId` + `createdAt` DESC | **Valid** |
| `buddy_requests` eventId/status/createdAt variants | **Valid** (some redundant) |
| `buddy_join_requests` buddyRequestId+status; requesterId+createdAt; ownerId+createdAt | **Partial** — app also queries `buddyRequestId`+`ownerId`+`status` and `requesterId`+`status` |
| `follows` target/follower + createdAt | **Mostly unused** (equality without orderBy) |
| `events` `isPrivate` + `date` | **Legacy unused** — code uses `isPublic` |
| `events` `organizerId` + `createdAt` DESC | **Valid** |
| `chats` `participantIds` CONTAINS + `lastMessageTimestamp` DESC | **Valid** |
| `bookings` `userId` + `createdAt` | **Mismatch** — code uses `senderId` / `providerId` |
| `tickets` `userId` + `purchasedAt` | **Mismatch** — field is `issuedAt` |
| `tickets` `eventId` + `userId` | **Partial** |
| `listings` status/city/localityId/transactionType + `publishedAt`; `listedByUid` + `updatedAt` | **Property domain** — matches `listingService` |
| `properties` `localityId`+`status`; `city`+`status` | **Property domain** — matches `propertyService` |
| `property_media` parent + visibility/status/sortOrder; parent + createdByUid + sortOrder; propertyId+mediaType+visibility+status; createdByUid+mediaType+createdAt | **Property domain** (3D public/owner queries) |
| `spatial_processing_jobs` submittedByUid + createdAt DESC | **3D processing jobs** |
| `localities` `city`+`status`+`name` | **Property domain** |

### Missing composites (queries that will fail-precondition if used with orderBy)

- `bookings`: `providerId` + `createdAt` DESC; `senderId` + `createdAt` DESC
- `tickets`: `organizerId` + `issuedAt` DESC (`getTicketsByOrganizer`)
- `friend_requests`: `toUserId` + `status` + `createdAt`
- `buddy_join_requests`: `buddyRequestId` + `ownerId` + `status`; `requesterId` + `status`

Equality-only fields (`cashfreeOrderId`, `isPublic`) typically auto-indexed.

Property indexes are documented in `docs/CROWW_PROPERTY_DOMAIN.md` §14. Deploy indexes from `croww-app/firestore.indexes.json`.

---

## 11. Authentication architecture

### CURRENT lifecycle

| Step | Implementation |
|------|----------------|
| Signup | `createUserWithEmailAndPassword` → `setDoc(users/{uid})` with `userType`, `role`, `stats`, flags → `updateProfile(displayName)` → AsyncStorage. Firebase **email verification is commented out**. Welcome email via CF `onDocumentCreated(users)`. |
| Login | Email/password → `getDoc(users/{uid})` → cache |
| Logout | Clear `pushToken` on user doc → `signOut` → clear AsyncStorage (`userLocation`, `cityName`, `manualCity`, user cache) |
| Persistence | Native AsyncStorage; web `browserLocalPersistence` |
| Session UI | `AuthContext` snapshot; `isBlocked` from profile |
| Password reset | HTTP `sendCustomPasswordReset` (branded Mailgun), not client `sendPasswordResetEmail` |
| Delete | HTTP `deleteUserAccount` with `{ uid }` — **no Auth token check** |
| Block | HTTP `toggleUserBlock` — **no Auth token check**; also sets Auth `disabled` |

### Roles (CURRENT)

Signup UI (`SignupScreen.js`): **Individual / Business / Provider**.

- `individual` — consumer; Home feed; Tickets tab
- `business` — venue/organizer; dashboard Home tab; events, staff, tickets
- `provider` — service vendor; dashboard; packages, bookings
- Admin via `userType == 'admin'` or `admins/{uid}` (AuthContext + Firestore `isAdmin()`).

Also duplicated flags: `isBusiness`, `isProvider`, `role` (copy of `userType`).

### RECOMMENDED FUTURE roles

Retain Auth + `users` documents. **CURRENT foundation:** optional additive `users.roles[]` (`buyer` \| `owner` \| `agent` \| `builder`) via `propertyActorService`. Do not rename `userType`. `users.trust.{owner,agent,builder}` is server-written. A role is not a Verified Agent / Verified Builder.

| Future role | Map from today | Keep |
|-------------|----------------|------|
| buyer / renter | `individual` | Auth, profile, chat, bookings-as-inquiries, KYC optional |
| owner | additive `roles` (not auto from `business`) | verification, listings, chat |
| agent | additive `roles` (not auto from `provider`) | verification, leads, chat |
| builder | additive `roles` | verification, project listings |
| admin | existing `userType` + `admins` | harden HTTP functions; admin UI already uses `userType` |

Do not overload `events` as listings.

---

## 12. Location architecture

### CURRENT flow

```
device GPS / browser geolocation / IP (ipapi.co)
  → locationService.getLocation()
      caches AsyncStorage keys: userLocation, cityName
  → screens set local state
  → MapScreen / Home / Search / CreateEvent
  → event.coordinate markers
  → EventDetail
```

**Service:** `src/services/locationService.js`

| Platform | Path |
|----------|------|
| Native | Silent permission **check only** (no auto dialog — iPad freeze workaround) → `getCurrentPositionAsync` (5s) → `getLastKnownPositionAsync` (3s) → **Mumbai default** |
| Web | `navigator.geolocation` (15s) → `https://ipapi.co/json/` → **Mumbai default** |
| User-initiated | `requestPermissionExplicitly()` |

Reverse geocode: native `Location.reverseGeocodeAsync`; web Google Geocode + BigDataCloud; else `DEFAULT_CITY`.

City picker: `LocationSelectorModal` → `AVAILABLE_CITIES = ['Bengaluru','Trivandrum']`. Home writes `manualCity` to AsyncStorage. Unsupported city → force **Bengaluru**.

Places: `GooglePlacesInput` and Map search; **`country:in` only**.

Distance: `src/utils/distance.js` Haversine; `AVERAGE_SPEED_KMH = 30`.

### Hardcoded geographic fallbacks (CURRENT — do not change in this phase)

| Location | Value |
|----------|--------|
| `locationService.js` | `DEFAULT_CITY = 'Mumbai'`, `19.0760, 72.8777` |
| `src/constants/location.js` | Same Mumbai default; city table uses **`Bangalore`** not `Bengaluru`; no Trivandrum |
| `MapScreen.js` | Mumbai in fallback, catch, `initialRegion` (imports `CITY_COORDINATES` unused) |
| `MapScreen.web.js` | Mumbai `defaultCenter`; missing business coords → **Bengaluru** `12.9716, 77.5946` |
| `CreateEventScreen.js` | Persist-time Mumbai if no coords |
| `HomeScreen.js` | Unsupported city → Bengaluru |
| `SearchScreen.js` | Duplicate city table including Bengaluru/Trivandrum/Kochi; mock location Bengaluru |

**Inconsistency:** live product cities are Bengaluru/Trivandrum; GPS failure still lands on Mumbai; constants file uses `Bangalore` so `CITY_COORDINATES['Bengaluru']` is undefined.

There is **no** global LocationContext. Each screen fetches independently. Events are **not** geo-queried; full public list + client Haversine.

---

## 13. Maps architecture

### CURRENT

| Platform | Implementation |
|----------|----------------|
| iOS/Android | `MapScreen.js` + `react-native-maps` |
| Web | `MapScreen.web.js` + `@react-google-maps/api` |
| Styling | `src/constants/mapStyle.js` |
| API key | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` via `app.config.js` (`ios.config.googleMapsApiKey`, `android.config.googleMaps.apiKey`, web config) |

Markers: public events (+ organizer’s own on native). Buddy overlay from `buddyService.getAllBuddyRequestsGlobally()`. Time filters 1D/1W/1M/ALL. Press → `EventSummaryCard` → `EventDetail`.

Coordinate shapes are inconsistent: `event.coordinate.{latitude,longitude}` vs `latitude`/`longitude` vs `lat`/`lng` (web parser).

### RECOMMENDED FUTURE (not implemented)

Evolve the **same map shell** (do not rewrite native apps):

```
map camera
  → properties (new collection, geohash or backend radius)
  → localities (catalog replacing duplicated city maps)
  → geographic layers (amenities, transit — new data, toggle overlay pattern already on Map for buddies)
  → price heatmaps / risk / area scores — new data products; do not jam into `events`
```

Prefer: one map component, layer toggles, typed `{ latitude, longitude }`, locality IDs instead of free-string city names. Add geo query; stop downloading all public events.

Advanced 3D/Gaussian Splats: **React Native app + selective native module**, not a Kotlin/Swift rewrite. Keep 2D map as discovery; open a viewer for spatial assets.

---

## 14. Media / storage architecture

### CURRENT pipeline

```
ImagePickerButton (library only)
  and/or MultiDocumentPicker (images + PDF)
  → imageOptimizer (images: width 1080, quality 0.8, prefer WebP)
  → uploadBytes
  → getDownloadURL
  → store URL on Firestore doc
```

**No** `launchCameraAsync` in the picker component. Camera is used for **ticket scanning**. **No video pipeline.**

### Dual upload services

| Service | Contract | Typical caller |
|---------|----------|----------------|
| `storageService.uploadImage(uri, folder)` | Appends `{ts}_{rand}.webp` under folder | CreateEvent → `event_images/` |
| `uploadService.uploadImage(uri, fullPath)` | Uses path as-is | EditProfile → `profile_pictures/{uid}/…` |

### Storage paths (CURRENT)

| Path | Use |
|------|-----|
| `event_images/{filename}.webp` | Event banners |
| `profile_pictures/{uid}/profile_{ts}.jpg` | Avatar (extension may not match WebP bytes) |
| `profile_covers/{uid}/cover_{ts}.jpg` | Cover |
| `portfolio_photos/{uid}/photo_{ts}_{i}.jpg` | Portfolio |
| `verification_docs/{uid}/verification_{ts}_{i}.{pdf\|png\|webp\|jpg}` | Business KYC docs |
| `property_media/{uid}/…` | Public listing photos/plans/videos (rules added; unused by UI) |
| `property_documents/{uid}/…` | Private property documents |
| `property_spatial/{uid}/…` | 3D **source** (private, 512 MB cap) |
| `property_spatial_public/{mediaId}/…` | Derived READY 3D (public read, Admin SDK write) |

`business_photos/` is in **storage rules** but not clearly used by app uploads.

### Storage rules (`croww-admin/storage.rules`)

Public **read** on profile/event/cover/portfolio/`property_media` / `property_spatial_public`; owner write on private prefixes. `verification_docs`, `property_documents`, and `property_spatial` owner/admin read; owner write. Default deny.

### Property media (CURRENT foundation)

Prefixes above + Firestore `property_media`. Photos/videos/floor plans remain the public gallery. 3D uses `mediaType: spatial` plus `property3DService` — never the image optimizer. Do not expose `verification_docs` as listing media.

### 3D / spatial (CURRENT foundation; GPU processing not built)

`mediaType: spatial` on `property_media` with explicit processing states. Clients cannot mark READY. Viewer: `Property3DViewer` (web iframe + WebGL detect; native poster fallback). GPU processing is a future worker. See `docs/CROWW_3D_ARCHITECTURE.md`. Do not run meshes through `imageOptimizer`. No fake splat assets.

---

## 15. Notification architecture

### CURRENT pipeline

```
Client service | Cloud Function | admin Dashboard
  → addDoc(notifications) { toUserId, fromUserId, title, message, data, read, createdAt }
  → CF sendPushNotification (onCreate)
  → users.pushToken
  → Expo Push { title, body, data }
  → Device: pushNotificationService listeners in AppNavigator
  → tap → navigateFromNotification(data)
```

In-app list: `notificationService.getNotifications` (`toUserId` + `createdAt`).

Consent: AsyncStorage `@croww_user_settings.pushNotifications`; daily ask `@croww_last_notification_ask`.

### Deep-link types (`src/utils/notificationNavigation.js`)

| type (lowercased) | Screen |
|-------------------|--------|
| `buddy_request_join` | BuddyRequestDetail |
| `buddy_request_approved` | EventBuddy |
| `new_event` | EventDetail |
| `review_prompt` | ServiceDetail |
| `chat_message` / `chat` | Chat |
| `friend_request` | FriendRequests |
| `friend_accepted` | ServiceDetail |
| `new_booking` / `booking_update` | BookingDetail |
| default | Notifications / Chat / ProviderBookings if ids present |

### RECOMMENDED FUTURE (not implemented)

Same `notifications` collection + Expo pipeline can support: saved-search alerts, new property alerts, price changes, agent responses, site-visit reminders, verification status — by adding `data.type` values and screens. Do not overload `new_event` for listings.

---

## 16. Chat architecture

### CURRENT

- `chatService.createChat(participantIds, participantNames)` — private chat deduped by exact participant set; groups with `admins`.
- Messages: subcollection, realtime `orderBy createdAt desc` `limit(50)`.
- Unread: `unreadCounts.{uid}` on chat doc.
- Booking and buddy flows auto-open chats.
- `signInAnonymously` is imported in `chatService.js` but the ensureAuth helper **rejects if not logged in** (import leftover).

### Property readiness

**Structurally yes** for buyer ↔ owner / agent / builder (any two UIDs). **Missing:** `listingId` / `propertyId` / `contextType` on the chat document. Add optional fields later; do not break existing participant queries.

`InquiryListScreen` vs `ChatListScreen` overlap — same `chatService` pattern.

---

## 17. Verification architecture

### CURRENT

| Path | Mechanism |
|------|-----------|
| Individual KYC | Cashfree DigiLocker via HTTP `getDigiLockerUrl` / `getDigiLockerStatus`. CF writes `kycStatus`, `aadhaarVerified`, `kycDetails`. Client also writes `verificationData` / `isVerified`. Redirect `https://croww.ai/kyc-complete` → `VerifyIdentity`. |
| Business | Upload to `verification_docs/{uid}/`; `verificationData.status: pending`. Admin Dashboard approve → `isApproved`, `verificationStatus`. |
| Badge | `VerificationBadge` + `isVerified` / `isApproved` |

No generic “verified” boolean. Property documents include a nested public `verification` map (`identity` unused for badges / `ownership` / `property` / `location`). Listings include `verification.representation`. Actor trust lives on `users.trust`. Cases and evidence live in private `verification_cases`. Clients create PENDING only. `reviewVerification` (admin) is the approval path. Listing `lastVerifiedAt` remains listing attestation, not a trust-dimension timestamp. See `docs/CROWW_VERIFICATION_ARCHITECTURE.md`.

### RECOMMENDED FUTURE

Expiration worker, ownership transfer, agency graph, site visits, automated verification. Do not overload event `verificationStatus`. Do not add a numeric trust score.

---

## 18. Payments architecture

### CURRENT

- Native: `paymentService.js` + Cashfree PG SDK.
- Web: `paymentService.web.js`; forces PRODUCTION on non-localhost hostnames.
- Orders: HTTP `createCashfreeOrder` / `verifyCashfreePayment`.
- Tickets/bookings store `cashfreeOrderId` + `PENDING_PAYMENT` → client finalize.
- Fees: `src/utils/feeCalculator.js` — 2% convenience + 18% GST to user; 7% commission + 18% GST from organizer; T+2 settlement helper.
- Return URL: `{origin}/payment-return?order_id=…` (`WebPayment` screen).
- iOS LSApplicationQueriesSchemes: UPI apps (PhonePe, GPay, Paytm, etc.).
- Plugin: `plugins/withCashfree.js` adds Cashfree Maven + `tools:replace` `allowBackup`.

**Do not modify payment logic casually.** HTTP payment endpoints are public (no Firebase Auth on the request).

### RECOMMENDED FUTURE (not implemented)

Same Cashfree PG can later support featured listings, subscriptions, verification fees, 3D capture fees — as **new order types**, not ticket records.

---

## 19. Cloud Functions architecture

**Source:** `croww-app/functions/index.js` + `emails.js`. Runtime Node 22. Tag in code: `CROWW_BACKEND_V5`. **Zero `onCall` functions.**

| Function | Trigger | Purpose | Collections | External APIs | Legacy/New | Reuse |
|----------|---------|---------|-------------|---------------|------------|-------|
| `createCashfreeOrder` | HTTP public | Create PG order | — | Cashfree PG | Current | High |
| `verifyCashfreePayment` | HTTP public | Verify paid | — | Cashfree PG | Current | High |
| `getDigiLockerUrl` | HTTP public | DigiLocker session | — | Cashfree Verification | Current | Medium |
| `getDigiLockerStatus` | HTTP public | Poll KYC; write user | `users` | Cashfree Verification | Current | Medium |
| `sendPushNotification` | Firestore create `notifications/{id}` | Expo push | notifications, users | Expo Push | Current | High |
| `sendWelcomeEmail` | create `users/{id}` | Welcome email | users | Mailgun | Current | High |
| `sendCustomPasswordReset` | HTTP public | Branded reset | Auth | Firebase Auth + Mailgun | Current | High |
| `cleanupExpiredEvents` | Schedule `0 0 * * *` | Delete events older than date−24h | events | — | Event | Low |
| `deleteUserAccount` | HTTP public **unauthenticated** | Flag, delete related, Auth delete | many | — | Current | Medium after authn |
| `toggleUserBlock` | HTTP public **unauthenticated** | Block + Auth disabled | users | — | Current | Medium after authn |
| `toggleFollow` | HTTP public | Follow graph + notif | follows, users, notifications | Expo via notif | Current | High |
| `onEventCreated` | create events | Notify past attendees / nearby | events, tickets, users, notifications | — | Event | Low |
| `onEventUpdated` | update events | Cancel → notif + email | tickets, notifications, users | Mailgun | Event | Low |
| `onChatMessageCreated` | create messages | Notif recipients | chats, notifications | — | Current | High |
| `onFriendRequestCreated` | create friend_requests | Notif | notifications | — | Current | Medium |
| `onFriendRequestUpdated` | update friend_requests | Accepted notif | users, notifications | — | Current | Medium |
| `onBookingCreated` | create bookings | Notif provider | notifications | — | Current | High |
| `onBookingUpdated` | update bookings | Status notif sender | notifications | — | Current | High |

Event-tied: `cleanupExpiredEvents`, `onEventCreated`, `onEventUpdated`. Do not delete them.

Property (in-repo, deploy separately): `publishListing`, `syncPropertyPublicLocation`, `recomputeLocalityMarket`, `onListingWrittenSavedSearchAlerts`, `reviewVerification`, `onVerificationCaseCreated`.

---

## 20. Android configuration

**Do not change production package name.**

| Item | Value |
|------|--------|
| Application ID | `com.croww.app` |
| versionName (`app.config.js`) | `1.0.4` |
| versionCode (`app.config.js`) | `11` |
| Google Maps | `android.config.googleMaps.apiKey` ← `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` |
| google-services | `./google-services.json` (prod) or `google-services.staging.json` if `APP_ENV=staging` |
| Permissions (config) | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` |
| Intent filter | scheme `crowwapp` |
| Plugin | `plugins/withCashfree.js` (Maven + allowBackup replace) |
| Adaptive icon | `assets/app-icon.png` |

`android/` is **gitignored** (EAS/prebuild artifact). Local gradle, if present, can lag `app.config.js` versions. EAS production profile builds **AAB**; preview builds **APK**.

---

## 21. iOS configuration

**Do not change production bundle identifier.**

| Item | Value |
|------|--------|
| Bundle ID | `com.croww.app` |
| version | `1.0.4` |
| buildNumber | `27` |
| App Store Connect ID (`eas.json` submit) | `6759898911` |
| Google Maps | `ios.config.googleMapsApiKey` from env |
| GoogleService-Info | `GoogleService-Info.plist` or `.staging.plist` |
| URL schemes | `crowwapp`, plus Expo / Google reversed client (native plist) |
| UPI query schemes | phonepe, tez, paytmmp, bhim, amazonpay, credpay, upi, gpay |
| ITSAppUsesNonExemptEncryption | false |
| Tablet | `supportsTablet: true` |

`ios/` is **gitignored**. Privacy strings via Expo plugins: location (always + when-in-use, copy still says “nearby events”), camera (photos + documents), photos.

---

## 22. Expo / EAS configuration

| Item | Value |
|------|--------|
| Expo SDK | `~54.0.33` |
| RN | `0.81.5` |
| slug | `croww-app` |
| owner | `nashnewton` |
| EAS project ID | `6a8dcff3-e1f3-47cb-be4d-8c3c21aead1f` |
| scheme | `crowwapp` |
| New Arch | enabled |
| Web output | SPA |
| Profiles | `development` (dev client), `preview` (internal APK), `production` (AAB) |
| Updates | No `runtimeVersion` / `updates.url` block in `app.config.js` (no EAS Update config observed) |
| Experiments | `typedRoutes: true` (meaningless without Expo Router), `reactCompiler: false` |

`eas.json` inlines `EXPO_PUBLIC_*` Firebase, Maps, Cashfree env for all profiles (see §23). Prefer EAS Secrets later; do not change identifiers now.

Scripts: `expo start`, `expo run:android` / `ios`, `eas build` preview/production.

---

## 23. Security findings

See **`docs/CROWW_SECURITY_HARDENING.md`** for the post-hardening inventory.

**CURRENT (repo):** `.env` files are gitignored and untracked; secret *values* remain in Git **history**. `eas.json` still contains client-public Firebase/Maps/Cashfree App ID keys (restrict in Google Cloud). Rotate leaked Cashfree/Mailgun credentials operationally. Do not print values.

**RECOMMENDED:** Deploy Functions + rules after staging; put Functions secrets in Secret Manager; restrict Maps/Firebase keys; optional history purge with an explicit force-push plan.

The old audit table of committed secrets is superseded: those files are untracked. History still requires rotation. See `docs/CROWW_SECURITY_HARDENING.md`.

---

## 24. Repository hygiene findings

Logs, `dist-web/`, and `.env` files were **untracked** in the 2026-09-10 hardening pass. Do not re-commit them. Remaining leftovers: Expo Router `app_backup/`, unused `expo-router` dependency, dual upload services, missing indexes.

| Item | Issue |
|------|--------|
| Parent `Croww/` | Not a git repo; empty `package-lock.json` |
| `croww-admin` | No git remote |
| No `.github/workflows` in app | No project CI observed |
| `app_backup/` | Expo Router template |
| Root `components/`, `hooks/`, `constants/theme.ts` | Template leftovers |
| `expo-router` | Unused production dependency |
| `puppeteer-core` | Only ad-hoc `test_event_creation.js` |
| `check_error.js` | Requires `puppeteer` (not in package.json) |
| `dist-web/` | Generated web bundle committed |
| `build_log*.txt`, `android_build_log.json`, `logs*.txt` | Large logs; some contain secrets |
| `test_cashfree.js`, `test_event_creation.js` | Ad-hoc scripts with secrets / experiments |
| Dual `storageService` / `uploadService` | Duplicate upload paths |
| Dual city coordinate tables | `constants/location.js` vs `SearchScreen.js` |
| Dual `firestore.rules` | App vs admin; buddy join delete differs |
| `firebase-admin` in croww-admin | Unused in src |
| Local `android/` `ios/` | Gitignored; version drift vs `app.config.js` |

---

## 25. Legacy event-domain inventory

Treat as **current product**, not delete.

**Screens:** Home (consumer), Map event markers, Event*, Ticket*, Buddy*, Landing, TicketScanner, EventStats, ManageEvents, FriendRequests (buddy joins).

**Collections:** `events`, `tickets`, `buddy_requests`, `buddy_join_requests`.

**Functions:** `cleanupExpiredEvents`, `onEventCreated`, `onEventUpdated`.

**Components:** `EventSummaryCard`, buddy cards, gender preference.

**Copy:** Help Center, location permission strings (“nearby events”), SEO `seoContent.js`.

**Fees:** Ticket convenience/commission model.

---

## 26. Reusability assessment

### KEEP / REUSE for property pivot

- React Native + Expo + Firebase Auth/Firestore/Storage/Functions
- React Navigation (single system)
- Auth screens, Settings, EditProfile, Blocked
- Chat + notifications + Expo push
- Maps shell (native + web) + Places + locationService
- Image/document upload + optimizer
- KYC DigiLocker + business doc verification
- Bookings as inquiry/booking prototype
- Follows, reviews (extend with listingId)
- Admin dashboard shell (will need new pages)
- Production package/bundle IDs, EAS project, Cashfree merchant

### MODIFY

- Signup roles → buyer/renter/owner/agent/builder
- Search marketplace → agents/builders/localities
- Profile / BusinessDashboard
- Notification types + deep links
- City catalog (Bengaluru vs Bangalore vs Mumbai default)
- Firestore rules (friends, ticket updates, list leakage) — later, explicitly
- HTTP function authentication

### DEPRECATE / REMOVE LATER (not now)

- Event/ticket/buddy product surfaces
- Expo Router leftovers
- Stub Privacy / BlockedUsers
- Orphan LandingScreen
- Duplicate upload services (merge later)
- `services` collection rules if still unused

### REBUILD / NEW (property domain)

- `properties` / `listings` (never `events`)
- `localities`, leads
- Personalized Area Score v1 exists (read-time; not stored on localities). City-wide rankings and heatmaps are still not built.
- Property chat context fields
- 3D media foundation exists (`mediaType: spatial`, `Property3DViewer`). GPU splat processing and native splat modules are still later.

---

## 27. Property-pivot migration strategy

**Constraint:** Stay on React Native + Expo + TypeScript-where-practical + Firebase. Incremental. No Kotlin/Swift rewrite. No Expo Router dual nav.

### Suggested phases (do not execute in this audit)

**Phase 0 — Safety (recommended next engineering, not done here)**  
Rotate leaked payment/email secrets; stop committing `.env`; ignore logs/`dist-web`; authenticate destructive HTTP functions. No product UI.

**Phase 1 — Domain model (implemented in source; not deployed)**  
Collections `properties`, `listings`, `localities`, `property_media`. Typed contracts in `src/domain/property/`. Services in `src/services/property/`. **Do not** write properties into `events`. Keep event writers running. Details: `docs/CROWW_PROPERTY_DOMAIN.md`.

**Phase 2 — Map-first discovery**  
Reuse Map screens: swap event query for property query behind a flag or new tab. Unify coordinates and locality catalog. Keep event map until sunset.

**Phase 3 — Identity**  
Extend `userType` (or additive `roles[]`) for owner/agent/builder/buyer/renter. Reuse KYC + verification docs. Admin approval flow already exists.

**Phase 4 — Conversations & leads**  
Add `listingId` to chats; reuse bookings as visit/lead requests; reuse notifications with new `data.type`s.

**Phase 5 — Media**  
Property photo/doc prefixes; video later; 3D Storage + native module only when a viewer exists.

**Phase 6 — Sunset events**  
After product decision: hide event tabs, then stop writes, then DELETE LATER collections/functions with explicit approval.

### System classification

| System | Action |
|--------|--------|
| Expo RN app, React Navigation, Firebase Auth | KEEP |
| users, chats, notifications, follows, reviews, bookings | REUSE / MODIFY |
| Maps, location, Places, image upload, KYC, Cashfree | REUSE / MODIFY |
| events, tickets, buddies, event CFs | DEPRECATE → REMOVE LATER |
| Expo Router, template components, committed logs | REMOVE LATER |
| Property listings, localities, scores, 3D | NEW |
| Full native rewrite | **Do not do** |

---

## 28. Technical risks

1. **Committed Cashfree + Mailgun secrets** — highest severity.
2. **Unauthenticated HTTP functions** can delete/block users if URLs are known.
3. **Ticket payment finalize vs rules** — buyer cannot update tickets.
4. **Index mismatches** (`isPrivate`, `purchasedAt`, bookings `userId`) cause silent empty lists / failed queries.
5. **Missing friend_requests rules.**
6. **Location city key mismatch** (Bengaluru vs Bangalore vs Mumbai).
7. **JS-only `src/`** with inconsistent shapes (`coordinate` vs `lat`/`lng`, `id` vs `uid`, Timestamp vs ISO).
8. **Admin rules drift** and email-only admin UI.
9. **WebPaymentScreen** missing service imports.
10. **Profile → Analytics** crash/no-op.
11. **Over-broad Firestore list** on tickets/bookings.
12. **No CI**; admin repo has no remote.
13. **New Architecture + iPad permission-sheet freeze** already required timeouts throughout Auth/Location/Events.

---

## 29. Recommended architecture for the next phase

### CURRENT (do not break)

React Native Expo app, React Navigation stacks/tabs, Firebase, Cashfree, Maps, existing event product, `com.croww.app`.

### RECOMMENDED FUTURE (guidance only)

```
Croww (RN + Expo + TS incremental + Firebase)
  Auth + users (extended roles)
  Map-first property discovery (reuse MapScreen)
  New collections: properties, localities, …
  Chat + notifications + bookings-as-leads
  KYC + listing verification
  Admin Vite app extended, same Firebase
  Optional native module only for 3D/Splat viewer
```

**Highest-value TypeScript conversions first (not a wholesale rewrite):**

1. `locationService.js` + `constants/location.js`
2. New property models (start typed)
3. `userService.js` / `authService.js` (`userType`, `id`/`uid`)
4. `eventService.js` only if still actively changing; otherwise freeze
5. `chatService.js`, `notificationNavigation.js`
6. Merge/type `uploadService` + `storageService`
7. Navigation param types for React Navigation

`tsconfig.json` is `strict: true` but **does not include `src/**/*.js`** (`allowJs` off). Template `.ts` files are not the app.

Enable `allowJs` + incremental `checkJs` only if the team wants gradual checking; otherwise convert file-by-file to `.ts`.

### Explicit non-goals until instructed

- Do not migrate to Kotlin + Swift apps
- Do not enable Expo Router alongside React Navigation
- Do not implement Gaussian Splatting, heatmaps, or city-wide area rankings. Personalized Area Score v1 already exists; do not turn it into a fixed locality rating.
- Do not delete event screens or collections
- Do not change package/bundle IDs
- Do not modify payment/verification/rules/indexes in drive-by refactors

---

## Appendix A — Service map

| File | Domain |
|------|--------|
| `src/services/firebaseConfig.js` | SDK init |
| `src/services/authService.js` | Signup/login/logout/reset/delete |
| `src/services/userService.js` | Profile, providers, follows read, packages/staff, marketplace settings |
| `src/services/eventService.js` | Events CRUD + public list |
| `src/services/ticketService.js` | Tickets, scan, finalize, organizer stats |
| `src/services/bookingService.js` | Bookings + finalize |
| `src/services/paymentService.js` / `.web.js` | Cashfree |
| `src/services/chatService.js` | Chats/messages |
| `src/services/notificationService.js` | Firestore notifications |
| `src/services/pushNotificationService.js` | Expo token + listeners |
| `src/services/buddyService.js` | Buddy groups + joins |
| `src/services/friendService.js` | friend_requests + friends subcollection |
| `src/services/reviewService.js` | Reviews + rating |
| `src/services/verificationService.js` | DigiLocker + business docs |
| `src/services/property/propertyTrustService.js` | Property trust submit / public badges |
| `src/services/locationService.js` | GPS/IP/cache |
| `src/services/uploadService.js` | Path-exact upload |
| `src/services/storageService.js` | Folder + generated filename upload |

`FriendRequestsScreen` uses **buddyService**, not friendService.

## Appendix B — Admin app

| Path | Role |
|------|------|
| `croww-admin/src/main.jsx` | Vite entry |
| `App.jsx` | Routes: `/login`, `/` Dashboard, `/events`, `/debug-db` |
| `ProtectedRoute.jsx` | `currentUser && isAdmin` |
| `pages/Dashboard.jsx` | Users, event/business KYC, **Property trust** queue, settings, counts |
| `pages/Events.jsx` | Feature/delete events |
| `pages/DebugDB.jsx` | Debug |
| `pages/Login.jsx` | Email/password |

## Appendix C — Theme (CURRENT)

Dark UI: background `#0A0A0A`, accent `#C1FF72`. File: `src/constants/theme.js`. Ignore root `constants/theme.ts`.
