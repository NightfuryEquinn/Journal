# File guide

What every file in this repository does. Build config (`tsconfig*.json`), `.gitignore`, lockfile, `node_modules/` and `dist/` are left out. For setup and architecture see [README.md](README.md); to host your own copy see [DEPLOYMENT.md](DEPLOYMENT.md).

## Root

- `index.html` — SPA shell: icons, PWA manifest link, theme colour, the `#root` mount point, and the `/src/main.tsx` entry script.
- `package.json` — Project manifest (`journs`, v1.2.1): scripts for dev / build / lint / the `check:*` self-checks / Mongo maintenance, dependencies, and the `lint-staged` config.
- `vite.config.ts` — Vite config: React and Tailwind plugins, the in-process API plugin, loads `.env` into `process.env`, and copies the `vercel.json` security headers onto `vite preview`.
- `vercel.json` — Vercel config: rewrites `/api/*` to the serverless functions and everything else to `index.html`, plus the CSP, `Referrer-Policy` and `nosniff` headers.
- `eslint.config.js` — ESLint flat config: typescript-eslint, the two core React hooks rules, react-refresh, type-only imports, no `any`.
- `knip.config.ts` — Config for knip, the unused file / export / dependency checker. Declares the API handlers and scripts as entry points.
- `.env.example` — Template for every environment variable (Mongo, JWT, cron secret, CORS, VAPID keys, build-time `VITE_*`).
- `LICENSE` — Business Source License 1.1 (source-available; converts to Apache 2.0 on the Change Date).
- `README.md` — Project overview: stack, auth and E2EE design, schemas, quests, reminders, API surface, scripts.
- `FILES.md` — This file.
- `DEPLOYMENT.md` — Step-by-step guide to rehosting on Vercel + MongoDB Atlas + cron-job.org.
- `.prettierrc.json` — Prettier style (single quotes, semicolons, 100 columns).

## `api/` — Vercel serverless functions

Each file under `api/` (except `_lib/`) is one route. Handlers use the minimal request / response types in `_lib/vercel.ts`, so there is no dependency on `@vercel/node`.

### `api/auth/`

- `api/auth/register.ts` — `POST /api/auth/register`, no auth. Creates the user (409 if the account exists) and an empty quest-progress document, returns a session JWT.
- `api/auth/login.ts` — `POST /api/auth/login`. Checks `accountId` + `authVerifier` (timing-safe compare); returns a JWT and the wrapped DEKs.
- `api/auth/bundle.ts` — `GET /api/auth/bundle?accountId=`, no auth. Returns the recovery material (salt + recovery-wrapped DEK) for a new-device recovery.
- `api/auth/recover.ts` — `POST /api/auth/recover`. Requires the matching `dekVerifier`, then rotates the passphrase wraps and returns a JWT. 401 on mismatch, 409 for legacy accounts without a verifier.
- `api/auth/verifier.ts` — `POST /api/auth/verifier`, JWT required. Backfills `dekVerifier` on accounts created before it existed; no-op once set.

### `api/entries/`

- `api/entries/index.ts` — `/api/entries`, JWT required. `GET` lists the account's encrypted entries; `PUT` bulk-upserts ciphertext + nonce.
- `api/entries/[id].ts` — `DELETE /api/entries/:id`, JWT required. Deletes one entry, scoped to the account.

### `api/push/`

- `api/push/subscription.ts` — `/api/push/subscription`, JWT required. `POST` stores a Web Push subscription with the device time zone; `DELETE` drops it (endpoint in the JSON body).

### Top level

- `api/quests.ts` — `/api/quests`, JWT required. `GET` returns quest / AURA progress after applying any pending settlement; `PUT` validates and saves it.
- `api/cron.ts` — `POST /api/cron`, `Bearer CRON_SECRET`. Runs quest settlement for all users and sends due push reminders; the two halves are independent. `?hour=` forces a reminder slot for testing.

### `api/_lib/` — shared server helpers

- `api/_lib/db.ts` — Cached MongoDB connection, document types, collection getters (`users`, `entries`, `quest_progress`, `push_subscriptions`), `touchActive`.
- `api/_lib/http.ts` — Session JWT sign / verify (HS256, 12 h), Bearer parsing, CORS allowlist, JSON response helpers, timing-safe compare, and the recover-auth decision.
- `api/_lib/schemas.ts` — Zod schemas for request bodies (register, login, recover, verifier, entries, push).
- `api/_lib/resolve-uri.ts` — Windows-only workaround that turns a `mongodb+srv://` URI into a direct connection when SRV lookups fail. Passes the URI through unchanged elsewhere.
- `api/_lib/vercel.ts` — Minimal `VercelRequest` / `VercelResponse` type shapes.

## `scripts/` — tooling and self-checks

- `scripts/vite-api-plugin.ts` — Vite plugin that serves `/api/*` inside `vite dev` and `vite preview` by calling the same handlers Vercel deploys.
- `scripts/auth-check.ts` — Assert-based check: DEK verifier, recover-auth branching, CORS allowlist, entry padding buckets, Face ID wrap round-trip. Run with `bun run check:auth`.
- `scripts/quest-check.ts` — Assert-based check of quest satisfaction, word counts, streaks and AURA settlement. `bun run check:quests`.
- `scripts/push-check.ts` — Assert-based check of reminder scheduling (time zones, DST, the 15-minute window) and the service worker. `bun run check:push`.
- `scripts/journal-export-check.ts` — Assert-based check of text wrapping and pagination for the image export. `bun run check:journal-export`.
- `scripts/drop-all.ts` — Drops every collection in `MONGODB_DB`. Needs `--confirm`. `bun run db:drop-all`.
- `scripts/purge-stale-users.ts` — Deletes users inactive for 90+ days along with their entries, quest progress and push subscriptions. Needs `--confirm`. `bun run db:purge-stale`.
- `scripts/bun-v8-patch.ts` — Bun preload polyfill so the MongoDB `bson` package can load; used by the `db:*` scripts.

## `shared/` — code used by both client and server

- `shared/types.ts` — `JournalEntry`, `QuestProgress` and period-state types.
- `shared/schemas.ts` — Zod schemas for a journal entry (validates JSON imports) and quest progress (validates the API).
- `shared/quests.ts` — Quest catalog (daily, weekly, milestones), word / char counts, streaks, satisfaction checks, AURA settlement with UTC period keys, claim helpers.
- `shared/push.ts` — Reminder hours (09 / 12 / 17 / 20 / 23 local), the quote pool, time-zone-aware "is a slot due" and dedup-key logic.

## `src/` — the React app

### Entry and shell

- `src/main.tsx` — React entry: mounts `<App />` with Vercel Analytics, loads fonts and CSS, registers the service worker.
- `src/app.tsx` — Root component: auth session, screen routing, entry sync (decrypt / encrypt / upsert / delete / import merge), quest saving, push sync, product tour, sound toggle, delete modal.
- `src/types.ts` — UI types (`AppView`, `ListLayout`, `LegalDoc`, `DeviceIdentity`) and re-exports of the shared entry / quest types.
- `src/vite-env.d.ts` — Vite client type declarations.
- `src/styles.css` — Tailwind v4 import, theme tokens and breakpoints, keyframes, HUD effects (bracket frames, backdrop, scrollbars), reduced-motion rules, Shepherd tour theme.

### Screens

- `src/landing.tsx` — Lazy-loaded pre-login marketing page: hero, feature sections, reminders, footer with links to Transparency, Privacy and Terms.
- `src/login.tsx` — The Secure Terminal: unlock with passphrase or Face ID, create a new user (12-word phrase → verify → passphrase), recover on a new device.
- `src/list.tsx` — Archive: timeline and stack layouts, search, tag filter, summary cells.
- `src/reader.tsx` — Reads one decrypted entry; opens the image-export dialog.
- `src/composer.tsx` — Create / edit an entry (mood, energy, weather, tags), unsaved-changes guard, delete.
- `src/profile.tsx` — AURA, streak, quests and claims, JSON export / import, reminder toggle, Face ID enrollment, links to Transparency and legal pages.
- `src/transparency.tsx` — Data-flow diagram (Mermaid, lazy-loaded), quest catalog and every data schema. Also exports shared text components used by `legal.tsx`.
- `src/legal.tsx` — In-app Privacy Policy and Terms & Conditions (static copy with a version stamp).

### UI kit and effects

- `src/hud.tsx` — Shared HUD components: `Panel`, `Btn`, `Bracket`, `TopBar`, `DecodeText`, `Caret`, mood / weather widgets, select, `Backdrop`, `ErrorBoundary`, and layout constants.
- `src/motion.ts` — anime.js hooks for entrance and scroll-reveal animations; respects reduced motion.
- `src/sound.ts` — `SoundManager`: Howler-based UI sounds from `audio/`, muted by default.
- `src/tours.ts` — Shepherd.js product tour (first unlock, replayable from the Archive).
- `src/format.ts` — Date / time formatting helpers.

### Crypto, identity and API client

- `src/crypto.ts` — All client-side cryptography: BIP39 phrase, PBKDF2 / HKDF key derivation, verifiers, AES-GCM wrap / unwrap, padded entry encrypt / decrypt.
- `src/identity.ts` — Device identity in `localStorage` and the register / unlock / recover flows that produce a session.
- `src/faceid.ts` — Optional WebAuthn PRF passkey (Face ID / Touch ID / Windows Hello) that wraps the passphrase key for biometric unlock.
- `src/api.ts` — Typed `fetch` client for every `/api` route; honours `VITE_API_BASE`.
- `src/push.ts` — Browser Web Push helpers: permission, subscribe / unsubscribe, and re-sync on each login.

### Journal image export

- `src/journal-export-dialog.tsx` — Preview-and-download dialog for exporting an entry as PNG pages.
- `src/journal-export.ts` — Renders an entry onto 1080×1350 canvases in the browser.
- `src/journal-pagination.ts` — Grapheme-aware text wrapping and page layout used by the renderer.

## `public/` — static assets served as-is

- `public/sw.js` — Service worker for push notifications only (no fetch handler, nothing is cached).
- `public/manifest.webmanifest` — PWA manifest; makes the app installable (required for push on iOS).
- `public/logo.png` — App icon (favicon, touch icon, manifest icon, notification icon, landing nav).
- `public/favicon.ico` — Browser tab icon.
- `public/contour.svg` — Contour-line backdrop texture used by `Backdrop` in `src/hud.tsx`.
- `public/hexgrid.svg` — Hex-grid backdrop texture used by `Backdrop`.

## `audio/` — UI sound effects

All imported by `src/sound.ts`.

- `audio/onclick.wav` — Button click.
- `audio/onhover.wav` — Button hover.
- `audio/ontype.wav` — Typing keydown.
- `audio/ondelete.wav` — Delete-confirmation modal opening.
- `audio/onpageload.wav` — App load.
- `audio/onshepherd.wav` — Each product-tour step.

## `.github/` and `.husky/` — automation

- `.github/workflows/ci.yml` — CI on push to `develop` and on pull requests: install, lint, format check, typecheck, knip.
- `.husky/pre-commit` — Runs `lint-staged` (ESLint + Prettier on staged files).
- `.husky/pre-push` — Runs typecheck, knip and the four `check:*` self-checks.
