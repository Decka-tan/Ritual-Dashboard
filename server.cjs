const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

let chromium = null
try {
  ;({ chromium } = require('playwright'))
} catch {
  chromium = null
}

const PORT = Number(process.env.PORT || 3000)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sopmod123'
const ROOT = __dirname
const DIST_DIR = path.join(ROOT, 'dist')
const PUBLIC_DIR = path.join(ROOT, 'public')
const PREVIEWS_DIR = path.join(PUBLIC_DIR, 'previews')
const DATA_DIR = path.join(ROOT, 'data')
const DB_FILE = path.join(DATA_DIR, 'submissions.json')
const sessions = new Set()

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ submissions: [] }, null, 2))
  }
}

function readDb() {
  ensureDb()
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
    return { submissions: Array.isArray(data.submissions) ? data.submissions : [] }
  } catch {
    return { submissions: [] }
  }
}

function writeDb(data) {
  ensureDb()
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
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

function getBearerToken(req) {
  const auth = req.headers.authorization || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : ''
}

function requireAdmin(req, res) {
  const token = getBearerToken(req)
  if (!token || !sessions.has(token)) {
    sendJson(res, 401, { error: 'Unauthorized' })
    return false
  }
  return true
}

function cleanString(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeUrl(url) {
  const value = cleanString(url, 700)
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function makeId() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`
}

function slugify(value) {
  return String(value || 'submitted-app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'submitted-app'
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getDomain(url = '') {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return url || 'unknown-domain'
  }
}

async function captureFallbackPreview(item, filePath, reason = 'Preview unavailable') {
  if (!chromium) throw new Error('Playwright is not installed')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const safeName = escapeHtml(item.name)
  const safeDomain = escapeHtml(getDomain(item.url))
  const safeReason = escapeHtml(reason.split('\n')[0].slice(0, 180))
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;width:1440px;height:900px;overflow:hidden;background:#050505;color:#fafafa;font-family:Inter,Arial,sans-serif}.wrap{position:relative;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;padding:72px;background:radial-gradient(circle at 24% 18%,rgba(0,255,148,.24),transparent 34%),radial-gradient(circle at 82% 72%,rgba(0,255,148,.12),transparent 30%),linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px),#050505;background-size:auto,auto,48px 48px,48px 48px,auto}.card{width:100%;height:100%;border:1px solid #262626;border-radius:34px;background:rgba(18,18,18,.88);box-shadow:0 28px 100px rgba(0,0,0,.55);overflow:hidden}.chrome{height:76px;display:flex;align-items:center;gap:16px;padding:0 28px;border-bottom:1px solid #262626;background:rgba(5,5,5,.72)}.dots{display:flex;gap:10px}.dot{width:15px;height:15px;border-radius:999px}.red{background:#ff5f57}.yellow{background:#ffbd2e}.green{background:#28c840}.url{min-width:0;flex:1;border:1px solid #262626;border-radius:999px;padding:12px 18px;color:#a3a3a3;font:600 14px/1.1 monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#121212}.content{height:calc(100% - 76px);display:flex;flex-direction:column;justify-content:flex-end;padding:64px;background:linear-gradient(180deg,transparent,rgba(5,5,5,.78))}.badge{align-self:flex-start;border:1px solid rgba(0,255,148,.35);border-radius:999px;background:rgba(0,255,148,.1);color:#00ff94;padding:10px 14px;font:700 13px/1 monospace;text-transform:uppercase;letter-spacing:.16em}h1{max-width:940px;margin:30px 0 0;font:900 92px/.88 Impact,Arial Black,sans-serif;text-transform:uppercase;letter-spacing:-.035em}p{max-width:760px;margin:28px 0 0;color:#a3a3a3;font-size:26px;line-height:1.35}
  </style></head><body><div class="wrap"><div class="card"><div class="chrome"><div class="dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div><div class="url">${safeDomain}</div></div><div class="content"><div class="badge">Static fallback preview</div><h1>${safeName}</h1><p>${safeReason}. Open the app directly from the dashboard to view the live site.</p></div></div></div></body></html>`
  try {
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: filePath, type: 'png', fullPage: false })
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

async function captureSubmissionPreview(item) {
  const previewSlug = item.previewSlug || `submitted-${slugify(item.name)}-${item.id}`
  const filePath = path.join(PREVIEWS_DIR, `${previewSlug}.png`)
  const preview = `/previews/${previewSlug}.png`

  fs.mkdirSync(PREVIEWS_DIR, { recursive: true })
  item.previewSlug = previewSlug
  item.preview = preview
  item.previewStatus = 'capturing'
  item.previewUpdatedAt = new Date().toISOString()

  if (!chromium) {
    item.previewStatus = 'failed'
    item.previewError = 'Playwright is not installed in production dependencies'
    return item
  }

  let browser = null
  let page = null
  try {
    console.log(`[preview] Capturing ${item.name} ${item.url} -> ${preview}`)
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    })
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType()
      if (type === 'media' || type === 'font') return route.abort()
      return route.continue()
    })
    await page.goto(normalizeUrl(item.url), { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForLoadState('load', { timeout: 25000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
    await page.waitForTimeout(4500)
    await page.screenshot({ path: filePath, type: 'png', fullPage: false, animations: 'disabled' })
    item.previewStatus = 'ready'
    item.previewError = ''
    console.log(`[preview] Ready ${preview}`)
  } catch (error) {
    const reason = error.message || 'Preview capture failed'
    console.error(`[preview] Failed ${item.name}: ${reason}`)
    try {
      await captureFallbackPreview(item, filePath, reason)
      item.previewStatus = 'fallback'
      item.previewError = reason
    } catch (fallbackError) {
      item.previewStatus = 'failed'
      item.previewError = fallbackError.message || reason
    }
  } finally {
    await page?.close?.().catch(() => {})
    await browser?.close?.().catch(() => {})
    item.previewUpdatedAt = new Date().toISOString()
  }

  return item
}

async function handleApi(req, res, pathname) {
  console.log(`[api] ${req.method} ${pathname}`)
  if (req.method === 'GET' && pathname === '/api/submissions') {
    const db = readDb()
    sendJson(res, 200, {
      approved: db.submissions.filter((item) => item.status === 'approved'),
    })
    return true
  }

  if (req.method === 'POST' && pathname === '/api/submissions') {
    try {
      const body = await readBody(req)
      const name = cleanString(body.name, 120)
      const url = normalizeUrl(body.url)
      const builder = cleanString(body.builder, 120)
      const builderHandle = cleanString(body.builderHandle, 80)
      const builderUrl = normalizeUrl(body.builderUrl)
      const about = cleanString(body.about, 700)

      if (!name || !url || !builder || !about) {
        sendJson(res, 400, { error: 'Missing required submission fields' })
        return true
      }

      const db = readDb()
      const submission = {
        id: makeId(),
        name,
        url,
        builder,
        builderHandle,
        builderUrl,
        about,
        status: 'pending',
        previewStatus: 'pending',
        submittedAt: new Date().toISOString(),
      }
      db.submissions.unshift(submission)
      writeDb(db)
      sendJson(res, 201, { submission })
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Invalid submission' })
    }
    return true
  }

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    try {
      const body = await readBody(req)
      if (body.password !== ADMIN_PASSWORD) {
        sendJson(res, 401, { error: 'Wrong password' })
        return true
      }
      const token = crypto.randomBytes(24).toString('hex')
      sessions.add(token)
      sendJson(res, 200, { token })
    } catch {
      sendJson(res, 400, { error: 'Invalid login request' })
    }
    return true
  }

  if (req.method === 'GET' && pathname === '/api/admin/submissions') {
    if (!requireAdmin(req, res)) return true
    sendJson(res, 200, readDb())
    return true
  }

  const actionMatch = pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/(approve|reject)$/)
  if (req.method === 'POST' && actionMatch) {
    if (!requireAdmin(req, res)) return true
    const [, id, action] = actionMatch
    const db = readDb()
    const item = db.submissions.find((submission) => submission.id === id)
    if (!item) {
      sendJson(res, 404, { error: 'Submission not found' })
      return true
    }
    item.status = action === 'approve' ? 'approved' : 'rejected'
    item.reviewedAt = new Date().toISOString()

    if (action === 'approve') {
      await captureSubmissionPreview(item)
    }

    writeDb(db)
    sendJson(res, 200, { submission: item })
    return true
  }

  return false
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.startsWith(PREVIEWS_DIR) ? 'public, max-age=60' : 'public, max-age=3600',
    })
    res.end(content)
  })
}

function serveStatic(req, res, pathname) {
  if (pathname.startsWith('/previews/')) {
    const previewPath = path.resolve(PREVIEWS_DIR, `.${decodeURIComponent(pathname.replace('/previews', ''))}`)
    if (!previewPath.startsWith(PREVIEWS_DIR)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    serveFile(res, previewPath)
    return
  }

  const safePath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname)
  const filePath = path.resolve(DIST_DIR, `.${safePath}`)
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.readFile(filePath, (error, content) => {
    if (!error) {
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' })
      res.end(content)
      return
    }

    fs.readFile(path.join(DIST_DIR, 'index.html'), (indexError, indexContent) => {
      if (indexError) {
        res.writeHead(404)
        res.end('Build not found. Run npm run build first.')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(indexContent)
    })
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (url.pathname.startsWith('/api/')) {
    try {
      const handled = await handleApi(req, res, url.pathname)
      if (!handled) sendJson(res, 404, { error: 'API route not found' })
    } catch (error) {
      console.error(`[api] ${req.method} ${url.pathname} failed`, error)
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' })
    }
    return
  }
  serveStatic(req, res, url.pathname)
})

ensureDb()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ritual Dashboard server listening on http://0.0.0.0:${PORT}`)
})
