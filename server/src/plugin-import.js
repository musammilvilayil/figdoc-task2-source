import { parseFigmaDocument } from './parser.js'

export function importPlugin(payload) {
  function invalid(message = 'Choose a valid .figdoc.json file exported by the Figdoc plugin.') {
    throw Object.assign(new Error(message), { status: 400 })
  }
  if (payload?.format !== 'figdoc-plugin' || payload.version !== 1 || typeof payload.file?.name !== 'string' || payload.file.document?.type !== 'DOCUMENT') invalid()
  const stack = [{ node: payload.file.document, depth: 0 }]
  let count = 0
  while (stack.length) {
    const { node, depth } = stack.pop()
    if (++count > 50000 || depth > 100) invalid('Selection is too complex. Export fewer frames.')
    if (!node || typeof node !== 'object' || typeof node.type !== 'string' || typeof node.id !== 'string') invalid()
    for (const key of ['name', 'characters']) if (node[key] !== undefined && typeof node[key] !== 'string') invalid()
    for (const key of ['children', 'fills', 'strokes']) if (node[key] !== undefined && !Array.isArray(node[key])) invalid()
    for (const paint of [...(node.fills || []), ...(node.strokes || [])]) if (!paint || typeof paint !== 'object') invalid()
    if (node.style !== undefined && (!node.style || typeof node.style !== 'object' || Array.isArray(node.style))) invalid()
    for (const child of node.children || []) stack.push({ node: child, depth: depth + 1 })
  }
  if (!payload.file.document.children?.length || payload.file.document.children.some(page => page.type !== 'CANVAS')) invalid()
  const result = parseFigmaDocument(payload.file)
  if (payload.previews !== undefined) {
    if (!Array.isArray(payload.previews) || payload.previews.length > 40) invalid()
    for (const preview of payload.previews) {
      if (!preview || typeof preview.id !== 'string' || typeof preview.name !== 'string' || typeof preview.page !== 'string' || !Number.isFinite(preview.width) || !Number.isFinite(preview.height) || preview.width <= 0 || preview.height <= 0 || typeof preview.data !== 'string' || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(preview.data) || preview.data.length > 7 * 1024 * 1024) invalid()
    }
    result.previews = payload.previews
  }
  if (payload.imageAssets !== undefined) {
    if (!Array.isArray(payload.imageAssets) || payload.imageAssets.some(item => !item || typeof item.name !== 'string' || typeof item.sectionId !== 'string')) invalid()
    result.imageAssets = payload.imageAssets
  }
  if (payload.previewWarnings !== undefined) {
    if (!Array.isArray(payload.previewWarnings) || payload.previewWarnings.some(item => typeof item !== 'string')) invalid()
    result.previewWarnings = payload.previewWarnings
  }
  result.insights.warnings.push('Imported from a Figma plugin selection. Content outside the selected layers is not included.')
  return result
}
