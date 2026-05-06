export const apiRequest = async (path, options = {}) => {
  const timeoutMs = options.timeoutMs || 30000
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const { token, headers, timeoutMs: _timeoutMs, ...fetchOptions } = options
    const response = await fetch(path, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Server took too long to respond. Please check deployment/API logs, then try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
