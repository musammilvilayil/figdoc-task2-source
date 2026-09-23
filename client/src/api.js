async function request(path, options) {
  const token = localStorage.getItem('figdoc-token')
  const headers = new Headers(options?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' })
  const type = response.headers.get('content-type') || ''
  const body = type.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) throw new Error(body?.error || 'The request could not be completed.')
  return body
}

export function register(email, password) {
  return request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
}

export async function continueAsGuest() {
  const result = await request('/api/auth/guest', { method: 'POST' })
  localStorage.setItem('figdoc-token', result.token)
  return result.user
}

export function googleLoginUrl() {
  return '/api/auth/google'
}

export async function login(email, password) {
  const result = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  localStorage.setItem('figdoc-token', result.token)
  return result.user
}

export async function logout() {
  try { await request('/api/auth/logout', { method: 'POST' }) } finally { localStorage.removeItem('figdoc-token') }
}

export function currentUser() {
  return request('/api/auth/me')
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

export async function importPluginFile(file) {
  if (file.size > 9 * 1024 * 1024) throw new Error('File exceeds 9 MB. Export fewer frames from Figma.')
  let payload
  try { payload = JSON.parse(await file.text()) } catch { throw new Error('This is not a valid JSON file. Export it again from the Figdoc plugin.') }
  return request('/api/import/plugin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

export function saveRemoteDocument(document) {
  return request(`/api/documents/${encodeURIComponent(document.localId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  })
}

export function sendEmailNotification(recipient, documentName) {
  return request('/api/notifications/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient, documentName }) })
}

export async function downloadDocument(document, format = 'markdown') {
  const token = localStorage.getItem('figdoc-token')
  const response = await fetch(`/api/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...(token ? { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } } : {}),
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
