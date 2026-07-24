# Journs

THIRTEENTH Self Project — an E2EE field journal (React + TypeScript + Vite) with a Vercel serverless API and MongoDB Atlas.

## Stack

- **Frontend:** Vite + React 19 (SPA)
- **API:** Vercel serverless functions under `api/` (hosting + HTTP only)
- **Database:** MongoDB Atlas
- **Auth:** 12-word BIP39 recovery phrase + device passphrase (no MetaMask / wallets)
- **Scheduler:** [cron-job.org](https://cron-job.org) calls the settle endpoint (not Vercel Cron)

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

Vite serves the SPA and mounts `/api/*` in-process (Mongo from `.env`). No separate API process.

Deployed builds call same-origin `/api/*` on Vercel.

### Production

```bash
bun run build
# deploy to Vercel with the same env vars set in the project dashboard
```

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `MONGODB_URI` | server / scripts | Atlas connection string |
| `MONGODB_DB` | server / scripts | Database name (default `journs`) |
| `JWT_SECRET` | server | Session signing (≥16 chars) |
| `CRON_SECRET` | server | Bearer token for settle endpoint (≥16 chars) |
| `VITE_API_BASE` | frontend (optional) | Absolute API origin; leave empty for same-origin `/api` (Vite middleware or Vercel) |

## Auth & E2EE

1. Create account → 12-word recovery phrase (shown once) + passphrase
2. Client derives `accountId` and a random **DEK**; wraps DEK under passphrase and recovery KEKs
3. Journal entries are **AES-GCM encrypted on-device**; MongoDB stores ciphertext only
4. Quest / AURA progress is **plaintext on the server** so period rollover can run without the DEK
5. Unlock uses passphrase → auth verifier → JWT; recover uses the mnemonic to unwrap the DEK and rotate the passphrase wrap

## Import / export

From **Profile → DATA**:

- **Export JSON** — decrypted plaintext backup (`journs-export-YYYYMMDD.json`)
- **Import JSON** — merge by entry `id` (imported wins), re-encrypt, sync

## Product tour & transparency

- First unlock starts a Shepherd.js tour (list / compose / profile)
- **Archive → REPLAY TOUR** resets and restarts it
- **Profile → TRANSPARENCY** shows a Mermaid diagram of how data moves (E2EE journal path vs quest path vs cron-job.org)

## Quest settlement (cron-job.org)

Vercel only exposes the handler. Configure the schedule in cron-job.org:

- **URL:** `POST https://<your-deploy>/api/cron/settle`
- **Header:** `Authorization: Bearer <CRON_SECRET>`
- **Schedule:** e.g. hourly, or `0 0 * * *` UTC

Do **not** enable Vercel Cron / `vercel.json` `crons`. Day and week keys are UTC so the external job and clients agree.

## Mongo maintenance scripts

Destructive. Both require `--confirm`.

```bash
# Wipe every collection in MONGODB_DB
bun run db:drop-all -- --confirm

# Delete users inactive >90 days (and their entries + quest_progress)
bun run db:purge-stale -- --confirm
```

These scripts preload a Bun v8 polyfill so the MongoDB `bson` package can load (`isBuildingSnapshot` is not implemented in Bun yet).

Inactivity uses `lastActiveAt` (updated on login and authenticated writes).

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
| `POST /api/cron/settle` | `CRON_SECRET` | Settle all users (cron-job.org only) |

## Scripts

- `bun run dev` — Vite SPA + in-process `/api` middleware
- `bun run build` — typecheck + production build
- `bun run preview` — preview production build
- `bun run db:drop-all` / `db:purge-stale` — Mongo maintenance
