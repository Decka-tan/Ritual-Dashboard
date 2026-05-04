import { listOfficialApps, readBody, requireAdmin, screenshotUrlFor, sendJson, supabaseFetch, toClientOfficialApp, toDbOfficialApp } from '../_lib.js'

export default async function handler(req, res) {
  try {
    if (!await requireAdmin(req, res)) return

    if (req.method === 'GET') {
      const apps = await listOfficialApps()
      sendJson(res, 200, { apps })
      return
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const id = String(body.id || '').trim()
      if (!id) {
        sendJson(res, 400, { error: 'Missing official app id' })
        return
      }

      const patch = toDbOfficialApp(body)
      if (!patch.site_number || !patch.name || !patch.url) {
        sendJson(res, 400, { error: 'Site number, name, and URL are required' })
        return
      }

      const rows = await supabaseFetch(`/official_apps?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })

      sendJson(res, 200, { app: toClientOfficialApp(rows[0]) })
      return
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const action = String(body.action || '').trim()
      const id = String(body.id || '').trim()

      if (action !== 'refresh-preview' || !id) {
        sendJson(res, 400, { error: 'Invalid official app action' })
        return
      }

      const existingRows = await supabaseFetch(`/official_apps?select=*&id=eq.${encodeURIComponent(id)}&limit=1`)
      const existing = existingRows[0]
      if (!existing) {
        sendJson(res, 404, { error: 'Official app not found' })
        return
      }

      const rows = await supabaseFetch(`/official_apps?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          preview_url: screenshotUrlFor(existing.url),
          preview_status: 'external',
          updated_at: new Date().toISOString(),
        }),
      })

      sendJson(res, 200, { app: toClientOfficialApp(rows[0]) })
      return
    }

    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Official apps admin API failed' })
  }
}
