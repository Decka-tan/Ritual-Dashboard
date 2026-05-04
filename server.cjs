const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PORT = Number(process.env.PORT || 3000)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sopmod123'
const ROOT = __dirname
const DIST_DIR = path.join(ROOT, 'dist')
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

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/submissions') {
    const db = readDb()
    sendJson(res, 200, {
      approved: db.submissions.filter((item) => item.status === 'approved'),
      pending: requireAdmin(req, { ...res, writeHead: () => {}, end: () => {} }) ? db.submissions.filter((item) => item.status === 'pending') : undefined,
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
    writeDb(db)
    sendJson(res, 200, { submission: item })
    return true
  }

  return false
}

function serveStatic(req, res, pathname) {
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
    const handled = await handleApi(req, res, url.pathname)
    if (!handled) sendJson(res, 404, { error: 'API route not found' })
    return
  }
  serveStatic(req, res, url.pathname)
})

ensureDb()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ritual Dashboard server listening on http://0.0.0.0:${PORT}`)
})
