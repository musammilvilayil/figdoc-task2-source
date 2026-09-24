import { layerBlocks } from './layer-inventory.js'
// Component content template based on the user's supplied reference.

const value = text => typeof text === 'string' && text.trim() ? text : 'Not provided'

const fields = rows => ({ kind: 'table', reference: true, headers: ['Field', 'Value'], widths: [30, 70], rows: rows.map(([key, val]) => [key, value(val)]) })

export function componentBlocks(doc) {
  if (!doc.content?.length && !doc.previews?.length && !doc.layers?.length) throw new Error('No text or previews were captured. Select the app screen frame in Figma, then prepare again.')

  const blocks = [

    { kind: 'title', text: doc.source.name },

    { kind: 'body', text: 'URL: ' + value(doc.source.url) },

    { kind: 'h1', text: 'Please read' },

    { kind: 'body', text: 'Review the component copy and previews below against the selected design. Check text wrapping and responsive layouts before publishing. Heading roles are inferred from Figma layer names and typography; HTML heading levels are included only when named H1 to H6. Missing website metadata is marked Not provided.' },

    { kind: 'h1', text: 'SEO Metadata' },

    { kind: 'table', reference: true, headers: ['SEO Property', 'Value'], widths: [40, 60], rows: ['Social Share URL (Twitter)', 'Social Share Title (Twitter)', 'Social Share Description (Twitter)', 'Open Graph URL', 'Open Graph Title', 'Open Graph Description', 'Canonical URL', 'Meta Description'].map(key => [key, 'Not provided']) },

  ]

  const groups = new Map()

  for (const item of doc.content) {

    const key = item.sectionId || item.page + '/' + item.section

    if (!groups.has(key)) groups.set(key, { name: item.section, page: item.page, items: [] })

    groups.get(key).items.push(item)

  }

  for (const preview of doc.previews || []) if (!groups.has(preview.id)) groups.set(preview.id, { name: preview.name, page: preview.page, items: [] })

  for (const [id, group] of groups) {

    blocks.push({ kind: 'h1', text: group.name || 'Component' }, { kind: 'meta', text: 'Page: ' + value(group.page) })

    const preview = doc.previews?.find(item => item.id === id)

    if (preview?.data) {

      const scale = Math.min(600 / preview.width, 350 / preview.height, 1)

      blocks.push({ kind: 'image', data: preview.data, width: Math.round(preview.width * scale), height: Math.round(preview.height * scale) })

      blocks.push({ kind: 'meta', text: 'Component preview from Figma' })

    }

    for (const item of group.items) {

      if (['Heading', 'Subheading'].includes(item.role)) blocks.push(fields([['Heading Text', item.content], ['Heading Level', item.headingLevel]]))

      else if (item.role === 'Button' || item.linkUrl) blocks.push(fields([[item.linkUrl ? 'Link Text' : 'Button Text', item.content], ['Link URL', item.linkUrl], ['Aria Label', null], ['Target', null]]))

      else blocks.push(fields([['Description', item.content]]))

    }

    if (!group.items.length) blocks.push({ kind: 'body', text: 'No editable text layers in this component. The preview preserves its appearance.' })

    for (const asset of doc.imageAssets?.filter(item => item.sectionId === id) || []) {

      blocks.push(fields([['Image layer', asset.name], ['Image Alt Text', null], ['Image link', null]]))

    }

  }

  if (!groups.size) blocks.push({ kind: 'body', text: 'No components in the selected scope.' })

  if (doc.previewWarnings?.length) blocks.push({ kind: 'h1', text: 'Export notes' }, ...doc.previewWarnings.map(text => ({ kind: 'body', text })))

  blocks.push(...layerBlocks(doc.layers))
  return blocks

}

