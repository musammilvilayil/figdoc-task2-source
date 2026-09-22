import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AlertTriangle, Check, ChevronDown, Download, FileJson, FileText, Layers3, Palette, Search, Type, X } from 'lucide-react'
import { scopeDocument } from './exportScope.js'
import { downloadJson, downloadDocument } from './api.js'

const tabs = [
  ['content', 'Content', FileText],
  ['tokens', 'Design tokens', Palette],
  ['components', 'Components', Layers3],
]

export default function DocumentPage({ document, onChange, saveStatus, Brand }) {
  const [tab, setTab] = useState('content')
  const [page, setPage] = useState('All pages')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [includeInventories, setIncludeInventories] = useState(true)
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)

  const filtered = useMemo(() => document.content.filter((item) => {
    const pageMatches = page === 'All pages' || item.page === page
    const searchMatches = `${item.content} ${item.name} ${item.section}`.toLowerCase().includes(query.toLowerCase())
    return pageMatches && searchMatches
  }), [document.content, page, query])
  const sections = useMemo(() => [...new Map(document.content.map(item => [`${item.page}::${item.section}`, item])).values()], [document.content])

  function editContent(id, content) {
    onChange({ ...document, content: document.content.map((item) => item.id === id ? { ...item, content } : item) })

  }

  async function exportFile(format) {
    if (exporting) return
    setExporting(true)
    setExportError(false)
    setToast('')
    try {
      const selected = scopeDocument(document, scope, filtered, includeInventories)
      if (scope !== 'all' && !selected.content.length) throw new Error('No text matches this export scope. Choose another page or clear your filters.')
      if (format === 'json') downloadJson(selected)
      else await downloadDocument(selected, format)
      setToast('Your export is ready. The download has started.')
    } catch (error) {
      setExportError(true)
      setToast(error.message)
    } finally { setExporting(false) }
  }
  return (
    <div className="app-shell"><a className="skip-link" href="#workspace-content">Skip to content</a>
      <header className="app-header">
        <Brand />
        <div className="header-file"><span>{document.source.name}</span><small>Content document</small></div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => onChange(document)} title={saveStatus}>{saveStatus === 'Saved on this device' ? <Check size={16} /> : null} Save</button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild><button className="primary-small" disabled={exporting} aria-busy={exporting}><Download size={16} /> {exporting ? 'Exporting…' : 'Export'} <ChevronDown size={15} /></button></DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content className="export-popover" align="end" sideOffset={8}>
              <DropdownMenu.Item className="export-item" onSelect={() => exportFile('docx')}><FileText /><span><strong>Word (.docx)</strong><small>Editable Word document</small></span></DropdownMenu.Item>
              <DropdownMenu.Item className="export-item" onSelect={() => exportFile('pdf')}><FileText /><span><strong>PDF (.pdf)</strong><small>Formatted and ready to share</small></span></DropdownMenu.Item>
              <DropdownMenu.Item className="export-item" onSelect={() => exportFile('markdown')}><FileText /><span><strong>Markdown</strong><small>Easy to share and review</small></span></DropdownMenu.Item>
              <DropdownMenu.Item className="export-item" onSelect={() => exportFile('json')}><FileJson /><span><strong>JSON</strong><small>For APIs and automation</small></span></DropdownMenu.Item>
            </DropdownMenu.Content></DropdownMenu.Portal>
          </DropdownMenu.Root> </div>
      </header>

      <aside className="sidebar">
        <Link to="/" className="new-import">+ New import</Link>
        <p className="sidebar-label">Document</p>
        {tabs.map(([value, label, Icon]) => <button key={value} aria-pressed={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}><Icon size={17} /> {label}<span>{value === 'content' ? document.summary.textItems : value === 'tokens' ? document.summary.colors + document.tokens.typography.length : document.summary.components}</span></button>)}
        <div className="sidebar-bottom"><small>Generated from Figma</small><span>{document.source.lastModified ? `Updated ${new Date(document.source.lastModified).toLocaleDateString()}` : 'Imported content'}</span></div>
      </aside>

      <main className="document-main" id="workspace-content" tabIndex={-1}>
        <div className="save-status" role="status">{saveStatus} · <Link to="/">Saved documents</Link></div>
        <details className="export-options"><summary>Export settings <span>{scope === 'all' ? 'Whole document' : scope === 'filtered' ? `${filtered.length} matching items` : 'Custom selection'}</span></summary>
          <label>Export scope<select aria-label="Export scope" value={scope} onChange={event => setScope(event.target.value)}><option value="all">Whole document</option><option value="filtered">Current search and page filter ({filtered.length} items)</option>{document.pages.map(item => <option key={item.id} value={`page:${item.name}`}>Page: {item.name}</option>)}{sections.map(item => <option key={`${item.page}::${item.section}`} value={`section:${item.page}::${item.section}`}>Section: {item.page} / {item.section}</option>)}</select></label>
          {scope !== 'all' && <label className="inventory-toggle"><input type="checkbox" checked={includeInventories} onChange={event => setIncludeInventories(event.target.checked)} /> Include styles and components from the whole file</label>}
        </details>
        {tab === 'content' && <ContentView document={document} page={page} setPage={setPage} query={query} setQuery={setQuery} filtered={filtered} editContent={editContent} />}
        {tab === 'tokens' && <TokensView document={document} />}
        {tab === 'components' && <ComponentsView document={document} />}
      </main>
      {toast && <div className="toast" role={exportError ? 'alert' : 'status'}>{exportError ? <AlertTriangle size={16} /> : <Check size={16} />} {toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}

function PageTitle({ eyebrow, title, copy }) {
  return <div className="page-title"><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>
}

function ContentView({ document, page, setPage, query, setQuery, filtered, editContent }) {
  const [groupBy, setGroupBy] = useState('section')
  const [pageState, setPageState] = useState({ key: '', index: 0 })
  const searchRef = useRef(null)
  const filterKey = JSON.stringify([query, page, groupBy])
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50))
  const pageIndex = pageState.key === filterKey ? Math.min(pageState.index, pageCount - 1) : 0
  const visible = useMemo(() => filtered.slice(pageIndex * 50, (pageIndex + 1) * 50), [filtered, pageIndex])
  useEffect(() => {
    function shortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  function changePage(index) {
    setPageState({ key: filterKey, index })
    searchRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  const groups = useMemo(() => visible.reduce((result, item) => {
    const key = groupBy === 'section' ? `${item.page} · ${item.section}` : item.role
    if (!result[key]) result[key] = []
    result[key].push(item)
    return result
  }, {}), [visible, groupBy])

  return <>
    <PageTitle eyebrow="COPY INVENTORY" title="Content" copy="Review and refine every piece of text extracted from your design." />
    <div className="summary-grid">
      <div><FileText /><span><strong>{document.summary.textItems}</strong><small>Text items</small></span></div>
      <div><Layers3 /><span><strong>{document.summary.pages}</strong><small>Figma pages</small></span></div>
      <div><Type /><span><strong>{new Set(document.content.map((item) => item.role)).size}</strong><small>Content types</small></span></div>
    </div>
    {document.insights.warnings.length > 0 && <div className="warning"><AlertTriangle size={18} /><div><strong>Review recommended</strong><span>{document.insights.warnings[0]}</span></div></div>}
    <div className="toolbar">
      <div className="search"><Search size={17} /><input ref={searchRef} aria-label="Search content" aria-keyshortcuts="Control+k Meta+k" placeholder="Search content…" onKeyDown={event => { if (event.key === 'Escape') setQuery('') }} value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>⌘ / Ctrl K</kbd>{query && <button className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}</div>
      <select aria-label="Filter by page" value={page} onChange={(e) => setPage(e.target.value)}><option>All pages</option>{document.pages.map((item) => <option key={item.id}>{item.name}</option>)}</select>
      <select aria-label="Group content" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="section">Group by section</option><option value="type">Group by type</option></select>
      {(query || page !== 'All pages') && <button className="filter-clear" type="button" onClick={() => { setQuery(''); setPage('All pages') }}>Clear filters</button>}
    </div>
    <p className="results-count" role="status">{filtered.length} of {document.content.length} text items · Click text to edit · Collapse a section to focus</p><div className="content-list">
      {Object.entries(groups).map(([group, items]) => <details key={`${filterKey}-${pageIndex}-${group}`} className="content-group" open><summary className="group-heading"><h2>{group}</h2><span>{items.length} item{items.length === 1 ? '' : 's'}</span></summary>{items.map((item) => <div className="content-row" key={item.id}><div className={`role-badge role-${item.role.toLowerCase()}`}>{item.role}</div><div className="editable-copy"><textarea aria-label={`Edit ${item.name}`} value={item.content} onChange={(e) => editContent(item.id, e.target.value)} rows={Math.min(4, Math.max(1, Math.ceil(item.content.length / 75)))} /><small>{item.name} · {item.path}</small></div><div className="text-style"><strong>{item.style.size ? `${item.style.size}px` : '—'}</strong><span>{item.style.family}</span></div></div>)}</details>)}
      {pageCount > 1 && <nav className="pagination" aria-label="Content pagination"><button className="secondary-button" disabled={pageIndex === 0} onClick={() => changePage(pageIndex - 1)}>Previous</button><span>Items {pageIndex * 50 + 1}–{Math.min((pageIndex + 1) * 50, filtered.length)} of {filtered.length}</span><button className="secondary-button" disabled={pageIndex + 1 === pageCount} onClick={() => changePage(pageIndex + 1)}>Next</button></nav>}
      {!filtered.length && <div className="empty-state"><Search /><h3>No matching content</h3><p>Try a different search or page filter.</p></div>}
    </div>
  </>
}

function TokensView({ document }) {
  return <>
    <PageTitle eyebrow="DESIGN SYSTEM" title="Design tokens" copy="A practical inventory of the visual styles found in this file." />
    <section className="token-section"><div className="section-title"><div><h2>Colors</h2><p>Solid fills, strokes, and text colors</p></div><span>{document.tokens.colors.length} tokens</span></div><div className="color-grid">{document.tokens.colors.map((color) => <div className="color-card" key={`${color.value}-${color.opacity}`}><div className="swatch" style={{ background: color.value, opacity: color.opacity }} /><div><strong>{color.name}</strong><code>{color.value}</code><small>{color.usages.join(' · ')}</small></div></div>)}</div></section>
    <section className="token-section"><div className="section-title"><div><h2>Typography</h2><p>Font styles used across text layers</p></div><span>{document.tokens.typography.length} styles</span></div><div className="type-table"><div className="type-table-head"><span>Preview</span><span>Font</span><span>Size / line</span><span>Usage</span></div>{document.tokens.typography.map((type, index) => <div className="type-row" key={`${type.family}-${type.weight}-${type.size}-${index}`}><span style={{ fontFamily: type.family, fontWeight: type.weight, fontSize: Math.min(type.size || 16, 28) }}>Ag</span><span><strong>{type.family}</strong><small>Weight {type.weight}</small></span><span>{type.size ?? '—'} / {type.lineHeight ?? '—'} px</span><span>{type.usageCount} layer{type.usageCount === 1 ? '' : 's'}</span></div>)}</div></section>
  </>
}

function ComponentsView({ document }) {
  return <>
    <PageTitle eyebrow="COMPONENT INVENTORY" title="Components" copy="Reusable components and instances found in the imported scope." />
    {document.components.length ? <div className="component-grid">{document.components.map((component) => <div className="component-card" key={component.name}><span className="component-icon"><Layers3 /></span><div><strong>{component.name}</strong><small>{component.type.replace('_', ' ').toLowerCase()}</small></div><span className="count">{component.instances}×</span></div>)}</div> : <div className="empty-state large"><Layers3 /><h3>No components found</h3><p>The imported scope does not include components or instances.</p></div>}
  </>
}






