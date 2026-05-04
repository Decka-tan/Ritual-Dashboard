const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const appsPath = path.resolve(__dirname, '..', 'src', 'data', 'apps.js')
const preTestnetAppsPath = path.resolve(__dirname, '..', 'src', 'data', 'preTestnetApps.js')
const outputDir = path.resolve(__dirname, '..', 'public', 'previews')
const manifestPath = path.join(outputDir, 'manifest.json')
const viewport = { width: 1440, height: 900 }
const defaultProblemIndexes = '5,7,12,16,17,19,23,24,32'
const forcedFallbackIndexes = new Set(
  (process.env.PREVIEW_FORCE_FALLBACK_INDEXES || '')
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0)
)
const knownProblemIndexes = new Set(
  (process.env.PREVIEW_PROBLEM_INDEXES || defaultProblemIndexes)
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0)
)

function normalizeUrl(url = '') {
  const cleaned = url.trim()
  if (!cleaned) return ''
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
}

function slugify(value, index) {
  return `${String(index + 1).padStart(2, '0')}-${value}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseAppsFile(source) {
  const matches = [...source.matchAll(/name:\s*(["'])(.*?)\1\s*,\s*url:\s*(["'])(.*?)\3/gs)]
  return matches.map((match) => ({ name: match[2], url: match[4] }))
}

function readPreviousManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return { results: [] }
  }
}

function shouldSkip(filePath, app, slug, previous, force) {
  if (force || !fs.existsSync(filePath)) return false
  const previousItem = previous.results?.find((item) => item.slug === slug)
  return previousItem?.url === normalizeUrl(app.url) && previousItem?.ok !== false
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

function looksForbidden(status, text = '') {
  const value = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const shortErrorPage = value.length < 1800
  const explicitForbiddenTitle = /^(error:\s*)?(403\s*:?\s*)?forbidden\b/.test(value)
  const edgeForbidden = /\b403\s*:?\s*forbidden\b/.test(value) && /\bid:\s*[a-z0-9:-]+\b/.test(value)
  const infraBlocked = /\b(vercel|cloudflare|edge|security|waf|deployment)\b/.test(value) && /\b(forbidden|blocked|access denied|unauthorized|not authorized)\b/.test(value)
  const commonBlocked = /\b(403|401|forbidden|access denied|not authorized|unauthorized|request blocked|blocked by target site)\b/.test(value)
  return status === 401 || status === 403 || (shortErrorPage && (explicitForbiddenTitle || edgeForbidden || infraBlocked || commonBlocked))
}

async function waitForPageToSettle(page, { slow = false } = {}) {
  await page.waitForLoadState('domcontentloaded', { timeout: slow ? 30000 : 18000 }).catch(() => {})
  await page.waitForLoadState('load', { timeout: slow ? 30000 : 18000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: slow ? 22000 : 12000 }).catch(() => {})
  await page.waitForTimeout(slow ? 14000 : 6500)

  // Give heavy client-rendered apps extra chances when the page is still visually empty or actively rendering.
  for (let attempt = 0; attempt < (slow ? 3 : 1); attempt += 1) {
    const visualState = await page.evaluate(() => {
      const bodyText = document.body?.innerText?.trim() || ''
      const imgCount = document.images?.length || 0
      const completeImages = [...document.images || []].filter((img) => img.complete && img.naturalWidth > 0).length
      const canvasCount = document.querySelectorAll('canvas').length
      const visibleNodes = [...document.body.querySelectorAll('main, section, article, button, a, input, canvas, img, [class]')]
        .filter((el) => {
          const box = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)
          return box.width > 20 && box.height > 20 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0'
        }).length
      const loadingText = /loading|initializing|starting|please wait|waking up/i.test(bodyText)
      return { bodyTextLength: bodyText.length, imgCount, completeImages, canvasCount, visibleNodes, loadingText }
    }).catch(() => ({ bodyTextLength: 0, imgCount: 0, completeImages: 0, canvasCount: 0, visibleNodes: 0, loadingText: false }))

    const visuallySparse = visualState.bodyTextLength < 80 && visualState.completeImages + visualState.canvasCount + visualState.visibleNodes < 4
    if (!visuallySparse && !visualState.loadingText) break
    await page.waitForTimeout(slow ? 6000 : 5000)
  }
}

async function waitForVisualStability(page, { checks = 3, interval = 1200 } = {}) {
  let previous = null
  let stable = 0

  for (let i = 0; i < checks + 6; i += 1) {
    const signature = await page.evaluate(() => {
      const body = document.body
      const text = body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 600) || ''
      const boxes = [...document.querySelectorAll('main, section, article, img, canvas, button, a, input, [class]')]
        .slice(0, 120)
        .map((el) => {
          const box = el.getBoundingClientRect()
          return `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`
        })
        .join('|')
      const pendingImages = [...document.images || []].filter((img) => !img.complete || img.naturalWidth === 0).length
      return `${text.length}:${pendingImages}:${boxes}`
    }).catch(() => '')

    if (signature && signature === previous) stable += 1
    else stable = 0

    previous = signature
    if (stable >= checks) return
    await page.waitForTimeout(interval)
  }
}

async function tryDownloadAlternativeScreenshot(app, filePath) {
  const url = normalizeUrl(app.url)
  const encoded = encodeURIComponent(url)
  const services = [
    {
      name: 'mini.s-shot.ru',
      url: `https://mini.s-shot.ru/1440x900/PNG/1440/Z100/?${encoded}`,
    },
    {
      name: 'image.thum.io',
      url: `https://image.thum.io/get/width/1440/crop/900/noanimate/${url}`,
    },
    {
      name: 's.wordpress.com/mshots',
      url: `https://s.wordpress.com/mshots/v1/${encoded}?w=1440&h=900`,
    },
  ]

  for (const service of services) {
    try {
      console.log(`    ALT ${service.name} ${url}`)
      const response = await fetch(service.url, {
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        },
        signal: AbortSignal.timeout(18000),
      })

      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.toLowerCase().includes('image')) {
        console.log(`    ALT-SKIP ${service.name} (${response.status} ${contentType || 'no content-type'})`)
        continue
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length < 12000) {
        console.log(`    ALT-SKIP ${service.name} (image too small: ${buffer.length} bytes)`)
        continue
      }

      fs.writeFileSync(filePath, buffer)
      return { ok: true, service: service.name }
    } catch (error) {
      console.log(`    ALT-SKIP ${service.name} (${error.message.split('\n')[0]})`)
    }
  }

  return { ok: false }
}

async function captureFallback(context, app, index, filePath, reason) {
  const page = await context.newPage()
  const url = normalizeUrl(app.url)
  const domain = getDomain(url)
  const safeName = escapeHtml(app.name)
  const safeDomain = escapeHtml(domain)
  const safeReason = escapeHtml(reason || 'Preview unavailable')

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      overflow: hidden;
      background: #050505;
      color: #fafafa;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .wrap {
      position: relative;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 72px;
      background:
        radial-gradient(circle at 24% 18%, rgba(0,255,148,.24), transparent 34%),
        radial-gradient(circle at 82% 72%, rgba(0,255,148,.12), transparent 30%),
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
        #050505;
      background-size: auto, auto, 48px 48px, 48px 48px, auto;
    }
    .card {
      width: 100%;
      height: 100%;
      border: 1px solid #262626;
      border-radius: 34px;
      background: rgba(18,18,18,.88);
      box-shadow: 0 28px 100px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05);
      overflow: hidden;
    }
    .chrome {
      height: 76px;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 28px;
      border-bottom: 1px solid #262626;
      background: rgba(5,5,5,.72);
    }
    .dots { display: flex; gap: 10px; }
    .dot { width: 15px; height: 15px; border-radius: 999px; }
    .red { background: #ff5f57; } .yellow { background: #ffbd2e; } .green { background: #28c840; }
    .url {
      min-width: 0;
      flex: 1;
      border: 1px solid #262626;
      border-radius: 999px;
      padding: 12px 18px;
      color: #a3a3a3;
      font: 600 14px/1.1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: #121212;
    }
    .content {
      height: calc(100% - 76px);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 64px;
      background: linear-gradient(180deg, transparent, rgba(5,5,5,.78));
    }
    .badge {
      align-self: flex-start;
      border: 1px solid rgba(0,255,148,.35);
      border-radius: 999px;
      background: rgba(0,255,148,.1);
      color: #00ff94;
      padding: 10px 14px;
      font: 700 13px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      text-transform: uppercase;
      letter-spacing: .16em;
    }
    h1 {
      max-width: 940px;
      margin: 30px 0 0;
      font: 900 92px/.88 Impact, Anton, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      text-transform: uppercase;
      letter-spacing: -.035em;
    }
    p {
      max-width: 760px;
      margin: 28px 0 0;
      color: #a3a3a3;
      font-size: 26px;
      line-height: 1.35;
    }
    .index {
      position: absolute;
      right: 72px;
      top: 72px;
      color: rgba(250,250,250,.08);
      font: 900 190px/.8 Impact, Anton, sans-serif;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="index">${String(index + 1).padStart(2, '0')}</div>
    <div class="card">
      <div class="chrome">
        <div class="dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
        <div class="url">${safeDomain}</div>
      </div>
      <div class="content">
        <div class="badge">Static fallback preview</div>
        <h1>${safeName}</h1>
        <p>${safeReason}. Open the app directly from the dashboard to view the live site.</p>
      </div>
    </div>
  </div>
</body>
</html>`

  try {
    await page.setViewportSize(viewport)
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: filePath, type: 'png', fullPage: false })
  } finally {
    await page.close().catch(() => {})
  }
}

async function installCaptureRoutes(page) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const type = request.resourceType()
    // Keep images/styles/scripts because screenshots need visual completeness; block only heavy media/fonts.
    if (['media', 'font'].includes(type)) return route.abort()
    return route.continue()
  })
}

async function tryCaptureOnce(browser, baseContext, app, index, filePath, attempt) {
  const url = normalizeUrl(app.url)
  const attemptContext = attempt.mobile
    ? await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
      })
    : baseContext
  const page = await attemptContext.newPage()

  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Upgrade-Insecure-Requests': '1',
      Referer: new URL(url).origin,
    })
    await installCaptureRoutes(page)

    const response = await page.goto(url, { waitUntil: attempt.waitUntil, timeout: attempt.timeout })
    await waitForPageToSettle(page, { slow: attempt.slow })

    const status = response?.status() || 0
    const pageText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')

    if (looksForbidden(status, pageText)) {
      return { ok: false, forbidden: true, reason: status ? `${status} Forbidden / blocked by target site` : 'Forbidden / blocked by target site' }
    }

    await waitForVisualStability(page, { checks: attempt.slow ? 3 : 2, interval: attempt.slow ? 1400 : 900 })
    await page.screenshot({ path: filePath, type: 'png', fullPage: false, animations: 'disabled' })
    return { ok: true, status }
  } finally {
    await page.close().catch(() => {})
    if (attempt.mobile) await attemptContext.close().catch(() => {})
  }
}

async function captureApp(browser, context, app, index, { force = false, previous } = {}) {
  const slug = slugify(app.name, index)
  const filePath = path.join(outputDir, `${slug}.png`)
  const url = normalizeUrl(app.url)

  if (shouldSkip(filePath, app, slug, previous, force)) {
    console.log(`[${index + 1}] SKIP ${app.name} -> ${slug}.png`)
    return { ...app, url, slug, ok: true, skipped: true, file: `/previews/${slug}.png` }
  }

  console.log(`[${index + 1}] Capturing ${app.name} -> ${slug}.png`)

  if (forcedFallbackIndexes.has(index + 1)) {
    const reason = 'Target site returns 403/edge protection in automated preview capture'
    await captureFallback(context, app, index, filePath, reason)
    console.log(`    FALLBACK ${url} (${reason})`)
    return { ...app, url, slug, ok: true, fallback: true, forcedFallback: true, reason, skipped: false, file: `/previews/${slug}.png` }
  }

  const isKnownProblem = knownProblemIndexes.has(index + 1)

  if (isKnownProblem) {
    const alternative = await tryDownloadAlternativeScreenshot(app, filePath)
    if (alternative.ok) {
      console.log(`    ALT-OK ${url} (${alternative.service})`)
      return { ...app, url, slug, ok: true, alternative: true, alternativeService: alternative.service, skipped: false, file: `/previews/${slug}.png` }
    }
  }

  const attempts = [
    { name: 'fast', waitUntil: 'commit', timeout: 30000, slow: false },
    { name: 'slow', waitUntil: 'domcontentloaded', timeout: 45000, slow: true },
    { name: 'full-load', waitUntil: 'load', timeout: 60000, slow: true },
    { name: 'mobile-safari', waitUntil: 'domcontentloaded', timeout: 45000, slow: true, mobile: true },
  ]

  let lastReason = 'Preview unavailable'

  for (const attempt of attempts) {
    try {
      const result = await tryCaptureOnce(browser, context, app, index, filePath, attempt)
      if (result.ok) {
        console.log(`    OK ${url} (${attempt.name})`)
        return { ...app, url, slug, ok: true, skipped: false, attempt: attempt.name, file: `/previews/${slug}.png` }
      }
      lastReason = result.reason || lastReason
      console.log(`    RETRY ${url} (${attempt.name}: ${lastReason})`)
    } catch (error) {
      lastReason = error.message.split('\n')[0]
      console.log(`    RETRY ${url} (${attempt.name}: ${lastReason})`)
    }
  }

  if (isKnownProblem || /forbidden|blocked|403|401|timeout|net::/i.test(lastReason)) {
    const alternative = await tryDownloadAlternativeScreenshot(app, filePath)
    if (alternative.ok) {
      console.log(`    ALT-OK ${url} (${alternative.service})`)
      return { ...app, url, slug, ok: true, alternative: true, alternativeService: alternative.service, reason: lastReason, skipped: false, file: `/previews/${slug}.png` }
    }
  }

  await captureFallback(context, app, index, filePath, lastReason)
  console.log(`    FALLBACK ${url} (${lastReason})`)
  return { ...app, url, slug, ok: true, fallback: true, reason: lastReason, skipped: false, file: `/previews/${slug}.png` }
}

function parseOnlyIndexes() {
  const arg = process.argv.find((item) => item.startsWith('--only='))
  if (!arg) return null

  const indexes = arg
    .slice('--only='.length)
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0)

  return indexes.length ? new Set(indexes) : null
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })

  const force = process.argv.includes('--force')
  const onlyIndexes = parseOnlyIndexes()
  const source = fs.readFileSync(appsPath, 'utf8')
  const preTestnetSource = fs.existsSync(preTestnetAppsPath) ? fs.readFileSync(preTestnetAppsPath, 'utf8') : ''
  const apps = [...parseAppsFile(source), ...parseAppsFile(preTestnetSource)]
  const previous = readPreviousManifest()

  if (!apps.length) {
    throw new Error(`No apps found in ${appsPath} or ${preTestnetAppsPath}`)
  }

  const previousBySlug = new Map((previous.results || []).map((item) => [item.slug, item]))
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  })

  const results = []

  for (let index = 0; index < apps.length; index += 1) {
    const slug = slugify(apps[index].name, index)
    if (onlyIndexes && !onlyIndexes.has(index + 1)) {
      const existing = previousBySlug.get(slug)
      results.push(existing || { ...apps[index], url: normalizeUrl(apps[index].url), slug, ok: fs.existsSync(path.join(outputDir, `${slug}.png`)), skipped: true, file: fs.existsSync(path.join(outputDir, `${slug}.png`)) ? `/previews/${slug}.png` : null })
      continue
    }

    results.push(await captureApp(browser, context, apps[index], index, { force, previous }))
  }

  await browser.close()

  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))

  const ok = results.filter((item) => item.ok || item.file).length
  const skipped = results.filter((item) => item.skipped).length
  const fallback = results.filter((item) => item.fallback).length
  const failed = results.filter((item) => !item.ok && !item.file).length
  console.log(`Done. Available ${ok}/${results.length}. Skipped existing: ${skipped}. Fallback screenshots: ${fallback}. Failed without fallback: ${failed}.`)
  console.log(`Manifest: ${manifestPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
