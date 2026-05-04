# Ritual Dashboard

Community hub for Ritual dApps.

- **Testnet live** entries come from the official Google Sheet.
- **Pre-Testnet** entries live in `src/data/preTestnetApps.js` so older/community submissions can be archived separately.

## Run locally

```bash
npm install
npm run dev
```

## Build / preview

```bash
npm run build
npm run preview
```

## Production server / Coolify

This project now includes a small Node server for community submissions and admin approval.

Coolify settings:

```txt
Build Pack: Nixpacks
Install Command: npm install
Build Command: npm run build
Start Command: npm start
Port: 3000
```

Environment variables:

```txt
PORT=3000
ADMIN_PASSWORD=Sopmod123
```

Use a persistent volume for `data/` on Coolify if you do not want submissions to reset across redeploys.

## Data source

Google Sheet:
https://docs.google.com/spreadsheets/d/1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM/edit?gid=0#gid=0

The dashboard does not fetch the sheet in-browser. It uses a cron-friendly refresh pipeline:

1. `npm run sync-sheet` fetches the public Google Sheet CSV and rewrites `src/data/apps.js`.
2. `npm run capture-previews` captures/updates cached screenshots in `public/previews/` for both Testnet and Pre-Testnet apps.
3. `npm run build` rebuilds the static dashboard into `dist/`.

Run all steps:

```bash
npm run refresh
```

Refresh logs are written to `logs/refresh.log`. A lockfile at `logs/refresh.lock` prevents overlapping cron runs.

## Sheet configuration

Defaults:

- Sheet ID: `1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM`
- GID: `0`

Optional env overrides:

```bash
RITUAL_SHEET_ID="your-sheet-id"
RITUAL_SHEET_GID="0"
RITUAL_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
```

The sheet must be public/readable, or the CSV export will return an error.

## Community Pre-Testnet submissions

The header has two controls:

- **Submit dApp**: public community form. Submitted dApps are saved as `pending` and do not appear publicly yet.
- **Admin**: password-protected approval dashboard. Only approved entries appear in the Pre-Testnet section.

Default admin password:

```txt
Sopmod123
```

Recommended production override:

```bash
ADMIN_PASSWORD="your-strong-password"
```

Submissions are stored on the VPS in:

```txt
data/submissions.json
```

API routes:

```txt
POST /api/submissions                 public submit
GET  /api/submissions                 public approved list
POST /api/admin/login                 admin login
GET  /api/admin/submissions           admin list all
POST /api/admin/submissions/:id/approve
POST /api/admin/submissions/:id/reject
```

Static/manual archive entries can still be kept in `src/data/preTestnetApps.js`, but normal community submissions should go through the approval dashboard.

## VPS cron example

From the VPS project directory:

```bash
cd /path/to/Ritual-Dashboard
npm install
npx playwright install chromium
npm run refresh
```

Add cron:

```cron
*/30 * * * * cd /path/to/Ritual-Dashboard && /usr/bin/npm run refresh >> logs/cron.log 2>&1
```

If deployed with Nginx/static hosting, point the web root to `dist/`. The cron refresh rebuilds `dist/` every run.

## Windows Task Scheduler equivalent

Use this action if running on Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'D:\Codingers\Ritual-Dashboard'; npm run refresh"
```
