import pdfmake from 'pdfmake/build/pdfmake.js'
import fonts from 'pdfmake/build/vfs_fonts.js'
import { importPlugin } from '../server/src/plugin-import.js'
import JSZip from 'jszip'
import { componentBlocks, assetFilename } from '../server/src/component-report.js'
import { toDocx, pdfDefinition } from '../server/src/report.js'

pdfmake.addVirtualFileSystem(fonts)
const $ = id => document.getElementById(id)
let payload = null, report = null, selection = '', busy = false, count = 0, revision = 0
let connected = false, attempts = 0
const status = message => { $('status').textContent = message }
function controls() {
  $('export').disabled = busy || !count
  for (const id of ['docx', 'pdf', 'json', 'assets']) $(id).disabled = busy || !report
}
controls()
function clear() { payload = report = null; revision++; controls() }
function download(blob, extension, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = (name.replace(/[^a-z0-9_-]+/gi, '-') || 'design') + extension
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
$('export').onclick = async () => {
  if (busy || !count) return
  clear(); busy = true; controls(); status('Reading selected layers…')
  parent.postMessage({ pluginMessage: { type: 'export' } }, '*')
}
for (const format of ['docx', 'pdf', 'json', 'assets']) $(format).onclick = async () => {
  if (!report || busy) return
  const snapshot = report, source = payload, currentRevision = revision
  busy = true; controls(); status('Preparing ' + format.toUpperCase() + '…')
  try {
    let assetBlob
    if (format === 'assets') {
      const zip = new JSZip()
      const pictures = (snapshot.previews || []).filter(p => p.kind === 'image-layer')
      if (!pictures.length) throw new Error('No individual image layers in this selection.')
      pictures.forEach((picture, index) => zip.file(assetFilename(picture, index), picture.data.split(',')[1], { base64: true }))
      zip.file('README.txt', 'Rendered image-layer previews matching the filenames in the documentation. Images may be downscaled. Verify resolution and permissions before production use.')
      assetBlob = await zip.generateAsync({ type: 'blob' })
    }
    const blob = format === 'assets' ? assetBlob : format === 'docx' ? await toDocx(snapshot, true, componentBlocks(snapshot))
      : format === 'pdf' ? await pdfmake.createPdf(pdfDefinition(snapshot, componentBlocks(snapshot))).getBlob()
      : new Blob([JSON.stringify({ ...source, layers: snapshot.layers })], { type: 'application/json' })
    if (currentRevision !== revision) { status('Selection changed. Prepare a new export.'); return }
    download(blob, format === 'json' ? '.figdoc.json' : format === 'assets' ? '-images.zip' : '.' + format, snapshot.source.name)
    status(format.toUpperCase() + ' ready. Check your downloads.')
  } catch (error) { status('Export failed: ' + error.message) }
  finally { busy = false; controls() }
}
window.onmessage = event => {
  // Figma bridges sandbox messages; event.source is not guaranteed to be parent.
  const message = event.data?.pluginMessage
  if (!message) return
  if (message.type === 'selection') {
    if (!Number.isInteger(message.count) || typeof message.selection !== 'string') return
    connected = true; clearInterval(handshake)
    $('retry').hidden = true
    count = message.count
    if (selection !== message.selection) { selection = message.selection; clear(); status('Selection changed. Prepare an export.') }
    $('selection').textContent = count + ' selected layer' + (count === 1 ? '' : 's')
    controls(); return
  }
  if (!['result', 'error'].includes(message.type)) return
  busy = false; clear()
  if (message.type === 'error') { status(message.message); return }
  if (message.selection !== selection) { status('Selection changed. Prepare a new export.'); return }
  try {
    if (new Blob([message.json]).size > 16 * 1024 * 1024) throw new Error('Selection exceeds 16 MB. Select fewer frames.')
    payload = JSON.parse(message.json); report = importPlugin(payload)
    if (!report.content.length && !report.previews?.length && !report.layers?.length) throw new Error('No text or previews captured. Select an app screen frame (not an empty layer), then prepare again.')
    status((report.layers?.length || 0) + ' layers | ' + (report.previews?.length || 0) + ' previews | ' + report.content.length + ' text items · ' + report.pages.length + ' page(s). Ready to download.')
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
