import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequest, readRequest, sealCredential, openCredential } from '../../figma-plugin/handoff.js'

test('connection codes are bound to the requesting plugin and consumed once', async () => {
  const pending = await createRequest()
  const request = readRequest(pending.fragment)
  const code = await sealCredential(request, 'google-credential')
  assert.ok(!code.includes('google-credential'))
  await assert.rejects(openCredential(await createRequest(), code), /does not match/)
  assert.equal(await openCredential(pending, code), 'google-credential')
  await assert.rejects(openCredential(pending, code), /Start Google sign-in/)
})

test('expired, malformed and tampered connection codes cannot sign in', async () => {
  const pending = await createRequest()
  const code = await sealCredential(pending.request, 'google-credential')
  await assert.rejects(openCredential(pending, 'invalid'), /complete connection code/)
  const offset = Math.floor(code.length / 2)
  const changed = code.slice(0, offset) + (code[offset] === 'a' ? 'b' : 'a') + code.slice(offset + 1)
  await assert.rejects(openCredential(pending, changed), /does not match/)
  pending.request.expires = Date.now() - 1
  await assert.rejects(openCredential(pending, code), /expired/)
  await assert.rejects(sealCredential(pending.request, 'token'), /expired/)
})
