import { layerInventory } from './layer-inventory.js'
const TEXT_ROLES = [
  [/^(h1|hero|display|title)/i, 'Heading'],
  [/^(h2|h3|heading|subtitle)/i, 'Subheading'],
  [/(button|btn|cta)/i, 'Button'],
  [/(label|caption|eyebrow|tag)/i, 'Label'],
  [/(error|warning|success|helper|hint)/i, 'Message'],
  [/(body|paragraph|description|copy)/i, 'Body'],
]

function round(value) {
  return Math.round(value * 100) / 100
}

function rgbaToHex(color = {}) {
  const channel = (value = 0) => Math.round(value * 255).toString(16).padStart(2, '0')
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`.toUpperCase()
}

function classifyText(node, trail = []) {
  if (trail.some(name => /(?:^|[\s/_-])(button|btn|cta)(?:$|[\s/_-])/i.test(name))) return 'Button'
  const candidate = `${node.name || ''} ${node.style?.fontSize || ''}`
  const namedRole = TEXT_ROLES.find(([pattern]) => pattern.test(candidate))?.[1]
  if (namedRole) return namedRole
  const size = node.style?.fontSize || 16
  if (size >= 32) return 'Heading'
  if (size >= 22) return 'Subheading'
  if (size <= 13) return 'Label'
  return 'Body'
}

function visiblePaint(paints) {
  return paints?.find((paint) => paint.visible !== false && paint.type === 'SOLID')
}

export function parseFigmaDocument(file, sourceUrl = '') {
  const textItems = []
  const colorMap = new Map()
  const typeMap = new Map()
  const componentSet = new Map()
  const pages = []
  let nodeCount = 0
  let hiddenCount = 0

  function addColor(paint, usage) {
    if (!paint?.color) return
    const hex = rgbaToHex(paint.color)
    const key = `${hex}-${paint.opacity ?? paint.color.a ?? 1}`
    if (!colorMap.has(key)) {
      colorMap.set(key, {
        value: hex,
        opacity: round(paint.opacity ?? paint.color.a ?? 1),
        usages: new Set(),
      })
    }
    colorMap.get(key).usages.add(usage)
  }

  function visit(node, trail, pageName, sectionName, sectionId = null) {
    nodeCount += 1
    if (node.visible === false) hiddenCount += 1
    const path = [...trail, node.name || node.type].join(' / ')

    addColor(visiblePaint(node.fills), node.type === 'TEXT' ? 'Text' : 'Fill')
    addColor(visiblePaint(node.strokes), 'Stroke')

    if (node.type === 'TEXT' && typeof node.characters === 'string' && node.characters.trim()) {
      const style = node.style || {}
      const typographyKey = [style.fontFamily, style.fontWeight, style.fontSize, style.lineHeightPx].join('|')
      if (!typeMap.has(typographyKey)) {
        typeMap.set(typographyKey, {
          family: style.fontFamily || 'Unknown',
          weight: style.fontWeight || 400,
          size: style.fontSize || null,
          lineHeight: style.lineHeightPx ? round(style.lineHeightPx) : null,
          usageCount: 0,
        })
      }
      typeMap.get(typographyKey).usageCount += 1
      textItems.push({
        id: node.id,
        name: node.name || 'Text',
        content: node.characters.trim(),
        role: classifyText(node, trail),
        page: pageName,
        section: sectionName || 'Ungrouped',
        path,
        sectionId,
        headingLevel: /^h[1-6](?:\b|[_-])/i.test(node.name || '') ? node.name.slice(0, 2).toUpperCase() : null,
        linkUrl: style.hyperlink?.type === 'URL' ? style.hyperlink.url : null,
        style: {
          family: style.fontFamily || 'Unknown',
          weight: style.fontWeight || 400,
          size: style.fontSize || null,
          color: visiblePaint(node.fills)?.color ? rgbaToHex(visiblePaint(node.fills).color) : null,
        },
      })
    }

    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE') {
      const componentName = node.name || 'Unnamed component'
      const entry = componentSet.get(componentName) || { name: componentName, type: node.type, instances: 0 }
      entry.instances += 1
      componentSet.set(componentName, entry)
    }

    const nextSection = ['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP'].includes(node.type)
      ? node.name || sectionName
      : sectionName
    for (const child of node.children || []) visit(child, [...trail, node.name || node.type], pageName, nextSection, ['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP'].includes(node.type) ? node.id : sectionId)
  }

  for (const page of file.document?.children || []) {
    const before = textItems.length
    visit(page, [], page.name || 'Untitled page', null)
    pages.push({
      id: page.id,
      name: page.name || 'Untitled page',
      textCount: textItems.length - before,
      topLevelSections: (page.children || []).map((child) => child.name || child.type).slice(0, 50),
    })
  }

  const duplicateCopy = [...textItems.reduce((map, item) => {
    const normalized = item.content.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!map.has(normalized)) map.set(normalized, [])
    map.get(normalized).push(item)
    return map
  }, new Map()).values()]
    .filter((items) => items.length > 1)
    .map((items) => ({ content: items[0].content, count: items.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const warnings = []
  if (!textItems.length) warnings.push('No visible text content was found in the imported scope.')
  const genericNames = textItems.filter((item) => /^(text|label|rectangle|frame)\s*\d*$/i.test(item.name)).length
  if (genericNames) warnings.push(`${genericNames} text layer${genericNames === 1 ? ' uses' : 's use'} generic names, which can make content handoff harder.`)
  if (hiddenCount) warnings.push(`${hiddenCount} hidden layer${hiddenCount === 1 ? ' was' : 's were'} included in the analysis.`)

  return {
    schemaVersion: '1.0',
    layers: layerInventory(file.document),
    generatedAt: new Date().toISOString(),
    source: { url: sourceUrl, name: file.name || 'Untitled Figma file', lastModified: file.lastModified || null, version: file.version || null },
    summary: { pages: pages.length, nodes: nodeCount, textItems: textItems.length, components: componentSet.size, colors: colorMap.size },
    pages,
    content: textItems,
    tokens: {
      colors: [...colorMap.values()].map((color, index) => ({ name: `color-${index + 1}`, ...color, usages: [...color.usages] })),
      typography: [...typeMap.values()].sort((a, b) => (b.size || 0) - (a.size || 0)),
    },
    components: [...componentSet.values()].sort((a, b) => b.instances - a.instances),
    insights: { duplicateCopy, warnings },
  }
}

function escapeTable(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

export function toMarkdown(doc) {
  const lines = [
    `# ${doc.source.name} — Content document`,
    '',
    `> Generated ${new Date(doc.generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`,
    '',
    '## Overview',
    '',
    `- **Pages:** ${doc.summary.pages}`,
    `- **Text items:** ${doc.summary.textItems}`,
    `- **Components:** ${doc.summary.components}`,
    `- **Color tokens:** ${doc.summary.colors}`,
    '',
  ]

  for (const page of doc.pages) {
    lines.push(`## ${page.name}`, '', '| Type | Layer | Content | Section |', '| --- | --- | --- | --- |')
    for (const item of doc.content.filter((entry) => entry.page === page.name)) {
      lines.push(`| ${escapeTable(item.role)} | ${escapeTable(item.name)} | ${escapeTable(item.content)} | ${escapeTable(item.section)} |`)
    }
    lines.push('')
  }

  lines.push('## Design tokens', '', '### Colors', '', '| Token | Value | Usage |', '| --- | --- | --- |')
  for (const color of doc.tokens.colors) lines.push(`| ${color.name} | ${color.value} | ${color.usages.join(', ')} |`)
  lines.push('', '### Typography', '', '| Font | Weight | Size | Line height | Uses |', '| --- | ---: | ---: | ---: | ---: |')
  for (const type of doc.tokens.typography) lines.push(`| ${escapeTable(type.family)} | ${type.weight} | ${type.size ?? '—'} | ${type.lineHeight ?? '—'} | ${type.usageCount} |`)

  if (doc.insights.warnings.length) {
    lines.push('', '## Review notes', '')
    for (const warning of doc.insights.warnings) lines.push(`- ${warning}`)
  }
  lines.push('', '---', '', `Source: ${doc.source.url || 'Imported Figma data'}`)
  return lines.join('\n')
}

