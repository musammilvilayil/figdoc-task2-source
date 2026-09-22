import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { exportBlocks, toDocx, toPdf } from '../src/exports.js'
import { parseFigmaDocument } from '../src/parser.js'
import { demoFigmaFile } from '../src/demo.js'

const demo = () => parseFigmaDocument(demoFigmaFile, 'Demo file')

test('exports include edited text, every section, and escaped Word content', async () => {
  const document = demo()
  document.content[0].content = 'Edited & approved <copy>\nSecond line café €'
  const blocks = exportBlocks(document)
  assert.ok(blocks.some(block => block.text === document.content[0].content))
  for (const component of document.components) assert.ok(blocks.some(block => block.rows?.some(row => row[0] === component.name)))
  const zip = await JSZip.loadAsync(await toDocx(document))
  const xml = await zip.file('word/document.xml').async('string')
  assert.match(xml, /Edited &amp; approved &lt;copy&gt;/)
  assert.match(xml, /Second line café €/)
  for (const heading of ['Content inventory', 'Design tokens', 'Typography', 'Components', 'Review notes']) assert.ok(xml.includes(heading))
  assert.match(xml, /<w:br\/>/)
})

test('PDF generates a real multipage document for long edited copy', async () => {
  const document = demo()
  document.content[0].content = 'Long edited copy with café and € currency. '.repeat(600)
  const buffer = await toPdf(document)
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
  assert.match(buffer.toString('latin1'), /%%EOF/)
  assert.ok((buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 2)
})

test('empty optional inventories produce usable Word and PDF files', async () => {
  const document = { source: { name: 'Empty file' }, content: [] }
  assert.ok(exportBlocks(document).some(block => block.text === 'No text content in this document.'))
  assert.ok((await toDocx(document)).length > 100)
  assert.equal((await toPdf(document)).subarray(0, 5).toString(), '%PDF-')
})

test('invalid export payloads are rejected as bad requests', async () => {
  for (const payload of [null, {}, {source:{name:'Invalid'},content:[{content:{text:'bad'}}]}, {source:{name:'Invalid'},content:[],tokens:{colors:[{usages:{}}]}}]) {
    await assert.rejects(toDocx(payload), { status: 400 })
    await assert.rejects(toPdf(payload), { status: 400 })
  }
})

test('report tables reflect current edits and provide repeated table headers in Word', async () => {
  const document = demo()
  document.content[0].content = 'Repeated edited text'
  document.content[1].content = 'Repeated edited text'
  const blocks = exportBlocks(document)
  assert.ok(blocks.filter(block => block.kind === 'table').length >= 7)
  assert.ok(blocks.some(block => block.text === '2 occurrences'))
  const overview = blocks.find(block => block.kind === 'table' && block.headers[0] === 'Measure')
  assert.equal(overview.rows.find(row => row[0] === 'Characters including spaces')[1], String(document.content.reduce((sum, item) => sum + Array.from(item.content).length, 0)))
  const zip = await JSZip.loadAsync(await toDocx(document))
  const xml = await zip.file('word/document.xml').async('string')
  assert.ok((xml.match(/<w:tbl>/g) || []).length >= 7)
  assert.match(xml, /w:tblHeader/)
})


test('older saved button copy is corrected in export without mutating original', () => {
  const document = demo()
  document.content[0].role = 'Body'
  document.content[0].path = 'Page / Filled large button / Get Started'
  const blocks = exportBlocks(document)
  assert.ok(blocks.some(block => block.text?.startsWith('Button | Hero title')))
  assert.equal(document.content[0].role, 'Body')
  assert.ok(!blocks.some(block => block.text?.includes('INSTANCE | Instances:')))
})
