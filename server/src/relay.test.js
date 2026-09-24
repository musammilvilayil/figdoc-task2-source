import test from 'node:test'
import assert from 'node:assert/strict'
import { waitForHandoff } from '../../figma-plugin/relay.js'

test('automatic login waits through missing records and network interruptions', async () => {
  let calls = 0
  const result = await waitForHandoff('https://example.test/handoff', 100, new AbortController().signal, {
    now: () => 1, delay: async () => {}, request: async () => {
      calls++
      if (calls === 1) throw new TypeError('Network failure')
      return { ok: true, json: async () => calls === 2 ? null : { code: 'encrypted', expires: 99 } }
    },
  })
  assert.equal(result, 'encrypted')
  assert.equal(calls, 3)
})

test('cancelled and expired requests do not authenticate', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(waitForHandoff('unused', 100, controller.signal, { now: () => 1 }), /cancelled/)
  await assert.rejects(waitForHandoff('unused', 100, new AbortController().signal, { now: () => 101 }), /timed out/)
})

test('expired cloud records are ignored until timeout', async () => {
  let time = 1
  await assert.rejects(waitForHandoff('unused', 10, new AbortController().signal, {
    now: () => time, delay: async () => { time = 11 },
    request: async () => ({ ok: true, json: async () => ({ code: 'expired', expires: 0 }) }),
  }), /timed out/)
})
