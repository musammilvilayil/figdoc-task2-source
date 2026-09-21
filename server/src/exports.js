import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import pdfmake from 'pdfmake'
import roboto from 'pdfmake/fonts/Roboto.js'

pdfmake.addFonts(roboto)

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
  const blocks = []
  const add = (kind, value) => blocks.push({ kind, text: text(value) })
  add('title', doc.source.name || 'Figma content document')
  add('subtitle', 'Content document')
  add('body', 'Copy, design styles, and components from the imported Figma file. This export includes the current edited text for review and handoff.')
  add('meta', `${doc.content.length} text items | ${list(doc.pages).length} pages | ${list(doc.components).length} components`)
  add('meta', `Source: ${text(doc.source.url, 'Not provided') || 'Not provided'}`)
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
  for (const component of components) {
    add('label', text(component.name))
    add('body', `${text(component.type).replaceAll('_', ' ')} | Instances: ${text(component.instances, '0')}`)
  }
  const warnings = doc.insights?.warnings ?? []
  if (!Array.isArray(warnings)) throw invalid()
  if (warnings.length) {
    add('h1', 'Review notes')
    warnings.forEach((warning) => add('body', warning))
  }
  return blocks
}

export async function toDocx(doc) {
  const headings = { title: HeadingLevel.TITLE, h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 }
  const sizes = { title: 44, subtitle: 28, h1: 32, h2: 26, h3: 23, label: 21, body: 21, meta: 17 }
  const children = exportBlocks(doc).map((block) => new Paragraph({
    heading: headings[block.kind],
    keepNext: ['h1', 'h2', 'h3', 'label', 'title', 'subtitle'].includes(block.kind),
    spacing: { before: block.kind === 'h1' ? 320 : block.kind === 'h2' ? 200 : 60, after: 120, line: 280 },
    children: block.text.split('\n').map((line, index) => new TextRun({
      text: line, break: index ? 1 : undefined, font: 'Calibri', size: sizes[block.kind],
      bold: ['h1', 'h2', 'h3', 'label'].includes(block.kind),
      color: block.kind === 'meta' ? '666666' : '000000',
    })),
  }))
  return Packer.toBuffer(new Document({
    creator: 'Figdoc', title: doc.source.name,
    styles: { default: { document: { run: { font: 'Calibri', size: 21, color: '000000' } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
  }))
}

export async function toPdf(doc) {
  const blocks = exportBlocks(doc)
  return pdfmake.createPdf({
    info: { title: doc.source.name, author: 'Figdoc' },
    pageSize: 'A4', pageMargins: [55, 48, 55, 48],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.2, color: '#202020' },
    content: blocks.map((block) => ({ text: block.text || ' ', style: block.kind, headlineLevel: ['h1', 'h2', 'h3', 'label'].includes(block.kind) ? 1 : undefined })),
    pageBreakBefore(currentNode, container) {
      return currentNode.headlineLevel === 1 && container.getFollowingNodesOnPage().length === 0
    },
    styles: {
      title: { fontSize: 24, margin: [0, 0, 0, 8], color: '#000000' },
      subtitle: { fontSize: 14, margin: [0, 0, 0, 16], color: '#000000' },
      h1: { fontSize: 17, bold: true, margin: [0, 20, 0, 10], color: '#000000' },
      h2: { fontSize: 13, bold: true, margin: [0, 12, 0, 8], color: '#000000' },
      h3: { fontSize: 11, bold: true, margin: [0, 9, 0, 6], color: '#000000' },
      label: { fontSize: 10, bold: true, margin: [0, 8, 0, 4] },
      body: { margin: [0, 0, 0, 7] },
      meta: { fontSize: 8, color: '#666666', margin: [0, 0, 0, 7] },
    },
    footer: (page, count) => ({ text: `${page} / ${count}`, alignment: 'right', margin: [55, 15, 55, 0], fontSize: 8, color: '#777777' }),
  }).getBuffer()
}
