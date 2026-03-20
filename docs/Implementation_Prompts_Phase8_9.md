# Phase 8 & 9 — Detailed Implementation Prompts

> Replaces WhatsApp bot (8.1) with push notifications.
> Voice/photo features use in-app recording (browser APIs) instead of WhatsApp.
> All prices are admin-configurable via GlobalConfig.

---

## Prompt 8.3a: Special Events — API Routes & Backend

### Context
The SpecialEvent, MachineAlert, and Banner models already exist in the Prisma schema (created in Phase 6.1). The GlobalConfig system already supports feature toggles and pricing. This prompt adds the API routes to create, approve, and deliver special events.

### Files to Create/Modify

**New file: `apps/api/src/routes/events.ts`**

Create a new Express router (`eventRouter`) with these endpoints:

#### 1. GET /events/config
- Public (with auth) — returns available events and their prices for the current venue
- Reads from venue settings (per-venue overrides) falling back to GlobalConfig defaults
- Response:
```json
{
  "events": {
    "skipQueue": { "enabled": true, "price": 5.00 },
    "silence": { "enabled": true, "options": [
      { "duration": 60, "price": 5.00 },
      { "duration": 120, "price": 10.00 },
      { "duration": 180, "price": 15.00 }
    ]},
    "textMessage": { "enabled": true, "price": 2.00, "maxLength": 200 },
    "voiceMessage": { "enabled": true, "options": [
      { "duration": 5, "price": 8.00 },
      { "duration": 15, "price": 10.00 }
    ], "requiresApproval": true },
    "photo": { "enabled": true, "price": 5.00, "requiresApproval": true },
    "reaction": { "enabled": true, "price": 1.00, "types": ["APPLAUSE", "BOO", "LAUGH", "HEART", "FIRE"] },
    "birthday": { "enabled": true, "price": 25.00 }
  }
}
```

#### 2. POST /events/skip-queue
- Auth required (CUSTOMER)
- Body: `{ machineId: string, queueItemId: string }`
- Logic:
  1. Verify queue item exists and belongs to this user
  2. Charge from wallet (create SKIP_QUEUE Transaction)
  3. Move queue item to position 2 (after currently playing)
  4. Re-order remaining queue items
  5. Emit WebSocket `queue:updated` to machine room
  6. Create SpecialEvent record with type SILENCE (reuse for tracking)
- Returns: updated queue position, transaction ID

#### 3. POST /events/silence
- Auth required (CUSTOMER)
- Body: `{ machineId: string, duration: 60 | 120 | 180 }`
- Logic:
  1. Validate duration is one of the allowed options
  2. Look up price for selected duration
  3. Charge from wallet (create SILENCE Transaction)
  4. Create SpecialEvent record (type: SILENCE, duration, status: APPROVED — no approval needed)
  5. Emit WebSocket `event:silence` to machine room with `{ duration, startedAt }`
- Returns: event ID, transaction ID

#### 4. POST /events/text-message
- Auth required (CUSTOMER)
- Body: `{ machineId: string, message: string }` (max 200 chars)
- Logic:
  1. Validate message length
  2. Charge from wallet (create TEXT_MESSAGE Transaction)
  3. Create SpecialEvent record (type: TEXT_MESSAGE, content: message, status: APPROVED)
  4. Emit WebSocket `event:textMessage` to machine room with `{ message, userName, duration: 15 }`
- Returns: event ID, transaction ID

#### 5. POST /events/voice-message
- Auth required (CUSTOMER)
- Body: `{ machineId: string, audioUrl: string, duration: 5 | 15 }`
  - `audioUrl` is a pre-uploaded URL (see file upload endpoint below)
- Logic:
  1. Charge from wallet (create VOICE_MSG Transaction)
  2. Create SpecialEvent record (type: VOICE_MESSAGE, content: audioUrl, duration, status: PENDING_APPROVAL)
  3. Emit WebSocket `event:pendingApproval` to bar owner room
- Returns: event ID, transaction ID, message "Awaiting bar owner approval"

#### 6. POST /events/photo
- Auth required (CUSTOMER)
- Body: `{ machineId: string, photoUrl: string }`
- Logic:
  1. Charge from wallet (create PHOTO Transaction)
  2. Create SpecialEvent record (type: PHOTO, content: photoUrl, status: PENDING_APPROVAL)
  3. Emit WebSocket `event:pendingApproval` to bar owner room
- Returns: event ID, transaction ID, message "Awaiting bar owner approval"

#### 7. POST /events/reaction
- Auth required (CUSTOMER)
- Body: `{ machineId: string, reactionType: "APPLAUSE" | "BOO" | "LAUGH" | "HEART" | "FIRE" }`
- Logic:
  1. Charge from wallet (create REACTION Transaction)
  2. Create SpecialEvent record (type: REACTION, content: reactionType, status: APPROVED)
  3. Emit WebSocket `event:reaction` to machine room with `{ type, userName }`
- Returns: event ID, transaction ID

#### 8. POST /events/birthday
- Auth required (CUSTOMER)
- Body: `{ machineId: string, birthdayName: string, message?: string, songId?: string }`
- Logic:
  1. Charge from wallet (create BIRTHDAY_PACK Transaction)
  2. Create SpecialEvent record (type: BIRTHDAY, content: JSON with name/message, status: APPROVED)
  3. If songId provided, add to queue at priority position
  4. Emit WebSocket `event:birthday` to machine room with `{ name, message }`
- Returns: event ID, transaction ID

#### 9. POST /events/:id/approve
- Auth required (BAR_OWNER or ADMIN)
- Logic:
  1. Find SpecialEvent, verify PENDING_APPROVAL status
  2. Verify bar owner owns the venue of this machine
  3. Update status to APPROVED, set approvedById
  4. Emit WebSocket event to machine room (voice: `event:voiceMessage`, photo: `event:photo`)
- Returns: updated event

#### 10. POST /events/:id/reject
- Auth required (BAR_OWNER or ADMIN)
- Logic:
  1. Find SpecialEvent, verify PENDING_APPROVAL status
  2. Update status to REJECTED
  3. **Refund**: Create a CREDIT transaction to user's wallet for the original amount
  4. Emit WebSocket `event:rejected` to user
- Returns: updated event, refund transaction ID

#### 11. GET /events/pending
- Auth required (BAR_OWNER or ADMIN)
- Returns all PENDING_APPROVAL events for machines in the owner's venues
- Include: user name, event type, content preview, created time

#### 12. POST /events/upload
- Auth required (CUSTOMER)
- Multipart file upload (audio or image)
- Max file size: 5MB for audio, 10MB for images
- Store in local `uploads/` directory (or S3 in production)
- Returns: `{ url: "/uploads/filename.ext" }`

### Modify: `apps/api/src/app.ts`
- Import and register `eventRouter` at `${apiPrefix}/events`

### Modify: `apps/api/src/routes/config.ts`
- Add default special event pricing to the global config defaults:
```typescript
specialEvents: {
  skipQueue: { enabled: false, price: 5.00 },
  silence: { enabled: false, options: [
    { duration: 60, price: 5.00 },
    { duration: 120, price: 10.00 },
    { duration: 180, price: 15.00 },
  ]},
  textMessage: { enabled: false, price: 2.00, maxLength: 200 },
  voiceMessage: { enabled: false, options: [
    { duration: 5, price: 8.00 },
    { duration: 15, price: 10.00 },
  ]},
  photo: { enabled: false, price: 5.00 },
  reaction: { enabled: false, price: 1.00 },
  birthday: { enabled: false, price: 25.00 },
}
```

### WebSocket Events Summary
All events emitted to room `machine:{machineId}`:
| Event | Payload | Trigger |
|-------|---------|---------|
| `event:silence` | `{ duration, startedAt }` | Silence purchased |
| `event:textMessage` | `{ message, userName, duration }` | Text message purchased |
| `event:voiceMessage` | `{ audioUrl, userName, duration }` | Voice message approved |
| `event:photo` | `{ photoUrl, userName }` | Photo approved |
| `event:reaction` | `{ type, userName }` | Reaction purchased |
| `event:birthday` | `{ name, message, songTitle? }` | Birthday purchased |
| `event:pendingApproval` | `{ eventId, type, userName }` | Sent to owner room |
| `event:rejected` | `{ eventId, type }` | Sent to user |
| `queue:updated` | `{ queue }` | Skip queue executed |

### Testing Checklist
```
- [ ] GET /events/config returns correct pricing from venue settings with GlobalConfig fallback
- [ ] Skip queue moves song to position 2, charges wallet, emits WebSocket
- [ ] Silence creates event, charges wallet, emits to machine with duration
- [ ] Text message validates max 200 chars, charges wallet, emits to machine
- [ ] Voice message creates PENDING_APPROVAL event, charges wallet
- [ ] Photo creates PENDING_APPROVAL event, charges wallet
- [ ] Reaction charges wallet, emits to machine with type
- [ ] Birthday creates event with optional song queue, charges wallet
- [ ] Approve changes status, emits to machine
- [ ] Reject refunds wallet, changes status
- [ ] Pending endpoint returns only events for owner's venues
- [ ] File upload works for audio and images with size limits
- [ ] Disabled events return 400 "Feature not enabled"
- [ ] Insufficient wallet balance returns 400
- [ ] All transactions create affiliate commission when applicable
- [ ] WebSocket events reach the correct machine room
```

---

## Prompt 8.3b: Special Events — Customer UI

### Context
The customer already has a Browse page to find songs and a Wallet page to manage credits. This prompt adds a "Special Features" menu accessible from the customer interface, where customers can purchase all special events.

### Files to Create

**New file: `apps/web/src/pages/SpecialEventsPage.tsx`**

A page with a grid of event cards, each with icon, name, price, and "Buy" action:

1. **Skip Queue** — Lightning bolt icon. Shows only if user has a song in queue. Tap → confirm dialog → wallet debit → success toast
2. **Silence** — Mute icon. Tap → duration picker (1/2/3 min with prices) → confirm → wallet debit → TV shows countdown
3. **Text Message** — Chat bubble icon. Tap → text input (200 char limit with counter) → confirm with price → wallet debit → shows on TV
4. **Voice Message** — Microphone icon. Tap → record audio using browser MediaRecorder API → preview playback → upload → wallet debit → "Awaiting approval" status
5. **Photo** — Camera icon. Tap → browser camera capture or file picker → preview → upload → wallet debit → "Awaiting approval" status
6. **Reactions** — Emoji icon. Tap → reaction picker grid (Applause/Boo/Laugh/Heart/Fire with animated preview) → one-tap purchase
7. **Birthday** — Cake icon. Tap → form (birthday person's name, optional message, optional song search) → confirm → wallet debit

**Design:**
- Grid layout, 2 columns on mobile, 3 on tablet
- Each card: dark bg with neon border glow, icon on top, name, price tag
- Disabled events are grayed out with "Not available" label
- Uses Card component from @jukebox/ui
- Framer Motion: staggered entrance animation, press animation on tap

**New file: `apps/web/src/stores/eventsStore.ts`**
Zustand store:
- `config` — event pricing/availability from GET /events/config
- `pendingEvents` — events awaiting approval (for owners)
- `fetchConfig(machineId)` — load available events
- `purchaseEvent(type, payload)` — POST to appropriate endpoint
- `uploadMedia(file)` — POST to /events/upload

**New file: `apps/web/src/components/AudioRecorder.tsx`**
- Uses browser `MediaRecorder` API
- Record button (hold or toggle) with animated waveform visualization
- Max duration enforcement (5s or 15s based on selection)
- Preview playback before confirming
- Returns audio Blob for upload

**New file: `apps/web/src/components/CameraCapture.tsx`**
- Uses browser `getUserMedia({ video: true })` API
- Live camera preview
- Capture button → shows preview → confirm or retake
- Returns image Blob for upload
- Fallback: file input picker if camera not available

### Modify: `apps/web/src/layouts/CustomerLayout.tsx`
- Add "Special" menu item to the customer navigation (between Queue and Wallet)
- Icon: sparkle or star emoji
- Path: `/special`

### Modify: `apps/web/src/App.tsx`
- Add route: `<Route path="/special" element={<SpecialEventsPage />} />`

### Modify: `apps/web/src/pages/owner/OwnerAlertsPage.tsx` (or new page)
- Add "Pending Approvals" section showing voice messages and photos awaiting approval
- Each pending item shows: customer name, type, preview (play audio / show thumbnail), approve/reject buttons
- Approve → POST /events/:id/approve
- Reject → POST /events/:id/reject with confirmation dialog

### Testing Checklist
```
- [ ] Special Events page loads and shows available events based on venue config
- [ ] Disabled events are grayed out and not clickable
- [ ] Skip Queue only appears when user has a queued song
- [ ] Silence duration picker shows correct prices
- [ ] Text message input enforces 200 char limit
- [ ] Audio recorder captures audio, enforces max duration, allows preview
- [ ] Camera capture works (or falls back to file picker)
- [ ] File upload succeeds for audio and images
- [ ] All purchases debit wallet and show success confirmation
- [ ] "Awaiting approval" status shown for voice/photo
- [ ] Bar owner sees pending approvals with preview
- [ ] Approve triggers TV display via WebSocket
- [ ] Reject refunds customer wallet
- [ ] Insufficient balance shows helpful error with "Top Up" link
```

---

## Prompt 8.4: TV Player Extension — Special Events Display

### Context
The TV Player (`/tv-player`) already displays the current playing song, queue, and now-playing info. This prompt extends it to display special events received via WebSocket.

### Modify: `apps/web/src/pages/TvPlayerPage.tsx`

Add event listeners for all special event WebSocket messages and render appropriate overlays:

#### 1. Silence Overlay
- Trigger: `event:silence` WebSocket
- Fade out current music (reduce volume over 2 seconds)
- Display: Full-screen dark overlay with:
  - "SILENCE" text in large neon pink
  - Circular countdown timer (animated ring)
  - Purchaser's name in small text
- When countdown ends: fade music back in, remove overlay
- CSS: `mix-blend-mode`, blur backdrop

#### 2. Text Message Overlay
- Trigger: `event:textMessage` WebSocket
- Display: Animated text that slides in from bottom
  - Neon glow text effect (text-shadow with green/purple)
  - Customer name above message in smaller text
  - Background: semi-transparent dark strip
- Duration: 15 seconds, then slides out
- Animation: Framer Motion `slideInUp` → hold → `slideOutUp`
- Must NOT pause music or block now-playing info entirely

#### 3. Voice Message Overlay
- Trigger: `event:voiceMessage` WebSocket
- Play audio through TV speakers (create `<audio>` element)
- Display: "Voice Message" visual overlay with:
  - Animated sound wave bars (like MusicVisualizer component)
  - Customer name
  - Duration countdown
- Music pauses during voice message, resumes after
- If audio fails to load, skip and log error

#### 4. Photo Display
- Trigger: `event:photo` WebSocket
- Display: Photo in center of screen with:
  - Animated neon frame border (gradient animation)
  - Customer name below photo
  - Entrance: scale up from center with glow
  - Duration: 10 seconds
- Music continues playing (photo is visual only)

#### 5. Reaction Overlay
- Trigger: `event:reaction` WebSocket
- Display: Animated emoji/effect particles:
  - APPLAUSE: clapping hands emojis rising from bottom
  - BOO: thumbs down emojis falling from top
  - LAUGH: laughing emojis scattered
  - HEART: heart emojis floating up
  - FIRE: fire emojis with orange glow
- Duration: 3-5 seconds
- CSS animation: randomized position, size, rotation, opacity
- Does NOT interrupt music or current display

#### 6. Birthday Celebration
- Trigger: `event:birthday` WebSocket
- Display: Full-screen celebration overlay:
  - "Happy Birthday [NAME]!" in large neon text
  - Confetti particle animation (CSS or canvas)
  - Custom message displayed below name
  - Optional: if a song was requested, show "Now playing [song] for [name]"
- Duration: 15 seconds
- Music continues (or plays birthday song if one was queued)

### Event Queue System
Multiple events may arrive close together. Implement a simple queue:
- Events that require full-screen (silence, birthday) go to a priority queue
- Events that are overlays (reactions, text messages) can display simultaneously
- Voice messages pause music — they get priority over other events
- Photos display after current overlay finishes

### New file: `apps/web/src/components/tv/EventOverlay.tsx`
Container component that manages the event queue and renders the appropriate overlay.

### New file: `apps/web/src/components/tv/ReactionParticles.tsx`
Reusable particle animation component for reactions and celebrations.

### Testing Checklist
```
- [ ] Silence overlay appears, countdown works, music resumes after
- [ ] Text messages slide in/out with neon glow effect
- [ ] Voice messages play audio through TV, visual shows during playback
- [ ] Photos display with neon frame for 10 seconds
- [ ] Reactions show animated particles without interrupting playback
- [ ] Birthday shows full celebration with confetti
- [ ] Multiple events queue correctly (don't overlap full-screen events)
- [ ] Events render correctly at TV resolution (1080p/4K)
- [ ] Normal song queue display continues working between events
- [ ] Audio failures are handled gracefully (skip, don't crash)
```

---

## Prompt 9.1a: Push Notifications & Alert System — Backend

### Context
Replaces the WhatsApp notification system with Web Push Notifications. The MachineAlert model already exists. This prompt builds the alert generation engine, push subscription management, and notification delivery.

### Files to Create

**New file: `apps/api/src/lib/pushNotifications.ts`**
- Uses `web-push` npm package
- Generate VAPID keys (store in env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`)
- `sendPushNotification(subscription, payload)` — sends a push to one subscriber
- `notifyUser(userId, title, body, data?)` — looks up user's push subscriptions and sends to all
- `notifyRole(role, title, body, data?)` — sends to all users with given role

**New migration + schema update:**
Add PushSubscription model:
```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```
Add to User model: `pushSubscriptions PushSubscription[]`

**New file: `apps/api/src/routes/notifications.ts`**
Express router (`notificationRouter`):

1. `GET /notifications/vapid-key` — Public, returns VAPID public key
2. `POST /notifications/subscribe` — Auth required, saves push subscription
   - Body: `{ endpoint, keys: { p256dh, auth } }`
   - Upsert by endpoint (user may re-subscribe)
3. `DELETE /notifications/subscribe` — Auth required, removes subscription
   - Body: `{ endpoint }`
4. `GET /notifications/history` — Auth required, returns recent alerts for this user's machines/venues

**New file: `apps/api/src/services/alertService.ts`**
Background service for generating and delivering alerts:

1. `generateAlert(machineId, type, severity, message)`:
   - Create MachineAlert record
   - Find who to notify:
     - Bar owner (venue owner)
     - Admin (all admins)
     - Assigned employee (if machine's venue is in their region)
   - Send push notification to each
   - Update MachineAlert.notifiedVia = 'DASHBOARD' (or 'EMAIL' if email added later)

2. `checkStaleHeartbeats()`:
   - Called on a 60-second interval (setInterval in server.ts)
   - Query all machines where lastHeartbeat < 2 minutes ago AND status = ONLINE
   - Transition them to OFFLINE (BLUE)
   - For machines offline > configured period (e.g., 3 days) AND no recent PURPLE alert → generate PURPLE alert

3. `resolveAlert(alertId, resolvedById)`:
   - Update MachineAlert: isResolved = true, resolvedAt = now, resolvedById
   - Send push to relevant users: "Alert resolved: {machine name}"

### Modify: `apps/api/src/routes/machines.ts`
In the heartbeat endpoint (POST /:id/heartbeat):
- If machine was OFFLINE/ERROR and comes back ONLINE → auto-resolve any open alerts for this machine
- If status is ERROR → call `generateAlert()` with HIGH severity
- If status changes from ONLINE to anything → generate appropriate alert
- Store health data from heartbeat body: `{ cpuUsage, memoryUsage, diskSpace, currentSong, queueLength }`

### Modify: `apps/api/src/app.ts`
- Register `notificationRouter` at `${apiPrefix}/notifications`

### Modify: `apps/api/src/server.ts`
- Start `checkStaleHeartbeats()` interval on server boot

### Install
```bash
npm install web-push --workspace=@jukebox/api
npm install -D @types/web-push --workspace=@jukebox/api
```

### Testing Checklist
```
- [ ] VAPID key endpoint returns public key
- [ ] Subscribe saves push subscription to DB
- [ ] Unsubscribe removes subscription
- [ ] generateAlert creates MachineAlert record
- [ ] generateAlert sends push to bar owner, admin, and employee
- [ ] checkStaleHeartbeats transitions ONLINE → OFFLINE after 2 min
- [ ] checkStaleHeartbeats generates PURPLE alert after configured inactivity
- [ ] Heartbeat with ERROR status generates HIGH alert
- [ ] Machine coming back ONLINE auto-resolves open alerts
- [ ] resolveAlert updates record and notifies users
- [ ] Push notification delivery handles failed/expired subscriptions gracefully
- [ ] Alert history endpoint returns alerts for user's relevant machines
```

---

## Prompt 9.1b: Push Notifications & Monitoring — Frontend

### Context
Add push notification subscription to the PWA, notification bell/dropdown UI, and extend the admin/owner dashboards with real-time alert management.

### Modify: `apps/web/src/lib/pushNotifications.ts` (new file)
Utility functions:
- `getVapidKey()` — GET /notifications/vapid-key
- `subscribeToPush()`:
  1. Request notification permission (`Notification.requestPermission()`)
  2. Get service worker registration
  3. Call `registration.pushManager.subscribe()` with VAPID key
  4. POST subscription to /notifications/subscribe
- `unsubscribeFromPush()` — Remove subscription

### Modify: Service Worker (PWA)
The project uses `vite-plugin-pwa` which auto-generates the SW. Add a `push` event listener:
- Create new file `apps/web/public/sw-push.js` that handles push events
- Or configure `vite-plugin-pwa` to include push handling in the generated SW
- On push event: show browser notification with title, body, icon
- On notification click: focus/open the app, navigate to relevant page (e.g., `/admin/alerts` or `/owner/alerts`)

### New file: `apps/web/src/components/NotificationBell.tsx`
- Bell icon with unread count badge (red circle with number)
- Click → dropdown showing recent notifications
- Each notification: icon (based on type), title, time ago, click to navigate
- "Mark all as read" button
- Fetches from GET /notifications/history

### Modify: All dashboard layouts (AdminLayout, BarOwnerLayout, EmployeeLayout)
- Add `<NotificationBell />` to the sidebar header area (next to logout)
- On mount: call `subscribeToPush()` if not already subscribed
- Show a one-time prompt to enable notifications (with explanation of why)

### Modify: `apps/web/src/pages/admin/AdminAlertsPage.tsx`
Extend the existing alerts page:
- Real-time updates via WebSocket (new alerts appear without refresh)
- Alert cards with severity color coding (CRITICAL=red, HIGH=pink, MEDIUM=amber, LOW=green)
- Each alert card shows: machine name, venue, type, severity, time, resolve button
- Resolve button → POST /events/:id/resolve (note: this is alerts, not events — adjust endpoint)
- Filter: by severity, by resolved/unresolved, by venue
- Sort: by time, by severity

### Modify: `apps/web/src/pages/owner/OwnerAlertsPage.tsx`
Same pattern as admin but filtered to owner's machines only.

### New file: `apps/web/src/stores/notificationStore.ts`
Zustand store:
- `notifications[]` — recent notifications
- `unreadCount` — number of unread
- `fetchNotifications()` — GET /notifications/history
- `markAllRead()` — local state update

### Testing Checklist
```
- [ ] Push permission prompt appears on first dashboard visit
- [ ] Subscribing saves subscription to backend
- [ ] Push notifications appear in browser when machine goes offline/error
- [ ] Clicking notification opens app and navigates to alerts page
- [ ] Notification bell shows unread count
- [ ] Bell dropdown shows recent notifications
- [ ] Admin alerts page updates in real-time via WebSocket
- [ ] Alert resolution works (button → API → UI update)
- [ ] Filters work (severity, status, venue)
- [ ] Owner alerts page shows only their machines' alerts
- [ ] Employee alerts page shows only their region's alerts
- [ ] Service worker handles push events while app is closed
- [ ] Unsubscribing removes push subscription
```

---

## Execution Order

| Step | Prompt | Description | Dependencies |
|------|--------|-------------|-------------|
| 1 | 8.3a | Special Events API routes | Phase 6+7 complete |
| 2 | 8.3b | Special Events Customer UI | 8.3a |
| 3 | 8.4 | TV Player Extension | 8.3a |
| 4 | 9.1a | Push Notifications Backend | Phase 6+7 complete |
| 5 | 9.1b | Push Notifications Frontend | 9.1a |

Steps 1 and 4 can be done in parallel (independent backends).
Steps 2, 3, and 5 depend on their respective backends.

---

## Environment Variables Required

```env
# Push Notifications (generate with: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=admin@solodevs.net
```

## NPM Packages to Install

```bash
# API
npm install web-push --workspace=@jukebox/api
npm install -D @types/web-push --workspace=@jukebox/api
npm install multer --workspace=@jukebox/api       # for file uploads
npm install -D @types/multer --workspace=@jukebox/api
```

No new frontend packages needed — browser APIs (MediaRecorder, getUserMedia, Push API) are built-in.
