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
  result.insights.warnings.push('Imported from a Figma plugin selection. Content outside the selected layers is not included.')
  return result
}
