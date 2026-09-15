# Croww Property Navigation

**Status:** Consumer app shell in source. Explore is map-first. Listing and Property screens load real domain documents. Locality is an evidence page plus personalized Area Score (read-time; not stored on the locality).

Production navigation remains **React Navigation** in `src/navigation/AppNavigator.js`. Expo Router is not used.

---

## 1. Navigation hierarchy

```
Root stack (AppNavigator)
├── Blocked
├── Auth (stack)
│     Login | Signup | LegalPolicy
└── Main (stack)                         [authenticated]
      ├── Tabs (PropertyTabNavigator)    [primary shell]
      │     Explore | Saved | Post | Messages | Profile
      ├── Property | Listing | Locality | PostListing | InventoryDashboard | InventoryMedia
      ├── SpatialTour
      ├── TrustOverview | SubmitVerification
      ├── Home | Map | Search            [legacy event/marketplace]
      └── existing stack screens         [chat, events, tickets, KYC, settings, …]
```

`ExploreProvider` wraps `NavigationContainer` so Explore can later hold city / locality / viewport / search intent without a new state library.

Auth → Main switching is unchanged: `AuthContext` `isAuthenticated` / `isBlocked` / `loading`.

---

## 2. Primary tabs

| Tab | Screen | Purpose now | Later |
|-----|--------|-------------|-------|
| **Explore** | `ExploreScreen` | Map-first published-listing discovery | Area intelligence, scores |
| **Saved** | `SavedScreen` | Listings / properties / searches | Alerts use Cloud Functions |
| **Post** | `PostScreen` + `PostListingScreen` | Create drafts; **Your listings** opens inventory dashboard | CRM |
| **Messages** | existing `ChatListScreen` | Same chats as before | Property inquiries on the same `chats` collection |
| **Profile** | existing `ProfileScreen` | Account, Settings → Verification (`TrustOverview`) | Property roles, still no second auth |

Icon + short label. Visual language is the existing dark theme / `TabBarIcon` / `ScreenWrapper`.

---

## 3. Role / capability behavior

Authentication is still `users/{uid}` + `userType` (`individual` / `business` / `provider` / `admin`).

Additive `users.roles[]` (`buyer` / `owner` / `agent` / `builder`) from the property domain is **read for copy**, not for hiding tabs.

**All five tabs are always visible.** A buyer can also become an owner; hiding Post would block that. `getShellCapabilities()` in `src/navigation/propertyCapabilities.js` documents this.

- `business` is **not** treated as builder.
- `provider` is **not** treated as agent.
- Admin remains the separate Vite admin app. The consumer shell does not grow an admin dashboard.

Legacy organizers (`userType` business/provider) reach event tools via **Settings → Event dashboard** (`BusinessDashboard`) and Profile **Dashboard** (business). Those are stack routes, not tabs.

---

## 4. Legacy isolation

Removed from **primary tabs**: Home (event feed / business dashboard), Tickets, Map (event map), Search (service marketplace).

**Not deleted:** screen files, services, Firestore event collections, Cloud Functions.

**Still registered on the Main stack** so `navigation.navigate('EventDetail' | 'Chat' | 'MyTickets' | …)` and notification handlers keep working:

- Event: `Home`, `Map`, `EventDetail`, `CreateEvent`, `EventBuddy`, `EventList`, …
- Tickets / bookings: `MyTickets`, `TicketDetail`, `WebPayment`, `ProviderBookings`, …
- Social: `FriendRequests`, `FriendsList`, buddy screens
- Organizer: `BusinessDashboard`, `ManageEvents`, `ManagePackages`, …
- Marketplace: `Search`, `ServiceDetail`

Do not put Tickets / Events / Buddy back on the tab bar unless a later prompt explicitly restores them.

---

## 5. Deep-link compatibility

Prefixes unchanged: Expo URL, `https://croww.ai`, `https://croww-app.web.app`, scheme `crowwapp`.

| Path | Destination |
|------|-------------|
| `explore` / `saved` / `post` / `inbox` / `me` | New tabs |
| `home` / `map` / `marketplace` / `my-tickets` | **Legacy stack** (event home, event map, marketplace, tickets) |
| `property/:propertyId` | `Property` detail (physical asset) |
| `listing/:listingId` | `Listing` detail (market offering) |
| `area/:localityId` | `Locality` evidence + personalized Area Score |
| `messages/:chatId` | `Chat` (unchanged) |
| `chats` | `ChatList` stack (same component as Messages tab) |
| `kyc-complete` | `VerifyIdentity` |
| `payment-return` | `WebPayment` |
| `event/:id`, `provider/:serviceId`, buddies, settings, help, notifications, friend-requests, blocked | Unchanged |

Notification routing (`src/utils/notificationNavigation.js`) still uses stack names (`Chat`, `EventDetail`, `ChatList`, …). No new notification types.

---

## 6. Chat integration

One chat system: `chatService` + `chats` / `messages`.

- Tab **Messages** = `ChatListScreen`
- Stack **Chat** / **ChatList** / **InquiryList** unchanged
- Chat back with no history opens the Messages tab

Property inquiry threads set optional `listingId` / `propertyId` on the existing `chats` document when opened from Listing. Messages are not auto-sent. Same `chats` / `messages` collections.

---

## 7. Profile integration

`ProfileScreen` is the Profile tab. Settings → Verification opens `TrustOverview` (identity KYC plus owner/agent/builder evidence). Legal and logout unchanged.

Repairs in this pass:

- Unregistered `Analytics` → `BusinessDashboard`
- KYC success → Explore tab (was Home tab)
- Web payment success → `MyTickets` stack (Tickets tab removed)
- Settings: Event dashboard row for business/provider

---

## 8. Property route conventions

Use these names (see `src/navigation/routeNames.js`):

| Name | Params | Path |
|------|--------|------|
| `Explore` | — | `/explore` |
| `Locality` | `localityId` | `/area/:localityId` |
| `Property` | `propertyId` | `/property/:propertyId` |
| `Listing` | `listingId` | `/listing/:listingId` |
| `Post` | — | `/post` |
| `InventoryDashboard` | — | `/inventory` |
| `InventoryMedia` | `listingId` | `/inventory/media/:listingId` |
| `Saved` | — | `/saved` |
| `Messages` | — | `/inbox` |

Listing and Property load via `propertyDetailService`. Do not name new property screens `Event*`, `Ticket*`, or `Home` for discovery.

`ExploreContext`: `city`, `localityId`, `viewport`, `searchLocation`, `focusLocality`. Locality → Explore sets viewport from centroid/`bounds` (camera hint, not an official polygon). Do not copy `locationService` Mumbai fallbacks into this context.

---

## 9. Migration considerations

1. Users who bookmarked `/home` still get the **event** feed, not Explore. Product home is `/explore` and the default tab.
2. Organizers no longer land on `BusinessDashboard` as tab 1. Point them at Settings / Profile Dashboard.
3. `navigate('Map')` / `navigate('Search')` still resolve (stack). `navigate('Tabs', { screen: 'Home' })` does **not**.
4. Dual registration: `ChatListScreen` is both tab `Messages` and stack `ChatList`.
5. Saved listings/properties/searches live under `users/{uid}` (see `docs/CROWW_SAVED_SEARCHES_ARCHITECTURE.md`). No top-level public save collection.
6. Admin Vite app gained a scoped **Property trust** queue tab. It is not a redesign.

---

## Explicitly out of scope

Locality comparison UI, city-wide rankings, CRM/lead pipelines, 3D capture/GPU processing, alert digests. 3D media foundation: `docs/CROWW_3D_ARCHITECTURE.md`. Inventory dashboard: `docs/CROWW_BROKER_DASHBOARD_ARCHITECTURE.md`. Locality evidence: `docs/CROWW_AREA_INTELLIGENCE_ARCHITECTURE.md`. Personalized Area Score: `docs/CROWW_AREA_SCORE_ARCHITECTURE.md`. Saved searches: `docs/CROWW_SAVED_SEARCHES_ARCHITECTURE.md`. Property trust: `docs/CROWW_VERIFICATION_ARCHITECTURE.md`.
