# Ritual Dashboard

Community dashboard for Ritual ecosystem dApps. It shows Official Testnet apps, approved Pre-Testnet/community submissions, and an admin panel for reviewing submissions, editing metadata, refreshing previews, and syncing official apps from a Google Sheet.

## Stack

- React 18 + Vite 5
- Tailwind CSS v4 via `@tailwindcss/vite`
- Vercel Serverless Functions in `api/`
- Supabase REST API, accessed server-side with the service role key
- Microlink screenshot URLs for generated app previews
- `hls.js` for the hero video background

## Features

- Public dashboard with Official Testnet and Pre-Testnet sections.
- Community dApp submission form.
- Admin login at `/admin`.
- Admin review flow for approving/rejecting submissions.
- Admin editor for Official Testnet and approved Pre-Testnet app metadata.
- Manual Google Sheet sync for Official Testnet apps.
- Static preview fallback images in `public/previews/`.
- Static frontend fallback data in `src/data/` if public API reads fail.

## Project structure

```txt
api/                         Vercel API routes
api/_lib.js                  Shared Supabase, auth, JSON, and normalization helpers
api/admin/login.js           Admin password login -> signed admin token
api/admin/review.js          Approve/reject community submissions
api/admin/official-apps.js   Admin Official Testnet CRUD-like actions
api/admin/pretestnet-apps.js Admin approved Pre-Testnet editing/preview seeding
api/admin/submissions/       Admin submissions listing route
api/official-apps.js         Public Official Testnet API
api/submissions.js           Public approved submissions + submit endpoint
api/sync-sheet.js            Google Sheet CSV -> Supabase official_apps sync
src/App.jsx                  Main dashboard, submit modal, admin page/modal
src/Header.jsx               Header/navigation
src/Footer.jsx               Footer/About section
src/HeroBackground.jsx       Hero HLS video background
src/data/                    Static fallback snapshots
public/previews/             Cached preview images
supabase-submissions.sql     Supabase schema and seed data
vercel.json                  Vercel SPA/API rewrites
vite.config.js               Vite config
```

## Local development

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

By default `vite.config.js` starts the dev server on `0.0.0.0:4173`.

> Note: the `/api/*` routes are designed for Vercel Serverless Functions. For full API/admin testing locally, use Vercel CLI (`vercel dev`) with the same environment variables.

## Build

```bash
npm run build
npm run preview
```

Verified during this review:

```txt
npm run build -> passed
```

Current build status:

```txt
npm run build -> passed with no large chunk warning after admin/HLS code-splitting.
```

The admin dashboard and HLS player are loaded separately from the main public dashboard bundle.

## Environment variables

Set these in Vercel Project Settings and in local `.env` / `.env.local` when testing APIs:

```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
ADMIN_PASSWORD="strong-admin-password"
ADMIN_TOKEN_SECRET="long-random-token-signing-secret"
CRON_SECRET="long-random-secret-for-sheet-sync"
RITUAL_SHEET_ID="1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM"
RITUAL_SHEET_GID="0"
RITUAL_SHEET_CSV_URL="optional-full-published-csv-url"
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. Never expose it through `VITE_*` variables.
- `ADMIN_PASSWORD` is required. The login API fails closed if it is missing.
- `ADMIN_TOKEN_SECRET` is strongly recommended so admin token signing is separated from the database key and password.
- `CRON_SECRET` protects `GET /api/sync-sheet` and can also authorize `POST /api/sync-sheet`.
- `RITUAL_SHEET_ID` and `RITUAL_SHEET_GID` are optional because defaults are provided.
- `RITUAL_SHEET_CSV_URL` can override the generated Google Sheet export URL.

## Supabase setup

Run the SQL file in Supabase SQL Editor:

```txt
supabase-submissions.sql
```

It creates/enables:

### `submissions`

Stores public community submissions and approved Pre-Testnet apps.

Important columns:

- `name`
- `url`
- `description`
- `creator_handle`
- `creator_name`
- `creator_url`
- `site_number`
- `status`: `pending`, `approved`, `rejected`
- `preview_url`
- `preview_status`
- `created_at`, `approved_at`, `rejected_at`

### `official_apps`

Stores Official Testnet apps synced from the Google Sheet and edited by admins.

Important columns:

- `site_number`
- `name`
- `url`
- `description`
- `creator_name`
- `creator_handle`
- `creator_url`
- `preview_url`
- `preview_status`
- `source`
- `created_at`, `updated_at`

RLS is enabled in the SQL file. Public browser access should stay closed; all database reads/writes go through server-side `/api/*` routes.

## API routes

### Public

```txt
GET  /api/official-apps   List Official Testnet apps from Supabase
GET  /api/submissions     List approved Pre-Testnet apps and hidden non-approved URLs
POST /api/submissions     Submit a pending Pre-Testnet dApp
```

### Admin

All admin routes require `Authorization: Bearer <admin-token>` except login.

```txt
POST  /api/admin/login             Login with ADMIN_PASSWORD, returns token
GET   /api/admin/submissions       List all submissions
POST  /api/admin/review            Approve or reject a submission
GET   /api/admin/official-apps     List Official Testnet apps for editing
PATCH /api/admin/official-apps     Save Official Testnet app edits
POST  /api/admin/official-apps     Refresh Official Testnet preview URL
GET   /api/admin/pretestnet-apps   List approved Pre-Testnet apps for editing
PATCH /api/admin/pretestnet-apps   Save approved Pre-Testnet app edits
POST  /api/admin/pretestnet-apps   Refresh preview or seed static Pre-Testnet apps
```

### Google Sheet sync

```txt
GET  /api/sync-sheet    Requires Authorization: Bearer <CRON_SECRET>
POST /api/sync-sheet    Requires admin token or Authorization: Bearer <CRON_SECRET>
```

The sync flow is insert-only by `site_number`:

```txt
Google Sheet CSV -> /api/sync-sheet -> Supabase official_apps
```

Existing `site_number` rows are skipped, so manual admin edits are not overwritten.

## Admin workflow

1. Open `/admin`.
2. Login with `ADMIN_PASSWORD`.
3. Use **Submissions** to approve or reject community dApps.
4. Use **Official Testnet** to sync the Google Sheet, edit app metadata, and refresh preview URLs.
5. Use **Pre-Testnet** admin controls to edit approved community apps and refresh previews.

Admin tokens are stored in `sessionStorage` by the frontend and expire after 24 hours.

## Data flow

```txt
Community submit form
  -> POST /api/submissions
  -> Supabase submissions(status='pending')

Admin approval
  -> POST /api/admin/review
  -> Supabase submissions(status='approved')
  -> preview_url defaults to Microlink screenshot URL

Official sync
  -> POST /api/sync-sheet
  -> Google Sheet CSV
  -> Supabase official_apps insert-only by site_number

Dashboard
  -> GET /api/official-apps
  -> GET /api/submissions
  -> render app cards
```

## Deployment checklist

1. Push the repository to GitHub.
2. Create/import the Vercel project.
3. Add all required environment variables in Vercel.
4. Run `supabase-submissions.sql` in Supabase.
5. Deploy Vercel.
6. Test `/` public dashboard.
7. Test `/admin` login.
8. Submit a test dApp and approve/reject it.
9. Run Official Testnet Google Sheet sync from admin.
10. Confirm previews and fallback images render correctly.

## Review notes / things to fix next

This pass cloned the repo, reviewed the codebase, ran production builds, fixed one security issue, and reduced the public dashboard bundle by code-splitting admin/HLS code.

### Fixed now

- Removed the hardcoded fallback admin password (`Sopmod123`) from `api/_lib.js`.
- Added fail-closed behavior in `api/admin/login.js` when `ADMIN_PASSWORD` is not configured.
- Rewrote this README with current setup, deployment, APIs, and known risks.
- Split the admin dashboard into `src/AdminDashboardModal.jsx` and lazy-load it from `/admin`.
- Moved shared frontend API fetch logic into `src/api.js`.
- Changed hero HLS loading to a dynamic `hls.js/dist/hls.light.mjs` import.

### Recommended next fixes

1. **Add linting and formatting**
   - There is no `lint` script yet.
   - Add ESLint + Prettier to catch unused imports, hook dependency issues, and style drift.

2. **Rate-limit public submissions and admin login**
   - `POST /api/submissions` and `POST /api/admin/login` have no rate limiting.
   - Add IP-based throttling or a provider-level WAF/Edge rate limit on Vercel.

3. **Harden URL validation**
   - `normalizeUrl()` accepts any `http(s)` URL after basic normalization.
   - Consider rejecting private IPs, localhost, unsupported protocols, and suspicious domains before using external screenshot services.

4. **Improve token comparison**
   - `requireAdmin()` compares signatures with normal string equality.
   - Use a timing-safe comparison where runtime support allows it.

5. **Avoid leaking internal errors to public clients**
   - Several API catch blocks return `error.message` directly.
   - Log full details server-side and return safer generic messages for public endpoints.

6. **Add tests for API helpers**
   - `parseCsv`, `rowsToOfficialApps`, token signing, and normalization logic are important and currently untested.

7. **Clarify Google Sheet sync semantics in UI**
   - The sync is insert-only by `site_number`.
   - If the sheet changes an existing row, admin must edit it manually or the sync logic must be changed to upsert selectively.

## Source sheet

Default Official Testnet source sheet:

```txt
https://docs.google.com/spreadsheets/d/1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM/edit?gid=0#gid=0
```

## Security reminders

- Do not commit `.env` files.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in server-side environments.
- Set a strong `ADMIN_PASSWORD` before deployment.
- Set `ADMIN_TOKEN_SECRET` before deployment.
- Protect `/api/sync-sheet` with `CRON_SECRET`.
- Rotate secrets if they were ever exposed in screenshots, logs, commits, or Discord messages.
