export async function waitForHandoff(url, expires, signal, { request = fetch, now = Date.now, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  while (!signal.aborted && now() < expires) {
    const attempt = new AbortController()
    const abort = () => attempt.abort()
    signal.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 10000)
    try {
      const response = await request(url, { signal: attempt.signal, cache: 'no-store' })
      if (response.ok) {
        const value = await response.json()
        if (value && typeof value.code === 'string' && value.code.length < 20000 && value.expires > now()) return value.code
      } else if (response.status !== 401 && response.status !== 403 && response.status < 500) {
        throw new Error('Login connection is unavailable. Please try again.')
      }
    } catch (error) {
      if (signal.aborted) break
      // Network interruptions are retried until the request expires.
      if (error.message === 'Login connection is unavailable. Please try again.') throw error
    } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
    await delay(1500)
  }
  throw new Error(signal.aborted ? 'Sign-in cancelled.' : 'Sign-in timed out. Click Continue with Google to try again.')
}
