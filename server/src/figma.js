import { setTimeout as delay } from 'node:timers/promises'
const FIGMA_API = 'https://api.figma.com/v1'

export function parseFigmaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Please enter a Figma file URL.')
  }

  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('That does not look like a valid URL.')
  }

  const host = url.hostname.toLowerCase()
  if (host !== 'figma.com' && host !== 'www.figma.com') {
    throw new Error('Please use a figma.com design or file URL.')
  }

  const match = url.pathname.match(/\/(?:file|design|proto)\/([a-zA-Z0-9_-]+)/)
  if (!match) {
    throw new Error('The Figma file key could not be found in this URL.')
  }

  return {
    fileKey: match[1],
    nodeId: url.searchParams.get('node-id')?.replace('-', ':') || null,
  }
}

export async function fetchFigmaFile({ fileKey, nodeId, token, signal, fetchImpl = fetch, wait = delay }) {
  const base = `${FIGMA_API}/files/${encodeURIComponent(fileKey)}`
  async function request(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response
      try { response = await fetchImpl(url, { headers: { 'X-Figma-Token': token }, signal }) }
      catch (error) {
        if (signal?.aborted || error.name === 'AbortError' || attempt === 2) throw error
        await wait(500 * 2 ** attempt, undefined, { signal })
        continue
      }
      if (response.ok) return response.json()
      const retryHeader = response.headers.get('retry-after')
      const retrySeconds = retryHeader == null ? 1 : Number.isFinite(Number(retryHeader)) ? Number(retryHeader) : Math.max(0, (Date.parse(retryHeader) - Date.now()) / 1000)
      if (attempt < 2 && (response.status >= 500 || (response.status === 429 && retrySeconds <= 5))) {
        await response.body?.cancel()
        await wait(Math.max(500 * 2 ** attempt, response.status === 429 ? retrySeconds * 1000 : 0), undefined, { signal })
        continue
      }
      const messages = {
        400: 'Figma rejected the file URL or selected node.',
        403: 'The token is invalid, expired, or cannot access this Figma file.',
        404: 'The Figma file could not be found.',
        429: `Figma rate limit reached. Try again ${Number.isFinite(retrySeconds) ? `in ${Math.ceil(retrySeconds)} seconds` : 'later'}, or import a selected frame.`,
      }
      throw Object.assign(new Error(messages[response.status] || 'Figma is temporarily unavailable. Please try again.'), { status: response.status === 429 ? 429 : response.status >= 500 ? 502 : 400 })
    }
  }
  if (nodeId) {
    const payload = await request(`${base}/nodes?ids=${encodeURIComponent(nodeId)}`)
    const node = payload.nodes?.[nodeId]?.document
    if (!node) throw Object.assign(new Error('The selected Figma node was not found.'), { status: 404 })
    const page = node.type === 'CANVAS' ? node : { id: 'selection-page', name: 'Selected frame', type: 'CANVAS', children: [node] }
    return { name: payload.name || 'Selected Figma node', lastModified: payload.lastModified, version: payload.version, document: { id: 'selection', type: 'DOCUMENT', children: [page] } }
  }
  // Fetch complete page subtrees separately to avoid truncating deeply nested layers.
  const file = await request(`${base}?depth=1`)
  const version = file.version ? `&version=${encodeURIComponent(file.version)}` : ''
  const pages = await Promise.all((file.document?.children || []).map(async page => {
    const payload = await request(`${base}/nodes?ids=${encodeURIComponent(page.id)}${version}`)
    const complete = payload.nodes?.[page.id]?.document
    if (!complete) throw Object.assign(new Error(`Could not load page "${page.name}". Please retry or import that page directly.`), { status: 502 })
    return complete
  }))
  return { ...file, document: { ...file.document, children: pages } }
}
