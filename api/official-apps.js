import { listOfficialApps, sendJson } from './_lib.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    const apps = await listOfficialApps()
    sendJson(res, 200, { apps })
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Official apps API failed' })
  }
}
