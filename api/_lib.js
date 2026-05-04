const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sopmod123'
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || SUPABASE_SERVICE_ROLE_KEY || ADMIN_PASSWORD
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(payload)
}

export function cleanString(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

export function normalizeUrl(url) {
  const value = cleanString(url, 700)
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}

  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

export async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are not configured')
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error || `Supabase request failed (${response.status})`
    throw new Error(message)
  }
  return data
}

export function toClientSubmission(row = {}) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    builder: row.creator_name || row.builder || row.creator_handle || 'Unknown',
    builderHandle: row.creator_handle || '',
    builderUrl: row.creator_url || '',
    about: row.description || row.about || '',
    status: row.status || 'pending',
    preview: row.preview_url || row.preview || '',
    previewStatus: row.preview_status || row.previewStatus || 'pending',
    submittedAt: row.created_at || row.submitted_at || row.submittedAt || '',
    reviewedAt: row.approved_at || row.rejected_at || row.reviewed_at || row.reviewedAt || '',
  }
}

export function toDbSubmission(body = {}) {
  return {
    name: cleanString(body.name, 120),
    url: normalizeUrl(body.url),
    description: cleanString(body.about || body.description, 700),
    creator_name: cleanString(body.builder || body.creator_name, 120),
    creator_handle: cleanString(body.builderHandle || body.creator_handle, 80),
    creator_url: normalizeUrl(body.builderUrl || body.creator_url),
    status: 'pending',
    preview_status: 'pending',
  }
}

export async function listSubmissions(filter = '') {
  const rows = await supabaseFetch(`/submissions?select=*&order=created_at.desc${filter}`)
  return rows.map(toClientSubmission)
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

async function hmac(value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Buffer.from(signature).toString('base64url')
}

export async function createAdminToken() {
  const payload = base64url(JSON.stringify({ role: 'admin', exp: Date.now() + TOKEN_TTL_MS }))
  const signature = await hmac(payload)
  return `${payload}.${signature}`
}

function getBearerToken(req) {
  const auth = req.headers.authorization || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : ''
}

export async function requireAdmin(req, res) {
  const token = getBearerToken(req)
  const [payload, signature] = token.split('.')
  if (!payload || !signature || signature !== await hmac(payload)) {
    sendJson(res, 401, { error: 'Unauthorized' })
    return false
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (data.role !== 'admin' || !data.exp || Date.now() > data.exp) throw new Error('Expired')
    return true
  } catch {
    sendJson(res, 401, { error: 'Unauthorized' })
    return false
  }
}

export function screenshotUrlFor(url) {
  const target = encodeURIComponent(normalizeUrl(url))
  return `https://api.microlink.io/?url=${target}&screenshot=true&embed=screenshot.url&waitUntil=networkidle2&viewport.width=1440&viewport.height=900&meta=false`
}
