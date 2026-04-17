# Client Feedback — Action Plan

Based on client testing session on 2026-04-14.

## Phase 1 — Critical Bug Fixes (1-2 days)

1. **Queue not removing played songs** — fix auto-remove after playback
2. **Text message not appearing on TV** — fix WebSocket event handling
3. **Photo from gallery error** — fix file picker on mobile and PC
4. **Voice message upload error** — debug upload flow
5. **Birthday pack paid but not in queue** — fix payment → queue flow
6. **QR code not visible on TV Player** — fix display
7. **Admin Users tab empty** — fix users list endpoint
8. **Price shows 11 R$ instead of correct amount** — fix price display

## Phase 2 — Configuration & Editing (2-3 days)

1. **Bar owner price editing not reflecting on customer view** — fix venue-specific price fetch
2. **Admin edit prices per bar** — embed price editor in bar detail page
3. **Editable special event durations** (text, photo, meme time on screen)
4. **Editable silence pricing tiers** (immediate vs between songs)
5. **Editable volume control pricing** (+10%, -10%, etc.)
6. **Password protection for revenue/billing section**

## Phase 3 — UX Improvements (2-3 days)

1. **Remove bar connection at login** — only ask when paying
2. **Simplify new customer registration** (email + password + recover)
3. **Bar name visible when connected** (header shows connected venue)
4. **Show TV preview inside bar dashboard** (no new tab needed)
5. **Role switching** (customer/bar/affiliate in one interface)
6. **Add volume control paid product** (+10%, +20%, -10%, -20%)

## Phase 4 — Silence Behavior (1 day)

1. **Silence pauses current song** — not just adds to queue
2. **Tiered pricing** — immediate silence R$ 20, between-songs R$ 2/5/8

## Phase 5 — Music Catalog (2-3 days)

1. **Cloud storage integration** — DigitalOcean Spaces for music files
2. **YouTube bot** — automatic download to cloud
3. **Manual upload via admin** — fix PC upload error
4. **Per-venue catalog** — enable/disable songs per bar

## Phase 6 — Payments (2 days)

1. **Use Stripe for both Pix + Card** (since Mercado Pago not authorizing)
2. **Stripe Pix integration** (Stripe supports Pix in Brazil)
3. **Automatic monthly payouts** via Stripe Connect
   - Affiliates get commission transfers
   - Bar owners get their revenue share
   - Operators get their cut

## Phase 7 — Extended Durations on TV (1 day)

1. **Text message** — stays on TV for 15 min (editable)
2. **Photo** — stays on TV for 3 min (editable)
3. **Reactions/memes** — last longer (editable)

---

## Priority Queue (What to Do First)

### Week 1 — Critical Fixes
1. Queue auto-remove played songs
2. Text/Photo/Voice message → TV display flow
3. Birthday pack → queue
4. QR code on TV Player
5. Price display fix (R$ format)

### Week 2 — Admin Power
1. Bar-specific price editing in admin
2. Editable special event prices/durations
3. Users tab fix
4. Password-protected billing

### Week 3 — UX Polish
1. Role switching interface
2. Bar dashboard with embedded TV
3. Volume control product
4. Silence immediate vs delayed pricing

### Week 4 — Infrastructure
1. Cloud storage (DigitalOcean Spaces)
2. Stripe Pix (replace Mercado Pago)
3. Stripe Connect for automatic payouts

---

## Questions for Client

1. **Stripe Pix**: Confirm you want to use Stripe for both Pix and Card (instead of Mercado Pago)?
2. **Cloud storage**: Confirm you want to set up DigitalOcean Spaces now?
3. **Admin billing password**: What should the password be for the billing section?
4. **Silence pricing**: Please provide the tiered prices (immediate, short, medium, long)?
5. **Volume control pricing**: Please confirm: R$ 1 per step? Per song?
