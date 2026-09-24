import { Document, HeadingLevel, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from 'docx'


function invalid() {
  return Object.assign(new Error('A valid content document is required.'), { status: 400 })
}
function text(value, fallback = '') {
  if (value == null) return fallback
  if (typeof value !== 'string' && typeof value !== 'number') throw invalid()
  // XML 1.0 cannot represent these control characters.
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}
function list(value) {
  if (value == null) return []
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== 'object')) throw invalid()
  return value
}

// Both formats use the same ordered content so edited copy cannot diverge.
export function exportBlocks(doc) {
  if (!doc?.source || typeof doc.source.name !== 'string' || !Array.isArray(doc.content)) throw invalid()
  // Upgrade older saved classifications without changing the saved document.
  doc = { ...doc, content: doc.content.map(item => item && item.role === 'Body' && /(?:^|[\s/_-])(button|btn|cta)(?:$|[\s/_-])/i.test(item.path || '') ? { ...item, role: 'Button' } : item) }
  const blocks = []
  const add = (kind, value) => blocks.push({ kind, text: text(value) })
  add('title', doc.source.name || 'Figma content document')
  add('subtitle', 'Content document')
  add('body', 'Copy, design styles, and components from the imported Figma file. This export includes the current edited text for review and handoff.')
  add('meta', `${doc.content.length} text item${doc.content.length === 1 ? '' : 's'} | ${list(doc.pages).length} page${list(doc.pages).length === 1 ? '' : 's'} | ${list(doc.components).length} component${list(doc.components).length === 1 ? '' : 's'}`)
  add('meta', `Source: ${text(doc.source.url, 'Not provided') || 'Not provided'}`)
  add('body', /[?&]node-id=/.test(doc.source.url || '') ? 'Scope: selected Figma frame or node only. Other screens and pages are not included.' : 'Scope: the imported Figma content. Any export selection is described in Review notes.')
  add('h1', 'Content inventory')
  const groups = new Map()
  for (const item of list(doc.content)) {
    if (typeof item.content !== 'string') throw invalid()
    const page = text(item.page, 'Untitled page')
    if (!groups.has(page)) groups.set(page, new Map())
    const sections = groups.get(page)
    const section = text(item.section, 'Ungrouped')
    if (!sections.has(section)) sections.set(section, [])
    sections.get(section).push(item)
  }
  if (!groups.size) add('body', 'No text content in this document.')
  for (const [page, sections] of groups) {
    add('h2', page)
    for (const [section, items] of sections) {
      add('h3', section)
      for (const item of items) {
        add('label', `${text(item.role, 'Text')} | ${text(item.name, 'Unnamed layer')}`)
        add('body', item.content)
        blocks[blocks.length - 1].keepWithMeta = true
        add('meta', `${text(item.style?.family, 'Unknown font')} | ${text(item.style?.size, 'Not specified')} px | ${text(item.path)}`)
      }
    }
  }
  add('h1', 'Design tokens')
  add('h2', 'Colors')
  const colors = list(doc.tokens?.colors)
  if (!colors.length) add('body', 'No color tokens found.')
  for (const color of colors) {
    if (color.usages != null && !Array.isArray(color.usages)) throw invalid()
    add('label', `${text(color.name)} | ${text(color.value)}`)
    add('body', `Opacity: ${text(color.opacity, '1')} | Usage: ${(color.usages || []).map((usage) => text(usage)).join(', ') || 'Not specified'}`)
  }
  add('h2', 'Typography')
  const typography = list(doc.tokens?.typography)
  if (!typography.length) add('body', 'No typography styles found.')
  for (const type of typography) {
    add('label', `${text(type.family)} | Weight ${text(type.weight)}`)
    add('body', `Size: ${text(type.size, 'Not specified')} px | Line height: ${text(type.lineHeight, 'Not specified')} px | Uses: ${text(type.usageCount, '0')}`)
  }
  add('h1', 'Components')
  const components = list(doc.components)
  if (!components.length) add('body', 'No components found.')
  const warnings = doc.insights?.warnings ?? []
  if (!Array.isArray(warnings)) throw invalid()
  if (warnings.length) {
    add('h1', 'Review notes')
    warnings.forEach((warning) => add('body', text(warning).replace('1 hidden layer were', '1 hidden layer was').replace('1 text layer use ', '1 text layer uses ')))
  }
  const table = (headers, rows, widths) => ({ kind: 'table', headers, rows: rows.map(row => row.map(value => text(value, 'Not specified'))), widths })
  const words = value => String(value || '').trim().split(/\s+/u).filter(Boolean).length
  const copy = doc.content
  const totalWords = copy.reduce((sum, item) => sum + words(item.content), 0)
  const roles = new Map()
  const duplicates = new Map()
  for (const item of copy) {
    const role = text(item.role, 'Text')
    roles.set(role, (roles.get(role) || 0) + 1)
    const normalized = item.content.trim().toLowerCase().replace(/\s+/g, ' ')
    if (normalized) {
      const existing = duplicates.get(normalized) || { copy: item.content, count: 0 }
      existing.count++
      duplicates.set(normalized, existing)
    }
  }
  const overview = [
    { kind: 'h1', text: 'Overview' },
    table(['Measure', 'Value'], [
      ['Text items', copy.length], ['Words in current copy', totalWords],
      ['Characters including spaces', copy.reduce((sum, item) => sum + Array.from(item.content).length, 0)],
      ['Pages in export', list(doc.pages).length], ['Color tokens', colors.length],
      ['Typography styles', typography.length], ['Component entries', components.length],
      ['Figma last modified', text(doc.source.lastModified, 'Not provided')],
      ['Figma version', text(doc.source.version, 'Not provided')],
    ], [65, 35]),
    { kind: 'meta', text: 'Word counts use whitespace separation. Copy counts reflect the current export scope; design inventories retain the scope noted in Review notes.' },
    { kind: 'h2', text: 'Page summary' },
    table(['Page', 'Text items', 'Words', 'Sections'], list(doc.pages).map(page => {
      const items = copy.filter(item => item.page === page.name)
      return [page.name, items.length, items.reduce((sum, item) => sum + words(item.content), 0), new Set(items.map(item => item.section)).size]
    }), [49, 17, 17, 17]),
    { kind: 'h2', text: 'Content types' },
    table(['Type', 'Text items'], [...roles], [70, 30]),
  ]
  blocks.splice(blocks.findIndex(block => block.text === 'Content inventory'), 0, ...overview)
  const tokenStart = blocks.findIndex(block => block.kind === 'h1' && block.text === 'Design tokens')
  const componentStart = blocks.findIndex(block => block.kind === 'h1' && block.text === 'Components')
  blocks.splice(tokenStart, componentStart - tokenStart,
    { kind: 'h1', text: 'Design tokens' },
    { kind: 'h2', text: 'Colors' },
    table(['Token', 'Value', 'Opacity', 'Usage'], colors.map(color => [color.name, color.value, color.opacity ?? 1, (color.usages || []).join(', ')]), [25, 22, 15, 38]),
    { kind: 'h2', text: 'Typography' },
    table(['Font', 'Weight', 'Size px', 'Line px', 'Uses'], typography.map(type => [type.family, type.weight, type.size, type.lineHeight, type.usageCount]), [36, 16, 16, 16, 16]),
    { kind: 'meta', text: 'These are extracted design values. The export uses a readable document font rather than reproducing each Figma text style.' },
  )
  const componentHeading = blocks.findIndex(block => block.kind === 'h1' && block.text === 'Components')
  blocks.splice(componentHeading + 1, 0, table(['Component', 'Node type', 'Occurrences'], components.map(component => [component.name, component.type.replaceAll('_', ' '), component.instances]), [48, 32, 20]))
  blocks.push({ kind: 'h1', text: 'Copy reference' },
    { kind: 'body', text: 'Use this index to locate text in the original design. Full edited text is preserved in Content inventory.' },
    table(['Layer', 'Page and section', 'Type', 'Characters'], copy.map(item => [item.name, `${item.page} / ${item.section}`, item.role, Array.from(item.content).length]), [29, 39, 17, 15]),
    { kind: 'h1', text: 'Repeated copy' })
  const repeated = [...duplicates.values()].filter(item => item.count > 1)
  if (!repeated.length) blocks.push({ kind: 'body', text: 'No repeated copy found in the current export scope.' })
  else {
    blocks.push({ kind: 'meta', keepWithMeta: true, text: 'Matches ignore letter case and repeated whitespace. Repetition may be intentional and is not necessarily an error.' })
    for (const item of repeated) blocks.push({ kind: 'label', text: `${item.count} occurrences` }, { kind: 'body', text: item.copy })
  }
  blocks.push({ kind: 'h1', text: 'Handoff checklist' },
    table(['Review task', 'Status'], [
      ['Check headings and calls to action for consistency', 'To review'],
      ['Review repeated copy and generic layer names', 'To review'],
      ['Verify design styles with the design owner', 'To review'],
      ['Check long copy in the original design', 'To review'],
    ], [78, 22]))
  return blocks
}

export async function toDocx(doc, asBlob = false, blocks = exportBlocks(doc)) {
  const headings = { title: HeadingLevel.TITLE, h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 }
  const sizes = { title: 44, subtitle: 28, h1: 32, h2: 26, h3: 23, label: 21, body: 21, meta: 17 }
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' }
  const children = blocks.map((block) => {
    if (block.kind === 'image') return new Paragraph({ spacing: { after: 140 }, children: [new ImageRun({ type: 'png', data: Uint8Array.from(atob(block.data.split(',')[1]), c => c.charCodeAt(0)), transformation: { width: block.width, height: block.height } })] })
    if (block.kind === 'table') return new Table({
      width: { size: 9706, type: WidthType.DXA },
      columnWidths: block.widths.map(width => Math.round(9706 * width / 100)),
      borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
      rows: [block.headers, ...(block.rows.length ? block.rows : [block.headers.map((_, i) => i === 0 ? 'No entries' : '')])].map((row, index) => new TableRow({
        tableHeader: index === 0,
        children: row.map((value, column) => new TableCell({
          width: { size: Math.round(9706 * block.widths[column] / 100), type: WidthType.DXA },
          margins: { top: 75, bottom: 75, left: 110, right: 110 },
          shading: { fill: index === 0 ? (block.reference ? 'F0F3F6' : '303844') : index % 2 ? 'FFFFFF' : 'F4F5F7' },
          children: [new Paragraph({ spacing: { after: 0, line: 250 }, children: String(value).split('\n').map((line, i) => new TextRun({ text: line, break: i ? 1 : undefined, size: 19, bold: index === 0, color: index === 0 ? (block.reference ? '2C3E50' : 'FFFFFF') : '202020' })) })],
        })),
      })),
    })
    return new Paragraph({
    heading: headings[block.kind],
    keepNext: ['h1', 'h2', 'h3', 'label', 'title', 'subtitle'].includes(block.kind) || block.keepWithMeta,
    spacing: { before: block.kind === 'h1' ? 220 : block.kind === 'h2' ? 140 : 30, after: 80, line: 250 },
    children: block.text.split('\n').map((line, index) => new TextRun({
      text: line, break: index ? 1 : undefined, font: 'Calibri', size: sizes[block.kind],
      bold: ['h1', 'h2', 'h3', 'label'].includes(block.kind),
      color: block.kind === 'meta' ? '666666' : '000000',
    })),
  })
  })
  return Packer[asBlob ? 'toBlob' : 'toBuffer'](new Document({
    creator: 'Figdoc', title: doc.source.name,
    styles: { default: { document: { run: { font: 'Calibri', size: 21, color: '000000' } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
  }))
}

export function pdfDefinition(doc, blocks = exportBlocks(doc)) {
  return {
    info: { title: doc.source.name, author: 'Figdoc' },
    pageSize: 'A4', pageMargins: [55, 48, 55, 48],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.1, color: '#202020' },
    content: blocks.map((block) => block.kind === 'image' ? { image: block.data, fit: [485, 290], margin: [0, 5, 0, 12] } : block.kind === 'table' ? { unbreakable: block.rows.length <= 6 && block.rows.every(row => row.every(cell => cell.length < 100)), margin: [0, 2, 0, 8], fontSize: 9, table: { headerRows: 1, widths: block.widths.map(width => (485 - block.widths.length * 14.5 - .5) * width / 100), body: [block.headers.map(value => ({ text: value, bold: true, color: block.reference ? '#2c3e50' : '#ffffff', fillColor: block.reference ? '#f0f3f6' : '#303844' })), ...(block.rows.length ? block.rows : [block.headers.map((_, i) => i === 0 ? 'No entries' : '')])] }, layout: { hLineColor: () => '#D9D9D9', vLineColor: () => '#D9D9D9', hLineWidth: () => .5, vLineWidth: () => .5, paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 4, paddingBottom: () => 4, fillColor: row => row > 0 && row % 2 === 0 ? '#F4F5F7' : null } } : ({ text: block.text || ' ', style: block.kind, headlineLevel: ['h1', 'h2', 'h3', 'label'].includes(block.kind) ? 1 : undefined })).reduce((result, node) => {
      const previous = result[result.length - 1]
      if (node.style === 'meta' && previous?.stack && previous.stack.some(item => item.style === 'label')) { previous.stack.push(node); return result }
      const heading = previous && ['h1', 'h2', 'h3', 'label'].includes(previous.style)
      if (heading && (node.unbreakable || (node.text && !node.headlineLevel && node.text.length < 400))) {
        const chain = []
        while (result.length && ['h1', 'h2', 'h3', 'label'].includes(result[result.length - 1].style)) chain.unshift(result.pop())
        result.push({ stack: [...chain, node], unbreakable: true })
      } else result.push(node)
      return result
    }, []),
    pageBreakBefore(currentNode, container) {
      return currentNode.headlineLevel === 1 && container.getFollowingNodesOnPage().every(node => node.headlineLevel === 1)
    },
    styles: {
      title: { fontSize: 24, margin: [0, 0, 0, 8], color: '#000000' },
      subtitle: { fontSize: 14, margin: [0, 0, 0, 16], color: '#000000' },
      h1: { fontSize: 17, bold: true, margin: [0, 14, 0, 7], color: '#000000' },
      h2: { fontSize: 13, bold: true, margin: [0, 9, 0, 5], color: '#000000' },
      h3: { fontSize: 11, bold: true, margin: [0, 6, 0, 4], color: '#000000' },
      label: { fontSize: 10, bold: true, margin: [0, 5, 0, 3] },
      body: { margin: [0, 0, 0, 4] },
      meta: { fontSize: 8, color: '#666666', margin: [0, 0, 0, 4] },
    },
    footer: (page, count) => ({ text: `${page} / ${count}`, alignment: 'right', margin: [55, 15, 55, 0], fontSize: 8, color: '#777777' }),
  }
}





