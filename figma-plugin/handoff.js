// The browser encrypts a short-lived Google credential for this plugin instance.
// Only public keys travel in the URL; no token is stored on a relay or database.
const encoder = new TextEncoder()
const decoder = new TextDecoder()
export const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
export const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
const pack = value => encode(encoder.encode(JSON.stringify(value)))
const unpack = value => JSON.parse(decoder.decode(decode(value)))
const keyOptions = { name: 'ECDH', namedCurve: 'P-256' }
async function derive(privateKey, publicKey) {
  const imported = await crypto.subtle.importKey('jwk', publicKey, keyOptions, false, [])
  return crypto.subtle.deriveKey({ name: 'ECDH', public: imported }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
function validateRequest(request) {
  if (request.v !== 1 || typeof request.nonce !== 'string' || request.nonce.length !== 43 || !Number.isFinite(request.expires) || request.expires <= Date.now() || request.expires > Date.now() + 11 * 60_000) throw new Error('This sign-in request expired. Start again from Figdoc.')
}
export async function createRequest() {
  const pair = await crypto.subtle.generateKey(keyOptions, false, ['deriveKey'])
  const request = { v: 1, nonce: encode(crypto.getRandomValues(new Uint8Array(32))), expires: Date.now() + 10 * 60_000, publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey) }
  return { request, privateKey: pair.privateKey, fragment: pack(request), used: false }
}
export function readRequest(fragment) {
  if (fragment.length > 3000) throw new Error('Invalid sign-in link. Open it from the Figdoc plugin.')
  const request = unpack(fragment)
  validateRequest(request)
  return request
}
export async function sealCredential(request, idToken) {
  validateRequest(request)
  if (typeof idToken !== 'string' || !idToken) throw new Error('Google did not return a sign-in credential.')
  const pair = await crypto.subtle.generateKey(keyOptions, false, ['deriveKey'])
  const key = await derive(pair.privateKey, request.publicKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(request.nonce) }, key, encoder.encode(JSON.stringify({ idToken, nonce: request.nonce, expires: request.expires })))
  return 'FIGDOC1.' + pack({ publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey), iv: encode(iv), data: encode(data) })
}
export async function openCredential(pending, code) {
  if (!pending || pending.used) throw new Error('Start Google sign-in from this plugin first.')
  validateRequest(pending.request)
  if (!code.startsWith('FIGDOC1.') || code.length > 20000) throw new Error('Paste the complete connection code from the Figdoc sign-in page.')
  try {
    const envelope = unpack(code.slice(8))
    const key = await derive(pending.privateKey, envelope.publicKey)
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: encoder.encode(pending.request.nonce) }, key, decode(envelope.data))
    const value = JSON.parse(decoder.decode(data))
    if (value.nonce !== pending.request.nonce || value.expires !== pending.request.expires || typeof value.idToken !== 'string') throw new Error('Invalid credential')
    pending.used = true
    return value.idToken
  } catch { throw new Error('This code does not match this sign-in attempt. Copy the latest code or start again.') }
}
