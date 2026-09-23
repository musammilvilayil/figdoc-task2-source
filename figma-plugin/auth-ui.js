import { initializeApp } from 'firebase/app'
import { initializeAuth, inMemoryPersistence, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth'
import { firebaseConfig, loginUrl } from './firebase-config.js'
import { createRequest, openCredential } from './handoff.js'

export function setupAuth({ onSignedOut, onStatus }) {
  const auth = initializeAuth(initializeApp(firebaseConfig), { persistence: inMemoryPersistence })
  const $ = id => document.getElementById(id)
  let pending, working = false, generation = 0
  $('google-login').onclick = async () => {
    if (working) return
    working = true
    $('google-login').disabled = true
    try {
      pending = await createRequest()
      $('connection-code').value = ''
      $('connect-fields').hidden = false
      parent.postMessage({ pluginMessage: { type: 'open-login', url: loginUrl + '#' + pending.fragment } }, '*')
      onStatus('Complete Google sign-in in your browser, then paste the connection code below.')
    } catch (error) { onStatus(error.message) }
    finally { working = false; $('google-login').disabled = false }
  }
  $('connect').onclick = async () => {
    if (working) return
    working = true
    const current = generation
    $('connect').disabled = $('google-login').disabled = true
    try {
      const idToken = await openCredential(pending, $('connection-code').value.trim())
      $('connection-code').value = ''
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
      if (current !== generation) { await signOut(auth); return }
      parent.postMessage({ pluginMessage: { type: 'authenticate', token: await auth.currentUser.getIdToken() } }, '*')
      onStatus('Verifying your Google account…')
    } catch (error) { onStatus('Could not connect. ' + error.message + ' Start a new sign-in to retry.') }
    finally { working = false; $('connect').disabled = $('google-login').disabled = false }
  }
  $('signout').onclick = async () => {
    generation++; pending = null
    onSignedOut()
    parent.postMessage({ pluginMessage: { type: 'signout' } }, '*')
    await signOut(auth)
    $('connection-code').value = ''
    $('connect-fields').hidden = true
    onStatus('Signed out. Continue with Google to use Figdoc.')
  }
  return {
    async token() {
      if (!auth.currentUser) throw new Error('Sign in with Google first.')
      return auth.currentUser.getIdToken()
    },
  }
}
