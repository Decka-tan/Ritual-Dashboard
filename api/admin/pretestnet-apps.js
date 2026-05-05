import { preTestnetApps } from '../../src/data/preTestnetApps.js'
import { cleanString, normalizeUrl, readBody, requireAdmin, screenshotUrlFor, sendJson, supabaseFetch, toClientSubmission } from '../_lib.js'

function toDbPreTestnetApp(body = {}) {
  return {
    name: cleanString(body.name, 120),
    url: normalizeUrl(body.url),
    description: cleanString(body.about || body.description, 700),
    creator_name: cleanString(body.builder || body.creator_name, 120) || 'Unknown',
    creator_handle: cleanString(body.builderHandle || body.creator_handle, 80),
    creator_url: normalizeUrl(body.builderUrl || body.creator_url),
    site_number: Number(body.siteNumber || body.site_number || 0),
    status: 'approved',
    preview_url: normalizeUrl(body.preview || body.preview_url),
    preview_status: cleanString(body.previewStatus || body.preview_status || 'pending', 40),
    approved_at: body.approvedAt || body.approved_at || new Date().toISOString(),
  }
}

async function listApprovedPreTestnetApps() {
  const rows = await supabaseFetch('/submissions?select=*&status=eq.approved&order=site_number.asc.nullslast,created_at.asc')
  return rows.map(toClientSubmission)
}

export default async function handler(req, res) {
  try {
    if (!await requireAdmin(req, res)) return

    if (req.method === 'GET') {
      const apps = await listApprovedPreTestnetApps()
      sendJson(res, 200, { apps })
      return
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const id = String(body.id || '').trim()
      if (!id) {
        sendJson(res, 400, { error: 'Missing Pre-Testnet app id' })
        return
      }

      const patch = toDbPreTestnetApp(body)
      if (!patch.name || !patch.url) {
        sendJson(res, 400, { error: 'Name and URL are required' })
        return
      }

      const rows = await supabaseFetch(`/submissions?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })

      sendJson(res, 200, { app: toClientSubmission(rows[0]) })
      return
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const action = String(body.action || '').trim()

      if (action === 'refresh-preview') {
        const id = String(body.id || '').trim()
        if (!id) {
          sendJson(res, 400, { error: 'Missing Pre-Testnet app id' })
          return
        }

        const existingRows = await supabaseFetch(`/submissions?select=*&id=eq.${encodeURIComponent(id)}&limit=1`)
        const existing = existingRows[0]
        if (!existing) {
          sendJson(res, 404, { error: 'Pre-Testnet app not found' })
          return
        }

        const rows = await supabaseFetch(`/submissions?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            preview_url: screenshotUrlFor(existing.url),
            preview_status: 'external',
          }),
        })

        sendJson(res, 200, { app: toClientSubmission(rows[0]) })
        return
      }

      if (action === 'seed-static') {
        const existingRows = await supabaseFetch('/submissions?select=url')
        const existingUrls = new Set(existingRows.map((row) => normalizeUrl(row.url).toLowerCase()))
        const now = new Date().toISOString()
        const rowsToInsert = preTestnetApps
          .filter((app) => !existingUrls.has(normalizeUrl(app.url).toLowerCase()))
          .map((app, index) => ({
            ...toDbPreTestnetApp({ ...app, siteNumber: index + 1, preview: screenshotUrlFor(app.url), previewStatus: 'external', approvedAt: now }),
            created_at: new Date(Date.now() + index).toISOString(),
          }))

        let inserted = []
        if (rowsToInsert.length) {
          inserted = await supabaseFetch('/submissions', {
            method: 'POST',
            body: JSON.stringify(rowsToInsert),
          })
        }

        sendJson(res, 200, {
          scanned: preTestnetApps.length,
          inserted: inserted.length,
          skippedExisting: preTestnetApps.length - inserted.length,
          apps: await listApprovedPreTestnetApps(),
        })
        return
      }

      sendJson(res, 400, { error: 'Invalid Pre-Testnet app action' })
      return
    }

    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Pre-Testnet admin API failed' })
  }
}
