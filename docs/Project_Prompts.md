# JukeBox Project — Development Prompts (Staged)

> **Platform Focus**: Android TV (primary), PWA (all screens, TV-optimized)
> **Architecture**: React PWA + Node.js + PostgreSQL (single codebase, TV player is a PWA route)
> **Design System**: Neon Party Vibes — luxury gradients, animations, nightclub imagery

---

## Frontend Design Rules (Apply to ALL UI prompts — Stage 1 AND Stage 2)

### Color Palette — Neon Party Vibes

| Role        | Color          | Hex       |
|-------------|----------------|-----------|
| Primary BG  | Deep Black     | `#0F0F0F` |
| Accent 1    | Neon Green     | `#00FF00` |
| Accent 2    | Neon Purple    | `#9B00FF` |
| Highlight   | Electric Pink  | `#FF0080` |
| Text        | Soft White     | `#F5F5F5` |

### Design Principles

1. **TV-First Responsive**: Primary target is TV-sized screens (1920x1080, 4K). Must scale down gracefully to mobile/tablet. Use large touch targets and readable fonts at distance.
2. **Luxury Aesthetic**: Rich gradients (black → purple → pink), glass-morphism effects, subtle glow/neon effects on interactive elements.
3. **Animations**: Smooth transitions between views, pulsing neon glows on active elements, particle effects for reactions, waveform visualizations during playback. Use `framer-motion` or CSS animations. Keep 60fps on TV hardware.
4. **Imagery**: Use high-quality images related to music, nightlife, DJ culture, vinyl records, sound waves, concert crowds, neon signs, and artistic visuals throughout the UI. Hero backgrounds, card overlays, empty states — all should feature curated nightclub/music imagery.
5. **Typography**: Bold, modern sans-serif (e.g., Inter, Poppins, or Montserrat). Large headings with neon glow text-shadow effects.
6. **Responsive Breakpoints**: TV (1920px+), Desktop (1024-1919px), Tablet (768-1023px), Mobile (320-767px).

---

---

# STAGE 1 — MVP (Production-Ready)

> **Goal**: A working jukebox system that can be installed in a real bar and earn money.
> **Roles**: Admin, Bar Owner, Customer (3 roles only)
> **Payments**: Pix only (most used in Brazilian bars)
> **No**: Employee dashboard, Affiliate system, Stripe/cards, WhatsApp bot, catalog bot, advanced special events, monitoring system

---

## Phase 1 — Foundation & Core Infrastructure

### Prompt 1.1: Project Scaffolding & Monorepo Setup

```
Create a monorepo project structure for JukeBox using the following layout:

/jukebox
├── /apps
│   ├── /web          — React PWA (Vite + React 18 + TypeScript)
│   └── /api          — Node.js backend (Express + TypeScript)
├── /packages
│   ├── /shared       — Shared types, constants, utils
│   └── /ui           — Shared UI components (design system)
├── /docs             — Project documentation
└── /scripts          — Build & utility scripts

Note: The TV player is a route within /apps/web (/tv-player), NOT a separate app.

Requirements:
- Use pnpm workspaces for the monorepo
- Configure ESLint + Prettier with shared config
- Set up TypeScript with path aliases
- Add Husky pre-commit hooks for linting
- Initialize Git with .gitignore covering all platforms

Tech stack:
- Frontend: React 18, TypeScript, Vite, TailwindCSS, Framer Motion
- Backend: Node.js, Express, TypeScript, Prisma ORM
- Database: PostgreSQL 15 + Redis (caching/sessions)
- Real-time: Socket.IO
- Testing: Vitest (frontend), Jest (backend), Playwright (E2E)

Local development:
- PostgreSQL and Redis run locally (installed on dev machine or via cloud service)
- Use .env files for configuration (database URL, Redis URL, API keys)
- npm scripts for starting all services in development mode
```

**Testing for 1.1:**
```
Verify:
- [ ] pnpm install succeeds with no errors
- [ ] TypeScript compiles in all packages
- [ ] ESLint runs across all packages
- [ ] PostgreSQL and Redis connect successfully via local or cloud connection
- [ ] Each app has a working dev server command
- [ ] Shared package imports resolve correctly in apps
```

---

### Prompt 1.2: Design System & UI Component Library

```
Build the JukeBox design system in /packages/ui using the Neon Party Vibes theme.

Color tokens (CSS custom properties + Tailwind config):
- --jb-bg-primary: #0F0F0F
- --jb-bg-secondary: #1A1A2E
- --jb-bg-tertiary: #16213E
- --jb-accent-green: #00FF00
- --jb-accent-purple: #9B00FF
- --jb-highlight-pink: #FF0080
- --jb-text-primary: #F5F5F5
- --jb-text-secondary: #B0B0B0
- --jb-gradient-main: linear-gradient(135deg, #0F0F0F 0%, #1A1A2E 50%, #9B00FF 100%)
- --jb-gradient-card: linear-gradient(145deg, rgba(26,26,46,0.8), rgba(15,15,15,0.9))
- --jb-glow-green: 0 0 20px rgba(0,255,0,0.3)
- --jb-glow-purple: 0 0 20px rgba(155,0,255,0.3)
- --jb-glow-pink: 0 0 20px rgba(255,0,128,0.3)

Components to build (all with Framer Motion animations):
1. Button — variants: primary (neon green), secondary (purple), danger (pink), ghost. Glow on hover/focus. Sizes: sm, md, lg, xl (TV).
2. Card — glass-morphism with backdrop-blur, gradient border, hover lift animation. Supports image overlay.
3. Input / SearchBar — dark input with neon border glow on focus. Search icon with pulse animation.
4. Modal / Drawer — slide-in from bottom (mobile) or center (TV/desktop), dark overlay with blur.
5. SongCard — album art thumbnail, song title, artist, duration, price badge. Neon border on hover. Plays preview animation.
6. QueueItem — position number (neon green), song info, animated progress bar for currently playing.
7. CreditBadge — displays user balance with animated counter, neon green glow.
8. StatusIndicator — circle dot: green (online), red (error), blue (offline). Pulsing animation.
9. Navbar / Sidebar — TV-optimized navigation with large icons, active state glow.
10. Toast / Notification — slide-in notification with neon accent border.
11. Skeleton Loader — animated shimmer effect with dark gradient.
12. MusicVisualizer — audio waveform/bars animation component for "now playing" display.

All components must:
- Be fully responsive (TV → mobile)
- Support keyboard/D-pad navigation (for TV)
- Include dark background music/nightclub imagery as default backgrounds
- Use Framer Motion for enter/exit/hover animations
- Export Storybook stories for visual testing
```

**Testing for 1.2:**
```
Verify:
- [ ] All 12 components render without errors
- [ ] Storybook runs and shows all component variants
- [ ] Components respond correctly to TV, desktop, tablet, and mobile breakpoints
- [ ] Keyboard/D-pad navigation works on all interactive components
- [ ] Animations run at 60fps (no jank on resize or interaction)
- [ ] Color tokens match the Neon Party Vibes palette exactly
- [ ] Glass-morphism and glow effects render correctly in Chrome, Firefox, Safari
- [ ] Snapshot tests pass for all component variants
```

---

### Prompt 1.3: Database Schema & Prisma Setup (MVP)

```
Design and implement the PostgreSQL database schema using Prisma ORM.
MVP scope — 3 roles only: ADMIN, BAR_OWNER, CUSTOMER.

Core models:

1. User
   - id, email, phone, name, role (ADMIN | BAR_OWNER | CUSTOMER)
   - passwordHash, avatar, createdAt, updatedAt

2. Venue (Bar/Club)
   - id, name, address, city, state, country
   - ownerId (→ User), timezone, currency
   - settings (JSON — song price, feature toggles)
   - status (ACTIVE | INACTIVE | SUSPENDED)
   - installDate

3. Machine (Jukebox device)
   - id, venueId (→ Venue), name, serialNumber
   - status (ONLINE | OFFLINE | ERROR)
   - lastHeartbeat, ipAddress
   - offlineSongCache (list of cached song IDs)
   - config (JSON — volume, screen settings, auto-play)

4. Song
   - id, title, artist, album, genre, duration
   - fileUrl (cloud storage path), videoUrl (optional clip)
   - coverArtUrl, metadata (JSON)
   - fileSize, format (MP3 | MP4)
   - isActive, addedAt

5. Queue
   - id, machineId (→ Machine), songId (→ Song)
   - userId (→ User), position, status (PENDING | PLAYING | PLAYED | SKIPPED)
   - paidAmount, paymentMethod, isPriority (fura-fila)
   - createdAt, playedAt

6. Transaction
   - id, userId (→ User), machineId (→ Machine)
   - type (CREDIT_PURCHASE | SONG_PAYMENT | SKIP_QUEUE)
   - amount, currency, paymentMethod (PIX | WALLET)
   - status (PENDING | COMPLETED | FAILED | REFUNDED)
   - pixTransactionId
   - createdAt

7. Wallet
   - id, userId (→ User)
   - balance, currency
   - lastTopUp, updatedAt
   Note: Credits usable across ALL machines in the network

8. Playlist (customer saved playlists)
   - id, userId (→ User), name
   - songIds (array), createdAt, updatedAt

Create:
- Prisma schema with all relations and indexes
- Seed script with sample data (venues, machines, songs, users of each role)
- Migration scripts
- Database utility functions (connection pooling, health check)

Schema must be designed so Stage 2 models (Employee, Affiliate, Commission, SpecialEvent, etc.)
can be added later via new migrations WITHOUT breaking existing data.
```

**Testing for 1.3:**
```
Verify:
- [ ] Prisma migrate succeeds and creates all tables
- [ ] Seed script populates all tables with sample data
- [ ] All foreign key relationships are valid
- [ ] Unique constraints work (email, serialNumber)
- [ ] JSON fields store and retrieve correctly
- [ ] Query performance: indexed fields return in <50ms on sample data
- [ ] Wallet balance cannot go negative (database constraint)
- [ ] Transaction types cover MVP paid features
```

---

### Prompt 1.4: Authentication & Authorization System (MVP)

```
Implement authentication and role-based access control (RBAC).
MVP: 3 roles only — ADMIN, BAR_OWNER, CUSTOMER.

Auth system:
- JWT-based authentication with access + refresh tokens
- Access token: 15 min expiry, refresh token: 7 days
- Phone number + OTP login (primary for customers in Brazil)
- Email + password login (for admin, bar owners)
- QR code scan → auto-register as customer for that venue

Role permissions (3 roles):

ADMIN (Machine Owner):
- Full access to ALL venues and machines
- Billing/revenue data for entire network
- Manage all users, pricing
- Password-protected billing section

BAR_OWNER:
- Full access to OWN venue/machine only
- Revenue data for own machine
- Machine status
- Cannot see other venues

CUSTOMER:
- Select songs, manage queue
- View own credits (wallet balance, usable across all machines)
- Payment (Pix)
- Own playlist management
- Song history

Middleware:
- requireAuth — validates JWT
- requireRole(roles[]) — checks user role
- requireVenueAccess(venueId) — checks user has access to venue
- rateLimiter — per-user rate limiting

API routes:
- POST /auth/register — email or phone registration
- POST /auth/login — email/password or phone/OTP
- POST /auth/refresh — refresh access token
- POST /auth/qr-register — register via QR scan (auto-assigns venue)
- GET /auth/me — current user profile
- PUT /auth/me — update profile

Design the auth middleware so that EMPLOYEE and AFFILIATE roles can be added
in Stage 2 without changing existing code (just extend the role enum and add new middleware).
```

**Testing for 1.4:**
```
Verify:
- [ ] User registration works for all 3 MVP roles
- [ ] JWT tokens are issued and refresh correctly
- [ ] Expired tokens are rejected with 401
- [ ] ADMIN can access all routes
- [ ] BAR_OWNER can only access their own venue data
- [ ] CUSTOMER cannot access admin/owner routes
- [ ] QR code registration creates a customer linked to correct venue
- [ ] Rate limiter blocks excessive requests
- [ ] OTP login flow works end-to-end
- [ ] Password hashing is secure (bcrypt, min 10 rounds)
```

---

## Phase 2 — Core Music & Playback System

### Prompt 2.1: Song Management & Catalog API

```
Build the song catalog management system.

Backend API routes:
- GET /songs — list songs with filters (genre, artist, album, search query). Paginated.
- GET /songs/:id — song details with metadata
- POST /songs (ADMIN only) — add song manually
- PUT /songs/:id (ADMIN only) — update song metadata
- DELETE /songs/:id (ADMIN only) — soft delete
- GET /songs/genres — list all genres
- GET /songs/artists — list all artists (with song count)
- POST /songs/request — customer requests a new song (stores request, notifies admin)

Search system:
- Full-text search on title + artist + album
- Filter by genre, artist, album
- Sort by popularity, recently added, alphabetical
- Search suggestions / autocomplete

Song storage:
- Songs stored in cloud (S3-compatible) with signed URLs
- Metadata in PostgreSQL
- Cover art stored separately, optimized for thumbnails
- Support MP3 (audio only) and MP4 (music video/clip)
- File size optimization: compress for streaming efficiency

Customer search flow (as specified):
Option 1: Search by artist/band name (free text)
Option 2: Browse → Genre → Artist → Album → Song → Confirm
```

**Testing for 2.1:**
```
Verify:
- [ ] Song listing returns paginated results with correct metadata
- [ ] Search by title, artist, and album returns relevant results
- [ ] Genre/artist filters work correctly
- [ ] Full-text search handles accented characters (Portuguese: ã, é, ç, etc.)
- [ ] Autocomplete returns suggestions in <200ms
- [ ] ADMIN can CRUD songs; other roles cannot
- [ ] Song request from customer is stored and admin is notified
- [ ] Signed URLs for song files expire after configured time
- [ ] Cover art thumbnails load in <100ms
- [ ] Browse flow (Genre → Artist → Album → Song) returns correct hierarchy
```

---

### Prompt 2.2: Queue Management System

```
Build the real-time song queue system.

Queue features:
- Each machine has its own queue
- Songs added to queue after successful payment
- Queue position is auto-calculated
- Currently playing song is tracked with progress
- Queue updates broadcast to all connected clients via WebSocket
- When queue is empty, auto-play from a default playlist (configurable per venue)

API routes:
- GET /machines/:id/queue — current queue for a machine
- POST /machines/:id/queue — add song to queue (requires payment)
- DELETE /machines/:id/queue/:queueId — remove from queue (ADMIN/BAR_OWNER only)
- PUT /machines/:id/queue/reorder — reorder queue (ADMIN/BAR_OWNER only)
- POST /machines/:id/queue/skip — skip current song (ADMIN/BAR_OWNER only)
- GET /machines/:id/now-playing — currently playing song with progress

Queue priority (fura-fila):
- Users can pay premium to move to position 1 or 2
- Priority price is configurable per venue
- Priority songs are visually distinct in queue display

WebSocket events:
- queue:updated — full queue refresh
- queue:song-added — new song added (with position)
- queue:song-removed — song removed
- queue:now-playing — current song changed
- queue:progress — playback progress update (every 5 seconds)

Auto-play behavior:
- When no songs in queue, play from venue's default playlist
- Default playlist is configurable by bar owner
- Cache 10-20 songs for offline auto-play
- Random entertaining videos play when no music clip available
```

**Testing for 2.2:**
```
Verify:
- [ ] Adding a song to queue places it in correct position
- [ ] Priority (fura-fila) songs jump to position 1-2
- [ ] WebSocket broadcasts queue changes to all connected clients
- [ ] Queue auto-advances when current song finishes
- [ ] Auto-play kicks in when queue is empty
- [ ] Bar owner can reorder, skip, and remove songs
- [ ] Customer cannot manipulate queue (only add via payment)
- [ ] Queue persists across server restarts (stored in DB)
- [ ] Multiple machines maintain independent queues
- [ ] Progress updates arrive every 5 seconds during playback
- [ ] Queue handles 50+ concurrent additions without race conditions
```

---

### Prompt 2.3: PWA Customer Interface — Song Selection & Queue View

```
Build the customer-facing PWA screens for song selection and queue viewing.

Apply Neon Party Vibes design rules throughout (see Frontend Design Rules above).

Screens:

1. Landing / QR Scan Entry:
   - Full-screen background: nightclub/DJ booth imagery with gradient overlay
   - Large QR code scanner button (neon green glow)
   - "Scan to Play" headline with animated neon text
   - Venue name and logo displayed after scan
   - Auto-installs as PWA with home screen icon

2. Song Search & Browse:
   - Top search bar with neon purple focus glow and pulse animation
   - Quick filter chips: "Popular", "New", genre tags (with gradient backgrounds)
   - Song results as SongCard grid (2 columns mobile, 4 tablet, 6 TV)
   - Each card: album art with glass overlay, song title, artist, price badge (neon green)
   - Tap card → expand with preview, "Add to Queue" button
   - Background: subtle music-related pattern (sound waves, vinyl grooves)

3. Browse Flow (Alternative):
   - Step 1: Genre selection — large image cards with genre name overlay (Rock, Sertanejo, Funk, Pop, etc.)
   - Step 2: Artist list — alphabetical with artist photos
   - Step 3: Album list — album covers in grid
   - Step 4: Song list — tracks from selected album
   - Step 5: Confirm — song details + price + "Pay & Add" button
   - Breadcrumb navigation with animated transitions between steps

4. Current Queue View:
   - "Now Playing" section at top: large album art, song title, artist, animated waveform visualizer, progress bar (neon green)
   - Queue list below: numbered items with album art thumbnails, estimated wait time
   - Priority songs marked with pink "VIP" badge and glow
   - Pull-to-refresh on mobile
   - Auto-scrolling queue on TV display

5. My Credits / Wallet:
   - Balance display with animated counter (neon green, large font)
   - "Top Up" button → Pix QR code payment
   - Transaction history list with icons per type
   - "Credits work at ANY JukeBox in the network" notice

6. My Playlists:
   - Saved playlists with custom names
   - Quick-add songs from playlist to queue
   - Create/edit/delete playlists

7. Song History:
   - List of previously played songs by this user
   - Quick re-queue option
   - Filter by date, venue

Navigation:
- Bottom tab bar (mobile): Home/Search, Queue, Wallet, Profile
- Side nav (TV): large icons with labels, active glow
- All transitions use Framer Motion page animations

Background imagery throughout:
- Use curated nightclub/music photos as section backgrounds
- Dark gradient overlays to maintain text readability
- Parallax scroll effects on hero sections
```

**Testing for 2.3:**
```
Verify:
- [ ] QR code scanning works on mobile cameras (iOS Safari, Android Chrome)
- [ ] PWA installs correctly on Android and iOS with custom icon
- [ ] Song search returns results in <300ms with debounced input
- [ ] Browse flow (Genre → Artist → Album → Song) navigates correctly
- [ ] SongCard displays all required info (art, title, artist, price)
- [ ] Queue view updates in real-time via WebSocket
- [ ] Now Playing shows correct song with progress animation
- [ ] Wallet balance updates immediately after payment
- [ ] Responsive layout works on: TV (1920px), desktop, tablet, mobile (320px)
- [ ] All animations run at 60fps on mid-range mobile devices
- [ ] Offline mode: cached queue and credits display when offline
- [ ] Color palette matches Neon Party Vibes spec exactly
- [ ] Images load with lazy loading and placeholder shimmer
- [ ] D-pad/keyboard navigation works on TV for all interactive elements
```

---

## Phase 3 — Payment System (Pix Only)

### Prompt 3.1: Pix Payment Integration

```
Implement the payment system supporting Pix only (MVP).

Pix Integration (via Mercado Pago, PagSeguro, or similar Brazilian gateway):
- Generate dynamic QR code for each transaction
- Webhook to confirm payment completion
- Instant notification → unlock song immediately
- Pix key management: admin and bar owner can each have configurable Pix keys
- Pix keys changeable via dashboard (admin changes any, bar owner changes own)

Payment flows:
1. Direct song payment: Customer selects song → pays via Pix → song added to queue
2. Credit top-up: Customer buys credits (wallet) via Pix → uses credits for songs
3. Skip queue payment: Customer pays premium via Pix → song jumps to position 1-2

Commission splitting:
- On each transaction, automatically calculate and record commissions:
  - Admin (machine owner) gets base percentage
  - Bar owner gets their configured percentage
- All percentages are editable by admin per venue
- Commission records created atomically with transaction

API routes:
- POST /payments/pix — generate Pix QR code
- POST /payments/pix/webhook — Pix payment confirmation callback
- POST /payments/wallet/topup — add credits to wallet via Pix
- POST /payments/wallet/spend — deduct credits for a purchase
- GET /payments/history — user's transaction history

Security:
- All payment routes require authentication
- Webhook verification (signature validation)
- Transaction amounts validated server-side
- Idempotency keys to prevent double charges
- Wallet balance checked before deduction (no negative balance)

Design the payment module so that Stripe (credit/debit card) integration can be
added in Stage 2 without changing existing payment flows.
```

**Testing for 3.1:**
```
Verify:
- [ ] Pix QR code generates correctly with proper amount
- [ ] Pix webhook confirms payment and updates transaction status
- [ ] Song is added to queue immediately after Pix confirmation
- [ ] Commission splits calculate correctly for admin and bar owner
- [ ] Commission percentages are configurable per venue
- [ ] Wallet top-up increases balance; song purchase decreases balance
- [ ] Wallet cannot go negative
- [ ] Idempotency prevents double charges on retry
- [ ] Transaction history shows correct amounts, dates, and types
- [ ] Webhook signature validation rejects tampered requests
- [ ] Payment works in test/sandbox mode
- [ ] Failed payment does NOT add song to queue
```

---

### Prompt 3.2: Pricing & Configuration System

```
Build the dynamic pricing and configuration system.

Admin-configurable values (per venue):
- Base song price (e.g., R$2.00)
- Priority song price / skip queue (e.g., R$5.00)
- Credit top-up amounts (e.g., R$10, R$20, R$50, R$100)
- Bar owner commission percentage

API routes:
- GET /venues/:id/pricing — get all prices for a venue
- PUT /venues/:id/pricing (ADMIN/BAR_OWNER) — update pricing
- GET /config/global — global default pricing
- PUT /config/global (ADMIN only) — update global defaults

New venues inherit global defaults but can be customized individually.
Price changes take effect immediately for new transactions.

Design the pricing schema so Stage 2 prices (silence, voice message, reactions,
birthday, affiliate commissions) can be added later without restructuring.
```

**Testing for 3.2:**
```
Verify:
- [ ] Default prices load correctly for new venues
- [ ] Admin can update prices for any venue
- [ ] Bar owner can only update prices for their own venue
- [ ] Price changes reflect immediately in customer app
- [ ] Commission percentages are enforced in payment calculations
- [ ] Price validation: no negative prices, reasonable maximums
- [ ] Price history is logged for audit purposes
```

---

## Phase 4 — Dashboards (MVP: 2 Dashboards)

### Prompt 4.1: Admin Dashboard (Machine Owner)

```
Build the Admin (Machine Owner) dashboard — full network management.

Apply Neon Party Vibes design. Background: dark with subtle city skyline / nightclub imagery.

Screens:

1. Machine Overview:
   - List view of ALL machines grouped by city/state
   - Each machine shows status indicator (green=online, red=error, blue=offline)
   - Status indicators pulse with glow animation
   - Click machine → detailed view
   - Summary cards at top: total machines, online %, revenue today (with animated counters)

2. Machine Detail:
   - Real-time status, last heartbeat time
   - Current queue and now playing
   - Venue info (bar name, owner, address, install date)
   - Actions: restart, clear queue, update config

3. Billing / Revenue (PASSWORD PROTECTED):
   - Requires secondary password to access
   - Revenue breakdown: daily / monthly / yearly
   - Filter by venue, city, payment method
   - Charts: revenue over time (line), revenue by venue (bar chart)
   - Export to CSV
   - Commission payouts summary

4. User Management:
   - CRUD for bar owners and customers
   - View customer activity

5. Song Catalog Management:
   - Add/edit/remove songs
   - Bulk upload interface
   - Song request queue from customers

6. Global Settings:
   - Default pricing configuration
   - Feature toggles per venue
   - System-wide announcements

Navigation: Sidebar with icons + labels, collapsible on smaller screens.
```

**Testing for 4.1:**
```
Verify:
- [ ] Dashboard loads all machines with correct status colors
- [ ] Status indicators update in real-time via WebSocket
- [ ] Clicking a machine shows correct detail view
- [ ] Billing section requires secondary password
- [ ] Revenue data is accurate and matches transaction records
- [ ] Charts render correctly with real data
- [ ] CSV export contains correct data
- [ ] User CRUD operations work for all MVP roles
- [ ] Responsive: works on desktop and tablet
```

---

### Prompt 4.2: Bar Owner Dashboard

```
Build the Bar Owner dashboard — single venue management.

Screens:
1. My Machine Status:
   - Status indicator (green/red/blue) with large animated display
   - Current queue, now playing
   - Machine uptime stats

2. Revenue:
   - Daily / monthly / yearly breakdown
   - Transaction list with details
   - Pie chart: revenue by payment type
   - Commission tracking (what they earn vs what admin takes)

3. Settings:
   - Adjust song prices for their machine
   - Configure auto-play playlist
   - Set screen display options (expand/shrink video, venue name overlay)
   - Manage default playlist for when queue is empty
```

**Testing for 4.2:**
```
Verify:
- [ ] Bar owner only sees their own machine (not others)
- [ ] Revenue data matches their venue's transactions exactly
- [ ] Price adjustments take effect immediately
- [ ] Auto-play playlist configuration persists and works
- [ ] All screens follow Neon Party Vibes design
```

---

## Phase 5 — TV Player View (React PWA Fullscreen)

### Prompt 5.1: TV Player View

```
Build the TV Player as a dedicated fullscreen route (/tv-player) within the same React PWA.
This is NOT a separate app — it is a React page that runs in the Android TV's Chrome browser in fullscreen/kiosk mode.

The bar owner opens the TV browser, navigates to the PWA URL + /tv-player, logs in once, and it runs fullscreen.

Technology: Same React + TypeScript + Framer Motion stack as the rest of the PWA.
Media playback: HTML5 <video> and <audio> elements.

Core functionality:
- Full-screen media player using HTML5 video/audio API
- Receives queue from backend via WebSocket (Socket.IO)
- Plays songs/videos in order automatically
- Displays "Now Playing" overlay: song title, artist, album art, progress bar
- Shows queue list on side or bottom (configurable)

Display modes:
1. Music Video mode: full-screen video clip with overlay
2. Audio-only mode: album art full-screen with animated visualizer (waveform/bars using Web Audio API + Canvas)
3. Idle mode: random entertaining videos to attract attention
   - Configurable by bar owner
   - Lower-third banner with venue name/branding

Screen layout (optimized for 1920x1080 and 4K):
- Full-screen video/art with dark gradient overlay
- Song info bar (bottom or top): title, artist, progress
- Queue ticker: next 3-5 songs scrolling
- Venue branding: bar name in corner (configurable text/position)
- QR code for customers to scan (always visible in corner)

Bar owner controls (via API, reflected in real-time):
- Expand/shrink video area
- Custom text overlay (e.g., venue name, promotions)
- Volume control
- Show/hide queue

Offline resilience:
- Use Service Workers to cache 10-20 songs locally (IndexedDB + Cache API)
- When internet drops, continue playing from cache
- Songs already in queue that were loaded continue playing
- Reconnect WebSocket automatically when internet returns
- Sync queue state with backend on reconnection

Power loss recovery:
- Android TV can be configured to auto-open Chrome in kiosk mode on boot
- Save current queue state to localStorage/IndexedDB continuously
- On page load, check for saved state and resume from where it left off
- If queue was playing, skip to next song and continue

Heartbeat:
- Send status to backend every 30 seconds via WebSocket
- Include: current song, queue length, network status
- Backend marks machine as OFFLINE if no heartbeat for 2 minutes

Neon Party Vibes on TV:
- Use the same color palette for all overlays and UI elements
- Neon glow effects on text and progress bars
- Smooth transitions between songs
- Animated visualizer uses accent colors (green, purple, pink)
```

**Testing for 5.1:**
```
Verify:
- [ ] /tv-player route loads fullscreen with correct layout on 1920x1080
- [ ] HTML5 video/audio plays MP3 and MP4 files correctly
- [ ] Queue receives updates from backend via WebSocket
- [ ] Songs auto-advance when current song finishes
- [ ] Offline mode: Service Worker serves cached songs when internet drops
- [ ] Queue state saves to IndexedDB and resumes on page reload
- [ ] Heartbeat sends every 30 seconds via WebSocket
- [ ] Backend marks machine OFFLINE after 2 min without heartbeat
- [ ] QR code is always visible and scannable
- [ ] Venue branding overlay displays correctly
- [ ] Video scales correctly to TV resolution (1080p, 4K)
- [ ] Page runs stable for 24+ hours without memory leaks (test in Chrome)
- [ ] Idle mode plays random videos when queue is empty
- [ ] Web Audio API visualizer renders smoothly at 60fps
```

---

## MVP Summary — Execution Order

| Phase | Section | Description | Dependencies |
|-------|---------|-------------|-------------|
| 1 | 1.1 | Monorepo & scaffolding | None |
| 1 | 1.2 | Design system & UI components | 1.1 |
| 1 | 1.3 | Database schema (MVP) | 1.1 |
| 1 | 1.4 | Auth & RBAC (3 roles) | 1.1, 1.3 |
| 2 | 2.1 | Song catalog API | 1.3, 1.4 |
| 2 | 2.2 | Queue management | 1.3, 1.4 |
| 2 | 2.3 | Customer PWA (songs & queue) | 1.2, 2.1, 2.2 |
| 3 | 3.1 | Pix payment integration | 1.3, 1.4, 2.2 |
| 3 | 3.2 | Pricing & config | 1.3, 1.4 |
| 4 | 4.1 | Admin dashboard | 1.2, 1.4, 3.1 |
| 4 | 4.2 | Bar owner dashboard | 1.2, 1.4, 3.1 |
| 5 | 5.1 | TV player view (React PWA route) | 1.2, 2.2 |

**After Stage 1 is complete**: You have a fully working jukebox system. Customers scan QR, pick songs, pay with Pix, songs play on TV. Admin manages everything, bar owners see their data. Ready to install in a real bar.

---

---

# STAGE 2 — Full Development (Post-MVP)

> **Goal**: Add all remaining features to make the product complete.
> **New Roles**: Employee, Affiliate (total 5 roles)
> **New Payments**: Stripe (credit/debit cards)
> **New Features**: WhatsApp bot, catalog bot, special events, monitoring, affiliate system
>
> **Prerequisite**: Stage 1 must be fully complete and tested.

---

## Phase 6 — Extended Roles & Payment

### Prompt 6.1: Database Schema Extension (New Roles & Models)

```
Extend the MVP database schema to support Stage 2 features.
All changes via NEW Prisma migrations — do NOT modify existing tables destructively.

Extend User model:
- Add roles: EMPLOYEE, AFFILIATE to the role enum
- Add to User: regionAccess (for employees), referralCode (unique, for affiliates)

New models:

1. Commission
   - id, affiliateId (→ User), transactionId (→ Transaction)
   - venueId (→ Venue), percentage, amount
   - type (SALE | VENUE_REFERRAL)
   - status (PENDING | PAID), paidAt
   - referralDuration (months), referralPercentage

2. AffiliateReferral
   - id, affiliateId (→ User), venueId (→ Venue)
   - referralCode, commissionPercent (50-100%)
   - durationMonths (1-6), startDate, endDate
   - isActive

3. MachineAlert
   - id, machineId (→ Machine), type (OFFLINE | AUDIO_FAIL | PAYMENT_ERROR | OWNER_INACTIVE)
   - message, severity (LOW | MEDIUM | HIGH | CRITICAL)
   - isResolved, resolvedAt, resolvedBy
   - notifiedVia (WHATSAPP | EMAIL | DASHBOARD)
   - createdAt

4. SpecialEvent
   - id, machineId (→ Machine), userId (→ User)
   - type (SILENCE | VOICE_MESSAGE | TEXT_MESSAGE | PHOTO | REACTION | BIRTHDAY)
   - content (text/URL), duration (seconds)
   - amount, status (PENDING_APPROVAL | APPROVED | REJECTED | PLAYED)
   - approvedBy (→ User, bar owner), createdAt

5. Banner
   - id, targetRole (AFFILIATE | CUSTOMER)
   - imageUrl, linkUrl, message
   - isActive, startDate, endDate
   - createdBy (→ User, admin)

Extend Transaction model:
- Add types: SILENCE | VOICE_MSG | REACTION | PHOTO | BIRTHDAY_PACK
- Add paymentMethod: CREDIT_CARD | DEBIT_CARD
- Add stripePaymentId

Extend Machine model:
- Add status: ALERT (purple status)

Update seed script with sample data for new models.
```

**Testing for 6.1:**
```
Verify:
- [ ] Migration succeeds without data loss on existing MVP database
- [ ] Existing MVP functionality still works after migration
- [ ] New roles can be assigned to users
- [ ] New models create and query correctly
- [ ] Relationships between new and existing models work
- [ ] Seed script includes sample data for all new models
```

---

### Prompt 6.2: Employee & Affiliate Auth Extension

```
Extend the authentication and authorization system with 2 new roles.

EMPLOYEE (Admin's Staff):
- Same as admin BUT no billing access
- Limited to assigned region (city/state/country)
- Can register new bar owners/venues in their region
- Can view and manage alerts for their machines

AFFILIATE (Promoter/Waiter):
- Personal QR code for tracking
- Commission dashboard (daily/monthly/yearly)
- Same song selection as customer
- Venue referral tracking

New middleware:
- requireRegion(region) — for employees, limits access to assigned region

New/updated API routes:
- All existing admin routes: add EMPLOYEE access where appropriate (except billing)
- GET /affiliates/me/commissions — affiliate's own commission data
- GET /affiliates/me/referrals — affiliate's referral tracking
- POST /affiliates/me/qr — generate affiliate QR code

Existing middleware (requireAuth, requireRole, requireVenueAccess) should need
minimal changes — just extend role checks.
```

**Testing for 6.2:**
```
Verify:
- [ ] Employee registration and login works
- [ ] Employee cannot access billing routes (API returns 403)
- [ ] Employee can only see venues in their assigned region
- [ ] Employee can register a new venue in their region
- [ ] Affiliate registration and login works
- [ ] Affiliate QR code is unique and trackable
- [ ] Affiliate can view own commissions
- [ ] Existing 3 MVP roles still work exactly the same
```

---

### Prompt 6.3: Stripe Card Payment Integration

```
Add credit/debit card payments via Stripe to the existing Pix payment system.

Credit/Debit Card Integration (via Stripe):
- Secure card tokenization (PCI compliant — never store raw card data)
- First-time: customer enters card details → token stored
- Subsequent: one-click payment using stored token
- Anti-fraud measures: 3D Secure, velocity checks, IP verification
- Chargeback handling: flag disputed transactions, notify admin

New/updated API routes:
- POST /payments/card — charge stored card or tokenize new card
- POST /payments/card/tokenize — store card token (first time)
- Update existing wallet/topup to support card payment method

Extend commission splitting to include affiliate percentage (20-50%, configurable).
All existing Pix flows continue to work unchanged.
```

**Testing for 6.3:**
```
Verify:
- [ ] Card tokenization stores token securely (no raw card data in DB)
- [ ] One-click card payment works with stored token
- [ ] 3D Secure challenge triggers for suspicious transactions
- [ ] Pix payments still work exactly the same
- [ ] Commission splits now include affiliate percentage when applicable
- [ ] Wallet top-up works with both Pix and card
- [ ] Chargeback flagging works
- [ ] Test/sandbox card numbers work correctly
```

---

## Phase 7 — Dashboards (Extended)

### Prompt 7.1: Employee Dashboard

```
Build the Employee dashboard — regional machine support.

Same Neon Party Vibes design as Admin dashboard but with these restrictions:
- NO access to billing/revenue section
- Only sees machines in their assigned region (city/state/country)
- Can register new bar owners/venues in their region
- Has alert history and defect tracking for their machines

Screens:
1. Regional Machine Overview — same layout as admin but filtered to region
2. Machine Detail — same as admin
3. Alert & Defect History — per machine, with resolution tracking
4. New Venue Registration — form to onboard new bar/venue
5. Venue List — all venues in their region with status and owner info

No billing, no global settings, no user management beyond venue registration.
```

**Testing for 7.1:**
```
Verify:
- [ ] Employee only sees machines in their assigned region
- [ ] Employee cannot access billing routes (API returns 403)
- [ ] Employee can register a new venue in their region
- [ ] Employee cannot register venues outside their region
- [ ] Alert history is accurate and filterable
- [ ] Dashboard layout matches admin design (Neon Party Vibes)
```

---

### Prompt 7.2: Affiliate Dashboard

```
Build the Affiliate (promoter/waiter) dashboard.

Screens:

1. Home / Earnings Overview:
   - Personal QR code displayed prominently (for customers to scan)
   - Today's earnings with animated counter (neon green)
   - Quick stats: daily / monthly / yearly earnings
   - "Share your code" button (generates shareable link/image)
   - Admin banner displayed prominently (customizable message area)

2. Commission Details:
   - List of all transactions where affiliate earned commission
   - Filter by date range
   - Shows: customer, amount, commission %, earned amount
   - Charts: earnings over time (daily/monthly)

3. Venue Referral Tracking:
   - List of venues referred by this affiliate
   - Each shows: venue name, referral %, duration, earnings to date
   - Status: active referral period or expired

4. Song Selection:
   - Same as customer interface (they can also use the jukebox)

5. Direct Channel:
   - WhatsApp icon for direct communication with the company
   - In-app messaging or link to support

Design note: Banner space at top of dashboard — admin can change the message/image
easily to communicate promotions, incentives, or announcements to affiliates.
```

**Testing for 7.2:**
```
Verify:
- [ ] Affiliate QR code is unique and links to their referral tracking
- [ ] When a customer scans affiliate QR and makes a purchase, commission is recorded
- [ ] Commission percentages match venue configuration (20-50%)
- [ ] Earnings dashboard shows accurate daily/monthly/yearly totals
- [ ] Venue referral earnings calculate correctly (50-100% for 1-6 months)
- [ ] Referral tracking shows correct active/expired status
- [ ] Admin banners display and update in real-time
- [ ] Affiliate can also use jukebox as a customer
- [ ] QR code sharing generates a working link/image
```

---

### Prompt 7.3: Admin Dashboard Extension

```
Extend the Admin dashboard (from Stage 1 Prompt 4.1) with Stage 2 features.

Add to existing Admin Dashboard:

1. User Management — add EMPLOYEE and AFFILIATE management:
   - Assign employees to regions
   - Set commission rates per affiliate
   - View affiliate performance

2. Alert Management (new screen):
   - List of active alerts (sorted by severity)
   - Alert types: machine offline, audio failure, payment error, owner inactive
   - Alert resolution workflow: acknowledge → investigate → resolve
   - Alert history with filters

3. Banner Management (new screen):
   - Create/edit banners for affiliate and customer dashboards
   - Set target audience (affiliates, customers, or both)
   - Schedule start/end dates
   - Preview banner appearance

4. Machine status — add PURPLE (Alert/inactive) status indicator

5. Special Event Approval view — see and manage pending events across all venues
```

**Testing for 7.3:**
```
Verify:
- [ ] Employee management (assign regions, CRUD) works
- [ ] Affiliate management (set commissions, view performance) works
- [ ] Alert management shows correct severity and status
- [ ] Alerts trigger within 30 seconds of machine status change
- [ ] Banner management creates banners visible to target audience
- [ ] PURPLE status indicator works for inactive machines
- [ ] All new screens follow Neon Party Vibes design
- [ ] Existing admin features still work perfectly
```

---

### Prompt 7.4: Bar Owner Dashboard Extension

```
Extend the Bar Owner dashboard (from Stage 1 Prompt 4.2) with Stage 2 features.

Add to existing Bar Owner Dashboard:

1. Alerts screen:
   - Active alerts for their machine
   - Alert history
   - WhatsApp icon for direct communication

2. Approve Special Events screen:
   - Voice messages waiting for approval
   - Photos waiting for approval
   - One-click approve/reject with preview

3. Affiliate tracking — see which affiliates are driving sales at their venue

4. Revenue — add credit/debit card breakdown to existing charts

WhatsApp icon in bottom-right corner on all screens.
```

**Testing for 7.4:**
```
Verify:
- [ ] Alert screen shows correct alerts for their machine
- [ ] Special event approval/rejection works correctly
- [ ] Approved voice message plays on the machine
- [ ] Rejected events notify the customer
- [ ] WhatsApp icon opens WhatsApp with pre-filled support number
- [ ] Revenue charts include card payment data
- [ ] Existing bar owner features still work perfectly
```

---

### Prompt 7.5: Customer Interface Extension

```
Extend the Customer PWA (from Stage 1 Prompt 2.3) with Stage 2 features.

Add to existing Customer Interface:

1. Payment Setup — add credit/debit card option alongside Pix:
   - Card form with secure tokenization
   - Saved cards for one-click payment

2. Special Features Menu (new screen):
   - Grid of premium features with icons and prices:
     - Skip Queue (with current queue length shown)
     - Paid Silence (1/2/3 min options)
     - Text Message (text input)
     - Voice Message (record via WhatsApp)
     - Photo/Selfie (via WhatsApp)
     - Birthday Package
     - Reactions (applause, boo, meme icons)
   - Each card shows price with neon green badge
   - One-tap purchase flow

3. WhatsApp Integration:
   - WhatsApp icon bottom-right on all screens
   - Options: report issue, request new song, send paid content (audio/meme)

4. Banners from admin displayed at top or between sections.
```

**Testing for 7.5:**
```
Verify:
- [ ] Card payment setup stores token securely
- [ ] Customer can pay with both Pix and card
- [ ] Special features (skip, silence, reactions) create correct transactions
- [ ] Voice message and photo flows redirect to WhatsApp correctly
- [ ] Banners display correctly from admin configuration
- [ ] Existing customer features still work perfectly
- [ ] All new screens follow Neon Party Vibes design
```

---

## Phase 8 — Advanced Features

### Prompt 8.1: WhatsApp Integration & Bot

```
Implement WhatsApp integration using the WhatsApp Business API (or alternative like Twilio/360dialog).

WhatsApp Bot menu:
Customer options:
1. Request a new song → stores request, notifies admin
2. Send text message to screen (R$2) → processes payment, displays on screen
3. Send photo to screen (R$5) → processes payment, displays on screen
4. Send voice message to screen: 5s (R$8), 15s (R$10) → requires bar owner approval → plays on machine
5. Report an issue → creates support ticket

Affiliate options:
1. View today's earnings → returns commission summary
2. Share referral link → generates and sends personal QR/link
3. Contact support → routes to admin team

Admin/Bar Owner alerts (outgoing):
- Machine went offline → WhatsApp notification
- Machine error → WhatsApp notification with error details
- Payment failure → WhatsApp alert
- Owner inactive (purple alert) → WhatsApp reminder

Technical:
- Use official WhatsApp Business API or Twilio WhatsApp
- Message templates for transactional messages (required by WhatsApp policy)
- Webhook to receive incoming messages
- Route messages based on user role and registered phone number
- Media handling: receive and forward photos, voice notes
- Payment verification before processing paid content
```

**Testing for 8.1:**
```
Verify:
- [ ] Bot responds to customer messages with correct menu
- [ ] Song request is stored and admin notified
- [ ] Paid text message charges correctly and displays on screen
- [ ] Paid photo charges correctly and displays on screen
- [ ] Voice message charges correctly and awaits bar owner approval
- [ ] Approved voice messages play on the machine
- [ ] Machine offline alert sends WhatsApp to bar owner and admin
- [ ] Alert messages arrive within 60 seconds of status change
- [ ] Affiliate can view earnings via WhatsApp
- [ ] Bot handles unknown messages gracefully (sends help menu)
- [ ] Message templates comply with WhatsApp Business API policies
```

---

### Prompt 8.2: Music Catalog Bot (Auto-fetch)

```
Build the automated music catalog management bot.

Functionality:
- Fetches music from defined, legal sources (admin-configurable source URLs/APIs)
- Downloads in MP3 format (audio) or MP4 (video clip) — prefer compressed formats for cloud efficiency
- Fetches album cover art
- Extracts and stores metadata: title, artist, album, genre, duration, year
- Organizes into catalog structure
- Uploads to cloud storage (2TB initial capacity, S3-compatible)
- Makes songs available to all machines via API

Process:
1. Admin adds song request or batch import list
2. Bot searches configured sources for the song
3. Downloads best quality within size limits
4. Compresses if needed (target: ~5MB per MP3, ~50MB per MP4)
5. Extracts metadata from file tags + external API (MusicBrainz, etc.)
6. Uploads to cloud storage
7. Creates database entry with metadata and file URL
8. Notifies admin of completion

Rules:
- No unstable web scraping (use stable APIs only)
- No heavy AI processing in v1 (future enhancement)
- Reliable and automated — runs as background service
- Duplicate detection (same song from different sources)
- Queue system for batch processing

API routes:
- POST /catalog/fetch — submit song fetch request
- GET /catalog/fetch/status — check fetch queue status
- POST /catalog/bulk-import — CSV/JSON list of songs to fetch
- GET /catalog/stats — storage usage, total songs, recent additions
```

**Testing for 8.2:**
```
Verify:
- [ ] Bot fetches song from configured source
- [ ] MP3 files are within size target (~5MB)
- [ ] MP4 clips are within size target (~50MB)
- [ ] Album art is downloaded and linked correctly
- [ ] Metadata extraction is accurate (title, artist, album, genre)
- [ ] Duplicate songs are detected and skipped
- [ ] Songs appear in catalog API after processing
- [ ] Bulk import processes all items in queue
- [ ] Cloud storage upload succeeds with correct file paths
- [ ] Admin receives notification when fetch completes
- [ ] Bot handles fetch failures gracefully (retries, then marks failed)
- [ ] Storage stats are accurate
```

---

### Prompt 8.3: Special Events System (All Paid Features)

```
Implement all special paid features as an event system.

Events:

1. Skip Queue (Fura-Fila):
   - Customer pays premium price → song moves to position 1 or 2
   - Queue re-orders automatically
   - "VIP" badge on queue display

2. Paid Silence:
   - Durations: 1 min (R$5), 2 min (R$10), 3 min (R$15) — admin configurable
   - Music fades out smoothly
   - TV displays "Silence Purchased" with countdown timer (neon pink)
   - After timer: music resumes

3. Text Message:
   - Customer types message (max 200 chars)
   - Displayed on TV screen with animated entrance
   - Neon text with glow effect on dark background
   - Duration: 15 seconds on screen

4. Voice Message (via WhatsApp):
   - Durations: 5 sec (R$8), 15 sec (R$10) — admin configurable
   - Requires bar owner approval before playing
   - Played through speakers with "Voice Message" visual on screen

5. Photo/Selfie (via WhatsApp):
   - Customer sends photo via WhatsApp
   - Displayed on TV screen for 10 seconds
   - Photo frame with neon border and customer name

6. Reactions:
   - Applause, Boos/Vaias, Memes — R$1 each
   - Animated overlay on TV screen (particles, emojis)
   - Sound effect plays with reaction

7. Birthday Package:
   - Custom bundle: dedicated song slot + message on screen + special effects
   - Price set by admin
   - Birthday animation with confetti and neon effects

All events:
- Require payment before execution
- Create Transaction and SpecialEvent records
- Commission splits apply (including affiliate if tracked)
- Admin can enable/disable any feature per venue
- Prices are configurable per venue
```

**Testing for 8.3:**
```
Verify:
- [ ] Skip queue moves song to correct position and charges premium
- [ ] Silence fades music, shows countdown, and resumes correctly
- [ ] Text message displays on screen with correct animation and duration
- [ ] Voice message requires approval and only plays when approved
- [ ] Photo displays with frame and neon border
- [ ] Reactions show animated overlay with sound effect
- [ ] Birthday package activates all bundled effects
- [ ] All events charge correct configurable prices
- [ ] Commission splits apply to all event transactions
- [ ] Events can be enabled/disabled per venue by admin
- [ ] Disabled events don't appear in customer interface
```

---

### Prompt 8.4: TV Player Extension (Special Events Display)

```
Extend the TV Player (from Stage 1 Prompt 5.1) to display Stage 2 special events.

Add to existing TV Player:

1. Text messages: display on screen with Framer Motion animated entrance
2. Reactions: animated emoji/effects overlay (CSS particles, emojis)
3. Voice messages: play audio with "Voice Message" visual on screen
4. Photos: display on screen briefly with neon frame
5. Silence: fade out music, show "Silence Purchased" with countdown

All animations use Neon Party Vibes colors and effects.
Events received via WebSocket from backend.
```

**Testing for 8.4:**
```
Verify:
- [ ] Text messages display with correct animation and duration
- [ ] Reactions show animated overlay effects
- [ ] Voice messages play audio with visual indicator
- [ ] Photos display with neon frame for correct duration
- [ ] Silence mode fades music and shows countdown
- [ ] All events render correctly at TV resolution
- [ ] Events don't interfere with normal music playback
- [ ] Existing TV player features still work perfectly
```

---

## Phase 9 — Monitoring & Alerts

### Prompt 9.1: Real-Time Machine Monitoring System

```
Build the real-time machine monitoring and alert system.

Machine status tracking:
- GREEN (Online): heartbeat received within last 2 minutes
- RED (Error): machine reported an error (audio failure, payment error, crash)
- BLUE (Offline): no heartbeat for 2+ minutes (normal — e.g., closed for the night)
- PURPLE (Alert): owner hasn't turned on machine for configured period (e.g., 3 days)

Dashboard components:
- Network map: visual map or grid of all machines with colored status dots
- Group by: city, state, country
- Real-time updates via WebSocket (status changes animate)
- Click machine → details panel with full status history

Alert system:
- Automatic alerts generated on status changes
- RED and PURPLE alerts auto-send WhatsApp to:
  - Bar owner (of that machine)
  - Admin (machine owner)
  - Assigned employee (if any)
- Alert includes: machine name, venue, error type, timestamp
- Alert dashboard: list of active/resolved alerts
- Resolution workflow: acknowledge → investigate → resolve

Machine health data:
- Heartbeat includes: CPU usage, memory usage, disk space, network speed, current song, queue length
- Historical charts: uptime %, error frequency, revenue correlation
- Predictive alerts: disk space running low, excessive errors

Alert history per machine:
- Full timeline of all alerts and status changes
- Installation date, total uptime, error count
- Bar owner contact info
```

**Testing for 9.1:**
```
Verify:
- [ ] Machine status updates correctly based on heartbeat timing
- [ ] GREEN → BLUE transition happens after 2 min without heartbeat
- [ ] RED status triggers on machine error report
- [ ] PURPLE status triggers after configured inactivity period
- [ ] WhatsApp alert sends within 60 seconds on RED/PURPLE
- [ ] Alert appears in admin/employee/bar owner dashboards
- [ ] Alert resolution workflow tracks state changes
- [ ] Machine health charts display accurate data
- [ ] Historical uptime percentage calculation is correct
- [ ] Status changes animate in real-time on dashboard
- [ ] Grouping by city/state/country works correctly
```

---

## Stage 2 Summary — Execution Order

| Phase | Section | Description | Dependencies |
|-------|---------|-------------|-------------|
| 6 | 6.1 | Database schema extension | Stage 1 complete |
| 6 | 6.2 | Employee & Affiliate auth | 6.1 |
| 6 | 6.3 | Stripe card payments | 6.1, Stage 1 3.1 |
| 7 | 7.1 | Employee dashboard | 6.2, Stage 1 4.1 |
| 7 | 7.2 | Affiliate dashboard | 6.2, Stage 1 4.1 |
| 7 | 7.3 | Admin dashboard extension | 6.1, 6.2 |
| 7 | 7.4 | Bar owner dashboard extension | 6.1, 8.3 |
| 7 | 7.5 | Customer interface extension | 6.3, 8.3 |
| 8 | 8.1 | WhatsApp bot | 6.1, 8.3 |
| 8 | 8.2 | Music catalog bot | Stage 1 2.1 |
| 8 | 8.3 | Special events system | 6.1, Stage 1 3.1 |
| 8 | 8.4 | TV player extension | 8.3, Stage 1 5.1 |
| 9 | 9.1 | Monitoring & alerts | 6.1, 8.1 |

---

## Legal & Licensing Notes

- All source code delivered via GitHub
- MIT License with copyright notice — commercial use requires owner authorization
- No third-party code that could be blocked or revoked (use only open-source MIT/Apache licensed dependencies)
- All encryption keys and passwords controlled exclusively by the project owner
- Full documentation included
