import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { componentBlocks } from './component-report.js'
import { importPlugin } from './plugin-import.js'
import { toDocx, pdfDefinition } from './report.js'
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE5kAAAAASUVORK5CYII='
test('component template preserves editable copy, previews and explicit heading/link metadata', async () => {
 const payload = { format: 'figdoc-plugin', version: 1, file: { name: 'Demo', document: { id: '0', type: 'DOCUMENT', children: [{ id: '1', type: 'CANVAS', name: 'Page', children: [{ id: '2', type: 'FRAME', name: 'Hero', children: [{ id: '3', type: 'TEXT', name: 'H1 title', characters: 'Actual heading', style: {} }, { id: '4', type: 'TEXT', name: 'CTA', characters: 'Explore', style: { hyperlink: { type: 'URL', url: 'https://example.com/' } } }] }] }] } }, previews: [{ id: '2', name: 'Hero', page: 'Page', width: 1, height: 1, data: png }] }
 const doc = importPlugin(payload)
 const blocks = componentBlocks(doc)
 const rows = blocks.filter(b => b.kind === 'table').flatMap(b => b.rows)
 assert.ok(rows.some(r => r[0] === 'Heading Level' && r[1] === 'H1'))
 assert.ok(rows.some(r => r[0] === 'Link URL' && r[1] === 'https://example.com/'))
 assert.ok(rows.some(r => r[0] === 'Meta Description' && r[1] === 'Not provided'))
 assert.ok(!blocks.some(b => b.text === 'Design tokens'))
 const zip = await JSZip.loadAsync(await toDocx(doc, false, blocks))
 assert.match(await zip.file('word/document.xml').async('string'), /Actual heading/)
 assert.ok(Object.keys(zip.files).some(name => name.startsWith('word/media/') && name.endsWith('.png')))
 assert.ok(pdfDefinition(doc, blocks).content.some(b => b.image === png))
 assert.throws(() => importPlugin({ ...payload, previews: [{ ...payload.previews[0], data: 'https://example.com/image.png' }] }))
})


test('empty selections cannot generate a template-only document', () => {
 assert.throws(() => componentBlocks({ source: { name: 'Empty' }, content: [], previews: [] }), /No text or previews/)
})
