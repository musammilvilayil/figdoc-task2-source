import { initializeApp } from 'firebase/app'
import { initializeAuth, inMemoryPersistence, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth'
import { firebaseConfig, loginUrl } from './firebase-config.js'
import { createRequest, openCredential } from './handoff.js'
import { waitForHandoff } from './relay.js'

export function setupAuth({ onSignedOut, onStatus }) {
  const auth = initializeAuth(initializeApp(firebaseConfig), { persistence: inMemoryPersistence })
  const $ = id => document.getElementById(id)
  let controller = null, generation = 0
  $('google-login').onclick = async () => {
    if (controller) return
    const current = ++generation
    controller = new AbortController()
    const signal = controller.signal
    $('google-login').disabled = true
    $('cancel-login').hidden = false
    try {
      const pending = await createRequest()
      if (signal.aborted) return
      const endpoint = firebaseConfig.databaseURL + '/handoffs/' + pending.request.nonce + '.json'
      parent.postMessage({ pluginMessage: { type: 'open-login', url: loginUrl + '#' + pending.fragment } }, '*')
      onStatus('Choose your Google account in the browser. Figdoc will connect automatically. Keep the sign-in page open until it says Connected.')
      const code = await waitForHandoff(endpoint, pending.request.expires, signal)
      if (signal.aborted) return
      const idToken = await openCredential(pending, code)
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
      if (current !== generation) { await signOut(auth); return }
      const token = await auth.currentUser.getIdToken()
      // Delete the encrypted handoff with the same user's verified Firebase token.
      // The browser also has a server-side onDisconnect cleanup and expiry timer.
      const removed = await fetch(endpoint + '?auth=' + encodeURIComponent(token), { method: 'DELETE', signal })
      if (!removed.ok) throw new Error('Could not complete the login connection. Please try again.')
      if (current !== generation) return
      parent.postMessage({ pluginMessage: { type: 'authenticate', token } }, '*')
      onStatus('Verifying your Google account…')
    } catch (error) {
      if (current === generation) onStatus(error.message)
    } finally {
      if (current === generation) {
        controller = null
        $('google-login').disabled = false
        $('cancel-login').hidden = true
      }
    }
  }
  async function cancel() {
    generation++; controller?.abort(); controller = null
    $('google-login').disabled = false
    $('cancel-login').hidden = true
    onSignedOut()
    parent.postMessage({ pluginMessage: { type: 'signout' } }, '*')
    await signOut(auth)
    onStatus('Choose Google or continue as guest.')
  }
  $('guest-login').onclick = async () => {
    await cancel()
    parent.postMessage({ pluginMessage: { type: 'guest-login' } }, '*')
  }
  $('cancel-login').onclick = cancel
  $('signout').onclick = cancel
  return {
    async token() {
      if (!auth.currentUser) throw new Error('Sign in with Google first.')
      return auth.currentUser.getIdToken()
    },
  }
}
