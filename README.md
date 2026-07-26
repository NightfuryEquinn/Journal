# Journs

THIRTEENTH Self Project — an end-to-end encrypted field journal.

React 19 + TypeScript + Vite SPA, Vercel serverless API, MongoDB Atlas. Auth is a 12-word BIP39 recovery phrase plus a device passphrase (no wallets). Journal plaintext never reaches the server; quest / AURA progress is plaintext so period settlement can run without the DEK.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React 19 SPA (`src/`) |
| API | Vercel serverless under `api/` |
| Shared | Zod schemas + quest logic (`shared/`) |
| Database | MongoDB Atlas (`users`, `entries`, `quest_progress`) |
| Auth | BIP39 mnemonic + passphrase → DEK wraps + JWT |
| Scheduler | [cron-job.org](https://cron-job.org) → `/api/cron/settle` (not Vercel Cron) |
| Audio | Howler.js + WAVs in `audio/` |

## Repository map

```
├── audio/                 # UI SFX (click, hover, type, page load, delete, shepherd)
├── api/
│   ├── auth/              # register, login, bundle, recover
│   ├── entries/           # ciphertext CRUD
│   ├── quests.ts          # AURA / quest progress
│   ├── cron/settle.ts     # period settlement
│   └── _lib/              # db, schemas, http, Atlas URI helpers
├── shared/                # types, Zod schemas, quest defs / settle / claim
├── src/                   # SPA screens, crypto, identity, HUD, tours
├── scripts/               # Vite /api middleware, Mongo maintenance, Bun polyfill
├── public/                # favicon, logo, backdrop SVGs
└── .env.example
```

### Frontend views

| View | Module | Role |
|------|--------|------|
| Login | `login.tsx` | Boot, unlock, create (phrase → verify → passphrase), recover |
| Archive | `list.tsx` | Timeline / stack layouts, search, tags, replay tour |
| Reader | `reader.tsx` | Read a decrypted entry |
| Composer | `composer.tsx` | Create / edit entry (mood, energy, weather, tags) |
| Profile | `profile.tsx` | Operator, AURA, quests, import/export, transparency link |
| Transparency | `transparency.tsx` | Data-flow diagram + schema documentation |

Supporting modules: `app.tsx` (session + routing), `crypto.ts` / `identity.ts`, `api.ts`, `hud.tsx` (SoundManager, TopBar, Panel/Btn), `tours.ts` (Shepherd).

## Setup

```bash
bun install
cp .env.example .env
# fill MONGODB_URI, MONGODB_DB, JWT_SECRET, CRON_SECRET
```

### Local development

```bash
bun run dev
```

Vite serves the SPA and mounts `/api/*` in-process from `.env`. No separate API process.

### Production

```bash
bun run build
# deploy to Vercel with the same env vars in the project dashboard
```

Deployed builds call same-origin `/api/*` on Vercel.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `MONGODB_URI` | server / scripts | Atlas connection string |
| `MONGODB_DB` | server / scripts | Database name (default `journs`) |
| `JWT_SECRET` | server | Session signing (≥16 chars) |
| `CRON_SECRET` | server | Bearer token for settle (≥16 chars) |
| `VITE_API_BASE` | frontend (optional) | Absolute API origin; empty = same-origin `/api` |

## Auth & E2EE

1. **Create** — 12-word recovery phrase (shown once) + passphrase
2. **Derive** — `accountId` from mnemonic seed; random **DEK**; wrap DEK under passphrase KEK (PBKDF2) and recovery KEK (HKDF)
3. **Register** — upload `accountId`, `salt`, both wraps, `authVerifier` (never the DEK, mnemonic, or passphrase)
4. **Journal** — AES-GCM encrypt `JournalEntry` JSON on-device; Mongo stores `ciphertext` + `nonce` only
5. **Unlock** — passphrase → verifier → JWT + unwrap DEK into session memory
6. **Recover** — mnemonic unwraps DEK via `GET /api/auth/bundle`, then `POST /api/auth/recover` rotates passphrase wraps

Quest / AURA progress is **plaintext on the server** so day/week rollover can run without the DEK.

In-app detail: **Profile → TRANSPARENCY** (Mermaid diagram + every schema).

## Data schemas (summary)

| Schema | Location | Visibility |
|--------|----------|------------|
| `JournalEntry` | `shared/schemas.ts` | Client memory + local export only |
| Encrypted entry | `api/_lib/schemas.ts` | Wire + Mongo `entries` |
| `UserDoc` | `api/_lib/db.ts` | Mongo `users` (wraps + verifier) |
| `QuestProgress` | `shared/schemas.ts` | Wire + Mongo `quest_progress` |
| Register / login / recover bodies | `api/_lib/schemas.ts` | Auth HTTP |
| Device identity | `src/identity.ts` | `localStorage` `journs.identity.v1` (no DEK) |

**`JournalEntry` fields:** `id`, `date`, `title`, `mood` (1–5), `energy` (1–5), `weather`, `tags[]`, `body`.

**Mongo `entries`:** `accountId`, `entryId`, `ciphertext`, `nonce`, `schemaVersion`, `updatedAt`.

## Quests & AURA

| Kind | Ids | Reward |
|------|-----|--------|
| Daily | `daily-write`, `daily-tag` | +10 / +5 AURA |
| Weekly | `weekly-three`, `weekly-mood` | +25 / +15 AURA |
| Milestone | `ms-pioneer`, `ms-chronicler`, `ms-archivist` | tags only (0 AURA) |

`settleAura` runs on day/week key change (client GET/PUT quests, or cron). Missed quests deduct AURA (floor 0). Period keys are **UTC** so clients and cron-job.org agree.

## Import / export

From **Profile → DATA**:

- **Export JSON** — decrypted plaintext backup (`journs-export-YYYYMMDD.json`)
- **Import JSON** — merge by entry `id` (imported wins), re-encrypt, sync

## Product tour

- Shepherd.js tour on first unlock (archive → compose → profile → done)
- **Archive → REPLAY TOUR** resets `journs.tour.v1` and restarts
- Each step `show` plays `audio/onshepherd.wav` when audio is enabled

## Audio

Howler-backed SFX in `SoundManager` (`src/hud.tsx`), gated by the topbar toggle (`localStorage` `journs.sound`):

| File | Trigger |
|------|---------|
| `onpageload.wav` | App load (once per session when sound is on) |
| `onclick.wav` | CTA buttons |
| `onhover.wav` | Button hover |
| `ontype.wav` | Typing keydown |
| `ondelete.wav` | Delete confirmation modal open |
| `onshepherd.wav` | Each Shepherd step |

Dropdowns and range sliders do not play click/type cues.

## Quest settlement (cron-job.org)

Vercel only exposes the handler. Configure the schedule externally:

- **URL:** `POST https://<your-deploy>/api/cron/settle`
- **Header:** `Authorization: Bearer <CRON_SECRET>`
- **Schedule:** e.g. hourly, or `0 0 * * *` UTC

Do **not** enable Vercel Cron / `vercel.json` `crons`.

## API surface

| Route | Auth | Role |
|-------|------|------|
| `POST /api/auth/register` | — | Create account + empty quest progress |
| `POST /api/auth/login` | — | Verifier → JWT + wrapped DEKs |
| `GET /api/auth/bundle` | — | Recovery wrap by `accountId` |
| `POST /api/auth/recover` | — | Rotate passphrase wraps |
| `GET/PUT /api/entries` | JWT | List / upsert ciphertext |
| `DELETE /api/entries/:id` | JWT | Delete one entry |
| `GET/PUT /api/quests` | JWT | Fetch / save quest progress |
| `POST /api/cron/settle` | `CRON_SECRET` | Settle all users |

JWT: HS256, claim `{ accountId }`, 12h expiry. Errors: `{ error: string }`.

## Mongo maintenance

Destructive. Both require `--confirm`.

```bash
# Wipe every collection in MONGODB_DB
bun run db:drop-all -- --confirm

# Delete users inactive >90 days (and their entries + quest_progress)
bun run db:purge-stale -- --confirm
```

Scripts preload a Bun v8 polyfill so the MongoDB `bson` package can load. Inactivity uses `lastActiveAt` (login + authenticated writes).

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Vite SPA + in-process `/api` |
| `bun run build` | Typecheck + production build |
| `bun run preview` | Preview production build |
| `bun run db:drop-all` | Drop all collections |
| `bun run db:purge-stale` | Purge inactive users |
