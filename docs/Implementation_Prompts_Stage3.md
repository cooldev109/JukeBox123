# Stage 3 — Client Requirements: Full Admin Control & Revenue System

> These prompts extend Stage 2. Each prompt is self-contained and can be implemented sequentially.
> All changes are additive (migrations, new routes, new pages) — no breaking changes.

---

## Prompt 10.1 — Full Admin CRUD (Users, Venues, Machines)

**Goal:** Admin can create, edit, and deactivate any user, venue, or machine from the dashboard. Everything is editable.

### Backend (`apps/api`)

**1. User Management Routes** — `src/routes/auth.ts`
- `PUT /auth/users/:id` — Admin edits any user (name, email, phone, role, regionAccess, referralCode). Validate email uniqueness.
- `DELETE /auth/users/:id` — Soft-delete: set `isActive: false`. Prevent deleting self.
- `POST /auth/users` — Admin creates user with any role (move from register, admin-only). Auto-generate referralCode for AFFILIATE, require regionAccess for EMPLOYEE.
- Add `isActive Boolean @default(true)` to User model in schema.prisma.

**2. Venue Management** — `src/routes/venues.ts`
- `DELETE /venues/:id` — Soft-delete: set status to `DEACTIVATED`. Cascade: set all machines to OFFLINE.
- `PUT /venues/:id/owner` — Admin reassigns venue to different BAR_OWNER.

**3. Machine Management** — `src/routes/machines.ts`
- `DELETE /machines/:id` — Soft-delete: set status to `DEACTIVATED`.
- `POST /machines/:id/reassign` — Move machine to different venue.

### Frontend (`apps/web`)

**4. Admin Users Page** — `src/pages/admin/AdminUsersPage.tsx`
- Full CRUD table with search, filter by role.
- Inline edit modal: name, email, phone, role, regionAccess, referralCode.
- Create user modal with role selector.
- Deactivate button with confirmation.

**5. Admin Venues Page** — `src/pages/admin/AdminVenuesPage.tsx`
- Search by venue name, bar owner name, city, state, country.
- Edit modal: all venue fields + owner reassignment.
- Deactivate button.

**6. Admin Machines Page** — `src/pages/admin/AdminMachinesPage.tsx`
- List all machines with venue, status, last heartbeat.
- Click machine → detail view (NOT black screen — show config, status, queue, revenue).
- Edit modal: name, config, reassign to different venue.
- Deactivate button.

### Tests
- User CRUD: create, edit, deactivate, prevent self-delete, email uniqueness.
- Venue: reassign owner, deactivate cascades machines.
- Machine: reassign venue, deactivate.

---

## Prompt 10.2 — Multi-Party Commission Split System

**Goal:** Revenue is split between Admin (platform), Bar Owner, Affiliate, and Operator (Employee). All percentages are editable per venue. The split must be transparent and auditable.

### Database (`apps/api/prisma/schema.prisma`)

**1. RevenueSplit model (NEW)**
```prisma
model RevenueSplit {
  id            String   @id @default(uuid())
  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  venueId       String
  venue         Venue    @relation(fields: [venueId], references: [id])

  totalAmount   Float
  platformAmount  Float    // Admin's cut
  platformPercent Float
  venueAmount     Float    // Bar Owner's cut
  venuePercent    Float
  affiliateAmount Float    // Affiliate's cut (0 if no affiliate)
  affiliatePercent Float
  operatorAmount  Float    // Employee/Operator's cut
  operatorPercent  Float

  affiliateId   String?
  affiliate     User?    @relation("AffiliateSplits", fields: [affiliateId], references: [id])
  operatorId    String?
  operator      User?    @relation("OperatorSplits", fields: [operatorId], references: [id])

  createdAt     DateTime @default(now())
}
```

**2. Venue Settings — Commission Config**
Add to venue `settings` JSON:
```json
{
  "commissionSplit": {
    "platformPercent": 30,
    "venuePercent": 30,
    "affiliatePercent": 35,
    "operatorPercent": 5
  }
}
```
Must always sum to 100%. Validate on save.

**3. Default Commission Config**
Add to `globalConfig` key `defaultCommissionSplit`:
```json
{
  "platformPercent": 30,
  "venuePercent": 30,
  "affiliatePercent": 35,
  "operatorPercent": 5
}
```

### Backend

**4. Split Service** — `src/services/revenueSplit.ts`
- `createSplit(transactionId, venueId)` — Called after every successful payment. Reads venue commission config (or global default). Finds active affiliate for venue. Finds assigned operator. Creates RevenueSplit record.
- `getVenueSplitConfig(venueId)` — Returns merged config (venue override > global default).

**5. Commission Config Routes** — `src/routes/config.ts`
- `GET /config/commission-split` — Get global default split.
- `PUT /config/commission-split` — Admin updates global default. Validate sum = 100%.
- `GET /venues/:id/commission-split` — Get venue-specific split (or default).
- `PUT /venues/:id/commission-split` — Admin updates venue-specific split. Validate sum = 100%.

**6. Integrate into Payment Flow** — `src/routes/payments.ts` and `src/routes/events.ts`
- After every successful transaction (song payment, top-up, special event), call `createSplit()`.

### Frontend

**7. Commission Config UI** — in AdminSettingsPage and venue edit modal
- Four sliders/inputs: Platform %, Venue %, Affiliate %, Operator %.
- Real-time sum display (must show 100%).
- Save validates sum = 100% before submitting.

**8. Split Breakdown** — in revenue pages
- Each transaction shows split breakdown (who gets what).
- Filter by party (platform, venue, affiliate, operator).

### Tests
- Split creation with all 4 parties.
- Split with no affiliate (affiliate share goes to platform).
- Split with no operator (operator share goes to platform).
- Validation: reject splits that don't sum to 100%.
- Venue override vs global default.

---

## Prompt 10.3 — Hierarchical Music Catalog (Folder Structure)

**Goal:** Songs organized as: **Catalog > Genre > Artist/Band > Album > Song**. Like folders in Windows. Support importing entire folder structures and remote sync to hardware devices.

### Database

**1. New Models**
```prisma
model Genre {
  id          String   @id @default(uuid())
  name        String   @unique
  coverArtUrl String?
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  artists     Artist[]
  createdAt   DateTime @default(now())
}

model Artist {
  id          String   @id @default(uuid())
  name        String
  genreId     String
  genre       Genre    @relation(fields: [genreId], references: [id])
  coverArtUrl String?
  isActive    Boolean  @default(true)
  albums      Album[]
  createdAt   DateTime @default(now())

  @@unique([name, genreId])
}

model Album {
  id          String   @id @default(uuid())
  name        String
  artistId    String
  artist      Artist   @relation(fields: [artistId], references: [id])
  coverArtUrl String?
  year        Int?
  isActive    Boolean  @default(true)
  songs       Song[]
  createdAt   DateTime @default(now())

  @@unique([name, artistId])
}
```

**2. Update Song model**
- Add `albumId String?` + relation to Album.
- Add `trackNumber Int?` for ordering within album.
- Keep existing `genre`, `artist`, `album` strings for backward compatibility + search.

### Backend

**3. Catalog Browse Routes** — `src/routes/catalog.ts` (extend existing)
- `GET /catalog/genres` — List all genres (with artist count).
- `GET /catalog/genres/:id/artists` — List artists in genre.
- `GET /catalog/artists/:id/albums` — List albums by artist.
- `GET /catalog/albums/:id/songs` — List songs in album.
- `POST /catalog/genres` — Admin creates genre.
- `POST /catalog/artists` — Admin creates artist under genre.
- `POST /catalog/albums` — Admin creates album under artist.
- `PUT /catalog/genres/:id`, `PUT /catalog/artists/:id`, `PUT /catalog/albums/:id` — Admin edits.
- `DELETE /catalog/genres/:id` etc. — Soft delete (isActive=false).

**4. Batch Import** — `POST /catalog/batch-import`
- Accepts a folder structure as JSON:
```json
{
  "genre": "Rock",
  "artist": "Band Name",
  "album": "Album Name",
  "coverArtUrl": "https://...",
  "songs": [
    { "title": "Song 1", "trackNumber": 1, "fileUrl": "...", "duration": 200, "fileSize": 5000000 }
  ]
}
```
- Auto-creates Genre, Artist, Album if they don't exist.
- Skips duplicate songs (by title + artist).

**5. Bulk Upload Endpoint** — `POST /catalog/upload-folder`
- Accepts multipart form with MP3/MP4 files.
- Reads ID3 tags (via `music-metadata` package) to extract genre, artist, album, title, duration.
- Auto-creates hierarchy.
- Stores files locally or uploads to S3.

**6. Remote Sync API** — `POST /catalog/sync`
- For Android TV / Raspberry Pi hardware devices.
- Returns a manifest of all songs with URLs, organized by genre > artist > album.
- Supports `since` parameter for incremental sync (only new/changed songs since timestamp).
- Device downloads files from URLs for offline playback.

### Frontend

**7. Admin Catalog Page** — `src/pages/admin/AdminCatalogPage.tsx`
- Folder-tree navigation: Genre list → click → Artist list → click → Album list → click → Song list.
- Breadcrumb: `Catalog / Rock / Metallica / Master of Puppets`.
- Each level shows cover art, count of children, action buttons (edit, add child, delete).
- "Import Folder" button: upload a ZIP or JSON structure.
- Drag-and-drop MP3 upload that auto-reads tags.

**8. Customer Browse Update** — `src/pages/BrowsePage.tsx`
- Replace flat song list with genre grid on first screen.
- Tap genre → artist grid → tap artist → album grid → tap album → song list.
- Keep search bar for quick lookup across all levels.
- "All Songs" quick-access button for flat list view.

### Tests
- CRUD for Genre, Artist, Album.
- Batch import creates full hierarchy.
- Duplicate prevention at each level.
- Customer browse navigation through hierarchy.
- Sync manifest generation.

---

## Prompt 10.4 — Advanced Revenue Dashboard & Reporting

**Goal:** Revenue is trackable by every dimension: client, venue, city, state, country, period, product type, party. Each role sees only their relevant data. Password-protected admin revenue.

### Backend

**1. Revenue Analytics Routes** — `src/routes/revenue.ts` (NEW)
- `GET /revenue/admin` — Admin dashboard totals. Query params:
  - `venueId` — filter by venue
  - `city`, `state`, `country` — location filters
  - `startDate`, `endDate` — date range
  - `type` — transaction type (SONG_PAYMENT, SKIP_QUEUE, SILENCE, etc.)
  - `groupBy` — day, week, month, venue, city, type
  - Returns: totals, splits breakdown, charts data.

- `GET /revenue/admin/export` — CSV/Excel export with all filters.

- `GET /revenue/venue/:id` — Bar Owner revenue for their venue.
  - Same date range and type filters.
  - Shows their cut only.

- `GET /revenue/affiliate` — Affiliate sees their commissions.
  - Filter by venue, period, status (pending/paid).
  - Shows earned, pending, paid totals.

- `GET /revenue/operator` — Employee/Operator sees their cut.
  - Filter by venue (assigned venues), period.

**2. Revenue Password** — `src/middleware/revenueAuth.ts`
- Admin revenue endpoints require secondary password.
- `POST /revenue/auth` — Verify revenue password, return short-lived revenue token (15 min).
- Revenue password stored in GlobalConfig (hashed), changeable by admin.
- All `/revenue/admin/*` endpoints require revenue token in header.

**3. Payout Management** — `src/routes/payouts.ts` (NEW)
- `GET /payouts/pending` — Admin sees all pending payouts (grouped by recipient).
- `POST /payouts/:id/mark-paid` — Admin marks a split/commission as paid.
- `POST /payouts/batch-pay` — Mark multiple as paid (with payment reference).
- `GET /payouts/history` — Payout history with filters.

### Frontend

**4. Admin Revenue Page** — `src/pages/admin/AdminRevenuePage.tsx` (rewrite)
- Password gate on entry (modal asking for revenue password).
- Dashboard cards: Total Revenue, Platform Cut, Venue Cuts, Affiliate Cuts, Operator Cuts.
- Filters bar: date range picker, venue selector, city/state dropdowns, product type selector.
- Charts: Revenue over time (line), Revenue by venue (bar), Revenue by product (pie), Split breakdown (stacked bar).
- Table: Transaction-level detail with split breakdown.
- Export button (CSV).

**5. Bar Owner Revenue** — `src/pages/owner/OwnerRevenuePage.tsx` (enhance)
- Date range filter.
- Revenue by product type breakdown.
- Transaction history with their cut shown.
- Daily/weekly/monthly summary toggle.

**6. Affiliate Revenue** — `src/pages/affiliate/AffiliateRevenuePage.tsx` (enhance)
- Earnings dashboard: earned, pending, paid.
- Filter by venue, date range.
- Commission history table.
- Payout status tracking.

**7. Operator Revenue** — `src/pages/employee/EmployeeRevenuePage.tsx` (NEW)
- Shows operator's cut from assigned venues.
- Filter by venue, date range.
- Summary cards + transaction list.

### Tests
- Revenue filtering by all dimensions.
- Revenue password authentication.
- Role-based data isolation.
- Split amounts match commission config.
- Export generates valid CSV.
- Payout workflow: pending → paid.

---

## Prompt 10.5 — Flexible Product Pricing & Combos

**Goal:** Every product/event has a price that is fully editable per venue. Support combos (bundles). Prices for silence are time-based with custom durations. Everything must be configurable for maximum profitability.

### Database

**1. Product model (NEW)**
```prisma
model Product {
  id          String   @id @default(uuid())
  code        String   @unique  // e.g. "SONG", "PRIORITY_SONG", "SKIP_QUEUE", "SILENCE_15S", "MEME", "SELFIE"
  name        String            // Display name
  description String?
  category    String            // "MUSIC", "SPECIAL_EVENT", "COMBO"
  basePrice   Float             // Default price (admin-set)
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  metadata    Json     @default("{}")  // Extra config like duration, includes, etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  venuePrices VenueProductPrice[]
  comboItems  ComboItem[]       @relation("ComboProducts")
  inCombos    ComboItem[]       @relation("IncludedInCombo")
}

model VenueProductPrice {
  id        String  @id @default(uuid())
  venueId   String
  venue     Venue   @relation(fields: [venueId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  price     Float
  isActive  Boolean @default(true)

  @@unique([venueId, productId])
}

model ComboItem {
  id        String  @id @default(uuid())
  comboId   String
  combo     Product @relation("ComboProducts", fields: [comboId], references: [id])
  productId String
  product   Product @relation("IncludedInCombo", fields: [productId], references: [id])
  quantity  Int     @default(1)
}
```

**2. Seed Default Products**
```
SONG            - Music / R$1.20
PRIORITY_SONG   - Music / R$2.00
SKIP_QUEUE      - Special Event / R$2.00
SILENCE_15S     - Special Event / R$1.00 (metadata: {durationSeconds: 15})
SILENCE_30S     - Special Event / R$2.00 (metadata: {durationSeconds: 30})
SILENCE_60S     - Special Event / R$5.00 (metadata: {durationSeconds: 60})
SILENCE_CUSTOM  - Special Event / R$0.10/sec (metadata: {perSecond: true, pricePerSecond: 0.10})
TEXT_MESSAGE    - Special Event / R$1.00
VOICE_MESSAGE   - Special Event / R$3.00
PHOTO           - Special Event / R$2.00
MEME            - Special Event / R$1.00
REACTION        - Special Event / R$0.50
BIRTHDAY        - Special Event / R$15.00
SELFIE          - Special Event / R$2.00

COMBO_BIRTHDAY_DELUXE - Combo / R$25.00 (includes: BIRTHDAY + SILENCE_60S + PHOTO + TEXT_MESSAGE)
COMBO_SELFIE_MEME     - Combo / R$3.50 (includes: SELFIE + MEME)
```

### Backend

**3. Product CRUD Routes** — `src/routes/products.ts` (NEW)
- `GET /products` — List all products (public, for customer UI).
- `GET /products/venue/:venueId` — Products with venue-specific pricing.
- `POST /products` — Admin creates product.
- `PUT /products/:id` — Admin edits product (name, price, metadata, active).
- `DELETE /products/:id` — Admin deactivates product.
- `POST /products/:id/combo-items` — Admin adds product to combo.
- `DELETE /products/:id/combo-items/:itemId` — Admin removes from combo.

**4. Venue Pricing Routes** — `src/routes/products.ts`
- `GET /products/venue/:venueId/prices` — Get all venue-specific prices.
- `PUT /products/venue/:venueId/prices` — Batch update venue prices.
  ```json
  { "prices": [{ "productId": "...", "price": 1.50, "isActive": true }] }
  ```
- If venue has no override, product.basePrice is used.

**5. Pricing Resolution Service** — `src/services/pricing.ts`
- `getPrice(productCode, venueId)` — Returns venue price if set, else basePrice.
- `getComboContents(comboProductId)` — Returns included products.
- `validateCombo(comboProductId)` — Ensure all included products exist and are active.

**6. Update Payment/Event flows**
- Replace hardcoded prices with `getPrice()` calls.
- Combo purchase: one transaction, one charge, creates multiple events.

### Frontend

**7. Admin Products Page** — `src/pages/admin/AdminProductsPage.tsx` (NEW)
- Table of all products grouped by category.
- Edit modal: name, base price, description, active toggle.
- Combo builder: select products to include, set combo price.
- Create new product form.

**8. Venue Pricing Page** — in venue settings
- Table of all products with: Base Price | Venue Price (editable) | Active toggle.
- Empty venue price field = uses base price (shown grayed out).
- Save all button.

**9. Customer Special Events Update**
- Fetch products from API instead of hardcoded config.
- Show combos prominently ("Save 30%!" badges).
- Silence: show duration/price options as configurable.
- Dynamically render available events based on venue's active products.

### Tests
- Product CRUD.
- Venue price override vs base price.
- Combo purchase creates all included events.
- Price validation (no negative prices).
- Venue can disable products individually.

---

## Prompt 10.6 — Location-Based Content & Regional Catalog

**Goal:** Each venue/region has different music preferences. Songs can be tagged by region. Venues see catalog filtered by their region. Admins can assign catalog subsets to regions.

### Database

**1. Region model (NEW)**
```prisma
model Region {
  id        String   @id @default(uuid())
  code      String   @unique  // "SP", "RJ", "MG", "BR-NE", etc.
  name      String            // "São Paulo", "Rio de Janeiro"
  country   String   @default("BR")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}

model RegionCatalog {
  id        String  @id @default(uuid())
  regionId  String
  genreId   String?  // If set, entire genre available in region
  artistId  String?  // If set, specific artist available
  songId    String?  // If set, specific song available
  priority  Int     @default(0)  // Higher = shown first

  @@unique([regionId, genreId, artistId, songId])
}
```

**2. Update Venue** — add `regionId String?` relation to Region.

### Backend

**3. Region Management** — `src/routes/regions.ts` (NEW)
- `GET /regions` — List all regions.
- `POST /regions` — Admin creates region.
- `PUT /regions/:id` — Admin edits region.
- `POST /regions/:id/catalog` — Admin assigns genres/artists/songs to region.
- `DELETE /regions/:id/catalog/:entryId` — Remove from region catalog.
- `GET /regions/:id/catalog` — Get region's catalog assignments.

**4. Update Song Browse** — `src/routes/songs.ts`
- `GET /songs` now accepts `regionId` or `venueId` parameter.
- If venueId provided → look up venue's region → filter songs by region catalog.
- If no region catalog entries exist for region, show all songs (fallback).

**5. Auto-Assign Venue Region**
- When venue is created with city/state, auto-assign matching region.
- Admin can manually override.

### Frontend

**6. Admin Regions Page** — `src/pages/admin/AdminRegionsPage.tsx` (NEW)
- List regions with venue count, catalog size.
- Edit region: assign genres, artists, individual songs.
- Drag-and-drop interface or multi-select.

**7. Customer Browse Update**
- Song catalog auto-filtered by venue's region.
- "Regional Hits" section at top.
- All songs still searchable (region just affects default view).

### Tests
- Region CRUD.
- Catalog assignment and retrieval.
- Song filtering by region.
- Fallback when no region catalog exists.

---

## Prompt 10.7 — Venue Interior Dashboard (Inside the Bar)

**Goal:** When you click a venue/machine in admin, see a rich interior view — NOT a black screen. Each venue has its own mini-dashboard showing music, revenue, values, and settings.

### Frontend

**1. Venue Detail Page** — `src/pages/admin/AdminVenueDetailPage.tsx` (NEW)
- Route: `/admin/venues/:id`
- **4 tabs** matching client requirements:

**Tab 1: Music (Musicas)**
- Current queue (live via WebSocket).
- Now playing with cover art and progress.
- Song history (last 50 played).
- Most played songs at this venue.
- Regional catalog assignment indicator.

**Tab 2: Revenue (Receita Local)**
- Revenue summary for this venue only.
- Charts: daily revenue, revenue by product type.
- Transaction list with filters.
- Commission split breakdown for this venue.
- Export CSV.

**Tab 3: Values (Valores)**
- 4-party commission split display with editable sliders:
  - Admin % | Affiliate % | Bar Owner % | Operator %
  - Real-time sum validation (must = 100%).
- Product pricing table for this venue:
  - All products with base price and venue override.
  - Inline edit.
- Save button.

**Tab 4: Settings (Configuracoes)**
- Venue info: name, address, code, status, owner.
- Machine list with status indicators.
- Feature toggles (which products/events are active).
- Operating hours (if implemented).
- Assigned employee/operator.
- QR code preview.

**2. Machine Detail Panel** — `src/pages/admin/AdminMachineDetailPage.tsx` (NEW)
- Route: `/admin/machines/:id`
- Current status with last heartbeat timestamp.
- Live queue view.
- Machine config (volume, autoplay, etc.).
- Recent alerts for this machine.
- Revenue generated by this machine.

**3. Navigation Updates**
- Admin Venues page: click venue row → navigate to detail page.
- Admin Machines page: click machine → navigate to detail page (not black screen).
- Breadcrumbs: Admin / Venues / Bar do Carlos / Music.

### Backend

**4. Venue Analytics Endpoint** — `src/routes/venues.ts`
- `GET /venues/:id/analytics` — Returns:
  - Revenue summary (today, week, month, all time).
  - Top songs played.
  - Active queue.
  - Machine statuses.
  - Commission split config.
  - Product pricing overrides.

### Tests
- Venue detail page renders all 4 tabs.
- Analytics endpoint returns correct data.
- Commission edit validates sum = 100%.

---

## Implementation Order

| Order | Prompt | Dependencies | Priority |
|-------|--------|-------------|----------|
| 1 | **10.1** Full Admin CRUD | None | HIGH |
| 2 | **10.5** Flexible Pricing & Combos | None | HIGH |
| 3 | **10.2** Commission Split System | 10.5 (products) | HIGH |
| 4 | **10.3** Hierarchical Catalog | None | HIGH |
| 5 | **10.6** Regional Catalog | 10.3 (catalog hierarchy) | MEDIUM |
| 6 | **10.4** Revenue Dashboard | 10.2 (splits) | HIGH |
| 7 | **10.7** Venue Interior Dashboard | 10.2 + 10.4 + 10.5 | HIGH |

### Estimated New/Modified Files per Prompt

| Prompt | New Files | Modified Files |
|--------|-----------|---------------|
| 10.1 | 3 (pages) | 5 (routes, schema, store) |
| 10.2 | 3 (model, service, routes) | 4 (schema, payments, events, config) |
| 10.3 | 4 (models, routes, pages) | 3 (schema, catalog, browse) |
| 10.4 | 4 (routes, pages, middleware) | 3 (existing revenue pages) |
| 10.5 | 5 (models, routes, service, pages) | 4 (schema, payments, events, customer UI) |
| 10.6 | 3 (model, routes, page) | 3 (schema, songs, browse) |
| 10.7 | 3 (pages) | 2 (routes, app) |
| **Total** | **~25 new** | **~24 modified** |
