const fs = require('fs')
const path = require('path')

const outputPath = path.resolve(__dirname, '..', 'src', 'data', 'preTestnetApps.js')

function normalizeUrl(url = '') {
  const cleaned = url.trim()
  if (!cleaned) return ''
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
}

function toVxTwitterUrl(url = '') {
  return normalizeUrl(url).replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)/i, 'https://api.vxtwitter.com')
}

function parseArgs(argv) {
  const args = {}
  for (const item of argv.slice(2)) {
    const match = item.match(/^--([^=]+)=(.*)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

function getDomain(url = '') {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function appNameFromUrl(url = '') {
  const domain = getDomain(url)
  const host = domain.split('.')[0] || 'Community dApp'
  return host
    .replace(/--.*$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

async function fetchTweetMeta(xUrl) {
  if (!xUrl) return {}
  const apiUrl = toVxTwitterUrl(xUrl)
  const response = await fetch(apiUrl, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'RitualDashboardPreTestnetSync/1.0',
    },
  })

  if (!response.ok) throw new Error(`vxTwitter fetch failed: HTTP ${response.status}`)
  const data = await response.json()

  const user = data.user || data.author || {}
  const builder = user.screen_name || user.username || user.name || data.user_screen_name || data.user_name || ''
  const text = data.text || data.tweet || data.description || ''
  const urls = []

  for (const mediaUrl of data.mediaURLs || []) urls.push(mediaUrl)
  for (const candidate of text.match(/https?:\/\/[^\s)]+/g) || []) urls.push(candidate.replace(/[.,]+$/, ''))
  for (const candidate of data.urls || []) {
    if (typeof candidate === 'string') urls.push(candidate)
    else if (candidate.expanded_url) urls.push(candidate.expanded_url)
    else if (candidate.url) urls.push(candidate.url)
  }

  const websiteUrl = urls.find((url) => !/\b(x\.com|twitter\.com|vxtwitter\.com|api\.vxtwitter\.com)\b/i.test(url)) || ''

  return {
    builder,
    builderUrl: normalizeUrl(xUrl),
    websiteUrl,
    text,
  }
}

function readExistingApps() {
  if (!fs.existsSync(outputPath)) return []
  const source = fs.readFileSync(outputPath, 'utf8')
  const match = source.match(/export const preTestnetApps =\s*(\[[\s\S]*\])\s*$/)
  if (!match) return []

  try {
    // The file is generated with JSON-compatible objects.
    return Function(`return (${match[1]})`)()
  } catch {
    return []
  }
}

function writeApps(apps) {
  const body = apps.map((app) => `  ${JSON.stringify(app, null, 2).replace(/\n/g, '\n  ')}`).join(',\n')
  const content = `export const preTestnetApps = [\n${body}\n]\n`
  fs.writeFileSync(outputPath, content)
}

async function main() {
  const args = parseArgs(process.argv)
  const xUrl = args.x || args.twitter || args.creator || ''
  const manualUrl = args.url || args.website || ''
  const manualName = args.name || ''
  const manualAbout = args.about || ''

  if (!xUrl && !manualUrl) {
    throw new Error('Usage: node scripts/add-pretestnet-app.cjs --x=https://x.com/user/status/123 [--url=https://site.app] [--name="App Name"] [--about="Short description"]')
  }

  let meta = {}
  if (xUrl) {
    try {
      meta = await fetchTweetMeta(xUrl)
    } catch (error) {
      console.warn(`Warning: ${error.message}. Continuing with manual args only.`)
      meta = { builderUrl: normalizeUrl(xUrl) }
    }
  }

  const url = normalizeUrl(manualUrl || meta.websiteUrl || '')
  if (!url) throw new Error('No website URL found. Pass --url=https://site.app')

  const app = {
    name: manualName || appNameFromUrl(url),
    url,
    builder: meta.builder || 'Unknown',
    builderUrl: meta.builderUrl || normalizeUrl(xUrl),
    about: manualAbout || 'Community-built Ritual pre-testnet dApp.',
  }

  const apps = readExistingApps()
  const key = app.url.toLowerCase()
  const existingIndex = apps.findIndex((item) => normalizeUrl(item.url).toLowerCase() === key)

  if (existingIndex >= 0) apps[existingIndex] = { ...apps[existingIndex], ...app }
  else apps.push(app)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  writeApps(apps)
  console.log(`${existingIndex >= 0 ? 'Updated' : 'Added'} pre-testnet app: ${app.name} -> ${app.url}`)
  console.log(`Builder: ${app.builder}${app.builderUrl ? ` (${app.builderUrl})` : ''}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
