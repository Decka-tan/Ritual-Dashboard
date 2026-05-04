import { listSubmissions, readBody, sendJson, supabaseFetch, toClientSubmission, toDbSubmission } from './_lib.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const approved = await listSubmissions('&status=eq.approved')
      sendJson(res, 200, { approved })
      return
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const submission = toDbSubmission(body)

      if (!submission.name || !submission.url || !submission.creator_name || !submission.description) {
        sendJson(res, 400, { error: 'Missing required submission fields' })
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
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Submission API failed' })
  }
}
