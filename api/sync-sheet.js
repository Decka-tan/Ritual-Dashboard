import { cleanString, normalizeUrl, requireAdmin, screenshotUrlFor, sendJson, supabaseFetch } from './_lib.js'

const DEFAULT_SHEET_ID = '1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM'
const DEFAULT_GID = '0'
const CRON_SECRET = process.env.CRON_SECRET || ''

export function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        value += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(value)
      value = ''
    } else if (char === '\n') {
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else if (char !== '\r') value += char
  }

  row.push(value)
  rows.push(row)
  return rows.filter((items) => items.some((item) => item.trim()))
}

function normalizeHeader(value = '') {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
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
  return /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}/i.test(value.trim()) || /^https?:\/\/t\.me\//i.test(value.trim())
}

function valueAt(row, index) {
  return index >= 0 ? cleanString(row[index], 900) : ''
}

export function rowsToOfficialApps(rows) {
  if (rows.length < 2) return []

  const headers = rows[0]
  let nameIndex = findColumn(headers, ['name', 'app', 'app name', 'dapp', 'dapp name', 'project', 'title'])
  let urlIndex = findColumn(headers, ['url', 'link', 'website', 'site', 'dapp url', 'app url'])
  const descriptionIndex = findColumn(headers, ['description', 'about', 'what is it about', 'what is this', 'details', 'summary'])
  const builderIndex = findColumn(headers, ['builder', 'builder name', 'creator', 'creator name', 'developer', 'author', 'submitted by'])
  const builderUrlIndex = findColumn(headers, ['builder url', 'creator url', 'builder link', 'creator link', 'x', 'twitter', 'github', 'profile'])
  const previewIndex = findColumn(headers, ['preview', 'preview url', 'screenshot', 'screenshot url', 'image'])

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
  return rows.slice(1).map((row, index) => {
    const name = valueAt(row, nameIndex)
    const url = normalizeUrl(valueAt(row, urlIndex))
    const key = `${name.toLowerCase()}|${url.toLowerCase()}`
    if (!name || !url || !looksLikeUrl(url) || seen.has(key)) return null
    seen.add(key)

    const preview = normalizeUrl(valueAt(row, previewIndex))
    return {
      site_number: index + 1,
      name,
      url,
      description: valueAt(row, descriptionIndex),
      creator_name: valueAt(row, builderIndex) || 'Unknown',
      creator_url: normalizeUrl(valueAt(row, builderUrlIndex)),
      preview_url: preview || screenshotUrlFor(url),
      preview_status: preview ? 'sheet' : 'external',
      source: 'google-sheet',
      updated_at: new Date().toISOString(),
    }
  }).filter(Boolean).map((app, index) => ({ ...app, site_number: index + 1 }))
}

function isAuthorized(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return CRON_SECRET && token && token === CRON_SECRET
}

async function fetchSheetCsv() {
  const sheetId = process.env.RITUAL_SHEET_ID || DEFAULT_SHEET_ID
  const gid = process.env.RITUAL_SHEET_GID || DEFAULT_GID
  const csvUrl = process.env.RITUAL_SHEET_CSV_URL || `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  const response = await fetch(csvUrl, {
    headers: {
      'user-agent': 'RitualDashboardSync/2.0',
      accept: 'text/csv,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`Google Sheet fetch failed: HTTP ${response.status} ${response.statusText}`)
  }

  return { csv: await response.text(), csvUrl }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    if (req.method === 'POST') {
      if (!isAuthorized(req) && !await requireAdmin(req, res)) return
    } else if (!isAuthorized(req)) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }

    const { csv, csvUrl } = await fetchSheetCsv()
    const apps = rowsToOfficialApps(parseCsv(csv))
    if (!apps.length) throw new Error('No valid official apps found in Google Sheet')

    const existingRows = await supabaseFetch('/official_apps?select=site_number')
    const existingSiteNumbers = new Set(existingRows.map((row) => Number(row.site_number)))
    const newApps = apps.filter((app) => !existingSiteNumbers.has(Number(app.site_number)))

    const rows = newApps.length
      ? await supabaseFetch('/official_apps', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(newApps),
      })
      : []

    sendJson(res, 200, {
      ok: true,
      mode: 'insert-only',
      source: csvUrl,
      scanned: apps.length,
      inserted: rows.length,
      skippedExisting: apps.length - rows.length,
      sample: rows.slice(0, 3).map((row) => ({ site_number: row.site_number, name: row.name, url: row.url })),
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Google Sheet sync failed' })
  }
}
