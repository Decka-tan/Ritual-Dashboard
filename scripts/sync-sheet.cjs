const fs = require('fs')
const path = require('path')

const DEFAULT_SHEET_ID = '1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM'
const DEFAULT_GID = '0'
const outputPath = path.resolve(__dirname, '..', 'src', 'data', 'apps.js')
const metaPath = path.resolve(__dirname, '..', 'src', 'data', 'apps-meta.json')

const sheetId = process.env.RITUAL_SHEET_ID || DEFAULT_SHEET_ID
const gid = process.env.RITUAL_SHEET_GID || DEFAULT_GID
const csvUrl = process.env.RITUAL_SHEET_CSV_URL || `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        value += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(value)
      value = ''
    } else if (char === '\n') {
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else if (char !== '\r') {
      value += char
    }
  }

  row.push(value)
  rows.push(row)
  return rows.filter((items) => items.some((item) => item.trim()))
}

function normalizeHeader(value = '') {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeUrl(url = '') {
  const cleaned = url.trim()
  if (!cleaned) return ''
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
}

function findColumn(headers, candidates) {
  const normalized = headers.map(normalizeHeader)
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate))
    if (index !== -1) return index
  }
  return -1
}

function looksLikeUrl(value = '') {
  return /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}/i.test(value.trim())
}

function toApps(rows) {
  if (rows.length < 2) return []

  const headers = rows[0]
  let nameIndex = findColumn(headers, ['name', 'app', 'app name', 'dapp', 'dapp name', 'project', 'title'])
  let urlIndex = findColumn(headers, ['url', 'link', 'website', 'site', 'dapp url', 'app url'])

  if (urlIndex === -1) {
    urlIndex = headers.findIndex((_, index) => rows.slice(1).some((row) => looksLikeUrl(row[index] || '')))
  }

  if (nameIndex === -1) {
    nameIndex = headers.findIndex((_, index) => index !== urlIndex && rows.slice(1).some((row) => (row[index] || '').trim()))
  }

  if (nameIndex === -1 || urlIndex === -1) {
    throw new Error(`Unable to detect name/url columns. Headers: ${headers.join(' | ')}`)
  }

  const seen = new Set()
  return rows.slice(1).map((row) => {
    const name = (row[nameIndex] || '').trim()
    const url = normalizeUrl(row[urlIndex] || '')
    return { name, url }
  }).filter((app) => {
    if (!app.name || !app.url || !looksLikeUrl(app.url)) return false
    const key = `${app.name.toLowerCase()}|${app.url.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function writeAppsFile(apps) {
  const body = apps.map((app) => `  {\n    name: ${JSON.stringify(app.name)},\n    url: ${JSON.stringify(app.url)}\n  }`).join(',\n')
  const content = `export const apps = [\n${body}\n]\n`
  fs.writeFileSync(outputPath, content)
}

async function main() {
  console.log(`Fetching sheet CSV: ${csvUrl}`)
  const response = await fetch(csvUrl, {
    headers: {
      'user-agent': 'RitualDashboardSync/1.0',
      accept: 'text/csv,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`Google Sheet fetch failed: HTTP ${response.status} ${response.statusText}. Make sure the sheet is public/readable or set RITUAL_SHEET_CSV_URL.`)
  }

  const csv = await response.text()
  const rows = parseCsv(csv)
  const apps = toApps(rows)

  if (!apps.length) {
    throw new Error('No valid apps found from sheet CSV.')
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  writeAppsFile(apps)
  fs.writeFileSync(metaPath, JSON.stringify({ syncedAt: new Date().toISOString(), source: csvUrl, count: apps.length }, null, 2))

  console.log(`Synced ${apps.length} apps -> ${outputPath}`)
  console.log(`Metadata -> ${metaPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
