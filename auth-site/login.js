import { initializeApp } from 'firebase/app'
import { initializeAuth, browserSessionPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { firebaseConfig, loginUrl } from '../figma-plugin/firebase-config.js'
import { readRequest, sealCredential } from '../figma-plugin/handoff.js'
// Firebase Hosting serves /__/auth on this same domain, avoiding third-party storage.
const auth = initializeAuth(initializeApp({ ...firebaseConfig, authDomain: new URL(loginUrl).hostname }), { persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver })
const $ = id => document.getElementById(id)
let request
try {
  const fragment = location.hash.slice(1) || sessionStorage.getItem('figdoc-request') || ''
  request = readRequest(fragment)
  sessionStorage.setItem('figdoc-request', fragment)
  history.replaceState(null, '', location.pathname)
  $('status').textContent = 'Checking sign-in…'
} catch { $('status').textContent = 'Open a new sign-in link from the Figdoc plugin to continue.' }
async function finishSignIn() {
  if (!request) { await signOut(auth); return }
  try {
    const result = await getRedirectResult(auth)
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result)
      $('code').value = await sealCredential(request, credential?.idToken)
      $('status').textContent = `Signed in as ${result.user.email}. Copy the code and return to Figdoc.`
      $('result').hidden = false
      $('google').hidden = true
      sessionStorage.removeItem('figdoc-request')
    } else {
      $('status').textContent = 'Ready to connect Figdoc. Choose your Google account below.'
    }
  } catch (error) { $('status').textContent = 'Sign-in failed. ' + error.message }
  finally { await signOut(auth); $('google').disabled = false }
}
$('google').onclick = async () => {
  $('google').disabled = true
  $('result').hidden = true
  $('code').value = ''
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    $('status').textContent = 'Opening Google sign-in…'
    await signInWithRedirect(auth, provider)
  } catch (error) { $('status').textContent = 'Sign-in failed. ' + error.message; $('google').disabled = false }
}
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('code').value); $('status').textContent = 'Copied. Return to Figma and paste the connection code.' }
  catch { $('code').select(); $('status').textContent = 'Select and copy the code manually, then return to Figma.' }
}
finishSignIn()
