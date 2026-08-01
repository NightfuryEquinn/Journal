# Journs — repo audit, prod API fix, mobile spacing, copy-all

## Context

Four threads, in priority order:

1. **Production is broken.** `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/shared/quests'` on `/api/auth/register`. Root cause: `package.json` sets `"type": "module"`, so Vercel's Node runtime loads the compiled functions as ESM — and Node's ESM loader requires a file extension on relative specifiers. Every import under `api/` and `shared/` is extensionless (`'../../shared/quests'`), so resolution fails at runtime. It works locally only because Vite/esbuild resolve extensionless specifiers.

2. **A second, independent bug found during the audit.** Every relative import in `api/quests.ts` is off by one directory level. The file sits at `api/quests.ts`, but line 2 reads `'../../shared/quests'` (resolves above the repo root) and lines 3–5 read `'../_lib/...'` (resolves to a non-existent root `_lib/`). Only line 1 (`'./_lib/vercel'`) is correct. `/api/quests` cannot ever have worked in production; the register.ts failure was masking it.

   It survived because **`api/` route handlers are in no tsconfig**. `tsconfig.node.json` includes only `api/_lib/**/*.ts`, and `tsconfig.app.json` includes only `src` and `shared`. So `tsc -b` never type-checks `api/auth/*`, `api/entries/*`, `api/quests.ts`, or `api/cron/settle.ts`.

3. **Dev/prod duplication.** `scripts/api-router.ts` (367 lines) re-implements all 8 handlers for local dev, and `scripts/api-auth.ts` duplicates `api/_lib/http.ts`'s JWT logic with a *different* secret policy (dev fallback string vs. throwing). This is the structural reason bug #2 went unnoticed — local dev never executes `api/quests.ts`.

4. **Mobile spacing.** `THEME.density` in `src/app.tsx` is hardcoded to `'spacious'`, so `--pad-lg` is 32px at every viewport. `Panel` applies `p-pad-lg`, so on a 375px phone a panel body gets 375 − 24 (page `px-3`) − 64 = **287px** of usable width. The `max-phone:`/`max-tablet:` variants already in the codebase are decent; the density tokens are the gap.

Plus: a "Copy All" button on the 12-word recovery phrase screen, which currently offers no way to save the phrase other than transcribing it by hand.

---

## 1. Fix ESM module resolution (unblocks production)

Add explicit `.js` extensions to every relative import in `api/` and `shared/`. TypeScript's `moduleResolution: "bundler"` (set in both tsconfigs) resolves a `./x.js` specifier to `./x.ts`, and esbuild does the same, so dev and type-checking are unaffected.

Files and their relative imports:

| File | Imports to extend |
|---|---|
| `api/_lib/db.ts` | L3 `../../shared/types`, L4 `./resolve-uri` |
| `api/_lib/http.ts` | L2 `./vercel` |
| `api/_lib/schemas.ts` | L2 `../../shared/schemas` |
| `api/auth/register.ts` | L1–L5 |
| `api/auth/login.ts` | L1–L4 |
| `api/auth/recover.ts` | L1–L4 |
| `api/auth/bundle.ts` | L1–L4 |
| `api/entries/index.ts` | L1–L4 |
| `api/entries/[id].ts` | L1–L3 |
| `api/cron/settle.ts` | L1–L4 |
| `api/quests.ts` | L1–L5 (**and fix the depth — see §2**) |
| `shared/quests.ts` | L1 `./types` |

Leave `src/` alone — Vite bundles it and extensionless is correct there.

## 2. Fix the broken paths in `api/quests.ts`

Combined with §1, lines 1–5 become:

```ts
import type { VercelRequest, VercelResponse } from './_lib/vercel.js';
import { settleAura } from '../shared/quests.js';
import { questProgressSchema } from './_lib/schemas.js';
import { questProgressCol, touchActive } from './_lib/db.js';
import { handleOptions, sendError, sendJson, verifySession } from './_lib/http.js';
```

## 3. Close the type-check gap

Extend `tsconfig.node.json`'s `include` from `api/_lib/**/*.ts` to `api/**/*.ts`, and add the three unchecked scripts (`scripts/drop-all.ts`, `scripts/purge-stale-users.ts`, `scripts/bun-v8-patch.ts`).

This is what makes §2's class of bug impossible going forward — `tsc -b` will fail on a bad path. Expect to fix fresh errors this surfaces in the previously-unchecked handlers; treat that as part of the task, not scope creep.

## 4. Collapse dev/prod duplication

Delete `scripts/api-router.ts` and `scripts/api-auth.ts`. Rewrite `scripts/vite-api-plugin.ts` to dispatch to the real handlers.

- Keep the existing `readBody` helper (`scripts/vite-api-plugin.ts:7`); drop `toWebRequest`/`writeWebResponse`, which only existed to feed the Fetch-based router.
- Add a small adapter building the `VercelRequest`/`VercelResponse` shapes from `api/_lib/vercel.ts` (they are deliberately minimal — `method`/`body`/`query`/`headers` in, `status`/`json`/`end`/`setHeader` out) over Node's `IncomingMessage`/`ServerResponse`. Parse JSON bodies into `req.body` and the query string into `req.query`, matching what Vercel does.
- Map pathname → handler via a static import map so Vite pre-bundles them: `/api/auth/register`, `/api/auth/login`, `/api/auth/recover`, `/api/auth/bundle`, `/api/entries`, `/api/entries/:id`, `/api/quests`, `/api/cron/settle`. For `/api/entries/:id`, set `req.query.id` the way the `[id].ts` filename convention implies.
- Keep the existing `getDb()` warm-up and the route-prefix guard at `scripts/vite-api-plugin.ts:81` so Vite's own module requests under `/api/_lib` are not intercepted.

Note the behaviour change: `api/_lib/http.ts:8` **throws** if `JWT_SECRET` is unset or under 16 chars, whereas the deleted `api-auth.ts` silently fell back to `'journs-dev-jwt-secret-change-me'`. Local dev will now require a real `JWT_SECRET` in `.env`. This is the correct behaviour (dev should match prod) — verify `.env` has one before testing.

## 5. Mobile spacing

In `src/styles.css`, extend the existing "Responsive chrome" section (starts L470) so the density tokens step down. Because `[data-density="spacious"]` (L115) and `:root` (L5) have equal specificity, placing the override later in the file wins — no `!important` needed.

- ≤860px: `--pad: 14px; --pad-lg: 22px; --row-gap: 10px`
- ≤560px: `--pad: 11px; --pad-lg: 15px; --row-gap: 8px`

This flows through `--spacing-pad`/`--spacing-pad-lg`/`--spacing-row` (`@theme`, L147–149) into every `p-pad-lg`, `p-pad` and `gap-row` utility, so `Panel` (`src/hud.tsx:208`) and all eight screens tighten at once.

Then spot-fix only the places that bypass the tokens with hardcoded values:

- `src/hud.tsx:190` — Panel header `px-3.5 py-2.5`: reduce below 560px so the header aligns with the now-tighter body.
- `src/list.tsx:260,271` — empty-state `py-15` (60px): add a `max-phone:` reduction.
- `src/login.tsx:291` — `gap-8 … tablet:gap-10 laptop:gap-15`: the `max-tablet:gap-6` is still generous once panels tighten.
- `src/transparency.tsx` — `SchemaTable` cells `px-2.5 py-2` and the diagram wrapper `p-3`; check horizontal overflow at 375px.
- `src/hud.tsx:561` — `HudSelect` trigger and dropdown items `px-2.5 py-2`.

Do **not** touch the `max-tablet:min-h-11` / `.tap-target` rules (`src/styles.css:475`) — 44px touch targets are already correct.

## 6. Copy All button

In `src/login.tsx`, in the `create-phrase` block (L453–494), add a copy control next to the 12-word grid (L458–468).

- Reuse the existing `Btn` from `src/hud.tsx:226` with `variant="ghost"` — it already wires `SoundManager.click()`/`hover()` and the `max-tablet:min-h-11` tap target, so a new button needs no extra sound plumbing.
- Copy `phrase.join(' ')` — plain space-separated words, no index prefixes, so the result is a valid BIP39 mnemonic that pastes into other wallets.
- There is no toast library and no existing clipboard helper in the repo, so use `navigator.clipboard.writeText` directly with a local `copied` state that flips the label to `✓ COPIED` for ~2s.
- `navigator.clipboard` is a genuine boundary — undefined on insecure origins and it rejects when permission is denied. Catch and surface `COPY FAILED` rather than failing silently.
- Reset `copied` in the two existing paths that clear the phrase (the BACK handler at L484–488 and `confirmPhraseSaved`).
- Icons are hand-rolled inline SVG in this codebase (see `AudioIcon`, `src/hud.tsx:306`). Match that if an icon is wanted, or use a text-only label to stay minimal.

## 7. Smaller audit findings

- **`vercel` CLI is in `dependencies`** (`package.json:22`), not `devDependencies`. It is a large CLI package that has no business in the production dependency graph. Move it.
- **No `crons` entry in `vercel.json`** despite `api/cron/settle.ts` existing and gating on `CRON_SECRET`. The AURA settle job never runs on a schedule. Either add a `crons` block or confirm it's triggered externally.
- **`index.html:9`** — `<link rel="icon" href="/favicon.ico" type="image/png" />` declares a `.ico` as `image/png`. Should be `image/x-icon` (the `/logo.png` line below it is already correct).
- **Dead CSS** — remove `.twk-slider`, `.twk-swatch`, `.twk-field-select`, `.twk-num`, `.twk-panel` (`src/styles.css` ~L407–493, including the `.twk-panel` rule inside the ≤560px media query). Orphans of a removed tweak panel; no `twk-` reference exists in any `.tsx`. Keep the unused palettes/densities per your call.
- **`@vercel/node` devDependency appears unused** — `api/_lib/vercel.ts:1` explicitly hand-rolls the types to avoid the dep. Verify nothing else needs it before removing; low priority.
- Confirmed **not** problems, so no action: `api/auth/bundle.ts` and `api/auth/recover.ts` are genuinely different endpoints (GET wrap material vs. POST rotate); `.login-connectors` is used at `src/login.tsx:678`; the `LEGACY_*` keys in `src/identity.ts` are live, consumed by `clearLegacyLocalData()`.

---

## Verification

**API fix — check before deploying.** The `vercel` CLI is already installed, so the compiled output can be inspected locally:

```
npx vercel build
```

Then confirm `.vercel/output/functions/api/auth/register.func/` contains `shared/quests.js` and that the emitted `register.js` imports it with the `.js` extension. Same for `api/quests.func/`. This catches the failure without burning a deploy.

**Type checking:**
```
bun run build      # tsc -b now covers all of api/ + scripts/
```

**Local dev (exercises the refactored plugin against the real handlers):**
```
bun run dev
```
Ensure `JWT_SECRET` (≥16 chars) is set in `.env` first — see §4. Then walk the full flow: create account → 12 words shown → Copy All → paste elsewhere to confirm it's 12 space-separated words → verify 3 words → set passphrase → write an entry → open profile (hits `/api/quests`, the previously-broken route) → claim a quest → sign out → recover on a "new device" using the phrase.

**Mobile:** DevTools device toolbar at 375px and 320px across all six screens (login, list, reader, composer, profile, transparency). Check for horizontal overflow, that panel padding looks intentional rather than cramped, and that buttons still clear 44px. Re-check at 560px and 860px for regressions at the breakpoint edges.

**Deploy:** push to a Vercel preview and hit `/api/auth/register` and `/api/quests` before promoting.

## Files touched

`api/**/*.ts` (all 13) · `shared/quests.ts` · `tsconfig.node.json` · `scripts/vite-api-plugin.ts` (rewrite) · `scripts/api-router.ts` + `scripts/api-auth.ts` (delete) · `src/login.tsx` · `src/styles.css` · `src/hud.tsx` · `src/list.tsx` · `src/transparency.tsx` · `package.json` · `vercel.json` · `index.html`
