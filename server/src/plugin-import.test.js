import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { importPlugin } from './plugin-import.js'
import { toDocx, toPdf } from './exports.js'

test('plugin selection exports once and flows through parser and Word/PDF', async () => {
  const messages = []
  const page = { id: '1:1', name: 'Page', selection: [] }
  const text = { id: '2:2', type: 'TEXT', name: 'Title', characters: 'Hello Malayalam മലയാളം', style: { fontSize: 32, fontFamily: 'Inter' } }
  const frame = { id: '2:1', parent: page, exportAsync: async () => ({ document: { id: '2:1', type: 'FRAME', name: 'Hero', children: [text] } }) }
  page.selection = [frame, { id: '2:2', parent: frame, exportAsync: () => { throw new Error('Nested selection must not export twice') } }]
  const figma = { currentPage: page, root: { name: 'Plugin test' }, showUI() {}, on() {}, ui: { postMessage: message => messages.push(message) } }
  vm.runInNewContext(await readFile(new URL('../../figma-plugin/code.js', import.meta.url), 'utf8'), { figma, __html__: '', fetch: () => { throw new Error('Plugin must not use network authentication') } })
  await figma.ui.onmessage({ type: 'export' })
  const result = messages.find(message => message.type === 'result')
  assert.ok(result)
  const doc = importPlugin(JSON.parse(result.json))
  assert.equal(doc.content.length, 1)
  assert.equal(doc.content[0].content, text.characters)
  assert.equal(doc.content[0].section, 'Hero')
  assert.ok((await toDocx(doc)).length > 100)
  assert.equal((await toPdf(doc)).subarray(0, 4).toString(), '%PDF')
  page.selection = []
  await figma.ui.onmessage({ type: 'export', token: 'test-token' })
  assert.equal(messages.at(-1).type, 'error')

})

test('plugin import rejects other JSON, malformed paint arrays and excessive depth', () => {
  assert.throws(() => importPlugin({ content: [] }), { status: 400 })
  const file = { name: 'Test', document: { id: '0', type: 'DOCUMENT', children: [{ id: '1', type: 'CANVAS', fills: 'invalid' }] } }
  assert.throws(() => importPlugin({ format: 'figdoc-plugin', version: 1, file }), { status: 400 })
  delete file.document.children[0].fills
  let node = file.document.children[0]
  for (let i = 0; i < 102; i++) { node.children = [{ id: String(i), type: 'FRAME' }]; node = node.children[0] }
  assert.throws(() => importPlugin({ format: 'figdoc-plugin', version: 1, file }), /too complex/)
})


test('selected bitmap gets a preview and missing REST text is recovered from live nodes', async () => {
 const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE5kAAAAASUVORK5CYII=', 'base64'))
 const messages = []
 const bitmap = { id: 'b', type: 'RECTANGLE', name: 'Screen image', width: 300, height: 600, fills: [{type:'IMAGE'}], exportAsync: async ({format}) => format === 'PNG' ? png : {document:{id:'b',type:'RECTANGLE',name:'Screen image'}} }
 const text = { id: 't', type: 'TEXT', name: 'H1 title', characters: 'Track your nutrition', fontSize: 32, fontName: {family:'Inter'} }
 const frame = { id: 'f', type: 'FRAME', name: 'Home', children: [text], exportAsync: async () => ({document:{id:'f',type:'FRAME',name:'Home'}}) }
 const figma = { currentPage: {id:'p',name:'Screens',selection:[bitmap,frame]}, root:{name:'Nutrition'}, showUI(){},on(){},base64Encode: bytes => Buffer.from(bytes).toString('base64'),ui:{postMessage: message => messages.push(message)} }
 vm.runInNewContext(await readFile(new URL('../../figma-plugin/code.js', import.meta.url),'utf8'),{figma,__html__:''})
 await figma.ui.onmessage({type:'export'})
 assert.equal(messages.at(-1).type,'result')
 const doc=importPlugin(JSON.parse(messages.at(-1).json))
 assert.equal(doc.content[0].content,'Track your nutrition')
 assert.equal(doc.previews[0].id,'b')
 assert.equal(doc.imageAssets[0].sectionId,'b')
})
