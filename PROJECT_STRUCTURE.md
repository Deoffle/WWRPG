# Wizarding World RPG — Project Structure

Last updated: 2025-12-19  
Repo: wwrpg-app

## Goals

A lightweight campaign manager + gameplay screen for a custom deck-builder RPG:

- Auth + campaigns with members (DM + players)
- Players: sheet (JSONB), items, report card (progression grades), NPC flag
- Cards: create/edit, assign to decks
- Decks: combat + exploration, with deck rules helper
- Monsters: DM-managed with image upload + DnD-style block sections
- Bestiary: per-player revealed monster info with reveal levels (1–3)
- Invites: join by link/code
- Backup: export/import campaign JSON (creates new campaign)
- (Next) Play Screen: player-facing “live” screen for exploring/combat

---

## Tech stack

- Next.js App Router (server components + route handlers)
- Supabase (Auth + Postgres + RLS + Storage)
- Tailwind CSS
- Data model: JSONB for flexible RPG schema

---

## Current user roles & permissions (high level)

- **DM**
  - Create/delete campaigns (only if whitelisted as campaign creator)
  - Manage members + invites + player assignment
  - Create/update/delete players, decks, cards
  - Create/update/delete monsters + upload images
  - Push monsters into player bestiary (L1/L2/L3) and “push to all (skip NPC)”
  - Export campaign JSON (DM-only)
  - Import campaign JSON (creates new campaign; DM becomes owner + DM member)

- **Player**
  - View allowed campaign content (RLS enforced)
  - View other player sheets (as designed)
  - View personal bestiary entries
  - Update own player sheet parts where allowed (items/report card etc.)

> Enforcement is via Supabase RLS policies (no service key in client).

---

## Deck behavior (game rules)

You have **two deck types**:

### Exploration deck (mostly static)
- You can use exploration cards “as available”.
- No strict draw-per-turn loop required (initially).

### Combat deck (turn-based)
- On each of the player’s turns, they **draw 4 cards**.
- If the player can’t draw enough because the deck is empty, the deck is **reshuffled**, then drawing continues.
- This implies **combat needs deck state** (draw pile, discard pile, reshuffle events), either in DB or in a “live play state”.

`src/lib/deck-rules.ts` is where we centralize these rules.

---

## Routes & pages map

### Root / layout
- `/` — landing page
Files:
- `src/app/page.tsx`
- `src/app/layout.tsx`

### Auth
- `/auth/login` — login page
- `POST /api/auth/logout` — logs out
Files:
- `src/app/auth/login/page.tsx`
- `src/app/api/auth/logout/route.ts`
- `src/app/app/campaigns/logout-button.tsx`

### Campaigns (global list)
- `/app/campaigns` — list + create + import + logout
- `POST /api/campaigns/create`
- `POST /api/campaigns/delete`
- `GET  /api/campaigns/export?campaignId=...` (DM)
- `POST /api/campaigns/import` (creates a new campaign)
Files:
- `src/app/app/campaigns/page.tsx`
- `src/app/app/campaigns/create-campaign-form.tsx`
- `src/app/app/campaigns/import-campaign-card.tsx`
- `src/app/app/campaigns/logout-button.tsx`
- `src/app/api/campaigns/create/route.ts`
- `src/app/api/campaigns/delete/route.ts`
- `src/app/api/campaigns/export/route.ts`
- `src/app/api/campaigns/import/route.ts`

### Campaign hub
- `/app/c/[campaignId]` — entry point for a campaign
Files:
- `src/app/app/c/[campaignId]/page.tsx`
- `src/app/app/c/[campaignId]/delete-campaign-card.tsx`

### Members & invites
- `/app/c/[campaignId]/members` — manage members, generate invite, assign players to users
- `/join/[code]` — accept invite/join
- `POST /api/invites/create`
- `POST /api/members/assign-player`
Files:
- `src/app/app/c/[campaignId]/members/page.tsx`
- `src/app/app/c/[campaignId]/members/create-invite-card.tsx`
- `src/app/app/c/[campaignId]/members/assign-player-table.tsx`
- `src/app/join/[code]/page.tsx`
- `src/app/api/invites/create/route.ts`
- `src/app/api/members/assign-player/route.ts`

### Players
- `/app/c/[campaignId]/players` — list + create
- `/app/c/[campaignId]/players/[playerId]` — player detail (items + report card + NPC toggle)
- `POST /api/players/create`
- `POST /api/players/items/save`
- `POST /api/players/report-card/save`
- `POST /api/players/set-npc`
Files:
- `src/app/app/c/[campaignId]/players/page.tsx`
- `src/app/app/c/[campaignId]/players/create-player-form.tsx`
- `src/app/app/c/[campaignId]/players/[playerId]/page.tsx`
- `src/app/app/c/[campaignId]/players/[playerId]/items-editor.tsx`
- `src/app/app/c/[campaignId]/players/[playerId]/report-card-editor.tsx`
- `src/app/app/c/[campaignId]/players/[playerId]/npc-toggle.tsx`
- `src/app/api/players/create/route.ts`
- `src/app/api/players/items/save/route.ts`
- `src/app/api/players/report-card/save/route.ts`
- `src/app/api/players/set-npc/route.ts`

### Decks
- `/app/c/[campaignId]/decks` — list + create
- `/app/c/[campaignId]/decks/[deckId]` — deck editor, assign cards
- `POST /api/decks/create`
- `POST /api/decks/set-card`
Files:
- `src/app/app/c/[campaignId]/decks/page.tsx`
- `src/app/app/c/[campaignId]/decks/create-deck-form.tsx`
- `src/app/app/c/[campaignId]/decks/[deckId]/page.tsx`
- `src/app/app/c/[campaignId]/decks/[deckId]/deck-editor.tsx`
- `src/app/api/decks/create/route.ts`
- `src/app/api/decks/set-card/route.ts`
- Helper:
  - `src/lib/deck-rules.ts`

### Cards
- `/app/c/[campaignId]/cards` — list + create
- `/app/c/[campaignId]/cards/[cardId]` — view + edit
- `POST /api/cards/create`
- `POST /api/cards/update`
Files:
- `src/app/app/c/[campaignId]/cards/page.tsx`
- `src/app/app/c/[campaignId]/cards/create-card-form.tsx`
- `src/app/app/c/[campaignId]/cards/[cardId]/page.tsx`
- `src/app/app/c/[campaignId]/cards/[cardId]/edit-card-form.tsx`
- `src/app/api/cards/create/route.ts`
- `src/app/api/cards/update/route.ts`

### Monsters
- `/app/c/[campaignId]/monsters` — list + create
- `/app/c/[campaignId]/monsters/[monsterId]` — monster editor + image upload + block list editor
- `POST /api/monsters/create`
- `POST /api/monsters/update`
- `POST /api/monsters/delete`
Files:
- `src/app/app/c/[campaignId]/monsters/page.tsx`
- `src/app/app/c/[campaignId]/monsters/create-monster-form.tsx`
- `src/app/app/c/[campaignId]/monsters/[monsterId]/page.tsx`
- `src/app/app/c/[campaignId]/monsters/[monsterId]/monster-editor.tsx`
- `src/app/app/c/[campaignId]/monsters/[monsterId]/monster-image-uploader.tsx`
- `src/app/app/c/[campaignId]/monsters/[monsterId]/block-list-editor.tsx`
- `src/app/api/monsters/create/route.ts`
- `src/app/api/monsters/update/route.ts`
- `src/app/api/monsters/delete/route.ts`

### Bestiary
- `/app/c/[campaignId]/bestiary` — list + detail overlay (scrolling modal)
- `POST /api/bestiary/push` — DM pushes reveal snapshots (single or all players; optional skip NPC)
Files:
- `src/app/app/c/[campaignId]/bestiary/page.tsx`
- `src/app/app/c/[campaignId]/bestiary/bestiary-client.tsx`
- `src/app/api/bestiary/push/route.ts`

### Backup (inside campaign)
- `/app/c/[campaignId]/backup` — export (and optional import UI if kept here)
Files:
- `src/app/app/c/[campaignId]/backup/page.tsx`
- `src/app/app/c/[campaignId]/backup/backup-client.tsx`
API:
- `src/app/api/campaigns/export/route.ts`
- `src/app/api/campaigns/import/route.ts`

---

## Lib / shared utilities

Supabase:
- `src/lib/supabase/server.ts` (server client)
- `src/lib/supabase/browser.ts` (browser client)

Game rules:
- `src/lib/deck-rules.ts`

---

## Data model conventions

### players.sheet (JSONB)
- `items: [{ id, name, qty, tags?, notes? }]`
- `reportCard: { subjects: [{ key, grade, proficient }], notes? }`
- `isNpc: boolean` (NPC flag used by “skip NPC” flows)
- (future) play-state / notes / etc

### monsters.data (JSONB)
Top-level (used for reveal 1–3):
- `imageUrl, type, size, alignment, ac, hp, speed, senses, languages`
- `strengths: string[]`
- `weaknesses: string[]`
- `stats: { PHY, MEN, MAG, INT, DIP, ICY }`

Nested “full sheet” extras:
- `sheet.description: string`
- `sheet.resistances: string[]`
- `sheet.immunities: string[]`
- `sheet.traits/actions/reactions/legendary_actions: [{ name, text }]`

### bestiary_entries.revealed (JSONB snapshot)
- Level 1: `{ monsterId, name, imageUrl, tags }`
- Level 2: adds `{ type, size, strengths, weaknesses }`
- Level 3: adds `{ sheet: {...full} }` (from monsters.data + monsters.data.sheet)

---

## Storage

- Supabase Storage bucket used for monster images:
  - Bucket: `monsters` (public read; authenticated write/update by policy)
  - URL stored in `monsters.data.imageUrl`

---

## Backlog / next steps (priority)

### Next: Play Screen (player-facing during sessions)
Core idea:
- DM toggles the campaign mode: **Exploration** vs **Combat**
- Player sees:
  - their current mode
  - their relevant deck (exploration or combat)
  - quick access to character sheet areas (items, report card, notes)
  - bestiary
- Combat extras:
  - initiative list + enemy HP list (light tracker; no map)
  - combat deck draw loop: draw 4/turn + reshuffle on empty

(We’ll define whether this uses a new table like `campaign_state` / `encounters`,
or a JSONB “play state” that’s safe + simple.)

### Later
- Auto-sync bestiary snapshots when monsters update (optional; can be done via “refresh all L3 entries” action or a DB trigger)
- Better monster “preview as L1/L2/L3” before pushing
- More robust backup schema as tables evolve

---

## Notes / gotchas

- Keep secrets server-side only. Browser uses `NEXT_PUBLIC_*` keys only.
- All writes rely on RLS + user session, never service-role key in client.
- Import/export will evolve as you add new tables/columns — it’s normal to update it when new features land.
