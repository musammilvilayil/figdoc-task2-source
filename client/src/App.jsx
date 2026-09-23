import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, FileText, Layers3, Link2, LockKeyhole, Palette } from 'lucide-react'
import { motion, MotionConfig } from 'motion/react'
import { analyzeFigma, continueAsGuest, currentUser, googleLoginUrl, importPluginFile, listDocuments, login, logout, register, saveRemoteDocument } from './api.js'
import { readLibrary, saveDocument } from './storage.js'
import DocumentPage from './DocumentPage.jsx'

function Brand() {
  return <Link className="brand" to="/" aria-label="Figdoc home"><span className="brand-mark"><Layers3 size={21} /></span><span>figdoc<span className="brand-dot">.</span></span></Link>
}

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'register') await register(email, password)
      const user = await login(email, password)
      onAuthenticated(user)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return <main className="home-shell"><section className="hero container"><div className="import-area" style={{ maxWidth: 520, margin: '0 auto' }}><div className="card-overline"><span>FIGDOC WORKSPACE</span><span>{mode === 'login' ? '01 — SIGN IN' : '01 — CREATE ACCOUNT'}</span></div><form className="converter-card" onSubmit={submit}><div className="form-heading"><span className="import-symbol"><LockKeyhole size={23} /></span><h2>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2><p>Sign in to keep your content documents private.</p></div><label htmlFor="auth-email">Email address</label><div className="input-wrap"><input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div><label htmlFor="auth-password">Password</label><div className="input-wrap"><input id="auth-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></div>{error && <div className="error" role="alert">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button><button type="button" className="show-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'I already have an account'}</button></form></div></section></main>
}

function AuthChoice({ onGuest, onEmail }) {
  return <main className="home-shell"><section className="hero container"><div className="import-area" style={{ maxWidth: 520, margin: '0 auto' }}><div className="card-overline"><span>FIGDOC WORKSPACE</span><span>01 — CHOOSE ACCESS</span></div><div className="converter-card"><div className="form-heading"><span className="import-symbol"><LockKeyhole size={23} /></span><h2>How would you like to continue?</h2><p>Google is optional. You can use Figdoc as a guest.</p></div><a className="primary-button" href={googleLoginUrl()} style={{ textDecoration: 'none', justifyContent: 'center' }}>Continue with Google <ArrowRight size={17} /></a><button className="secondary-button" onClick={onGuest}>Continue as guest</button><button className="show-button" onClick={onEmail}>Use email and password</button></div></div></section></main>
}

function HomePage({ onDocument, library, onOpen, user, onLogout }) {
  const navigate = useNavigate()
  const [libraryQuery, setLibraryQuery] = useState('')
  const [librarySort, setLibrarySort] = useState('recent')
  const [figmaUrl, setFigmaUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [importMode, setImportMode] = useState('link')
  const [pluginFile, setPluginFile] = useState(null)
  async function load() {
    if (loading) return
    setError('')
    setLoading('import')
    try {
      if (importMode === 'plugin' && !pluginFile) throw new Error('Choose your .figdoc.json file first.')
      const result = importMode === 'plugin' ? await importPluginFile(pluginFile) : await analyzeFigma(figmaUrl.trim(), token.trim())
      await onDocument({ ...result, localId: crypto.randomUUID() })
      navigate('/document')
    } catch (err) { setError(err.message) } finally { setLoading('') }
  }
  return <main className="home-shell">
        <header className="landing-header">
      <nav className="landing-nav container" aria-label="Main navigation">
        <div className="landing-identity"><Brand /><span className="brand-descriptor">THE HANDOFF WORKSPACE</span></div>
        <div className="landing-links"><a href="#how-it-works">How it works</a>{library.length > 0 && <a href="#saved-documents">Your documents <span>{library.length}</span></a>}<span>{user.email}</span><button type="button" className="show-button" onClick={onLogout}>Sign out</button></div>
        <a className="header-cta" href="#import-design" onClick={() => requestAnimationFrame(() => window.document.getElementById('figma-url')?.focus({ preventScroll: true }))}>Import a design <ArrowUpRight size={16} /></a>
      </nav>
      <div className="header-subline container"><span><span className="header-status-dot" /> A clearer path from Figma to handoff</span><span className="header-formats">WORD <span>/</span> PDF <span>/</span> MARKDOWN <span>/</span> JSON</span></div>
    </header>
    <section className="hero container">
      <motion.div className="hero-story" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
        <div className="eyebrow"><span /> FROM DESIGN TO DOCUMENT</div>
        <h1>Good design.<br />Great words.<br /><em>All in one place.</em></h1>
        <p className="hero-copy">Give the words in your Figma file a home. Bring copy, styles, and components into a document your whole team can work with.</p>
        <div className="story-note"><span className="note-line" /> Less hunting through layers.<br />More getting on the same page.</div>
        <div className="file-journey" aria-label="Figma design to editable document"><span><Layers3 size={16} /> Your Figma file</span><ArrowRight size={18} /><span><FileText size={16} /> A clear handoff</span></div>
      </motion.div>
      <motion.div id="import-design" className="import-area" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .1 }}>
        <div className="card-overline"><span>START SOMETHING CLEAR</span><span>01 — IMPORT</span></div>
        <form className="converter-card" onSubmit={(event) => { event.preventDefault(); load() }} aria-busy={!!loading}>
          <div className="form-heading"><span className="import-symbol"><Link2 size={23} /></span><h2>Bring your design in.</h2><p>One Figma link. Everything worth handing off.</p></div>
          <div className="import-modes" aria-label="Import method">{[['link', 'Figma link'], ['plugin', 'Plugin file · No token']].map(([mode, label]) => <button key={mode} type="button" aria-pressed={importMode === mode} disabled={!!loading} onClick={() => { setImportMode(mode); setError('') }}>{label}</button>)}</div>
          {importMode === 'link' ? <><label htmlFor="figma-url">Figma file link</label>
          <div className="input-wrap"><Link2 size={17} /><input id="figma-url" type="url" value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/design/..." required disabled={!!loading} /></div>
          <span className="field-hint">Use a whole file or a link to a specific frame.</span>
          <div className="label-row"><label htmlFor="figma-token">Personal access token</label></div>
          <div className="input-wrap"><LockKeyhole size={17} /><input id="figma-token" value={token} onChange={(e) => setToken(e.target.value)} type={showToken ? 'text' : 'password'} placeholder="figd_..." autoComplete="off" required disabled={!!loading} /><button type="button" className="show-button" aria-label={showToken ? 'Hide access token' : 'Show access token'} aria-pressed={showToken} onClick={() => setShowToken(!showToken)}>{showToken ? 'Hide' : 'Show'}</button></div>
          <details className="token-help"><summary>Where do I find my token?</summary><p>In Figma, open Settings → Security → Personal access tokens. Generate a token with read access to file content, then paste it here.</p></details>
          </> : <div className="plugin-import"><p>Export selected frames with the Figdoc Figma plugin, then upload the file here.</p><label htmlFor="plugin-file">Figdoc plugin file</label><input id="plugin-file" type="file" accept=".json,application/json" required disabled={!!loading} onChange={event => setPluginFile(event.target.files?.[0] || null)} /><span className="field-hint">.figdoc.json · Up to 9 MB</span><details className="token-help"><summary>Set up the Figma plugin</summary><p><a href="/figdoc-plugin.zip" download>Download plugin source</a>, unzip it, and follow the included README to register it in Figma Desktop. Run it on your selected frames and download the plugin file.</p></details></div>}
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary-button" disabled={!!loading}>{loading === 'import' ? <><span className="spinner" /> Reading your design…</> : <>Create document <ArrowRight size={17} /></>}</button>
          <p className="privacy-note"><LockKeyhole size={12} /> {importMode === 'plugin' ? 'No token needed. Your file is processed by this Figdoc server.' : 'Your token is used for this request and never stored.'}</p>
        </form>
        <div className="below-card"><Check size={14} /> Editable copy <span>·</span> Organized styles <span>·</span> Ready to export</div>
      </motion.div>
    </section>
    {library.length > 0 && <section id="saved-documents" className="saved-library container"><h2>Your saved documents</h2><p>Reopen a document to continue editing.</p><div className="library-tools"><input aria-label="Search saved documents" placeholder="Find a document…" value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} /><select aria-label="Sort saved documents" value={librarySort} onChange={event => setLibrarySort(event.target.value)}><option value="recent">Recently saved</option><option value="name">Name A–Z</option></select></div>{!library.some(item => item.source.name.toLowerCase().includes(libraryQuery.toLowerCase())) && <p role="status">No documents match your search.</p>}<div>{[...library].filter(item => item.source.name.toLowerCase().includes(libraryQuery.toLowerCase())).sort((a,b) => librarySort === 'name' ? a.source.name.localeCompare(b.source.name) : b.savedAt.localeCompare(a.savedAt)).map(item => <button key={item.localId} onClick={async () => { await onOpen(item); navigate('/document') }}><FileText size={20} /><span><strong>{item.source.name}</strong><small>{item.content.length} text items · Saved {new Date(item.savedAt).toLocaleString()}</small></span><ArrowUpRight size={18} /></button>)}</div></section>}
    <section id="how-it-works" className="feature-strip container" aria-label="What is in your document">
      <div className="feature-intro"><span>THE DETAILS, TOGETHER</span><h2>A handoff with <br />nothing lost.</h2></div>
      <div><FileText /><span className="feature-index">01</span><strong>Every word, accounted for.</strong><p>Review and edit text by page and section. Keep the context that makes copy useful.</p></div>
      <div><Palette /><span className="feature-index">02</span><strong>A shared visual language.</strong><p>Colors, typography, and reusable components, collected from your design.</p></div>
      <div><ArrowUpRight /><span className="feature-index">03</span><strong>Ready for the next person.</strong><p>Share a Word document or PDF, or export Markdown and JSON for your workflow.</p></div>
    </section>
    <footer className="home-footer container"><span>Made for the space between design and delivery.</span><span>Figma in. Clarity out.</span></footer>
  </main>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [showAuthChoice, setShowAuthChoice] = useState(true)
  const [emailAuth, setEmailAuth] = useState(false)
  const [document, setDocument] = useState(null)
  const [library, setLibrary] = useState([])
  const [ready, setReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Saved on this device')
  const revision = useRef(0)
  useEffect(() => {
    let mounted = true
    async function restore() {
      try {
        const session = await currentUser()
        if (mounted) setUser(session.user)
        const data = await readLibrary()
        let docs = data.documents
        let active = docs.find(item => item.localId === data.active) || null
        try {
          const remoteDocs = await listDocuments()
          if (remoteDocs.length) {
            docs = remoteDocs
            active = remoteDocs[0]
            await Promise.all(remoteDocs.map(item => saveDocument(item)))
          }
        } catch { /* Keep using local storage when the server library is unavailable. */ }
        if (!docs.length) {
          let legacy
          try { legacy = JSON.parse(sessionStorage.getItem('figdoc-result')) } catch { /* No valid previous session. */ }
          if (legacy?.source && Array.isArray(legacy.content)) {
            active = { ...legacy, localId: crypto.randomUUID(), savedAt: new Date().toISOString() }
            await saveDocument(active)
            docs = [active]
          }
        }
        if (mounted) { setLibrary(docs); setDocument(active) }
      } catch { if (mounted) setSaveStatus('Storage unavailable. Export a backup before leaving.') }
      finally { if (mounted) { setAuthReady(true); setReady(true) } }
    }
    restore()
    return () => { mounted = false }
  }, [])
  async function updateDocument(next) {
    const current = ++revision.current
    const record = { ...next, savedAt: new Date().toISOString() }
    setDocument(record)
    setSaveStatus('Saving…')
    try {
      await saveDocument(record)
      await saveRemoteDocument(record)
      setLibrary(items => [...items.filter(item => item.localId !== record.localId), record])
      if (current === revision.current) setSaveStatus('Saved on this device')
    } catch {
      if (current === revision.current) setSaveStatus('Saved locally. Server sync will retry on the next change.')
    }
  }
  async function activateUser(nextUser) {
    setUser(nextUser)
    setEmailAuth(false)
    setShowAuthChoice(false)
    setLibrary([])
    setDocument(null)
    try {
      const remoteDocs = await listDocuments()
      if (remoteDocs.length) {
        setLibrary(remoteDocs)
        setDocument(remoteDocs[0])
        await Promise.all(remoteDocs.map(item => saveDocument(item)))
      }
    } catch { setSaveStatus('Guest workspace ready. Server history is unavailable.') }
  }
  if (!authReady) return <main className="container"><p role="status">Opening your workspace…</p></main>
  if (showAuthChoice) return <AuthChoice onGuest={async () => activateUser(await continueAsGuest())} onEmail={() => setEmailAuth(true)} />
  if (emailAuth || !user) return <AuthPage onAuthenticated={activateUser} />
  if (!ready) return <main className="container"><p role="status">Opening your workspace…</p></main>
  return <MotionConfig reducedMotion="user"><Routes>
    <Route path="/" element={<HomePage onDocument={updateDocument} library={library} onOpen={updateDocument} user={user} onLogout={async () => { await logout(); setUser(null); setLibrary([]); setDocument(null) }} />} />
    <Route path="/document" element={document ? <DocumentPage key={document.localId} document={document} onChange={updateDocument} saveStatus={saveStatus} Brand={Brand} /> : <Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></MotionConfig>
}


