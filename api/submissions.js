import { checkRateLimit, getClientIp, listSubmissions, readBody, sendJson, supabaseFetch, toClientSubmission, toDbSubmission, validatePublicUrl } from './_lib.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const approved = await listSubmissions('&status=eq.approved', 'site_number.asc.nullslast,created_at.asc')
      const existingRows = await supabaseFetch('/submissions?select=url,status')
      const hiddenUrls = existingRows
        .filter((row) => row.status === 'pending')
        .map((row) => row.url)
        .filter(Boolean)
      sendJson(res, 200, { approved, hiddenUrls })
      return
    }

    if (req.method === 'POST') {
      if (checkRateLimit(getClientIp(req), { max: 3, windowMs: 60_000 })) {
        sendJson(res, 429, { error: 'Too many submissions. Please wait a minute and try again.' })
        return
      }

      const body = await readBody(req)
      const submission = toDbSubmission(body)

      if (!submission.name || !submission.url || !submission.creator_name || !submission.description) {
        sendJson(res, 400, { error: 'Missing required submission fields' })
        return
      }

      const urlCheck = validatePublicUrl(submission.url)
      if (!urlCheck.valid) {
        sendJson(res, 400, { error: urlCheck.error })
        return
      }

      const rows = await supabaseFetch('/submissions', {
        method: 'POST',
        body: JSON.stringify(submission),
      })

      sendJson(res, 201, { submission: toClientSubmission(rows[0]) })
      return
    }

    sendJson(res, 405, { error: 'Method not allowed' })
  } catch {
    sendJson(res, 500, { error: 'Submission failed. Please try again.' })
  }
}
