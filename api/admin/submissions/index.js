import { listSubmissions, requireAdmin, sendJson } from '../../_lib.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    if (!await requireAdmin(req, res)) return
    const submissions = await listSubmissions()
    sendJson(res, 200, { submissions })
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Admin submissions API failed' })
  }
}
