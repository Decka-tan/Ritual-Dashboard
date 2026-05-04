import { readBody, requireAdmin, screenshotUrlFor, sendJson, supabaseFetch, toClientSubmission } from '../_lib.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    if (!await requireAdmin(req, res)) return

    const body = await readBody(req)
    const id = String(body.id || '').trim()
    const action = String(body.action || '').trim()

    if (!id || !['approve', 'reject'].includes(action)) {
      sendJson(res, 400, { error: 'Invalid review action' })
      return
    }

    const existingRows = await supabaseFetch(`/submissions?select=*&id=eq.${encodeURIComponent(id)}&limit=1`)
    const existing = existingRows[0]
    if (!existing) {
      sendJson(res, 404, { error: 'Submission not found' })
      return
    }

    const now = new Date().toISOString()
    const patch = action === 'approve'
      ? {
          status: 'approved',
          approved_at: now,
          rejected_at: null,
          preview_url: existing.preview_url || screenshotUrlFor(existing.url),
          preview_status: existing.preview_url ? (existing.preview_status || 'ready') : 'external',
        }
      : {
          status: 'rejected',
          approved_at: null,
          rejected_at: now,
        }

    const rows = await supabaseFetch(`/submissions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })

    sendJson(res, 200, { submission: toClientSubmission(rows[0]) })
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Review API failed' })
  }
}
