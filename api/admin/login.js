import { ADMIN_PASSWORD, createAdminToken, readBody, sendJson } from '../_lib.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    if (!ADMIN_PASSWORD) {
      sendJson(res, 500, { error: 'ADMIN_PASSWORD is not configured' })
      return
    }

    const body = await readBody(req)
    if (body.password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: 'Wrong password' })
      return
    }

    sendJson(res, 200, { token: await createAdminToken() })
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Invalid login request' })
  }
}
