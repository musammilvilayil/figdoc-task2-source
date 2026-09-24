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
  let valid = true
  vm.runInNewContext(await readFile(new URL('../../figma-plugin/code.js', import.meta.url), 'utf8'), { figma, __html__: '', fetch: async () => ({ ok: valid, json: async () => valid ? { users: [{ email: 'test@example.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] }] } : {} }) })
  await figma.ui.onmessage({ type: 'export', token: 'test-token' })
  assert.equal(messages.at(-1).type, 'auth-error')
  await figma.ui.onmessage({ type: 'authenticate', token: 'test-token' })
  assert.equal(messages.at(-1).type, 'authenticated')
  await figma.ui.onmessage({ type: 'export', token: 'test-token' })
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
  valid = false
  await figma.ui.onmessage({ type: 'export', token: 'expired-token' })
  assert.equal(messages.at(-1).type, 'auth-error')
  valid = true
  await figma.ui.onmessage({ type: 'authenticate', token: 'test-token' })
  await figma.ui.onmessage({ type: 'signout' })
  await figma.ui.onmessage({ type: 'export', token: 'test-token' })
  assert.equal(messages.at(-1).type, 'auth-error')
  valid = false // Guest exports must not call Google verification.
  page.selection = [frame]
  await figma.ui.onmessage({ type: 'guest-login' })
  assert.equal(messages.at(-1).type, 'guest-session')
  await figma.ui.onmessage({ type: 'export' })
  assert.equal(messages.at(-1).type, 'result')
  await figma.ui.onmessage({ type: 'signout' })
  await figma.ui.onmessage({ type: 'export' })
  assert.equal(messages.at(-1).type, 'auth-error')
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
