import { useEffect, useMemo, useState } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { HeroBackground } from './HeroBackground'
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

const apiRequest = async (path, options = {}) => {
  const timeoutMs = options.timeoutMs || 30000
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const { token, headers, timeoutMs: _timeoutMs, ...fetchOptions } = options
    const response = await fetch(path, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Server took too long to respond. Please check deployment/API logs, then try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
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

function AdminDashboardModal({ open = true, onClose, onApproved, page = false }) {
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(() => sessionStorage.getItem('ritual-admin-token') || '')
  const [submissions, setSubmissions] = useState([])
  const [officialApps, setOfficialApps] = useState([])
  const [pretestnetApps, setPretestnetApps] = useState([])
  const [editingOfficial, setEditingOfficial] = useState({})
  const [editingPretestnet, setEditingPretestnet] = useState({})
  const [adminTab, setAdminTab] = useState('submissions')
  const [error, setError] = useState('')
  const [syncResult, setSyncResult] = useState(null)
  const [seedResult, setSeedResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadSubmissions = async (adminToken = token) => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/admin/submissions', { token: adminToken })
      setSubmissions(data.submissions || [])
    } catch (error) {
      setError(error.message || 'Failed to load submissions')
      if (error.message === 'Unauthorized') {
        sessionStorage.removeItem('ritual-admin-token')
        setToken('')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadOfficialApps = async (adminToken = token) => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/admin/official-apps', { token: adminToken })
      const apps = data.apps || []
      setOfficialApps(apps)
      setEditingOfficial(Object.fromEntries(apps.map((item) => [item.id, { ...item }])))
    } catch (error) {
      setError(error.message || 'Failed to load official apps')
      if (error.message === 'Unauthorized') {
        sessionStorage.removeItem('ritual-admin-token')
        setToken('')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadPretestnetApps = async (adminToken = token) => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/admin/pretestnet-apps', { token: adminToken })
      const apps = data.apps || []
      setPretestnetApps(apps)
      setEditingPretestnet(Object.fromEntries(apps.map((item) => [item.id, { ...item }])))
    } catch (error) {
      setError(error.message || 'Failed to load Pre-Testnet apps')
      if (error.message === 'Unauthorized') {
        sessionStorage.removeItem('ritual-admin-token')
        setToken('')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadAdminData = async (adminToken = token) => {
    await Promise.all([loadSubmissions(adminToken), loadOfficialApps(adminToken), loadPretestnetApps(adminToken)])
  }

  useEffect(() => {
    if (open && token) loadAdminData(token)
  }, [open, token])

  if (!open) return null

  const login = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
        timeoutMs: 30000,
      })
      sessionStorage.setItem('ritual-admin-token', data.token)
      setToken(data.token)
      setPassword('')
      await loadAdminData(data.token)
    } catch (error) {
      setError(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const review = async (id, action) => {
    setLoading(true)
    setError('')
    try {
      await apiRequest('/api/admin/review', {
        method: 'POST',
        token,
        body: JSON.stringify({ id, action }),
        timeoutMs: action === 'approve' ? 90000 : 15000,
      })
      await loadSubmissions(token)
      onApproved?.()
    } catch (error) {
      setError(error.message || 'Review failed')
    } finally {
      setLoading(false)
    }
  }

  const updateOfficialDraft = (id, field, value) => {
    setEditingOfficial((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [field]: value,
      },
    }))
  }

  const updatePretestnetDraft = (id, field, value) => {
    setEditingPretestnet((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [field]: value,
      },
    }))
  }

  const saveOfficialApp = async (id) => {
    const draft = editingOfficial[id]
    if (!draft) return
    setLoading(true)
    setError('')
    try {
      await apiRequest('/api/admin/official-apps', {
        method: 'PATCH',
        token,
        body: JSON.stringify(draft),
      })
      await loadOfficialApps(token)
      onApproved?.()
    } catch (error) {
      setError(error.message || 'Failed to save official app')
    } finally {
      setLoading(false)
    }
  }

  const refreshOfficialPreview = async (id) => {
    setLoading(true)
    setError('')
    try {
      await apiRequest('/api/admin/official-apps', {
        method: 'POST',
        token,
        body: JSON.stringify({ id, action: 'refresh-preview' }),
        timeoutMs: 30000,
      })
      await loadOfficialApps(token)
      onApproved?.()
    } catch (error) {
      setError(error.message || 'Failed to refresh official preview')
    } finally {
      setLoading(false)
    }
  }

  const syncOfficialApps = async () => {
    setLoading(true)
    setError('')
    setSyncResult(null)
    try {
      const result = await apiRequest('/api/sync-sheet', {
        method: 'POST',
        token,
        timeoutMs: 90000,
      })
      setSyncResult(result)
      await loadOfficialApps(token)
      onApproved?.()
    } catch (error) {
      setError(error.message || 'Failed to sync Google Sheet')
    } finally {
      setLoading(false)
    }
  }

  const savePretestnetApp = async (id) => {
    const draft = editingPretestnet[id]
    if (!draft) return
    setLoading(true)
    setError('')
    try {
      await apiRequest('/api/admin/pretestnet-apps', {
        method: 'PATCH',
        token,
        body: JSON.stringify(draft),
      })
      await loadPretestnetApps(token)
      onApproved?.()
    } catch (error) {
      setError(error.message || 'Failed to save Pre-Testnet app')
    } finally {
      setLoading(false)
    }
  }

  const refreshPretestnetPreview = async (id) => {
    setLoading(true)
    setError('')
    try {
      await apiRequest('/api/admin/pretestnet-apps', {
        method: 'POST',
        token,
        body: JSON.stringify({ id, action: 'refresh-preview' }),
        timeoutMs: 30000,
      })
      await loadPretestnetApps(token)
      onApproved?.()
    } catch (error) {
      setError(error.message || 'Failed to refresh Pre-Testnet preview')
    } finally {
      setLoading(false)
    }
  }

  const seedPretestnetApps = async () => {
    setLoading(true)
    setError('')
    setSeedResult(null)
    try {
      const result = await apiRequest('/api/admin/pretestnet-apps', {
        method: 'POST',
        token,
        body: JSON.stringify({ action: 'seed-static' }),
        timeoutMs: 90000,
      })
      setSeedResult(result)
      const apps = result.apps || []
      setPretestnetApps(apps)
      setEditingPretestnet(Object.fromEntries(apps.map((item) => [item.id, { ...item }])))
      await loadSubmissions(token)
      onApproved?.()
    } catch (error) {
      setError(error.message || 'Failed to add static Pre-Testnet apps')
    } finally {
      setLoading(false)
    }
  }

  const pending = submissions.filter((item) => item.status === 'pending')
  const approved = submissions.filter((item) => item.status === 'approved')
  const rejected = submissions.filter((item) => item.status === 'rejected')

  return (
    <div className={page ? 'min-h-screen bg-bg px-5 py-10 text-text-primary md:px-6 md:py-16' : 'fixed inset-0 z-[90] flex items-center justify-center px-5 py-8'}>
      {!page && <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" type="button" onClick={onClose} aria-label="Close admin dashboard" />}
      <section className={page ? 'relative z-10 mx-auto w-full max-w-5xl rounded-[2rem] border border-border bg-surface p-6 shadow-2xl md:p-8' : 'relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-border bg-surface p-6 shadow-2xl md:p-8'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Admin approval</span>
            <h2 className="mt-3 font-display text-4xl uppercase leading-none text-text-primary md:text-5xl">Submission Dashboard</h2>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">Approve only the community dApps you want to appear in Pre-Testnet.</p>
          </div>
          {page ? (
            <a className="rounded-full border border-border px-3 py-2 font-mono text-xs uppercase text-text-secondary hover:border-accent hover:text-accent" href="/">Dashboard</a>
          ) : (
            <button className="rounded-full border border-border px-3 py-2 font-mono text-xs uppercase text-text-secondary hover:border-accent hover:text-accent" type="button" onClick={onClose}>Close</button>
          )}
        </div>

        {!token ? (
          <div className="mt-8 grid gap-4 rounded-2xl border border-border bg-bg/70 p-5">
            <label className="grid gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
              Admin password
              <input className="rounded-xl border border-border bg-bg px-4 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" onKeyDown={(event) => event.key === 'Enter' && login()} />
            </label>
            <button className="rounded-xl bg-accent px-5 py-4 font-mono text-xs font-semibold uppercase tracking-wider text-black hover:bg-accent/90 disabled:opacity-60" type="button" onClick={login} disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="mb-5 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">
              <button className={`rounded-full border px-3 py-1.5 ${adminTab === 'submissions' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border hover:border-accent hover:text-accent'}`} type="button" onClick={() => setAdminTab('submissions')}>Submissions {pending.length}</button>
              <button className={`rounded-full border px-3 py-1.5 ${adminTab === 'official' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border hover:border-accent hover:text-accent'}`} type="button" onClick={() => setAdminTab('official')}>Official Testnet {officialApps.length}</button>
              <button className={`rounded-full border px-3 py-1.5 ${adminTab === 'pretestnet' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border hover:border-accent hover:text-accent'}`} type="button" onClick={() => setAdminTab('pretestnet')}>Pre-Testnet {pretestnetApps.length}</button>
              <span className="rounded-full border border-border px-3 py-1.5">Approved {approved.length}</span>
              <span className="rounded-full border border-border px-3 py-1.5">Rejected {rejected.length}</span>
              <button className="rounded-full border border-border px-3 py-1.5 hover:border-accent hover:text-accent" type="button" onClick={() => loadAdminData(token)} disabled={loading}>Refresh</button>
            </div>

            {adminTab === 'submissions' ? (
              pending.length ? (
                <div className="grid gap-4">
                  {pending.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-border bg-bg/70 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">{new Date(item.submittedAt).toLocaleString()}</span>
                          <h3 className="mt-2 font-display text-3xl uppercase leading-none text-text-primary">{item.name}</h3>
                          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{item.about}</p>
                          <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs">
                            <a className="rounded-full border border-border px-3 py-1.5 text-text-secondary hover:border-accent hover:text-accent" href={item.url} target="_blank" rel="noreferrer">Open website</a>
                            {item.builderUrl && <a className="rounded-full border border-accent/30 px-3 py-1.5 text-accent hover:bg-accent hover:text-black" href={item.builderUrl} target="_blank" rel="noreferrer">{item.builder}</a>}
                          </div>
                        </div>
                        <div className="flex min-w-44 flex-col gap-2">
                          <button className="rounded-xl bg-accent px-4 py-3 font-mono text-xs font-semibold uppercase text-black hover:bg-accent/90 disabled:opacity-60" type="button" onClick={() => review(item.id, 'approve')} disabled={loading}>Approve</button>
                          <button className="rounded-xl border border-red-500/40 px-4 py-3 font-mono text-xs font-semibold uppercase text-red-200 hover:bg-red-500/10 disabled:opacity-60" type="button" onClick={() => review(item.id, 'reject')} disabled={loading}>Reject</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-bg/70 p-8 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">No pending submissions</p>
                </div>
              )
            ) : adminTab === 'official' ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Manual Google Sheet sync</span>
                      <p className="mt-2 text-sm leading-relaxed text-text-secondary">Pull latest Official Testnet rows from Google Sheet into Supabase. Existing site numbers are skipped, so manual edits stay safe.</p>
                    </div>
                    <button className="rounded-xl bg-accent px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-black hover:bg-accent/90 disabled:opacity-60" type="button" onClick={syncOfficialApps} disabled={loading}>{loading ? 'Syncing...' : 'Sync Google Sheet'}</button>
                  </div>
                  {syncResult && (
                    <p className="mt-4 rounded-xl border border-border bg-bg/70 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-text-secondary">
                      Scanned {syncResult.scanned || 0} · Inserted {syncResult.inserted || 0} · Skipped {syncResult.skippedExisting || 0}
                    </p>
                  )}
                </div>
                {officialApps.map((item) => {
                  const draft = editingOfficial[item.id] || item
                  return (
                    <article key={item.id} className="rounded-2xl border border-border bg-bg/70 p-5">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Official #{String(draft.siteNumber || item.siteNumber).padStart(2, '0')}</span>
                          <h3 className="mt-2 font-display text-3xl uppercase leading-none text-text-primary">{draft.name || item.name}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 font-mono text-xs">
                          <a className="rounded-full border border-border px-3 py-1.5 text-text-secondary hover:border-accent hover:text-accent" href={draft.url} target="_blank" rel="noreferrer">Open website</a>
                          <button className="rounded-full border border-border px-3 py-1.5 text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50" type="button" onClick={() => refreshOfficialPreview(item.id)} disabled={loading}>Refresh preview</button>
                          <button className="rounded-full border border-accent/40 bg-accent px-3 py-1.5 text-black hover:bg-accent/90 disabled:opacity-50" type="button" onClick={() => saveOfficialApp(item.id)} disabled={loading}>Save</button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[0.35fr_1fr_1fr]">
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Site #<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" type="number" value={draft.siteNumber || ''} onChange={(event) => updateOfficialDraft(item.id, 'siteNumber', event.target.value)} /></label>
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">dApp name<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.name || ''} onChange={(event) => updateOfficialDraft(item.id, 'name', event.target.value)} /></label>
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">URL<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.url || ''} onChange={(event) => updateOfficialDraft(item.id, 'url', event.target.value)} /></label>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Builder name<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.builder || ''} onChange={(event) => updateOfficialDraft(item.id, 'builder', event.target.value)} /></label>
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Builder / X / GitHub link<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.builderUrl || ''} onChange={(event) => updateOfficialDraft(item.id, 'builderUrl', event.target.value)} /></label>
                      </div>
                      <label className="mt-3 grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Description<textarea className="min-h-24 rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.about || ''} onChange={(event) => updateOfficialDraft(item.id, 'about', event.target.value)} /></label>
                      <label className="mt-3 grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Preview URL<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.preview || ''} onChange={(event) => updateOfficialDraft(item.id, 'preview', event.target.value)} /></label>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Manual Pre-Testnet seed</span>
                      <p className="mt-2 text-sm leading-relaxed text-text-secondary">Add static Pre-Testnet apps, including the Maharshi list, into Supabase so they show in admin and can be edited with screenshots.</p>
                    </div>
                    <button className="rounded-xl bg-accent px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-black hover:bg-accent/90 disabled:opacity-60" type="button" onClick={seedPretestnetApps} disabled={loading}>{loading ? 'Adding...' : 'Add static Pre-Testnet'}</button>
                  </div>
                  {seedResult && (
                    <p className="mt-4 rounded-xl border border-border bg-bg/70 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-text-secondary">
                      Scanned {seedResult.scanned || 0} · Inserted {seedResult.inserted || 0} · Skipped {seedResult.skippedExisting || 0}
                    </p>
                  )}
                </div>
                {pretestnetApps.map((item, index) => {
                  const draft = editingPretestnet[item.id] || item
                  return (
                    <article key={item.id} className="rounded-2xl border border-border bg-bg/70 p-5">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Pre-Testnet #{String(index + 1).padStart(2, '0')}</span>
                          <h3 className="mt-2 font-display text-3xl uppercase leading-none text-text-primary">{draft.name || item.name}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 font-mono text-xs">
                          <a className="rounded-full border border-border px-3 py-1.5 text-text-secondary hover:border-accent hover:text-accent" href={draft.url} target="_blank" rel="noreferrer">Open website</a>
                          <button className="rounded-full border border-border px-3 py-1.5 text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50" type="button" onClick={() => refreshPretestnetPreview(item.id)} disabled={loading}>Refresh preview</button>
                          <button className="rounded-full border border-accent/40 bg-accent px-3 py-1.5 text-black hover:bg-accent/90 disabled:opacity-50" type="button" onClick={() => savePretestnetApp(item.id)} disabled={loading}>Save</button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">dApp name<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.name || ''} onChange={(event) => updatePretestnetDraft(item.id, 'name', event.target.value)} /></label>
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">URL<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.url || ''} onChange={(event) => updatePretestnetDraft(item.id, 'url', event.target.value)} /></label>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Builder name<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.builder || ''} onChange={(event) => updatePretestnetDraft(item.id, 'builder', event.target.value)} /></label>
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Builder / X / GitHub link<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.builderUrl || ''} onChange={(event) => updatePretestnetDraft(item.id, 'builderUrl', event.target.value)} /></label>
                      </div>
                      <label className="mt-3 grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Description<textarea className="min-h-24 rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.about || ''} onChange={(event) => updatePretestnetDraft(item.id, 'about', event.target.value)} /></label>
                      <label className="mt-3 grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Preview URL<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" value={draft.preview || ''} onChange={(event) => updatePretestnetDraft(item.id, 'preview', event.target.value)} /></label>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
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
  const [officialApps, setOfficialApps] = useState([])
  const isAdminRoute = window.location.pathname === '/admin'

  const loadApprovedApps = async () => {
    try {
      const data = await apiRequest('/api/submissions')
      setApprovedApps(data.approved || [])
    } catch {
      setApprovedApps([])
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
      id: Number(app.siteNumber || index + 1),
      section: 'testnet',
      sectionLabel: 'Testnet',
      slug: slugify(app.name, Number(app.siteNumber || index + 1) - 1),
      domain: getDomain(app.url),
      platform: getPlatform(app.url),
      tag: getTag(app.name),
    }))
  }, [officialApps])

  const communityApps = useMemo(() => {
    const mergedApps = [...preTestnetApps]
    const seenUrls = new Set(preTestnetApps.map((app) => normalizeUrl(app.url).toLowerCase()))

    approvedApps.forEach((app) => {
      const appUrl = normalizeUrl(app.url).toLowerCase()
      if (seenUrls.has(appUrl)) {
        const existingIndex = mergedApps.findIndex((item) => normalizeUrl(item.url).toLowerCase() === appUrl)
        if (existingIndex >= 0) mergedApps[existingIndex] = { ...mergedApps[existingIndex], ...app }
        return
      }

      seenUrls.add(appUrl)
      mergedApps.push(app)
    })

    return mergedApps.map((app, index) => ({
      ...app,
      id: index + 1,
      section: 'pretestnet',
      sectionLabel: 'Pre-Testnet',
      slug: slugify(`pretestnet-${app.name}`, index),
      domain: getDomain(app.url),
      platform: getPlatform(app.url),
      tag: getTag(app.name),
    }))
  }, [approvedApps])

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
    return <AdminDashboardModal page onApproved={refreshPublicData} />
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
