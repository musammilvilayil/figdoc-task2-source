import { initializeApp } from 'firebase/app'
import { initializeAuth, browserSessionPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { getDatabase, ref, set, remove, onDisconnect, onValue } from 'firebase/database'
import { firebaseConfig, loginUrl } from '../figma-plugin/firebase-config.js'
import { readRequest, sealCredential } from '../figma-plugin/handoff.js'
const app = initializeApp({ ...firebaseConfig, authDomain: new URL(loginUrl).hostname })
const auth = initializeAuth(app, { persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver })
const database = getDatabase(app)
const $ = id => document.getElementById(id)
let request, cleanupTimer, unsubscribe
const connectionWatchdog = setTimeout(() => {
  $('status').textContent = 'Google sign-in is taking too long. Open this login from Figma in Chrome or Edge, and check that your browser allows Google sign-in services.'
  $('google').disabled = false
}, 25000)
try {
  const fragment = location.hash.slice(1) || sessionStorage.getItem('figdoc-request') || ''
  request = readRequest(fragment)
  sessionStorage.setItem('figdoc-request', fragment)
  history.replaceState(null, '', location.pathname)
  $('status').textContent = 'Connecting…'
} catch { clearTimeout(connectionWatchdog); $('status').textContent = 'Open Figdoc in Figma and click Continue with Google.' }
async function googleSignIn() {
  if (!request) return
  $('google').disabled = true
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    $('status').textContent = 'Opening Google sign-in…'
    await signInWithRedirect(auth, provider)
  } catch (error) { $('status').textContent = 'Sign-in failed. ' + error.message; $('google').disabled = false }
}
async function finishSignIn() {
  if (!request) { await signOut(auth); return }
  let handoff
  try {
    const result = await getRedirectResult(auth)
    if (!result) { await googleSignIn(); return }
    const credential = GoogleAuthProvider.credentialFromResult(result)
    const code = await sealCredential(request, credential?.idToken)
    handoff = ref(database, 'handoffs/' + request.nonce)
    // Register server-side cleanup before publishing. Closing this page removes it.
    await onDisconnect(handoff).remove()
    await set(handoff, { code, uid: result.user.uid, expires: request.expires })
    clearTimeout(connectionWatchdog)
    $('google').hidden = true
    $('status').textContent = 'Signed in. Connecting to Figma… Keep this page open for a moment.'
    sessionStorage.removeItem('figdoc-request')
    cleanupTimer = setTimeout(async () => {
      unsubscribe?.()
      try { await remove(handoff) } finally {
        await signOut(auth)
        $('status').textContent = 'Connection expired. Start again from the Figdoc plugin.'
      }
    }, Math.max(1, request.expires - Date.now()))
    unsubscribe = onValue(handoff, async snapshot => {
      if (snapshot.exists()) return
      clearTimeout(cleanupTimer)
      unsubscribe?.()
      $('status').textContent = 'Connected! Return to Figma. You can close this page.'
      $('success').hidden = false
      await signOut(auth)
    }, async () => {
      clearTimeout(cleanupTimer)
      $('status').textContent = 'Connection interrupted. Start again from Figdoc.'
      await signOut(auth)
    })
  } catch (error) {
    clearTimeout(connectionWatchdog)
    if (handoff) { try { await remove(handoff) } catch {} }
    await signOut(auth)
    $('status').textContent = 'Sign-in failed. ' + error.message + ' Start again from Figdoc.'
    $('google').disabled = false
  }
}
$('google').onclick = googleSignIn
finishSignIn()
