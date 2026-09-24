import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import browserPdf from 'pdfmake/build/pdfmake.js'
import fonts from 'pdfmake/build/vfs_fonts.js'
import { toDocx, pdfDefinition } from './report.js'
import { importPlugin } from './plugin-import.js'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

test('offline plugin renderers preserve website report tables and long actual copy', async () => {
  const copy = 'Actual design copy, not a layer name. '.repeat(250)
  const doc = importPlugin({ format: 'figdoc-plugin', version: 1, file: { name: 'Parity test', document: { type: 'DOCUMENT', id: '0', children: [{ type: 'CANVAS', id: '1', name: 'Page', children: [{ type: 'TEXT', id: '2', name: 'Body', characters: copy }] }] } } })
  const browserWord = await toDocx(doc, true)
  const browserXml = await (await JSZip.loadAsync(await browserWord.arrayBuffer())).file('word/document.xml').async('string')
  const serverXml = await (await JSZip.loadAsync(await toDocx(doc))).file('word/document.xml').async('string')
  assert.equal(browserXml, serverXml)
  assert.match(browserXml, /Actual design copy/)
  assert.match(browserXml, /w:tbl/)
  assert.match(browserXml, /Handoff checklist/)
  browserPdf.addVirtualFileSystem(fonts)
  const pdf = await browserPdf.createPdf(pdfDefinition(doc)).getBlob()
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF')
})

test('plugin UI invalidates stale and failed selections before downloading', async () => {
  const elements = new Map(['export', 'docx', 'pdf', 'json', 'status', 'selection', 'retry', 'page-access', 'page-workspace', 'auth-page', 'workspace-page', 'auth-status', 'signout'].map(id => [id, { disabled: true, textContent: '', classList: { toggle() {} } }]))
  const parent = { postMessage() {} }, window = {}
  const source = (await readFile(new URL('../../figma-plugin/ui-entry.js', import.meta.url), 'utf8')).replace(/^import [^\r\n]*\r?\n/gm, '')
  let retry
  vm.runInNewContext(source, { parent, window, setInterval: callback => { retry = callback; return 1 }, clearInterval() {}, document: { getElementById: id => elements.get(id) }, pdfmake: { addVirtualFileSystem() {} }, fonts: {}, Blob, importPlugin: () => ({ content: [{ content: 'Example' }], pages: [], source: { name: 'Test' } }) })
  for (let i = 0; i < 9; i++) retry()
  assert.equal(elements.get('retry').hidden, false)
  assert.match(elements.get('selection').textContent, /unavailable/)
  elements.get('retry').onclick()
  const message = data => window.onmessage({ source: null, data: { pluginMessage: data } })
  message({ type: 'selection', selection: 'A', count: 1 })
  assert.equal(elements.get('export').disabled, false)
  await elements.get('export').onclick()
  message({ type: 'result', selection: 'A', json: '{}' })
  assert.equal(elements.get('docx').disabled, false)
  message({ type: 'selection', selection: 'B', count: 1 })
  assert.equal(elements.get('docx').disabled, true)
  message({ type: 'result', selection: 'A', json: '{}' })
  assert.equal(elements.get('pdf').disabled, true)
  await elements.get('export').onclick()
  message({ type: 'error', message: 'Export failed' })
  assert.equal(elements.get('json').disabled, true)
  assert.equal(elements.get('export').disabled, false)

})
