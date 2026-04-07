# JukeBox — Phase 3: Client Interface Redesign & New Features

> **Prerequisite**: Stage 1 (MVP) and Stage 2 (Extended) complete
> **Goal**: Redesign customer experience, add Google login, phone jukebox mode, role switching, bundled purchases

---

## Prompt 3.1: Google One-Click Login (OAuth)

```
Replace the current email/password registration with Google One-Click Login.

Requirements:
- Add "Sign in with Google" button on the landing page
- Use Google OAuth 2.0 (Google Identity Services / @react-oauth/google)
- When user signs in with Google:
  - If account exists (same email) → login automatically
  - If new user → create account with Google name, email, avatar
  - No password needed — Google handles authentication
- Store Google OAuth token for session management
- Existing email/password login still works as fallback
- All roles (Customer, Bar Owner, Employee, Affiliate) can use Google login
- After login, redirect to /browse (customer) or appropriate dashboard (other roles)

Backend changes:
- POST /auth/google — accept Google ID token, verify with Google API, create/find user
- Store googleId on User model for linking

Frontend changes:
- Add Google Sign-In button on LandingPage
- Load Google Identity Services SDK dynamically
- Remove venue code requirement from login (already done)
- Show Google avatar in profile if available

Testing:
- [ ] Google login creates new account on first sign-in
- [ ] Google login finds existing account on subsequent sign-ins
- [ ] Google avatar and name display correctly
- [ ] Email/password login still works
- [ ] All 5 roles can sign in with Google
```

---

## Prompt 3.2: UI Redesign — Single Screen Products

```
Redesign the customer Browse page to show ALL products on one screen.

Current state: Songs are on Browse page, special events on a separate Special page.

New layout (single scrollable screen):
1. Top: Venue connection (QR scan or code input) — collapsible after connecting
2. Search bar + genre filters
3. Song list with:
   - Album art, title, artist, duration
   - Price badge (R$ 2.00)
   - "+" button to add to favorites
   - Tap song → payment modal
4. Special products section (below songs or as horizontal scroll):
   - Skip Queue (Fura-Fila) — with queue length shown
   - Silence (1/2/3 min)
   - Text Message to screen
   - Voice Message
   - Photo Display
   - Reactions (Applause, Boo, etc.)
   - Birthday Package
   - Each shows icon, name, price
5. Bottom: Song Finder bot button (existing)

All products visible on one page. Customer can browse everything without navigating.

The payment modal should support multi-item selection:
- Customer can select: 1 song + skip queue + photo → combined price
- "Cart" style: add items, see total, pay once
- Payment methods: Wallet, Pix, Card

Testing:
- [ ] All products visible on single screen
- [ ] Song list scrollable with genre filters
- [ ] Special products section visible below songs
- [ ] Multi-item selection works (song + extras)
- [ ] Combined price calculates correctly
- [ ] Single payment for multiple items
- [ ] Mobile responsive layout
```

---

## Prompt 3.3: Multi-Item Cart & Bundle Purchase

```
Implement a cart system for bundled purchases.

Current: Customer pays for one item at a time.
New: Customer can add multiple items to cart and pay once.

Cart features:
- Floating cart button (bottom of screen) showing item count
- Add song to cart (tap "Add to Cart" instead of immediate payment)
- Add special events to cart (skip queue, silence, photo, etc.)
- Cart drawer/modal shows all selected items with prices
- Remove items from cart
- Total price calculated
- Single payment (Wallet, Pix, or Card) for entire cart
- After payment: all items processed (songs added to queue, events created)

API changes:
- POST /payments/cart — accept array of items, process all in one transaction
- Each item: { type, songId?, machineId, amount, metadata? }
- Atomic: either all succeed or all fail
- Revenue split applied to total

Frontend:
- CartStore (Zustand) — items, addItem, removeItem, total, clearCart
- CartDrawer component — slide-up panel showing items
- CartButton — floating badge with item count
- Integrate with existing payment flow (Wallet/Pix/Card)

Testing:
- [ ] Add multiple songs to cart
- [ ] Add song + skip queue + photo to cart
- [ ] Total price is correct
- [ ] Single payment processes all items
- [ ] Songs enter queue in correct order
- [ ] Special events are created
- [ ] Cart clears after successful payment
- [ ] Remove items from cart works
```

---

## Prompt 3.4: Favorite Songs & Playlist Replay

```
Add favorite songs feature and playlist replay from history.

Favorites:
- "+" button on each song card (heart or plus icon)
- Tap to add/remove from favorites
- Favorites list accessible from Profile or a dedicated tab
- Quick-add favorite songs to queue
- Favorites persist across sessions (stored in database)

API:
- POST /songs/:id/favorite — toggle favorite
- GET /songs/favorites — list user's favorites
- Add UserFavorite model: userId + songId + createdAt

Playlist replay:
- In Song History page, add "Replay" button
- Replays the same set of songs (adds all to cart or queue)
- "Replay last session" — re-queue all songs from last visit
- Filter history by venue, date

Testing:
- [ ] "+" button adds song to favorites
- [ ] Favorites list shows all saved songs
- [ ] Remove from favorites works
- [ ] Quick-add from favorites to queue
- [ ] Replay from history adds songs to queue/cart
- [ ] Favorites persist after logout/login
```

---

## Prompt 3.5: Role Switching (Same Email, Multiple Roles)

```
Allow users to switch between roles without logging out.

Current: Each role has a separate dashboard. Users must navigate manually.
New: Same email can have multiple roles. One-click switch between interfaces.

UI:
- Profile dropdown or avatar menu shows available roles
- Click to switch: Customer / Affiliate / Owner / Employee / Admin
- Interface changes instantly (no page reload)
- Current role indicator visible in header

Implementation:
- User model already supports one role per account
- New approach: User can have multiple roles (add roles[] array or separate role assignments)
- OR simpler: Admin can assign additional roles to a user
- Frontend stores active role, switches layout accordingly

Role combinations:
- Customer + Affiliate (most common — waiter/promoter who also uses jukebox)
- Customer + Bar Owner (owner who plays music at their own bar)
- Admin + Customer (admin testing the system)

Affiliate info embedded in customer interface:
- Below wallet balance, show affiliate earnings summary
- Affiliate QR code accessible from customer profile
- No need for separate affiliate dashboard

Testing:
- [ ] User with multiple roles sees role switcher
- [ ] Switching roles changes the interface
- [ ] Affiliate info visible in customer interface
- [ ] No logout required to switch
- [ ] Permissions respected per role
```

---

## Prompt 3.6: Two QR Codes (Music + Registration)

```
Generate two different QR codes for each venue.

QR Code 1 — Music (for existing customers):
- URL: https://jukjoy.com/browse?venue=BAR-CARLOS
- Scans → opens browse page connected to venue
- If logged in → ready to play
- If not logged in → can browse, prompted to login when paying

QR Code 2 — Registration (for new customers):
- URL: https://jukjoy.com/?venue=BAR-CARLOS&register=true
- Scans → opens registration page with venue pre-filled
- Google One-Click or email registration
- After registration → redirected to browse page connected to venue

Bar Owner Dashboard:
- QR Code page shows both QR codes side by side
- Labels: "QR para Músicas" and "QR para Novos Clientes"
- Download and print buttons for each
- Print layout includes both QR codes with instructions

Testing:
- [ ] Music QR opens browse page connected to venue
- [ ] Registration QR opens registration page
- [ ] After registration, customer is connected to venue
- [ ] Both QR codes downloadable and printable
- [ ] QR codes are different (different URLs)
```

---

## Prompt 3.7: Phone as Jukebox (Mobile TV Player)

```
Allow the bar owner's phone to work as a jukebox — replicating the TV player on mobile.

Current: TV Player only works on /tv-player route in desktop/TV browser.
New: Bar owner can use their phone as the jukebox display + speaker.

Mobile Jukebox mode:
- Accessible from bar owner dashboard: "Use Phone as Jukebox" button
- Opens fullscreen mobile player (similar to TV Player but mobile-optimized)
- Plays songs from the queue using phone speakers
- Shows: now playing, album art, queue list, venue branding
- Audio output goes through phone → connected Bluetooth speaker

Bluetooth integration:
- No special code needed — user connects Bluetooth speaker via phone settings
- Browser plays audio through system audio output
- Works with any Bluetooth speaker (already paired via Android/iOS settings)
- Add note in UI: "Connect your Bluetooth speaker in phone settings for best sound"

Share to TV:
- "Share Screen" button — opens share menu (native Web Share API)
- "Open on TV" button — shows URL to open on TV browser
- QR code to scan with TV/computer to open TV Player

Controls:
- Play/Pause, Next, Volume slider
- Queue management (reorder, remove)
- Venue branding overlay toggle

Testing:
- [ ] Mobile jukebox opens in fullscreen
- [ ] Audio plays through phone/Bluetooth speaker
- [ ] Queue syncs in real-time
- [ ] Songs auto-advance
- [ ] Share/Open on TV options work
- [ ] Volume control works
- [ ] Mobile responsive at all phone sizes
```

---

## Prompt 3.8: Volume Control (Owner + Paid Customer)

```
Add volume control features.

Bar Owner volume control:
- Volume slider in owner dashboard and mobile jukebox
- Changes volume on TV Player in real-time via WebSocket
- Mute button

Paid volume control (customer):
- Customer can pay to change volume for one song
- "Volume Up" and "Volume Down" as special products
- Price configurable by admin (e.g., R$ 1.00)
- Volume change is temporary (resets after the song)
- Shows notification on TV: "Volume changed by [customer name]"

WebSocket events:
- volume:set { level: 0-100 } — from owner dashboard
- volume:temporary { level: 0-100, duration: 'song' } — from paid customer

Testing:
- [ ] Owner can adjust volume from dashboard
- [ ] Volume changes reflected on TV Player in real-time
- [ ] Customer can pay to change volume
- [ ] Volume resets after song ends
- [ ] TV shows notification when volume changes
```

---

## Prompt 3.9: Inline Billing & Settings for Bar Owner

```
Embed billing and settings directly in the bar owner's main interface.

Current: Bar owner has separate tabs (Machine, Revenue, Settings, etc.)
New: Everything accessible from one screen without leaving the interface.

Layout:
- Main screen shows: machine status + current queue + now playing
- Swipe or scroll down to see:
  - Quick revenue summary (today, this week, this month)
  - Recent transactions list
  - Quick settings (song price, volume, auto-play toggle)
- Full settings accessible via gear icon (expandable panel, not new page)
- Full revenue details accessible via tap on revenue card

No separate pages needed for basic operations. The bar owner sees everything at a glance.

Testing:
- [ ] Revenue summary visible on main screen
- [ ] Quick settings adjustable without navigation
- [ ] Full settings accessible from gear icon
- [ ] Machine status, queue, and now playing visible together
- [ ] Mobile responsive
```

---

## Prompt 3.10: Per-Venue Catalog

```
Allow each venue to have its own song catalog.

Current: All songs are available at all venues.
New: Admin/Owner can configure which songs are available at each venue.

Options:
1. Venue uses global catalog (default — all songs available)
2. Venue uses custom catalog (only selected songs/genres available)
3. Venue blocks specific songs (global minus blocked)

Implementation:
- VenueCatalog model: venueId, songId, isAvailable
- Or use existing RegionCatalog pattern
- Filter songs API by venue when connected
- Admin can assign catalog per venue
- Bar owner can enable/disable songs for their venue

UI:
- Admin: venue detail → catalog tab → toggle songs on/off
- Bar owner: settings → manage catalog → toggle songs

Testing:
- [ ] Venue with custom catalog shows only assigned songs
- [ ] Venue with global catalog shows all songs
- [ ] Blocking a song hides it from that venue only
- [ ] Other venues not affected
- [ ] Admin can configure any venue's catalog
- [ ] Bar owner can only configure their own
```

---

## Prompt 3.11: Cloud Storage Setup

```
Set up cloud storage for music files.

Provider: DigitalOcean Spaces (S3-compatible)

Setup:
- Create a Space: "jukebox-music"
- Region: NYC3 (same as VPS)
- Configure CORS for streaming
- Generate Access Key and Secret Key

Backend:
- Add S3 client (aws-sdk or @aws-sdk/client-s3)
- File upload endpoint: POST /songs/upload (admin only)
- Accept MP3/MP4 files, max 50MB
- Upload to Spaces, return CDN URL
- Update song.fileUrl with CDN URL
- Organize by genre: /music/{genre}/{artist}/{filename}.mp3

Admin UI:
- Song management page → "Upload Song" button
- Drag & drop file upload
- Auto-extract metadata from MP3 tags (title, artist, album, genre, duration)
- Progress bar during upload
- After upload → song appears in catalog immediately

Song Finder Bot update:
- When bot finds a song on archive.org, option to:
  a) Use archive.org URL directly (current behavior)
  b) Download and re-upload to own Spaces (for reliability)

Environment variables:
- SPACES_ENDPOINT="nyc3.digitaloceanspaces.com"
- SPACES_BUCKET="jukebox-music"
- SPACES_ACCESS_KEY="xxx"
- SPACES_SECRET_KEY="xxx"
- SPACES_CDN_URL="https://jukebox-music.nyc3.cdn.digitaloceanspaces.com"

Testing:
- [ ] File upload to Spaces works
- [ ] CDN URL streams audio correctly
- [ ] Admin can upload songs via dashboard
- [ ] Metadata auto-extracted from MP3
- [ ] Songs organized by genre in storage
- [ ] Upload size limit enforced (50MB)
- [ ] CORS configured for streaming from browser
```

---

## Execution Order

| Phase | Prompt | Description | Effort | Priority |
|-------|--------|-------------|--------|----------|
| A | 3.1 | Google OAuth Login | 2-3 days | High |
| A | 3.2 | UI Redesign (Single Screen) | 5-7 days | High |
| A | 3.4 | Favorites & Playlist Replay | 2-3 days | Medium |
| B | 3.3 | Multi-Item Cart | 3-4 days | High |
| B | 3.7 | Phone as Jukebox | 5-7 days | High |
| B | 3.8 | Volume Control | 2-3 days | Medium |
| C | 3.5 | Role Switching | 3-5 days | Medium |
| C | 3.6 | Two QR Codes | 1-2 days | Medium |
| C | 3.9 | Inline Billing/Settings | 3-4 days | Medium |
| C | 3.10 | Per-Venue Catalog | 2-3 days | Low |
| C | 3.11 | Cloud Storage Setup | 2-3 days | High |

**Total estimated: 5-7 weeks**

**Phase A (2 weeks):** Core UX improvements — Google login, single screen, favorites
**Phase B (2 weeks):** Phone jukebox, cart system, volume control
**Phase C (1-2 weeks):** Role switching, QR codes, settings, cloud storage
