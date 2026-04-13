# JukeBox Testing Guide

Complete test procedure for the JukeBox platform at **https://jukjoy.com**.

## Before Testing

Deploy latest code on VPS:
```bash
cd /root/JukeBox && git pull && cd apps/api && npx prisma db push && npm run build && cd ../web && npm run build && pm2 restart jukebox-api
```

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@jukebox.com | password123 |
| Bar Owner 1 | carlos@bar1.com | password123 |
| Bar Owner 2 | ana@bar2.com | password123 |
| Customer | joao@test.com | password123 |
| Employee | lucas@jukebox.com | password123 |
| Affiliate | rafael@promo.com | password123 |

---

## PART 1 — Public Access & Language

### Test 1.1 — Homepage without login
1. Open **https://jukjoy.com** in browser (or incognito)
2. Verify: Browse page loads immediately (no login wall)
3. See: JukeBox logo (top-left), Language toggle + Login button (top-right)
4. See: Search bar, genre filters, song grid, special products section
5. **✅ Pass** — No login required

### Test 1.2 — Language Toggle
1. On homepage, click the **🇺🇸 EN** button top-right
2. It switches to **🇧🇷 PT** (Portuguese flag)
3. Page text changes to Portuguese:
   - "Login / Register" → "Entrar / Cadastrar"
   - "Special Features" → "Recursos Especiais"
   - "Request a Song" → "Pedir uma Música"
4. Click again → switches back to EN
5. Refresh page → language preference is remembered

### Test 1.3 — Browse songs without login
1. On homepage, scroll through song list (10 songs)
2. Click any song → modal opens with song details
3. Click "Tap to preview" → audio preview plays
4. Close modal → no errors

---

## PART 2 — Customer Journey (Full Flow)

### Test 2.1 — Login
1. Click **Login / Register** button top-right
2. Login page opens (with Google Sign-In button if configured)
3. Enter `joao@test.com` / `password123` → click "Enter JukeBox"
4. Redirected to homepage, now shows user avatar top-right

### Test 2.2 — Search Songs
1. Type "Hero" in search bar
2. Only "Hero" by Donnie Sands appears
3. Clear search → all 10 songs return
4. Click **Rock** genre filter → only Rock songs show
5. Click **All** → all songs return

### Test 2.3 — Song Request
1. Scroll down to "Request a Song" section
2. Click it → modal opens
3. Enter: Title "Evidencias", Artist "Chitãozinho e Xororó"
4. Click "Send Request"
5. Success message appears → modal closes

### Test 2.4 — Song Finder Bot
1. Click the pink **music note floating button** (bottom-right)
2. Chat modal opens
3. Type "blues" → press Enter
4. Bot shows results from Internet Archive
5. Click "+ Add" on a song → it's added to catalog

### Test 2.5 — Connect to Venue
1. Click any song → payment modal opens
2. Click "Add to Queue" → venue connection modal appears
3. Enter **BAR-CARLOS** → click Connect
4. Modal closes, now connected

### Test 2.6 — Top Up Wallet with Pix (Sandbox)
1. Click **Wallet** tab in bottom nav
2. Click "Top Up Credits"
3. Select **Pix** payment method
4. Click **R$ 5** button
5. QR code + copia-e-cola appear
6. Click **"[SANDBOX] Simulate Payment"**
7. Balance updates to show +R$ 5

### Test 2.7 — Pay with Wallet
1. Go back to **Browse** tab
2. Click any song
3. Select **Wallet** payment method
4. Click "Add to Queue — R$ 2.00"
5. Success animation → song added to queue
6. Wallet balance decreases by R$ 2.00

### Test 2.8 — Pay with Card (Stripe Test)
1. Click another song
2. Select **Card** payment method
3. Click "Add to Queue — R$ 2.00"
4. Stripe payment form appears
5. Enter test card: **4242 4242 4242 4242**
6. Expiry: **12/30**, CVC: **123**, ZIP: **12345**
7. Click "Pay R$ 2.00"
8. Success → song added to queue
9. Verify in admin: transaction status is COMPLETED

**Stripe test cards for different scenarios:**
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- Insufficient funds: `4000 0000 0000 9995`
- 3D Secure: `4000 0025 0000 3155`
- Expired card: `4000 0000 0000 0069`

### Test 2.9 — View Queue
1. Click **Queue** tab in bottom nav
2. See both songs you paid for
3. First song should show as "Playing" or position 1

### Test 2.10 — Special Events
1. Click **Special** tab in bottom nav
2. See grid: Skip Queue, Silence, Text Message, Voice Message, Photo, Reactions, Birthday
3. Click **Text Message** → modal opens
4. Type a message → click Send
5. Payment deducted from wallet

### Test 2.11 — Voice Message (Media Capture)
1. In Special Events, click **Voice Message**
2. Modal opens with "Choose from Gallery" and "Take Photo" buttons
3. Click "Choose from Gallery" → select an audio file from phone
4. Preview plays → click "Send"
5. Payment deducted, event sent to bar owner for approval

### Test 2.12 — Profile Page
1. Click **Profile** tab
2. See name, balance, role
3. Click "My Wallet" → goes to wallet page
4. Click "Song History" → goes to history page
5. Click "Logout" → redirects to homepage, user logged out

---

## PART 3 — Bar Owner Flow

### Test 3.1 — Bar Owner Login
1. Login as `carlos@bar1.com` / `password123`
2. Owner dashboard loads with tabs: Machine, Alerts, Revenue, QR Code, Settings

### Test 3.2 — Machine Status
1. Click **Machine** tab
2. See "JukeBox Principal" with status ONLINE
3. Queue Size shows current queue count
4. Click "Open TV Player" → TV Player opens in new tab

### Test 3.3 — Approve Special Event
1. Click **Alerts** tab
2. See pending events (voice messages, photos from customers)
3. Click **Approve** on a voice message
4. Event status changes to APPROVED

### Test 3.4 — Revenue
1. Click **Revenue** tab
2. See revenue summary for your venue only
3. See transaction history

### Test 3.5 — QR Code
1. Click **QR Code** tab
2. See QR code for BAR-CARLOS
3. Click Download → QR downloads as PNG
4. Click Print → print dialog

### Test 3.6 — Settings
1. Click **Settings** tab
2. Change song price from R$ 2 to R$ 3
3. Save → verify price changed

---

## PART 4 — Admin Flow

### Test 4.1 — Admin Login
1. Login as `admin@jukebox.com` / `password123`
2. Admin dashboard loads with sidebar menu

### Test 4.2 — Machines
1. Click **Machines** → see both machines
2. Click a machine → detail page

### Test 4.3 — Venues
1. Click **Venues** → see both venues
2. Click Bar do Carlos → detail page with owner info, commission split, Pix key

### Test 4.4 — Music Catalog Upload
1. Click **Music Catalog**
2. Click **📤 Upload MP3** button (purple)
3. Click to select an MP3 file from computer
4. Fill in title, artist, album, genre
5. Click Upload Song → progress bar
6. Song appears in catalog
7. Go to customer Browse page → new song visible

### Test 4.5 — Revenue
1. Click **Revenue** → see all transactions from all venues
2. Export CSV if needed

### Test 4.6 — Users
1. Click **Users** → see all user accounts
2. Filter by role

### Test 4.7 — Products
1. Click **Products** → see all configurable products
2. Change price on one → save

### Test 4.8 — Settings
1. Click **Settings** → see global pricing
2. Change default song price

---

## PART 5 — TV Player

### Test 5.1 — Open TV Player
1. In new browser tab: **https://jukjoy.com/tv-player**
2. Login as bar owner
3. Select machine → TV Player loads
4. QR code visible in corner

### Test 5.2 — Music Playback
1. If queue has songs → music starts playing automatically
2. Now Playing shows song title, artist, progress bar
3. Wait for song to finish → next song auto-advances

### Test 5.3 — Real-time Queue Update
1. Keep TV Player open
2. On phone/another tab, add a song (pay)
3. Verify song appears in TV Player queue immediately

---

## PART 6 — Employee & Affiliate

### Test 6.1 — Employee Login
1. Login as `lucas@jukebox.com` / `password123`
2. Employee dashboard (region: São Paulo)
3. Verify: Only sees venues in São Paulo region

### Test 6.2 — Affiliate Login
1. Login as `rafael@promo.com` / `password123`
2. Affiliate dashboard with personal QR code
3. See commission history (from seed data)

---

## PART 7 — Error Handling

| # | Test | Expected |
|---|------|----------|
| 7.1 | Invalid venue code `FAKE-BAR` | "Venue not found" error |
| 7.2 | Wrong password | "Invalid credentials" |
| 7.3 | Customer tries `/admin` URL | Redirected to home |
| 7.4 | Pay with empty wallet | Error or prompt to top up |
| 7.5 | Generate Pix → don't pay → wait 5min | Status becomes "Expired" |

---

## PART 8 — Quick Smoke Test (5 min)

If short on time, run these 5 tests:

1. ✅ Open https://jukjoy.com → songs visible
2. ✅ Toggle language (EN ↔ PT)
3. ✅ Login as customer → connect to BAR-CARLOS
4. ✅ Pay for a song (sandbox Pix or card)
5. ✅ Open TV Player → song plays

---

## Results Checklist

| Part | Status |
|------|--------|
| 1. Public Access & Language | ☐ |
| 2. Customer Journey | ☐ |
| 3. Bar Owner Flow | ☐ |
| 4. Admin Flow | ☐ |
| 5. TV Player | ☐ |
| 6. Employee & Affiliate | ☐ |
| 7. Error Handling | ☐ |

---

## Notes

- **Pix payments**: Currently in sandbox mode on jukjoy.com. Use the "[SANDBOX] Simulate Payment" button instead of real payment.
- **Stripe card payments**: Configured with test keys. Use test card numbers above — no real money charged.
- **Google OAuth**: Requires `VITE_GOOGLE_CLIENT_ID` in `apps/web/.env` to show the Google Sign-In button.
- **YouTube download**: Requires `yt-dlp` installed on VPS and `YOUTUBE_API_KEY` env var for best results.
- **Spotify metadata**: Requires `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` env vars.
