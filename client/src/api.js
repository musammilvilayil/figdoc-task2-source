async function request(path, options) {
  const response = await fetch(path, options)
  const type = response.headers.get('content-type') || ''
  const body = type.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) throw new Error(body?.error || 'The request could not be completed.')
  return body
}

export function analyzeFigma(figmaUrl, token) {
  return request('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ figmaUrl, token }),
  })
}

export function listDocuments() {
  return request('/api/documents')
}

export function saveRemoteDocument(document) {
  return request(`/api/documents/${encodeURIComponent(document.localId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  })
}

export async function downloadDocument(document, format = 'markdown') {
  const response = await fetch(`/api/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'The export could not be created.')
  }
  const blob = await response.blob()
  downloadBlob(blob, filename(document.source.name, format === 'markdown' ? 'md' : format))
}

export function downloadJson(document) {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename(document.source.name, 'json'))
}

function filename(name, extension) {
  const safe = (name || 'figma-content').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${safe || 'figma-content'}.${extension}`
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

