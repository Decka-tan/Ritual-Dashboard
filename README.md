# Ritual Dashboard

Community hub for Ritual dApps, deployed on Vercel with Supabase-backed admin editing and submission approval.

## What it does

- **Official Testnet**: live list of Ritual Testnet dApps stored in Supabase `official_apps`.
- **Pre-Testnet**: approved community submissions stored in Supabase `submissions`.
- **Admin route**: `/admin` for reviewing submissions and editing Official Testnet metadata.
- **Preview images**: static cached previews in `public/previews/` plus Microlink-generated external screenshot URLs for newly approved/refreshed apps.
- **Hero stats**: Official Testnet count, Pre-Testnet count, total builders without deduplication, and total dApps.
- **Hero background**: Mux HLS video background powered by `hls.js`.

## Stack

- Vite + React 18
- Tailwind CSS v4
- Vercel Serverless Functions under `api/`
- Supabase REST API via service role key
- Microlink screenshot URLs for approved/refreshed previews

## Run locally

```bash
npm install
npm run dev
```

Local dev starts Vite. API routes are intended for Vercel, so full submission/admin behavior should be tested on Vercel or with a compatible Vercel local environment.

## Build / preview

```bash
npm run build
npm run preview
```

## Required environment variables

Create `.env` locally and import the same values into Vercel:

```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-or-secret-key"
SUPABASE_ANON_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
ADMIN_PASSWORD="your-admin-password"
ADMIN_TOKEN_SECRET="optional-random-token-secret"
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.
- `.env` is ignored by git.
- `ADMIN_TOKEN_SECRET` is optional but recommended. If omitted, the app falls back to the service role key or admin password for token signing.

## Supabase setup

Open Supabase SQL Editor and run:

```txt
supabase-submissions.sql
```

That file safely uses `create table if not exists` and seeds/updates the current Official Testnet list.

Tables:

### `submissions`

Stores public Pre-Testnet submissions.

Important columns:

- `name`
- `url`
- `description`
- `creator_name`
- `creator_handle`
- `creator_url`
- `status`: `pending`, `approved`, or `rejected`
- `preview_url`
- `preview_status`
- `created_at`, `approved_at`, `rejected_at`

Public order is oldest approved first, so the earliest approved submission becomes Pre-Testnet site `#01`.

### `official_apps`

Stores admin-editable Official Testnet apps.

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
- `updated_at`

## Vercel deployment

The project is Vercel-ready. `vercel.json` routes:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This keeps direct routes like `/admin` working as a React route while preserving `/api/*` serverless functions.

Deployment checklist:

1. Push latest `main` to GitHub.
2. Import env vars into Vercel.
3. Run `supabase-submissions.sql` in Supabase.
4. Deploy/redeploy Vercel.
5. Test `/` and `/admin`.

## API routes

Public:

```txt
GET  /api/official-apps      list Official Testnet apps from Supabase
GET  /api/submissions        list approved Pre-Testnet submissions, oldest-first
POST /api/submissions        submit a new pending Pre-Testnet dApp
```

Admin:

```txt
POST  /api/admin/login             returns a signed admin token
GET   /api/admin/submissions       list all submissions, newest-first
POST  /api/admin/review            approve/reject a submission
GET   /api/admin/official-apps     list official apps for editing
PATCH /api/admin/official-apps     save official app edits
POST  /api/admin/official-apps     refresh official preview URL
```

Admin token is stored in `sessionStorage` by the frontend and sent as `Authorization: Bearer <token>`.

## Admin workflow

Go to:

```txt
/admin
```

After login, the admin page has two tabs:

- **Submissions**
  - review pending community dApps
  - approve or reject
  - approval sets a Microlink screenshot URL if no preview exists
- **Official Testnet**
  - edit site number, name, URL, builder name, builder link, description, and preview URL
  - refresh preview URL through Microlink

## Data flow

```txt
Public submit form
  -> POST /api/submissions
  -> Supabase submissions(status='pending')

Admin approve
  -> POST /api/admin/review
  -> Supabase submissions(status='approved', preview_url=Microlink URL)

Public dashboard
  -> GET /api/official-apps
  -> GET /api/submissions
  -> render Official Testnet + Pre-Testnet cards
```

If `/api/official-apps` fails, the frontend falls back to the static snapshot in `src/data/apps.js` + `src/data/appDetails.js`.

## Source sheet

Original community source sheet:

```txt
https://docs.google.com/spreadsheets/d/1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM/edit?gid=0#gid=0
```

Current production flow does **not** depend on live Google Sheet sync. Official apps are editable in Supabase through `/admin`.

## Project structure

```txt
api/                         Vercel API routes
api/_lib.js                  shared Supabase/auth/normalization helpers
src/App.jsx                  main dashboard, admin route, submission modal
src/Header.jsx               fixed header/navigation
src/Footer.jsx               footer/About section
src/HeroBackground.jsx       Mux HLS hero video background
src/data/apps.js             static Official Testnet fallback snapshot
src/data/appDetails.js       static metadata fallback snapshot
src/data/preTestnetApps.js   optional static Pre-Testnet fallback/archive
public/previews/             cached static preview images
supabase-submissions.sql     Supabase schema + official app seed data
```

## Useful scripts

```bash
npm run dev                         start Vite dev server
npm run build                       production build
npm run preview                     preview production build
```

## Security notes

- Do not commit `.env`.
- Keep Supabase service role/secret key only in server-side Vercel env vars.
- Browser reads/writes go through `/api/*`; Supabase RLS is enabled in the SQL file.
- Change `ADMIN_PASSWORD` in production.
- Add `ADMIN_TOKEN_SECRET` for cleaner admin token signing separation.

## Known tradeoffs

- Microlink screenshot URLs avoid iframe lag and Vercel serverless browser issues, but third-party screenshot capture may still show blocked/late-loading sites.
- Official app descriptions are manually editable. Automatic metadata fetching is not enabled yet to avoid low-quality scraped descriptions.
