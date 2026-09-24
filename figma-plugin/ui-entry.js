import pdfmake from 'pdfmake/build/pdfmake.js'
import fonts from 'pdfmake/build/vfs_fonts.js'
import { importPlugin } from '../server/src/plugin-import.js'
import { toDocx, pdfDefinition } from '../server/src/report.js'
import { setupAuth } from './auth-ui.js'

pdfmake.addVirtualFileSystem(fonts)
const $ = id => document.getElementById(id)
let payload = null, report = null, selection = '', busy = false, count = 0, revision = 0
let connected = false, attempts = 0
let authenticated = false
let sessionMode = 'signed-out' // 'google' | 'guest' | 'signed-out'
const status = message => { $('status').textContent = message }
function showPage(page) {
  if (!$('auth-page') || !$('workspace-page')) return
  const access = page === 'access' || !authenticated
  $('auth-page').hidden = !access
  $('workspace-page').hidden = access
  $('page-access').classList.toggle('active', access)
  $('page-workspace').classList.toggle('active', !access)
}
function controls() {
  $('export').disabled = busy || !count || !authenticated
  for (const id of ['docx', 'pdf', 'json']) $(id).disabled = busy || !report || !authenticated
  $('page-workspace').disabled = !authenticated
  $('signout').hidden = !authenticated
}
const authentication = setupAuth({
  onSignedOut() { authenticated = false; sessionMode = 'signed-out'; clear(); showPage('access') },
  onStatus(message) { $('auth-status').textContent = message },
})
if ($('page-access')) $('page-access').onclick = () => showPage('access')
if ($('page-workspace')) $('page-workspace').onclick = () => showPage('workspace')
showPage('access')
controls()
function clear() { payload = report = null; revision++; controls() }
function download(blob, extension, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = (name.replace(/[^a-z0-9_-]+/gi, '-') || 'design') + extension
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
$('export').onclick = async () => {
  if (!authenticated || busy || !count) return
  clear(); busy = true; controls(); status('Reading selected layers…')
  try { parent.postMessage({ pluginMessage: { type: 'export', token: sessionMode === 'google' ? await authentication.token() : undefined } }, '*') }
  catch (error) { busy = false; authenticated = false; sessionMode = 'signed-out'; clear(); showPage('access'); $('auth-status').textContent = error.message }
}
for (const format of ['docx', 'pdf', 'json']) $(format).onclick = async () => {
  if (!authenticated || !report || busy) return
  const snapshot = report, source = payload, currentRevision = revision
  busy = true; controls(); status('Preparing ' + format.toUpperCase() + '…')
  try {
    const blob = format === 'docx' ? await toDocx(snapshot, true)
      : format === 'pdf' ? await pdfmake.createPdf(pdfDefinition(snapshot)).getBlob()
      : new Blob([JSON.stringify(source)], { type: 'application/json' })
    if (currentRevision !== revision) { status('Selection changed. Prepare a new export.'); return }
    download(blob, format === 'json' ? '.figdoc.json' : '.' + format, snapshot.source.name)
    status(format.toUpperCase() + ' ready. Check your downloads.')
  } catch (error) { status('Export failed: ' + error.message) }
  finally { busy = false; controls() }
}
window.onmessage = event => {
  // Figma bridges sandbox messages; event.source is not guaranteed to be parent.
  const message = event.data?.pluginMessage
  if (!message) return
  if (message.type === 'authenticated' || message.type === 'guest-session') {
    sessionMode = message.type === 'guest-session' ? 'guest' : 'google'
    authenticated = true
    $('auth-status').textContent = sessionMode === 'guest' ? 'Continuing as guest' : 'Signed in as ' + message.email
    showPage('workspace'); controls(); return
  }
  if (message.type === 'auth-error') {
    authenticated = false; sessionMode = 'signed-out'; busy = false; clear(); showPage('access')
    $('auth-status').textContent = message.message; return
  }
  if (message.type === 'selection') {
    if (!Number.isInteger(message.count) || typeof message.selection !== 'string') return
    connected = true; clearInterval(handshake)
    $('retry').hidden = true
    count = message.count
    if (selection !== message.selection) { selection = message.selection; clear(); status('Selection changed. Prepare an export.') }
    $('selection').textContent = count + ' selected layer' + (count === 1 ? '' : 's')
    controls(); return
  }
  if (!authenticated || !['result', 'error'].includes(message.type)) return
  busy = false; clear()
  if (message.type === 'error') { status(message.message); return }
  if (message.selection !== selection) { status('Selection changed. Prepare a new export.'); return }
  try {
    if (new Blob([message.json]).size > 9 * 1024 * 1024) throw new Error('Selection exceeds 9 MB. Select fewer frames.')
    payload = JSON.parse(message.json); report = importPlugin(payload)
    status(report.content.length + ' text items · ' + report.pages.length + ' page(s). Ready to download.')
  } catch (error) { clear(); status(error.message) }
  controls()
}
function requestSelection() {
  if (connected) return
  if (++attempts > 8) {
    clearInterval(handshake)
    $('selection').textContent = 'Figma connection unavailable'
    status('Close and reopen this development plugin. Check that its manifest points to the updated code.js and ui.html in the same folder.')
    $('retry').hidden = false
    return
  }
  parent.postMessage({ pluginMessage: { type: 'ready' } }, '*')
}
let handshake = setInterval(requestSelection, 1000)
$('retry').onclick = () => {
  clearInterval(handshake); attempts = 0; connected = false
  $('selection').textContent = 'Connecting to Figma…'; $('retry').hidden = true
  handshake = setInterval(requestSelection, 1000); requestSelection()
}
requestSelection()
