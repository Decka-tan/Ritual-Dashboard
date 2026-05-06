import { useEffect, useState } from 'react'
import { apiRequest } from './api'

export function AdminDashboardModal({ open = true, onClose, onApproved, page = false }) {
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
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Pre-Testnet #{String(draft.siteNumber || item.siteNumber || index + 1).padStart(2, '0')}</span>
                          <h3 className="mt-2 font-display text-3xl uppercase leading-none text-text-primary">{draft.name || item.name}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 font-mono text-xs">
                          <a className="rounded-full border border-border px-3 py-1.5 text-text-secondary hover:border-accent hover:text-accent" href={draft.url} target="_blank" rel="noreferrer">Open website</a>
                          <button className="rounded-full border border-border px-3 py-1.5 text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50" type="button" onClick={() => refreshPretestnetPreview(item.id)} disabled={loading}>Refresh preview</button>
                          <button className="rounded-full border border-accent/40 bg-accent px-3 py-1.5 text-black hover:bg-accent/90 disabled:opacity-50" type="button" onClick={() => savePretestnetApp(item.id)} disabled={loading}>Save</button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[0.35fr_1fr_1fr]">
                        <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">Site #<input className="rounded-xl border border-border bg-bg px-3 py-3 font-sans text-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent" type="number" value={draft.siteNumber || ''} onChange={(event) => updatePretestnetDraft(item.id, 'siteNumber', event.target.value)} /></label>
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
