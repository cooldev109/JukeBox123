# JukeBox — Testing Roadmap

> Complete guide to testing the JukeBox MVP on desktop browser and Android TV emulator.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18+ |
| **PostgreSQL** | Running on `localhost:5432`, database `jukebox1` |
| **Redis** | Running on `localhost:6379` |
| **Android Studio** | For Android TV emulator (Step 3+) |
| **Dependencies** | Already installed (`npm install` done) |
| **Database** | Already migrated and seeded |

---

## Quick Reference: IDs & Credentials

### Login Accounts (all passwords: `password123`)

| Role | Email | Name |
|------|-------|------|
| Admin | `admin@jukebox.com` | Admin JukeBox |
| Bar Owner 1 | `carlos@bar1.com` | Carlos Silva |
| Bar Owner 2 | `ana@bar2.com` | Ana Costa |

### Venue Codes (for customer entry)

| Venue | Code | Owner |
|-------|------|-------|
| Bar do Carlos | `BAR-CARLOS` | Carlos Silva |
| Boteco da Ana | `BOTECO-ANA` | Ana Costa |

### Machine UUIDs (for TV Player setup)

| Machine | UUID | Venue |
|---------|------|-------|
| JukeBox Principal | `7d461dd3-b7d3-4618-a2e6-202308776ece` | Bar do Carlos |
| JukeBox Salão | `14551bc5-f3e7-4045-9f8f-14e12e429221` | Boteco da Ana |

### Other

| Key | Value |
|-----|-------|
| Admin billing password | `admin123` |
| API server | `http://localhost:3002` |
| Web server | `http://localhost:5173` |
| Android emulator host alias | `10.0.2.2` (maps to your PC) |

---

## Step 1: Start the Servers

Open **two terminals**:

### Terminal 1 — API Server

```bash
cd e:/Workspace_2/JukeBox
npm run dev:api
```

Wait for: `Server running on port 3002`

### Terminal 2 — Web Server

```bash
cd e:/Workspace_2/JukeBox
npm run dev:web
```

Wait for: `Local: http://localhost:5173`

> The web server already binds to `0.0.0.0` (all interfaces), so it's accessible from the Android emulator without extra configuration.

---

## Step 2: Desktop Browser Testing

### 2A. Customer Flow — Landing Page

1. Open **http://localhost:5173**
2. Enter venue code: `BAR-CARLOS`
3. Optionally add your name (e.g., `Test User`)
4. Click **"Enter JukeBox"**

**Expected:** Redirects to `/browse` with the song catalog visible.

### 2B. Browse & Queue

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | View `/browse` | 10 songs load with cover art from Archive.org |
| 2 | Type "Blues" in search | Filters to "Blues Evermore" by Coleman Hawkins |
| 3 | Click a genre chip | Song list filters by that genre |
| 4 | Click a song card | Detail modal opens with song info |
| 5 | Click "Add to Queue" | Song added (or error if insufficient balance) |
| 6 | Navigate to `/queue` | Your queued song appears with position and wait time |

### 2C. Wallet & Payments

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Go to `/wallet` | Balance displays (new guest users start at 0) |
| 2 | Click a top-up amount (e.g., R$10) | Pix QR code generates (mock in dev) |
| 3 | Go to `/history` | Transaction history shows (may be empty for new users) |

### 2D. Admin Dashboard

1. Go to **http://localhost:5173** → click **"Already have an account? Login"**
2. Login: `admin@jukebox.com` / `password123`

| Page | URL | What to Verify |
|------|-----|---------------|
| Users | `/admin/users` | 22+ users listed with roles (ADMIN, BAR_OWNER, CUSTOMER) |
| Songs | `/admin/songs` | 10 songs listed; search works; try adding a new song via the form |
| Machines | `/admin/machines` | 2 machines listed with status indicators |
| Revenue | `/admin/revenue` | Enter billing password `admin123`; charts render with venue data |
| Settings | `/admin/settings` | Global config loads (song price, priority price, commission %); try saving a change |

### 2E. Bar Owner Dashboard

1. Logout from admin
2. Login as `carlos@bar1.com` / `password123`

| Page | URL | What to Verify |
|------|-----|---------------|
| Machine Status | `/owner/machine` | "JukeBox Principal" shows with status and heartbeat |
| Revenue | `/owner/revenue` | Transaction list with today/month/total calculations |
| QR Code | `/owner/qr-code` | QR code renders encoding `BAR-CARLOS`; Download saves PNG; Print opens dialog |
| Settings | `/owner/settings` | Pricing loads (R$2.00 / R$5.00); can edit and save |

---

## Step 3: Set Up Android TV Emulator

### 3A. Create the Virtual Device

1. Open **Android Studio** → **Device Manager** (or Tools → Device Manager)
2. Click **Create Virtual Device**
3. Choose category: **TV**
4. Pick **"Android TV (1080p)"** or **"Android TV (4K)"**
5. Select a system image — recommended: **API 33 or 34, x86_64**
6. Click **Finish** → **Launch** the emulator

### 3B. Find Your PC's IP Address

Run in a terminal:

```bash
ipconfig
```

Look for your **IPv4 Address** under your active adapter (e.g., `192.168.1.100`).

> **Shortcut:** The standard Android Emulator maps `10.0.2.2` to your host PC's `localhost`. Try this first.

### 3C. Verify Connectivity

In the Android TV emulator, open the **built-in browser** (or install one via Play Store) and navigate to:

```
http://10.0.2.2:5173
```

**Expected:** The JukeBox landing page loads with the Neon Party Vibes theme.

> **Troubleshooting:** If `10.0.2.2` doesn't work, use your actual PC IP: `http://192.168.x.x:5173`

---

## Step 4: Test TV Player on Android Emulator

### 4A. Open TV Player URL

In the Android TV emulator browser, go to:

```
http://10.0.2.2:5173/tv-player
```

### 4B. Login on TV Player

| Field | Value |
|-------|-------|
| Email | `carlos@bar1.com` |
| Password | `password123` |

Click **Login**.

### 4C. Enter Machine ID

After login, enter the machine UUID:

```
7d461dd3-b7d3-4618-a2e6-202308776ece
```

Click **"Start Player"**.

### 4D. Verify TV Player Display

| Element | Expected |
|---------|----------|
| Idle screen | "JukeBox" title with neon green glow |
| Venue name | "Bar do Carlos" displayed below title |
| Instruction text | "Scan the QR code to add songs!" |
| Connection dot | Green dot (top-right) = WebSocket connected |
| QR code box | White box in bottom-right corner |
| Top bar | "JukeBox | Bar do Carlos" with connection indicator |

### 4E. Test Real-Time Queue (Desktop → TV)

This is the **core feature** — songs added from a customer's phone appear on the TV in real-time.

1. **Keep the TV Player open** on the Android emulator
2. On your **desktop browser**, open a new tab: `http://localhost:5173`
3. Enter venue code: `BAR-CARLOS`
4. Go to **Browse** → pick a song → click **"Add to Queue"**
5. **Watch the Android emulator** — the song should appear on the TV Player via WebSocket

**Expected behavior:**
- Song info appears (title, artist, album art)
- Audio begins playing (from Archive.org MP3)
- Audio visualizer animates
- Progress bar shows at the bottom
- "Requested by" shows the customer name

### 4F. Test TV Player Controls

| Action | How | Expected |
|--------|-----|----------|
| D-pad navigation | Arrow keys on emulator | Navigate UI elements |
| Fullscreen | Click/tap anywhere on the player | Requests fullscreen mode |
| Queue panel | Should show if enabled in machine config | "Up Next" panel on the right side |
| Song transition | Wait for song to end or add multiple | Next song auto-plays with smooth transition |
| Idle return | Let queue empty out | Returns to idle screen with JukeBox branding |

---

## Step 5: End-to-End Flow — The Money Flow

This tests the complete business workflow: customer pays → song plays on TV.

### Setup

- **Android emulator**: TV Player running (Step 4)
- **Desktop browser**: Open `http://localhost:5173`

### Flow

| # | Where | Action | Expected |
|---|-------|--------|----------|
| 1 | Desktop | Enter venue code `BAR-CARLOS` | Enters as guest customer |
| 2 | Desktop | Go to `/wallet` | Shows balance (R$0.00 for new user) |
| 3 | Desktop | Click top-up amount (e.g., R$20) | Pix QR code generates |
| 4 | Desktop | Go to `/browse` | Song catalog displays |
| 5 | Desktop | Select a song → "Add to Queue" | Song added to machine queue |
| 6 | TV Emulator | **Watch** | Song appears → audio plays → visualizer active |
| 7 | Desktop | Add 2-3 more songs | Queue builds up on TV |
| 8 | TV Emulator | **Watch** | Songs play in order; "Up Next" shows queue |
| 9 | Desktop | Add a VIP/priority song | Should jump ahead in queue |
| 10 | TV Emulator | **Watch** | Priority song plays next; queue reorders |

### After the Flow

- Check `/wallet` — balance should have decreased
- Check `/history` — transactions logged
- Check `/queue` — shows current queue state
- On Bar Owner login → `/owner/revenue` — transactions visible

---

## Step 6: Edge Cases & Error Handling

| Test | Steps | Expected Result |
|------|-------|----------------|
| Invalid venue code | Enter `FAKE-CODE` on landing page | Error: "Invalid venue code" |
| Wrong password | Login with wrong password | Error: "Login failed" |
| Empty queue on TV | TV Player with no songs queued | Idle mode: logo + "Scan QR" message |
| Multiple songs | Add 4-5 songs rapidly | All appear in queue in order |
| Insufficient balance | Try adding song with R$0 balance | Error message about insufficient funds |
| Duplicate song | Add same song twice | Should allow (same song can be in queue multiple times) |
| Song search edge cases | Search with special chars, empty string | Should not crash; returns filtered or all results |
| TV Player disconnect | Stop the API server while TV Player is running | Green dot turns red (disconnected) |
| TV Player reconnect | Restart the API server | Should auto-reconnect; green dot returns |
| Browser refresh on TV | Refresh the TV Player page | Should restore state from localStorage |

---

## Step 7: Cross-Role Verification

Verify that each role only sees what they should:

| As | Can Access | Cannot Access |
|----|-----------|---------------|
| Guest Customer | `/browse`, `/queue`, `/wallet`, `/history`, `/profile` | `/admin/*`, `/owner/*` |
| Bar Owner | `/owner/*` pages | `/admin/*` pages |
| Admin | `/admin/*` pages | — (full access) |

### How to Test

1. Login as customer → try navigating to `http://localhost:5173/admin` → should redirect
2. Login as bar owner → try navigating to `/admin` → should redirect
3. Login as admin → all pages accessible

---

## Step 8: Android TV-Specific Tests

These tests are specific to the TV environment:

| Test | What to Check |
|------|--------------|
| **Screen resolution** | UI renders correctly at 1080p TV resolution |
| **Font readability** | Text is readable from "across the room" (large fonts on TV) |
| **D-pad navigation** | All interactive elements reachable with arrow keys + Enter |
| **No mouse cursor** | UI doesn't require mouse hover for essential features |
| **Fullscreen** | Player fills entire screen, no browser chrome visible |
| **Long-running** | Leave TV Player idle for 10+ minutes — should stay connected (heartbeat) |
| **Audio playback** | Songs play through the emulator's audio output |
| **Album art** | Cover images from Archive.org load correctly |
| **Animations** | Visualizer and transitions run smoothly (60fps target) |
| **Auto-play policy** | Click/tap the player once to unlock audio autoplay |

---

## Seeded Test Data Summary

The database comes pre-loaded with:

| Data | Count | Notes |
|------|-------|-------|
| Users | 22 | 1 admin, 2 bar owners, 3 named customers + guests |
| Venues | 2 | Bar do Carlos, Boteco da Ana |
| Machines | 2 | One per venue |
| Songs | 10 | Real CC0 MP3s from Archive.org (playable) |
| Wallets | 3 | Customers with R$10-50 balance |
| Queue Items | 23 | All SKIPPED status (from previous testing) |
| Transactions | 4 | Sample completed payments |
| Playlists | 1 | "Minhas Favoritas" for customer 1 |
| Global Config | 2 | Default pricing + feature toggles |

### Song List

| Title | Artist | Genre |
|-------|--------|-------|
| Defining Moment | Donnie Sands | Acoustic |
| Hero | Donnie Sands | Pop |
| The Perfect Storm | Donnie Sands | Rock |
| Bad Parenting | Trench Party | Indie |
| Job 33 Remix | elperfecto.com | Electronic |
| Frecuencias | Malaventura | Electronic |
| La Cruz | Malaventura | Electronic |
| Aldous | Stig Sneddon | Rock |
| Four More Years | Stig Sneddon | Rock |
| Blues Evermore | Coleman Hawkins | Jazz |

> All songs are CC0/Public Domain from Archive.org — real playable MP3s with cover art.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| API won't start | Check PostgreSQL is running: `pg_isready -h localhost` |
| Redis connection error | Start Redis: `redis-server` |
| Web page blank | Check terminal for Vite errors; try `npm run dev:web` again |
| Can't reach from emulator | Use `10.0.2.2` (Android emulator) or your PC's actual IP |
| Audio won't play on TV | Click/tap the player once to unlock browser autoplay policy |
| Songs don't load (network error) | Archive.org URLs require internet; check emulator has connectivity |
| TV Player shows red dot | API server not running or WebSocket proxy not working |
| Login fails | Verify credentials; check API terminal for errors |
| "Invalid venue code" | Use exactly `BAR-CARLOS` or `BOTECO-ANA` (case-sensitive) |
| Port 5173 in use | Kill the process: `npx kill-port 5173` |
| Port 3002 in use | Kill the process: `npx kill-port 3002` |
| Database connection failed | Verify `.env` in `apps/api/`: `DATABASE_URL=postgresql://postgres:future@localhost:5432/jukebox1` |

---

## Re-seeding the Database

If you need a fresh start:

```bash
cd e:/Workspace_2/JukeBox
npm run db:seed
```

> **Warning:** This deletes all existing data and recreates the seed data. Machine UUIDs will change — you'll need to look up the new ones.
