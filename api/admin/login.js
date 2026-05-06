import { ADMIN_PASSWORD, TOKEN_TTL_MS, checkRateLimit, createAdminToken, getClientIp, readBody, sendJson } from '../_lib.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    if (checkRateLimit(getClientIp(req), { max: 10, windowMs: 60_000 })) {
      sendJson(res, 429, { error: 'Too many login attempts. Please wait a minute.' })
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

    const token = await createAdminToken()
    sendJson(res, 200, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
  } catch {
    sendJson(res, 400, { error: 'Invalid login request' })
  }
}
