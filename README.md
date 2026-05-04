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

## Add Pre-Testnet community dApps

Manual file:

```js
// src/data/preTestnetApps.js
export const preTestnetApps = [
  {
    name: "Example dApp",
    url: "https://example.com/",
    builder: "Creator Name",
    builderUrl: "https://x.com/creator/status/123",
    about: "Short description of what the dApp does."
  }
]
```

Helper command using an X/Twitter post and vxTwitter-compatible API:

```bash
npm run add-pretestnet -- --x=https://x.com/creator/status/123 --url=https://example.com/ --name="Example dApp" --about="Short description"
```

If the tweet exposes a website URL through vxTwitter, `--url` can be omitted. If no website is detected, pass `--url` manually.

After adding entries:

```bash
npm run capture-previews
npm run build
```

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
