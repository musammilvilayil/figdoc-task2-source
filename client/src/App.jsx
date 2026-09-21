import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, FileText, Layers3, Link2, LockKeyhole, Palette } from 'lucide-react'
import { motion, MotionConfig } from 'motion/react'
import { analyzeFigma, listDocuments, saveRemoteDocument } from './api.js'
import { readLibrary, saveDocument } from './storage.js'
import DocumentPage from './DocumentPage.jsx'

function Brand() {
  return <Link className="brand" to="/" aria-label="Figdoc home"><span className="brand-mark"><Layers3 size={21} /></span><span>figdoc<span className="brand-dot">.</span></span></Link>
}

function HomePage({ onDocument, library, onOpen }) {
  const navigate = useNavigate()
  const [figmaUrl, setFigmaUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  async function load() {
    if (loading) return
    setError('')
    setLoading('import')
    try {
      const result = await analyzeFigma(figmaUrl.trim(), token.trim())
      await onDocument({ ...result, localId: crypto.randomUUID() })
      navigate('/document')
    } catch (err) { setError(err.message) } finally { setLoading('') }
  }
  return <main className="home-shell">
    <nav className="nav container" aria-label="Main navigation"><Brand /><span className="nav-caption">A little clarity for your next handoff.</span></nav>
    <section className="hero container">
      <motion.div className="hero-story" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
        <div className="eyebrow"><span /> FROM DESIGN TO DOCUMENT</div>
        <h1>Good design.<br />Great words.<br /><em>All in one place.</em></h1>
        <p className="hero-copy">Give the words in your Figma file a home. Bring copy, styles, and components into a document your whole team can work with.</p>
        <div className="story-note"><span className="note-line" /> Less hunting through layers.<br />More getting on the same page.</div>
        <div className="file-journey" aria-label="Figma design to editable document"><span><Layers3 size={16} /> Your Figma file</span><ArrowRight size={18} /><span><FileText size={16} /> A clear handoff</span></div>
      </motion.div>
      <motion.div className="import-area" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .1 }}>
        <div className="card-overline"><span>START SOMETHING CLEAR</span><span>01 — IMPORT</span></div>
        <form className="converter-card" onSubmit={(event) => { event.preventDefault(); load() }} aria-busy={!!loading}>
          <div className="form-heading"><span className="import-symbol"><Link2 size={23} /></span><h2>Bring your design in.</h2><p>One Figma link. Everything worth handing off.</p></div>
          <label htmlFor="figma-url">Figma file link</label>
          <div className="input-wrap"><Link2 size={17} /><input id="figma-url" type="url" value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/design/..." required disabled={!!loading} /></div>
          <span className="field-hint">Use a whole file or a link to a specific frame.</span>
          <div className="label-row"><label htmlFor="figma-token">Personal access token</label></div>
          <div className="input-wrap"><LockKeyhole size={17} /><input id="figma-token" value={token} onChange={(e) => setToken(e.target.value)} type={showToken ? 'text' : 'password'} placeholder="figd_..." autoComplete="off" required disabled={!!loading} /><button type="button" className="show-button" aria-label={showToken ? 'Hide access token' : 'Show access token'} aria-pressed={showToken} onClick={() => setShowToken(!showToken)}>{showToken ? 'Hide' : 'Show'}</button></div>
          <details className="token-help"><summary>Where do I find my token?</summary><p>In Figma, open Settings → Security → Personal access tokens. Generate a token with read access to file content, then paste it here.</p></details>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary-button" disabled={!!loading}>{loading === 'import' ? <><span className="spinner" /> Reading your design…</> : <>Create document <ArrowRight size={17} /></>}</button>
          <p className="privacy-note"><LockKeyhole size={12} /> Your token is used for this request and never stored.</p>
        </form>
        <div className="below-card"><Check size={14} /> Editable copy <span>·</span> Organized styles <span>·</span> Ready to export</div>
      </motion.div>
    </section>
    {library.length > 0 && <section className="saved-library container"><h2>Your saved documents</h2><p>Stored on this device. Clearing browser data removes these documents.</p><div>{[...library].sort((a,b) => b.savedAt.localeCompare(a.savedAt)).map(item => <button key={item.localId} onClick={async () => { await onOpen(item); navigate('/document') }}><FileText size={20} /><span><strong>{item.source.name}</strong><small>{item.content.length} text items · Saved {new Date(item.savedAt).toLocaleString()}</small></span><ArrowUpRight size={18} /></button>)}</div></section>}
    <section className="feature-strip container" aria-label="What is in your document">
      <div className="feature-intro"><span>THE DETAILS, TOGETHER</span><h2>A handoff with <br />nothing lost.</h2></div>
      <div><FileText /><span className="feature-index">01</span><strong>Every word, accounted for.</strong><p>Review and edit text by page and section. Keep the context that makes copy useful.</p></div>
      <div><Palette /><span className="feature-index">02</span><strong>A shared visual language.</strong><p>Colors, typography, and reusable components, collected from your design.</p></div>
      <div><ArrowUpRight /><span className="feature-index">03</span><strong>Ready for the next person.</strong><p>Share a Word document or PDF, or export Markdown and JSON for your workflow.</p></div>
    </section>
    <footer className="home-footer container"><span>Made for the space between design and delivery.</span><span>Figma in. Clarity out.</span></footer>
  </main>
}

export default function App() {
  const [document, setDocument] = useState(null)
  const [library, setLibrary] = useState([])
  const [ready, setReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Saved on this device')
  const revision = useRef(0)
  useEffect(() => {
    let mounted = true
    async function restore() {
      try {
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
      finally { if (mounted) setReady(true) }
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
  if (!ready) return <main className="container"><p role="status">Opening your workspace…</p></main>
  return <MotionConfig reducedMotion="user"><Routes>
    <Route path="/" element={<HomePage onDocument={updateDocument} library={library} onOpen={updateDocument} />} />
    <Route path="/document" element={document ? <DocumentPage key={document.localId} document={document} onChange={updateDocument} saveStatus={saveStatus} Brand={Brand} /> : <Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></MotionConfig>
}
