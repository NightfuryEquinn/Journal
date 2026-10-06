# Deployment guide

Rehost Journs from scratch on **Vercel** (static SPA + serverless API), **MongoDB Atlas** (database) and **cron-job.org** (scheduler). The free tiers of all three are enough.

> **License note.** Journs is under the [Business Source License 1.1](LICENSE). Running your own copy for personal use is fine; read the Additional Use Grant before offering it as a competing service.

## What you will end up with

```
Browser ──► Vercel (dist/ static files + /api/* functions) ──► MongoDB Atlas
                         ▲
cron-job.org ──POST /api/cron every 15 min (Bearer CRON_SECRET)
```

| Piece         | Role                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| Vercel        | Serves the Vite build and runs `api/**` as serverless functions, same origin    |
| MongoDB Atlas | Stores ciphertext, key wraps, quest progress, push subscriptions                |
| cron-job.org  | Calls `/api/cron` to settle quests and send reminders (Vercel Cron is not used) |

## 1. Prerequisites

- [Bun](https://bun.sh) (the repo uses `bun.lock`) and Git
- Accounts: [GitHub](https://github.com), [Vercel](https://vercel.com), [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), [cron-job.org](https://cron-job.org)
- Your own copy of the repo on GitHub (fork it, or push a clone to a new repo)

## 2. Clone and install

```bash
git clone https://github.com/<you>/<repo>.git journs
cd journs
bun install        # also installs the Husky git hooks via `prepare`
cp .env.example .env    # PowerShell: Copy-Item .env.example .env
```

You will fill `.env` in as you go. Every variable:

| Variable                | Required | Where it is read | Purpose                                                                  |
| ----------------------- | -------- | ---------------- | ------------------------------------------------------------------------ |
| `MONGODB_URI`           | yes      | server, scripts  | Atlas connection string                                                  |
| `MONGODB_DB`            | no       | server, scripts  | Database name, default `journs`                                          |
| `JWT_SECRET`            | yes      | server           | Signs session tokens, at least 16 characters                             |
| `CRON_SECRET`           | yes      | server           | Bearer token for `/api/cron`, at least 16 characters                     |
| `ALLOWED_ORIGINS`       | no       | server           | Comma-separated origins allowed cross-site; leave empty when same-origin |
| `VAPID_PUBLIC_KEY`      | yes\*    | server           | Web Push public key                                                      |
| `VAPID_PRIVATE_KEY`     | yes\*    | server           | Web Push private key                                                     |
| `VAPID_SUBJECT`         | yes\*    | server           | `mailto:you@example.com` or an `https://` URL                            |
| `VITE_VAPID_PUBLIC_KEY` | yes\*    | browser, build   | Same value as `VAPID_PUBLIC_KEY`; baked in at build time                 |
| `VITE_API_BASE`         | no       | browser, build   | Leave empty (same-origin `/api`)                                         |

\*Required for reminders. Without the VAPID keys the journal still works, but `/api/cron` reports the push half as failed and the reminder toggle is disabled.

## 3. MongoDB Atlas

1. **Create a cluster.** Atlas → _Create_ → free **M0** cluster. Pick the region closest to your Vercel functions. Vercel's default function region is `iad1` (Washington D.C.), so AWS `us-east-1` is a good match.
2. **Create a database user.** _Security → Database Access → Add New Database User_ → password authentication → built-in role **Read and write to any database** (or a custom role with `readWrite` on `journs` only). Use a generated password with no special characters, or URL-encode it later.
3. **Allow network access.** _Security → Network Access → Add IP Address_:
   - `0.0.0.0/0` (Allow access from anywhere). Vercel functions have no fixed egress IPs, so this is required. Access is still protected by the user and password.
   - Optionally add your own IP for local development and the maintenance scripts (covered by the entry above).
4. **Get the connection string.** _Database → Connect → Drivers_ and copy the `mongodb+srv://…` string. Replace `<password>` with the user's password (URL-encode `@ : / ? # %` and similar characters).
5. **Fill `.env`:**

   ```bash
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=journs
   ```

6. **Collections.** Nothing to create by hand: `users`, `entries`, `quest_progress` and `push_subscriptions` appear on first write, and the unique index on `push_subscriptions.endpoint` is created automatically at connection time (`api/_lib/db.ts`).
7. **Optional indexes** (recommended; they match the queries the API makes and make account registration race-safe). In _Atlas → Browse Collections → your database → Indexes_, or in `mongosh`:

   ```js
   use journs
   db.users.createIndex({ accountId: 1 }, { unique: true })
   db.entries.createIndex({ accountId: 1, entryId: 1 }, { unique: true })
   db.quest_progress.createIndex({ accountId: 1 }, { unique: true })
   ```

> Local development on Windows: if `mongodb+srv` DNS lookups fail, `api/_lib/resolve-uri.ts` falls back to `nslookup` and connects directly. Nothing to configure; on Vercel the SRV URI is used as-is.

## 4. Generate secrets

```bash
# JWT_SECRET and CRON_SECRET — run twice, one value each (works in bash and PowerShell)
bun -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

# VAPID keys for Web Push — run once
bunx web-push generate-vapid-keys
```

Put them in `.env`:

```bash
JWT_SECRET=<64 hex chars>
CRON_SECRET=<a different 64 hex chars>
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:you@example.com
VITE_VAPID_PUBLIC_KEY=<same value as VAPID_PUBLIC_KEY>
```

Keep these somewhere safe. **Do not regenerate the VAPID keys later**: every existing push subscription is bound to the old public key and would stop working.

## 5. Run it locally

```bash
bun run dev                          # http://localhost:5173 — SPA + /api in one process
```

Create a user, save the 12-word phrase, write an entry. Then check the production build with the production security headers:

```bash
bun run build
bun run preview
```

## 6. Deploy to Vercel

### Option A: dashboard

1. Push your repo to GitHub.
2. Vercel → _Add New → Project_ → import the repo.
3. Settings (Vercel detects most of this):

   | Setting          | Value                                          |
   | ---------------- | ---------------------------------------------- |
   | Framework Preset | Vite                                           |
   | Root Directory   | `./`                                           |
   | Install Command  | `bun install` (default when `bun.lock` exists) |
   | Build Command    | `bun run build`                                |
   | Output Directory | `dist`                                         |
   | Node.js Version  | 24.x                                           |

4. **Environment Variables**: add every variable from the table in step 2 (Production, and Preview if you want preview deployments to work). Leave `VITE_API_BASE` and `ALLOWED_ORIGINS` empty or unset.
5. _Settings → Functions → Function Region_: pick the region that matches your Atlas cluster (for example Washington, D.C. `iad1` for AWS `us-east-1`).
6. **Deploy.**
7. _Optional:_ in the project, open _Analytics_ and click _Enable_. The app already mounts `@vercel/analytics` (page views only). Add a custom domain under _Settings → Domains_.

`vercel.json` is picked up automatically: it routes `/api/*` to the functions, everything else to `index.html`, and sets the CSP, `Referrer-Policy` and `nosniff` headers.

> Do **not** enable Vercel Cron or add `crons` to `vercel.json`. Scheduling is done by cron-job.org (step 7).

### Option B: CLI

```bash
bunx vercel login
bunx vercel link                      # create / pick the project

# add each variable once per environment; paste the value when prompted
bunx vercel env add MONGODB_URI production
bunx vercel env add MONGODB_DB production
bunx vercel env add JWT_SECRET production
bunx vercel env add CRON_SECRET production
bunx vercel env add VAPID_PUBLIC_KEY production
bunx vercel env add VAPID_PRIVATE_KEY production
bunx vercel env add VAPID_SUBJECT production
bunx vercel env add VITE_VAPID_PUBLIC_KEY production
# repeat with `preview` instead of `production` if you use preview deployments

bunx vercel --prod                    # build and deploy
```

`bunx vercel env pull .env.local` copies the project's variables back to a local file.

### Gotchas

- `VITE_*` values are compiled into the JavaScript bundle. After changing one, **redeploy** (Deployments → ⋯ → Redeploy).
- Leave `VITE_API_BASE` empty. The CSP has `connect-src 'self'`, so pointing the app at a different API origin also requires editing the CSP in `vercel.json`, and that origin must be listed in `ALLOWED_ORIGINS`.
- The site must be served over HTTPS for service workers and Web Push; Vercel does this by default.

## 7. Schedule the cron job (cron-job.org)

Quest settlement and push reminders both run from one endpoint.

1. cron-job.org → _Create cronjob_.
2. **URL:** `https://<your-domain>/api/cron`
3. **Schedule:** every **15 minutes**. Reminders use a 15-minute window; a slower cadence skips reminder slots.
4. _Advanced_:
   - **Request method:** `POST`
   - **Headers:** `Authorization` = `Bearer <your CRON_SECRET>`
5. Save and enable.

Test it by hand:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron
# → {"ok":true,"settle":{...},"push":{...},"at":"..."}

# force the 09:00 reminder slot (dedup still applies, so a re-run is a no-op)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://<your-domain>/api/cron?hour=9"
```

`ok: false` (HTTP 500) means one half failed; the other half's result is still reported in the body.

## 8. Verify the deployment

- [ ] The site loads over HTTPS and shows the landing page.
- [ ] You can create a user, write an entry, reload and unlock again.
- [ ] In Atlas _Browse Collections_: `entries` contains only `ciphertext` and `nonce`, not readable text.
- [ ] _Profile → Notifications_ can be enabled, and the forced-slot `curl` above sends a notification.
- [ ] On iPhone / iPad: _Share → Add to Home Screen_ first. iOS only delivers push to an installed PWA.
- [ ] cron-job.org shows green runs; the response includes `"ok": true`.

## 9. Operating it

**Updates.** Pushing to the connected branch redeploys automatically. CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck and knip on pushes to `develop` and on pull requests.

**Maintenance scripts** read `MONGODB_URI` and `MONGODB_DB` from your local `.env`, so point it at the database you mean to touch. Both require `--confirm`:

```bash
bun run db:purge-stale -- --confirm   # delete users inactive for 90+ days (and their data)
bun run db:drop-all -- --confirm      # wipe every collection — destructive
```

**Secrets rotation.**

- `JWT_SECRET`: changing it signs everyone out (12 h tokens), nothing else is lost.
- `CRON_SECRET`: change it in Vercel and in the cron-job.org header together.
- VAPID keys: avoid; see the warning in step 4.

## Troubleshooting

| Symptom                                                                  | Cause / fix                                                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `MongoServerSelectionError` / timeouts                                   | Atlas _Network Access_ does not allow `0.0.0.0/0`, or the password is not URL-encoded           |
| `MONGODB_URI is not set`                                                 | Variable missing in the Vercel environment you deployed to; add it and redeploy                 |
| `JWT_SECRET must be set (min 16 chars)`                                  | Missing or too short                                                                            |
| `/api/cron` returns 401                                                  | The `Authorization: Bearer …` header does not exactly match `CRON_SECRET`                       |
| `/api/cron` returns 500 `CRON_SECRET not configured`                     | Set `CRON_SECRET` in the Vercel environment and redeploy                                        |
| `/api/cron` returns 405                                                  | The job must use `POST`, not `GET`                                                              |
| `/api/cron` returns `"VAPID keys not configured"`                        | Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`                                 |
| Reminder toggle disabled / "VITE_VAPID_PUBLIC_KEY not set at build time" | Set `VITE_VAPID_PUBLIC_KEY`, then **redeploy**                                                  |
| Reminders arrive late or not at all                                      | Cron cadence slower than 15 minutes; check the cron-job.org run history                         |
| No notifications on iOS                                                  | The app must be added to the Home Screen first                                                  |
| Browser CORS errors                                                      | Calling the API from another origin: add it to `ALLOWED_ORIGINS` (and see the CSP gotcha above) |
| Blank page after a deploy                                                | Check _Build Logs_ for a failed `tsc -b`; run `bun run build` locally first                     |
