import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

const AdminDashboardModal = lazy(() => import('./AdminDashboardModal').then((module) => ({ default: module.AdminDashboardModal })))
import { Header } from './Header'
import { Footer } from './Footer'
import { HeroBackground } from './HeroBackground'
import { apiRequest } from './api'
import { apps } from './data/apps'
import { appDetails } from './data/appDetails'
import { preTestnetApps } from './data/preTestnetApps'

const normalizeUrl = (url = '') => url.startsWith('http') ? url : `https://${url}`

const getDomain = (url = '') => {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return url || 'unknown-domain'
  }
}

const getPlatform = (url) => {
  const host = getDomain(url)
  if (host.includes('vercel.app')) return 'Vercel'
  if (host.includes('replit.app')) return 'Replit'
  if (host.includes('lovable.app')) return 'Lovable'
  if (host.includes('netlify.app')) return 'Netlify'
  if (host.includes('pages.dev')) return 'Cloudflare Pages'
  if (host.includes('github.io')) return 'GitHub Pages'
  if (host.includes('t.me')) return 'Telegram'
  return 'Custom'
}

const getTag = (name) => {
  const value = name.toLowerCase()
  if (value.includes('market')) return 'Market'
  if (value.includes('casino') || value.includes('arcade') || value.includes('shooter') || value.includes('jumping') || value.includes('pixelverse') || value.includes('arena') || value.includes('tamagotchi')) return 'Game'
  if (value.includes('analytics') || value.includes('analyzer') || value.includes('explorer') || value.includes('oracle')) return 'Analytics'
  if (value.includes('identity') || value.includes('profile') || value.includes('card') || value.includes('proof')) return 'Identity'
  if (value.includes('faucet') || value.includes('hub') || value.includes('console') || value.includes('map')) return 'Utility'
  if (value.includes('trading') || value.includes('dex') || value.includes('pump')) return 'DeFi'
  return 'Other'
}

const slugify = (value, index) => `${String(index + 1).padStart(2, '0')}-${value}`
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const getBuilderIdentity = (app = {}) => {
  const rawIdentity = app.builderUrl || app.builderHandle || app.builder || ''
  const identity = String(rawIdentity).trim().toLowerCase()
  if (!identity || identity === 'unknown') return ''

  const xHandle = extractXHandle(identity).toLowerCase()
  if (xHandle) return `x:${xHandle}`

  return identity
    .replace(/^@/, '')
    .replace(/\/$/, '')
}

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

const extractXHandle = (value = '') => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed
    .replace(/^https?:\/\/(?:www\.)?(?:vx)?twitter\.com\//i, '')
    .replace(/^https?:\/\/(?:www\.)?x\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .trim()
}

const fetchCreatorProfile = async (handle) => {
  const cleanHandle = extractXHandle(handle)
  if (!cleanHandle) return { handle: '', displayName: '' }

  const endpoints = [
    `https://ritual-twitter-proxy.artelamon.workers.dev/api/twitter/${encodeURIComponent(cleanHandle)}?t=${Date.now()}`,
    `https://api.vxtwitter.com/${encodeURIComponent(cleanHandle)}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 9000)
      const response = await fetch(endpoint, { signal: controller.signal })
      window.clearTimeout(timeout)
      if (!response.ok) continue

      const data = await response.json()
      const displayName = data?.displayName || data?.user_name || data?.name || data?.screen_name || data?.user?.name || data?.user?.screen_name
      if (displayName && String(displayName).trim()) {
        return { handle: cleanHandle, displayName: String(displayName).trim() }
      }
    } catch {
      // Try next endpoint.
    }
  }

  return { handle: cleanHandle, displayName: `@${cleanHandle}` }
}

function BrowserPreview({ app }) {
  const [imageFailed, setImageFailed] = useState(false)
  const previewImage = app.preview || `/previews/${app.slug}.png`

  useEffect(() => {
    setImageFailed(false)
  }, [previewImage])

  return (
    <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-bg">
      {!imageFailed ? (
        <img
          className="h-full w-full object-cover object-top opacity-90 grayscale-[15%] transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100 group-hover:grayscale-0"
          src={previewImage}
          alt={`${app.name} website preview`}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_25%,rgba(0,255,148,0.16),transparent_36%),#050505] p-6 text-center">
          <div className="max-w-sm">
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent">
              Preview unavailable
            </span>
            <h3 className="mt-5 font-display text-3xl uppercase leading-none text-text-primary">Open dApp directly</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              This app can still be opened from the card.
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-bg/10" />
    </div>
  )
}

function SubmitDappModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', url: '', creator: '', about: '' })
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')

  if (!open) return null

  const updateField = (field) => (event) => {
    setError('')
    setSubmitted(false)
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const submitDapp = async () => {
    const name = form.name.trim()
    const url = form.url.trim()
    const handle = extractXHandle(form.creator)
    const about = form.about.trim()

    if (!name || !url || !handle || !about) {
      setError('Please fill dApp name, website link, Creator X, and description.')
      return
    }

    setError('')
    setSubmitted(false)

    try {
      setLoadingStep('Fetching creator profile...')
      const creatorProfile = await fetchCreatorProfile(handle)

      setLoadingStep('Sending submission for admin approval...')
      await sleep(350)

      await onSubmit({
        name,
        url: normalizeUrl(url),
        builder: creatorProfile.displayName || `@${handle}`,
        builderHandle: `@${creatorProfile.handle || handle}`,
        builderUrl: `https://x.com/${creatorProfile.handle || handle}`,
        about,
      })

      setForm({ name: '', url: '', creator: '', about: '' })
      setSubmitted(true)
      setLoadingStep('')
    } catch (error) {
      setLoadingStep('')
      setError(error.message || 'Submission failed. Please check the dApp URL and Creator X handle, then try again.')
    }
  }

  const isLoading = Boolean(loadingStep)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-5 py-8">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" type="button" onClick={onClose} aria-label="Close submit form" />
      <section className="relative z-10 w-full max-w-2xl rounded-[2rem] border border-border bg-surface p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Community submission</span>
            <h2 className="mt-3 font-display text-4xl uppercase leading-none text-text-primary md:text-5xl">Submit Pre-Testnet dApp</h2>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Submit a community dApp for review. It appears in Pre-Testnet only after admin approval.
            </p>
          </div>
          <button className="rounded-full border border-border px-3 py-2 font-mono text-xs uppercase text-text-secondary hover:border-accent hover:text-accent" type="button" onClick={onClose} disabled={isLoading}>
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            dApp name
            <input className="rounded-xl border border-border bg-bg/80 px-4 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={form.name} onChange={updateField('name')} placeholder="Ritual Example App" disabled={isLoading} />
          </label>
          <label className="grid gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            Website link
            <input className="rounded-xl border border-border bg-bg/80 px-4 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={form.url} onChange={updateField('url')} placeholder="https://example.vercel.app/" disabled={isLoading} />
          </label>
          <label className="grid gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            Creator X only
            <input className="rounded-xl border border-border bg-bg/80 px-4 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={form.creator} onChange={updateField('creator')} placeholder="@decka_chan" disabled={isLoading} />
          </label>
          <label className="grid gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            What is it about?
            <textarea className="min-h-28 rounded-xl border border-border bg-bg/80 px-4 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={form.about} onChange={updateField('about')} placeholder="Short description of what the dApp does." disabled={isLoading} />
          </label>
        </div>

        {loadingStep && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" />
            <span>{loadingStep}</span>
          </div>
        )}
        {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        {submitted && <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">Submitted for approval. It will appear in Pre-Testnet after admin review.</p>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="inline-flex flex-1 items-center justify-center rounded-xl bg-accent px-5 py-4 font-mono text-xs font-semibold uppercase tracking-wider text-black hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60" type="button" onClick={submitted ? onClose : submitDapp} disabled={isLoading}>
            {submitted ? 'Done' : isLoading ? 'Submitting...' : 'Submit dApp'}
          </button>
          <button className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-5 py-4 font-mono text-xs font-semibold uppercase tracking-wider text-text-primary hover:border-accent hover:text-accent disabled:opacity-50" type="button" onClick={onClose} disabled={isLoading}>
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

function AppCard({ app }) {
  const previewUrl = normalizeUrl(app.url)

  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-3xl border border-border bg-surface/90 backdrop-blur hover:-translate-y-1 hover:border-accent hover:shadow-[0_16px_50px_rgba(0,255,148,0.12)] focus:outline-none focus:ring-2 focus:ring-accent/70"
      role="link"
      tabIndex={0}
      aria-label={`Open ${app.name} in a new tab`}
      onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          window.open(previewUrl, '_blank', 'noopener,noreferrer')
        }
      }}
    >
      <div className="flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-3">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden="true" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" aria-hidden="true" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 font-mono text-[11px] text-text-secondary">
          <span className="block truncate">{app.domain}</span>
        </div>
      </div>

      <BrowserPreview app={app} />

      <div className="p-5">
        <div className="min-w-0">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">#{String(app.id).padStart(2, '0')} · {app.sectionLabel} · {app.tag}</span>
          <h2 className="mt-3 font-display text-3xl uppercase leading-none tracking-wide group-hover:text-accent">
            {app.name}
          </h2>
          <p className="mt-4 min-h-[3rem] text-sm leading-relaxed text-text-secondary">
            {app.about || 'Community-built Ritual dApp.'}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {app.builderUrl ? (
            <a
              className="rounded-full border border-accent/30 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent hover:text-black"
              href={app.builderUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label={`Open creator link for ${app.name}`}
            >
              Builder: {app.builder || 'Creator'}
            </a>
          ) : (
            <span className="rounded-full border border-border px-3 py-1.5 font-mono text-xs text-text-secondary">
              Builder: {app.builder || 'Unknown'}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function AppSection({ id, eyebrow, title, description, apps }) {
  return (
    <section id={id} className="scroll-mt-28 pb-14">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-accent">{eyebrow}</span>
          <h2 className="mt-3 font-display text-5xl uppercase leading-none tracking-tight md:text-6xl">{title}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary md:text-base">{description}</p>
        </div>
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">{apps.length} apps</span>
      </div>

      {apps.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {apps.map((app) => <AppCard app={app} key={`${app.section}-${app.name}-${app.id}`} />)}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-surface/70 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">No entries yet</p>
          <h3 className="mt-3 font-display text-3xl uppercase text-text-primary">Approved community dApps will appear here</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
            Submitted pre-testnet dApps stay hidden until admin approval.
          </p>
        </div>
      )}
    </section>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('All')
  const [tag, setTag] = useState('All')
  const [activeSection, setActiveSection] = useState('testnet')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [approvedApps, setApprovedApps] = useState([])
  const [hiddenPreTestnetUrls, setHiddenPreTestnetUrls] = useState([])
  const [officialApps, setOfficialApps] = useState([])
  const isAdminRoute = window.location.pathname === '/admin'

  const loadApprovedApps = async () => {
    try {
      const data = await apiRequest('/api/submissions')
      setApprovedApps(data.approved || [])
      setHiddenPreTestnetUrls(data.hiddenUrls || [])
    } catch {
      setApprovedApps([])
      setHiddenPreTestnetUrls([])
    }
  }

  const loadOfficialApps = async () => {
    try {
      const data = await apiRequest('/api/official-apps')
      setOfficialApps(data.apps || [])
    } catch {
      setOfficialApps([])
    }
  }

  const refreshPublicData = () => {
    loadApprovedApps()
    loadOfficialApps()
  }

  useEffect(() => {
    refreshPublicData()
  }, [])

  const submitCommunityApp = async (app) => {
    await apiRequest('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(app),
    })
  }

  const testnetApps = useMemo(() => {
    const sourceApps = officialApps.length ? officialApps : apps.map((app, index) => {
      const details = appDetails[app.url] || appDetails[normalizeUrl(app.url)] || {}
      return {
        ...app,
        ...details,
        siteNumber: index + 1,
        preview: `/previews/${slugify(app.name, index)}.png`,
      }
    })

    return sourceApps.map((app, index) => ({
      ...app,
      id: index + 1,
      siteNumber: app.siteNumber || index + 1,
      section: 'testnet',
      sectionLabel: 'Testnet',
      slug: slugify(app.name, index),
      domain: getDomain(app.url),
      platform: getPlatform(app.url),
      tag: getTag(app.name),
    }))
  }, [officialApps])

  const communityApps = useMemo(() => {
    const approvedUrls = new Set(approvedApps.map((app) => normalizeUrl(app.url).toLowerCase()))
    const hiddenUrls = new Set(hiddenPreTestnetUrls.map((url) => normalizeUrl(url).toLowerCase()))
    const staticFallbackApps = preTestnetApps.filter((app) => {
      const appUrl = normalizeUrl(app.url).toLowerCase()
      return !approvedUrls.has(appUrl) && !hiddenUrls.has(appUrl)
    })
    const mergedApps = [...approvedApps, ...staticFallbackApps]

    return mergedApps.map((app, index) => ({
      ...app,
      id: index + 1,
      siteNumber: app.siteNumber || index + 1,
      section: 'pretestnet',
      sectionLabel: 'Pre-Testnet',
      slug: slugify(`pretestnet-${app.name}`, index),
      domain: getDomain(app.url),
      platform: getPlatform(app.url),
      tag: getTag(app.name),
    }))
  }, [approvedApps, hiddenPreTestnetUrls])

  const enrichedApps = useMemo(() => [...testnetApps, ...communityApps], [testnetApps, communityApps])
  const platforms = useMemo(() => ['All', ...new Set(enrichedApps.map(app => app.platform))], [enrichedApps])
  const tags = useMemo(() => ['All', ...new Set(enrichedApps.map(app => app.tag))], [enrichedApps])

  const filteredApps = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return enrichedApps.filter(app => {
      const matchesQuery = !needle || [app.name, app.domain, app.platform, app.tag, app.about, app.builder, app.builderHandle, app.sectionLabel].filter(Boolean).some(value => value.toLowerCase().includes(needle))
      const matchesPlatform = platform === 'All' || app.platform === platform
      const matchesTag = tag === 'All' || app.tag === tag
      return matchesQuery && matchesPlatform && matchesTag
    })
  }, [enrichedApps, query, platform, tag])

  const filteredTestnetApps = filteredApps.filter((app) => app.section === 'testnet')
  const filteredCommunityApps = filteredApps.filter((app) => app.section === 'pretestnet')
  const activeApps = activeSection === 'testnet' ? filteredTestnetApps : filteredCommunityApps

  const sectionTabs = [
    { id: 'testnet', label: 'Official Testnet', count: testnetApps.length },
    { id: 'pretestnet', label: 'Pre-Testnet', count: communityApps.length },
  ]

  const totalDapps = testnetApps.length + communityApps.length
  const totalBuilders = new Set(enrichedApps
    .map(getBuilderIdentity)
    .filter(Boolean)).size

  const statCards = [
    { label: 'Official Testnet', value: testnetApps.length },
    { label: 'Pre-Testnet', value: communityApps.length },
    { label: 'Total Builders', value: totalBuilders },
    { label: 'Total dApps', value: totalDapps },
  ]

  if (isAdminRoute) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-bg px-6 py-10 text-text-primary">Loading admin dashboard...</div>}>
        <AdminDashboardModal page onApproved={refreshPublicData} />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary" id="dashboard">
      <Header onSubmitClick={() => setSubmitOpen(true)} />
      <SubmitDappModal open={submitOpen} onClose={() => setSubmitOpen(false)} onSubmit={submitCommunityApp} />
      <section className="relative flex min-h-screen items-center overflow-hidden border-b border-white/10 px-5 py-24 md:px-6 md:py-28">
        <HeroBackground />

        <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center gap-8">
          <header className="flex flex-col items-start gap-8">
            <div className="inline-flex rounded-full border border-border bg-surface/70 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-accent backdrop-blur">
              Ritual Community Hub
            </div>

            <div className="max-w-5xl">
              <h1 className="font-display text-6xl uppercase leading-[0.9] tracking-tight md:text-8xl lg:text-9xl">
                Ritual <br />
                <span className="text-accent">Dashboard</span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
                Browse official Ritual Testnet dApps and community-built pre-testnet experiments in one hub. Search by app name, builder, domain, hosting platform, or category.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                className="inline-flex items-center justify-center rounded-xl border border-accent bg-accent px-8 py-4 font-mono text-sm font-semibold uppercase tracking-wider text-black hover:bg-accent/90"
                href="#apps"
              >
                Browse dApps
              </a>
              <a
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/35 px-8 py-4 font-mono text-sm font-semibold uppercase tracking-wider text-text-primary backdrop-blur hover:border-accent hover:text-accent"
                href="https://docs.google.com/spreadsheets/d/1-71yrtMqSRCTAvmshY2K_wDSYproX7GQFybKwkC5IFM/edit?gid=0#gid=0"
                target="_blank"
                rel="noreferrer"
              >
                Source Sheet
              </a>
            </div>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/15 bg-surface/35 p-5 backdrop-blur-md hover:border-accent/50">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">{item.label}</span>
                <strong className="mt-3 block font-display text-4xl font-normal leading-none text-text-primary">{item.value}</strong>
              </div>
            ))}
          </section>

        </main>
      </section>

      <section id="apps" className="mx-auto w-full max-w-6xl scroll-mt-28 px-5 py-14 md:px-6 md:py-20">
        <div className="mb-8 rounded-[2rem] border border-border bg-surface/85 p-3 backdrop-blur">
          <div className="relative grid gap-3 md:grid-cols-2">
            <div
              className={`absolute inset-y-0 hidden rounded-[1.5rem] bg-accent transition-transform duration-300 md:block md:w-1/2 ${activeSection === 'pretestnet' ? 'translate-x-full' : 'translate-x-0'}`}
              aria-hidden="true"
            />
            {sectionTabs.map((item) => {
              const isActive = activeSection === item.id
              return (
                <button
                  className={`relative z-10 rounded-[1.5rem] border px-6 py-7 text-left transition md:border-transparent ${isActive ? 'border-accent bg-accent text-black md:bg-transparent' : 'border-border bg-bg/70 text-text-primary hover:border-accent/50'}`}
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                >
                  <span className={`block font-mono text-xs uppercase tracking-[0.22em] ${isActive ? 'text-black/70' : 'text-text-secondary'}`}>{item.label}</span>
                  <strong className="mt-3 block font-display text-6xl font-normal leading-none">{item.count}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <section className="mb-10 grid gap-4 rounded-2xl border border-border bg-surface/85 p-4 backdrop-blur md:grid-cols-[1.8fr_0.8fr_0.8fr]">
          <input
            className="w-full rounded-xl border border-border bg-bg/80 px-4 py-4 font-mono text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
            type="text"
            placeholder="Search app, builder, domain, category, platform..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="w-full rounded-xl border border-border bg-bg/80 px-4 py-4 font-mono text-sm text-text-primary outline-none focus:border-accent" value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platforms">
            {platforms.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="w-full rounded-xl border border-border bg-bg/80 px-4 py-4 font-mono text-sm text-text-primary outline-none focus:border-accent" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Categories">
            {tags.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </section>

        <AppSection
          id={activeSection === 'testnet' ? 'testnet-apps' : 'pre-testnet-apps'}
          eyebrow={activeSection === 'testnet' ? 'Official sheet' : 'Community archive'}
          title={activeSection === 'testnet' ? 'Testnet live' : 'Pre-Testnet'}
          description={activeSection === 'testnet'
            ? 'Apps listed from the official community sheet after Ritual Testnet went live. This section is updated by the sheet sync pipeline.'
            : 'Approved community dApps and experiments built before the live testnet list.'}
          apps={activeApps}
        />
      </section>
      <Footer />
    </div>
  )
}

export default App
