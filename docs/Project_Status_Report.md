# JukeBox — Project Status Report

**Date**: 2026-02-26
**Status**: Planning Complete — Ready for Development

---

## Project Overview

Online jukebox platform for bars and entertainment venues in Brazil (with international expansion plans). Customers interact via PWA to select and pay for songs. Bar owners manage remotely. Music plays on Android TV devices.

## Development Strategy

**Two-stage approach:**
- **Stage 1 (MVP)**: Production-ready core system — 3 roles, Pix payments, working jukebox
- **Stage 2 (Full)**: All remaining features — 2 more roles, Stripe, WhatsApp, advanced features

## Platform Decision

**Primary Hardware**: Android TV (not Chromecast — more stable, supports offline, local cache, auto-recovery)

**Fallback**: Raspberry Pi or dedicated Android device if Android TV is insufficient for specific venues.

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend (PWA) | React 18 + TypeScript + Vite + TailwindCSS + Framer Motion |
| Backend API | Node.js + Express + TypeScript + Prisma ORM |
| Database | PostgreSQL 15 + Redis |
| Real-time | Socket.IO (WebSocket) |
| TV Player | React PWA fullscreen route (/tv-player) — same codebase |
| Payments | Pix (Stage 1) + Stripe cards (Stage 2) |
| WhatsApp | WhatsApp Business API / Twilio (Stage 2) |
| Cloud Storage | S3-compatible (2TB initial) |

## Design System

**Theme**: Neon Party Vibes — luxury nightclub aesthetic

| Role | Color | Hex |
|------|-------|-----|
| Background | Deep Black | #0F0F0F |
| Accent 1 | Neon Green | #00FF00 |
| Accent 2 | Neon Purple | #9B00FF |
| Highlight | Electric Pink | #FF0080 |
| Text | Soft White | #F5F5F5 |

- TV-first responsive design (1920px primary, scales to mobile)
- Luxury gradients, glass-morphism, neon glow effects
- Nightclub/music imagery throughout
- 60fps animations via Framer Motion

## User Roles

| Role | Stage | Description |
|------|-------|-------------|
| Admin | 1 (MVP) | Full network control, billing, user management |
| Bar Owner | 1 (MVP) | Own venue management, revenue, settings |
| Customer | 1 (MVP) | Song selection, payments, playlists, credits |
| Employee | 2 (Full) | Regional support, no billing access |
| Affiliate | 2 (Full) | QR code tracking, commissions, referrals |

## Stage 1 — MVP (Production-Ready)

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Foundation (scaffolding, design system, DB, auth — 3 roles) | Not started |
| Phase 2 | Core music & playback (catalog, queue, customer PWA) | Not started |
| Phase 3 | Payment system (Pix only, pricing, commissions) | Not started |
| Phase 4 | 2 dashboards (Admin + Bar Owner) | Not started |
| Phase 5 | TV player view (React PWA fullscreen route) | Not started |

## Stage 2 — Full Development (Post-MVP)

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 6 | Extended roles & payment (Employee, Affiliate, Stripe) | Not started |
| Phase 7 | Extended dashboards (Employee, Affiliate, Admin/BarOwner/Customer upgrades) | Not started |
| Phase 8 | Advanced features (WhatsApp bot, catalog bot, special events, TV extension) | Not started |
| Phase 9 | Monitoring & alerts system | Not started |

## Key Documents

- [Project Prompts (Full Development Guide)](Project_Prompts.md)
- [Original Job Description](Jukebox_Project_Job_Description.txt)

## Notes

- Stage 1 must be fully complete and tested before starting Stage 2
- Each prompt includes specific test checklists
- Prompts are ordered by dependency — follow the execution order tables
- Design rules (Neon Party Vibes) apply to ALL prompts in both stages
