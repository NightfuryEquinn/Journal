# Journs

THIRTEENTH Self Project — an end-to-end encrypted field journal.

React 19 + TypeScript + Vite SPA, Vercel serverless API, MongoDB Atlas. Auth is a 12-word BIP39 recovery phrase plus a device passphrase (no wallets). Journal plaintext never reaches the server; quest / AURA progress is plaintext so period settlement can run without the DEK.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React 19 SPA (`src/`) |
| API | Vercel serverless under `api/` |
| Shared | Zod schemas + quest logic (`shared/`) |
| Database | MongoDB Atlas (`users`, `entries`, `quest_progress`, `push_subscriptions`) |
| Auth | BIP39 mnemonic + passphrase → DEK wraps + JWT |
| Scheduler | [cron-job.org](https://cron-job.org) → `/api/cron` (not Vercel Cron) |
| Reminders | W3C Push API (VAPID + `web-push`), `public/sw.js`, installable via `public/manifest.webmanifest` |
| Audio | Howler.js + WAVs in `audio/` |

## Repository map

```
├── audio/                 # UI SFX (click, hover, type, page load, delete, shepherd)
├── api/
│   ├── auth/              # register, login, bundle, recover
│   ├── entries/           # ciphertext CRUD
│   ├── quests.ts          # AURA / quest progress
│   ├── push/              # push subscription register / drop
│   ├── cron.ts            # period settlement + reminder fan-out
│   └── _lib/              # db, schemas, http, Atlas URI helpers
├── shared/                # types, Zod schemas, quest defs / settle / claim, reminder slots
├── src/                   # SPA screens, crypto, identity, HUD, tours, push
├── scripts/               # Vite /api middleware, Mongo maintenance, Bun polyfill, push check
├── public/                # favicon, logo, backdrop SVGs, service worker, manifest
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
bunx web-push generate-vapid-keys
# fill VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY
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
| `CRON_SECRET` | server | Bearer token for `/api/cron` (≥16 chars) |
| `VAPID_PUBLIC_KEY` | server | Web Push application server key |
| `VAPID_PRIVATE_KEY` | server | Web Push signing key |
| `VAPID_SUBJECT` | server | `mailto:` or `https://` contact for push services |
| `VITE_VAPID_PUBLIC_KEY` | frontend | Same value as `VAPID_PUBLIC_KEY`; baked in at build time |
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

Catalog lives in `shared/quests.ts`. Profile and Transparency render those arrays; do not duplicate ids elsewhere.

| Kind | Ids | Reward |
|------|-----|--------|
| Daily | `daily-write`, `daily-tag`, `daily-tags-3`, `daily-long` | +10 / +5 / +5 / +5 AURA |
| Weekly | `weekly-three`, `weekly-mood`, `weekly-days`, `weekly-energy` | +25 / +15 / +15 / +10 AURA |
| Milestone | `ms-pioneer` … `ms-spectrum` (13 total) | tags only (0 AURA) |

`settleAura` runs on day/week key change (client GET/PUT quests, or cron). Missed **timed** quests deduct AURA (floor 0). Period keys are **UTC** so clients and cron-job.org agree. New timed quests carry `sinceDay: 2026-08-14` so a closed period **before** that date is not penalized. Milestones scan the full archive (lifetime max streak, not current streak).

```bash
bun run check:quests   # satisfaction, max streak, sinceDay settle
```

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

## Scheduled work (cron-job.org)

One job drives everything: quest settlement and reminder fan-out. Vercel only
exposes the handler — configure the schedule externally:

- **URL:** `POST https://<your-deploy>/api/cron`
- **Header:** `Authorization: Bearer <CRON_SECRET>`
- **Schedule:** **every 15 minutes**

The cadence is set by push, not settlement — it must be at least as frequent as
`WINDOW_MINUTES` (15) or reminder slots are skipped. Settlement is idempotent and
only writes on a day/week rollover, so running it every 15 minutes is a no-op scan
the rest of the time.

The two halves run independently (`Promise.allSettled`): a Mongo failure during
settlement cannot swallow reminders. The response reports each side:

```json
{ "ok": true, "settle": { "ok": true, "scanned": 3, "updated": 1 },
  "push": { "ok": true, "scanned": 5, "sent": 2, "pruned": 0, "failed": 0 },
  "at": "..." }
```

`ok: false` (HTTP 500) means at least one half failed; the other half's result is
still reported. Do **not** enable Vercel Cron / `vercel.json` `crons`.

## Reminders (W3C Push API)

Five nudges per day on the subscriber's **local** clock — 09:00, 12:00, 17:00, 20:00, 23:00 — defined in `shared/push.ts`. Each notification body is a `"quote" — author` line picked from a rotating pool (seeded by local day + hour, so the same slot is stable for everyone that day). Opt in from **Profile → NOTIFICATIONS**; the button click is the user gesture `Notification.requestPermission()` requires.

Delivery rides the single `/api/cron` job above, every 15 minutes. The 15-minute window is what makes `:30` and `:45` offset zones (Asia/Kolkata, Asia/Kathmandu, Pacific/Chatham) fire on the hour locally instead of half an hour late.

Notes:

- Payloads are generic copy only. The server holds no DEK, so a reminder can never mention entry content.
- `push_subscriptions` is keyed on `endpoint`, so one account can have several devices and re-subscribing is idempotent. `syncPush` re-registers on every authed boot, which is how endpoint rotation and travel (timezone change) are picked up — the service worker has no session token of its own.
- Dedup is claim-before-send on `lastSentKey` (`${localDay}:${hour}`): at-most-once, so a retried cron run cannot double-push.
- `404`/`410` from a push service prunes the row.
- `?hour=9|12|17|20|23` on `/api/cron` forces a slot for testing. Dedup still applies, so a forced re-run is a no-op.
- iOS Safari only delivers push to a Home-Screen-installed PWA — hence `public/manifest.webmanifest`.
- `public/sw.js` has **no** `fetch` handler. No journal data is stored locally, so there is nothing to cache.

```bash
bun run check:push   # reminder scheduling + service worker logic
bun run check:quests # quest satisfaction + settleAura
```

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
| `POST /api/push/subscription` | JWT | Register a push subscription + timezone |
| `DELETE /api/push/subscription` | JWT | Drop a subscription by `?endpoint=` |
| `POST /api/cron` | `CRON_SECRET` | Settle all users + send due reminders |

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
| `bun run check:push` | Reminder scheduling + service worker logic |
| `bun run check:quests` | Quest satisfaction, max streak, sinceDay settle |
| `bun run db:drop-all` | Drop all collections |
| `bun run db:purge-stale` | Purge inactive users |
