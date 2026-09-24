import { firebaseConfig, loginUrl } from '../firebase-config.js'
let busy = false
let authRevision = 0
let sessionMode: 'signed-out' | 'google' | 'guest' = 'signed-out'
async function verifyGoogle(token: unknown) {
  if (typeof token !== 'string' || token.length > 15000) throw new Error('Sign in with Google to continue.')
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + firebaseConfig.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) })
  const body = await response.json()
  const user = body.users?.[0]
  if (!response.ok || !user?.emailVerified || !user.providerUserInfo?.some((provider: { providerId: string }) => provider.providerId === 'google.com')) throw new Error('Your Google session expired. Sign in again.')
  return user
}
function selectionStatus() {
  figma.ui.postMessage({ type: 'selection', count: figma.currentPage.selection.length, selection: figma.currentPage.id + ':' + figma.currentPage.selection.map(node => node.id).sort().join(',') })
}

figma.on('selectionchange', selectionStatus)
figma.ui.onmessage = async (message: { type: string, token?: string, url?: string }) => {
  if (message.type === 'ready') return selectionStatus()
  if (message.type === 'open-login') {
    if (typeof message.url === 'string' && message.url.startsWith(loginUrl + '#') && message.url.length < 4000) figma.openExternal(message.url)
    return
  }
  if (message.type === 'signout') { authRevision++; sessionMode = 'signed-out'; return }
  if (message.type === 'guest-login') {
    authRevision++; sessionMode = 'guest'
    figma.ui.postMessage({ type: 'guest-session' })
    return
  }
  if (message.type === 'authenticate') {
    const revision = ++authRevision
    sessionMode = 'signed-out'
    try {
      const user = await verifyGoogle(message.token)
      if (revision !== authRevision) return
      sessionMode = 'google'
      figma.ui.postMessage({ type: 'authenticated', email: user.email })
    } catch (error) {
      if (revision === authRevision) figma.ui.postMessage({ type: 'auth-error', message: error instanceof Error ? error.message : 'Google sign-in could not be verified.' })
    }
    return
  }
  if (message.type !== 'export' || busy) return
  busy = true
  const revision = authRevision
  try {
    try {
      if (sessionMode === 'signed-out') throw new Error('Choose Google or guest before preparing a document.')
      if (sessionMode === 'google') await verifyGoogle(message.token)
    } catch (error) {
      if (revision !== authRevision) return
      sessionMode = 'signed-out'
      figma.ui.postMessage({ type: 'auth-error', message: error instanceof Error ? error.message : 'Unable to verify your Google account. Try again.' })
      return
    }
    if (revision !== authRevision) return
    const page = figma.currentPage
    const selection = [...page.selection]
    const selectionKey = page.id + ':' + selection.map(node => node.id).sort().join(',')
    if (!selection.length) throw new Error('Select at least one frame or layer in Figma.')
    const ids = new Set(selection.map(node => node.id))
    const roots = selection.filter(node => {
      for (let parent: BaseNode | null = node.parent; parent; parent = parent.parent) {
        if (ids.has(parent.id)) return false
      }
      return true
    })
    const children = []
    for (const node of roots) {
      const result = await node.exportAsync({ format: 'JSON_REST_V1' }) as { document?: unknown }
      if (!result.document) throw new Error('Figma could not export this selection.')
      children.push(result.document)
    }
    const payload = {
      format: 'figdoc-plugin', version: 1,
      file: { name: figma.root.name, document: { id: 'document', type: 'DOCUMENT', children: [
        { id: page.id, name: page.name, type: 'CANVAS', children }
      ] } }
    }
    if (revision === authRevision) figma.ui.postMessage({ type: 'result', selection: selectionKey, json: JSON.stringify(payload), name: figma.root.name })
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Export failed. Try a smaller selection.' })
  } finally { busy = false }
}

figma.showUI(__html__, { width: 380, height: 560, themeColors: true })
selectionStatus()

